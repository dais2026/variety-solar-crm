import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  insertClosedSale,
  getClosedSales,
  getClosedSaleById,
  updateClosedSale,
  getClosedSaleByLeadPhone,
  getClosedSalesCount,
  getPendingPylonSales,
  getClosedSaleByPylonRef,
} from "../db";
import { notifyOwner } from "../_core/notification";
import { parsePylonPdf, extractPdfText } from "../scheduledPylonSales";
import { storagePut } from "../storage";

const closedSaleInput = z.object({
  // Customer Information
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().min(1, "Phone number is required"),
  installAddress: z.string().min(1, "Installation address is required"),
  postalAddress: z.string().optional(),
  nmi: z.string().optional(),
  meterNumber: z.string().optional(),
  currentRetailer: z.string().optional(),
  distributor: z.string().optional(),
  existingSolar: z.enum(["yes", "no"]).optional(),
  propertyType: z.enum(["house", "townhouse", "unit", "commercial"]).optional(),
  roofType: z.enum(["tile", "colorbond", "flat", "klip-lok", "other"]).optional(),
  phases: z.enum(["1-phase", "2-phase", "3-phase"]).optional(),

  // System Specification
  systemSizeDc: z.string().optional(),
  systemSizeAc: z.string().optional(),
  panelBrand: z.string().optional(),
  panelModel: z.string().optional(),
  panelQuantity: z.number().int().positive().optional(),
  panelWattage: z.number().int().positive().optional(),
  inverterBrand: z.string().optional(),
  inverterModel: z.string().optional(),
  inverterQuantity: z.number().int().positive().optional(),
  batteryBrand: z.string().optional(),
  batteryModel: z.string().optional(),
  batteryCapacityKwh: z.string().optional(),
  batteryQuantity: z.number().int().positive().optional(),
  optimisers: z.string().optional(),
  mountingType: z.enum(["roof", "ground", "tilt-frame"]).optional(),
  exportLimitKw: z.string().optional(),
  evCharger: z.string().optional(),
  hotWaterSystem: z.string().optional(),
  additionalProducts: z.string().optional(),

  // Financial Information
  totalContractPrice: z.string().min(1, "Contract price is required"),
  depositAmount: z.string().optional(),
  depositPaid: z.enum(["yes", "no"]).optional(),
  depositDate: z.number().optional(),
  paymentMethod: z.enum(["cash", "finance", "green-loan", "interest-free", "mixed"]).optional(),
  financeProvider: z.string().optional(),
  financeAmount: z.string().optional(),
  financeTerm: z.string().optional(),
  stcRebateValue: z.string().optional(),
  numberOfStcs: z.number().int().optional(),
  pricePerWatt: z.string().optional(),
  balanceDue: z.string().optional(),
  paymentSchedule: z.string().optional(),

  // Contract & Compliance
  contractSignedDate: z.number().min(1, "Contract signed date is required"),
  contractDocumentUrl: z.string().optional(),
  coolingOffExpiry: z.number().optional(),
  cecInstaller: z.string().optional(),
  cecDesigner: z.string().optional(),
  warrantyWorkmanshipYears: z.number().int().optional(),
  warrantyPanelProductYears: z.number().int().optional(),
  warrantyInverterYears: z.number().int().optional(),
  warrantyBatteryYears: z.number().int().optional(),

  // Site & Technical Details
  roofOrientation: z.string().optional(),
  roofPitch: z.number().int().optional(),
  shadingAssessment: z.string().optional(),
  switchboardCondition: z.enum(["good", "needs-upgrade", "asbestos"]).optional(),
  switchboardUpgrade: z.enum(["yes", "no"]).optional(),
  cableRunMetres: z.number().int().optional(),
  trenchingRequired: z.enum(["yes", "no"]).optional(),
  annualProductionEstimate: z.number().int().optional(),
  energyOffsetPercent: z.number().int().optional(),

  // Sales Attribution
  dealOwner: z.string().optional(),
  leadSource: z.string().optional(),
  closedWonReason: z.string().optional(),
  daysInPipeline: z.number().int().optional(),
  proposalsSent: z.number().int().optional(),
  referralSource: z.string().optional(),

  // Notes & Link
  notes: z.string().optional(),
  leadPhone: z.string().optional(),
});

export const closedSalesRouter = router({
  create: publicProcedure
    .input(closedSaleInput)
    .mutation(async ({ input, ctx }) => {
      const now = Date.now();

      // Auto-calculate cooling-off expiry (10 business days from contract signed)
      let coolingOffExpiry = input.coolingOffExpiry;
      if (!coolingOffExpiry && input.contractSignedDate) {
        const signedDate = new Date(input.contractSignedDate);
        let businessDays = 0;
        const date = new Date(signedDate);
        while (businessDays < 10) {
          date.setDate(date.getDate() + 1);
          const day = date.getDay();
          if (day !== 0 && day !== 6) businessDays++;
        }
        coolingOffExpiry = date.getTime();
      }

      // Auto-calculate price per watt if system size and price provided
      let pricePerWatt = input.pricePerWatt;
      if (!pricePerWatt && input.totalContractPrice && input.systemSizeDc) {
        const price = parseFloat(input.totalContractPrice);
        const sizeKw = parseFloat(input.systemSizeDc);
        if (price > 0 && sizeKw > 0) {
          pricePerWatt = (price / (sizeKw * 1000)).toFixed(2);
        }
      }

      // Auto-calculate balance due
      let balanceDue = input.balanceDue;
      if (!balanceDue && input.totalContractPrice) {
        const total = parseFloat(input.totalContractPrice);
        const deposit = input.depositAmount ? parseFloat(input.depositAmount) : 0;
        const stc = input.stcRebateValue ? parseFloat(input.stcRebateValue) : 0;
        balanceDue = (total - deposit - stc).toFixed(2);
      }

      const id = await insertClosedSale({
        ...input,
        customerEmail: input.customerEmail || null,
        coolingOffExpiry: coolingOffExpiry ?? null,
        pricePerWatt: pricePerWatt ?? null,
        balanceDue: balanceDue ?? null,
        projectStatus: "contract-signed",
        userId: ctx.user?.id ?? null,
        createdAt: now,
        updatedAt: now,
      });

      if (!id) {
        return { success: true, id: 0 };
      }

      const record = await getClosedSaleById(id);

      // Notify owner of new closed sale (fire-and-forget, non-blocking)
      notifyOwner({
        title: `New Sale Closed: ${input.customerName}`,
        content: `Deal closed for ${input.customerName} at ${input.installAddress}.\nContract value: $${parseFloat(input.totalContractPrice).toLocaleString()}\nSystem: ${input.systemSizeDc ? input.systemSizeDc + 'kW' : 'TBD'} ${input.batteryBrand || ''} ${input.batteryModel || ''}\nPayment: ${input.paymentMethod}\nStatus: Contract Signed`,
      }).catch((e) => {
        console.warn('[ClosedSales] Owner notification failed:', e);
      });

      return { success: true, id, ...record };
    }),

  list: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const [sales, total] = await Promise.all([
        getClosedSales(limit, offset),
        getClosedSalesCount(),
      ]);
      return { sales, total };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      return getClosedSaleById(input.id);
    }),

  getByLeadPhone: publicProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => {
      return getClosedSaleByLeadPhone(input.phone);
    }),

  pendingPylonReview: publicProcedure
    .query(async () => {
      const sales = await getPendingPylonSales();
      return { sales, count: sales.length };
    }),

  confirmPylonSale: publicProcedure
    .input(z.object({
      id: z.number().int(),
      data: closedSaleInput.partial(),
    }))
    .mutation(async ({ input }) => {
      // Update the sale with any user edits and change status to contract-signed
      await updateClosedSale(input.id, {
        ...input.data,
        projectStatus: "contract-signed",
        updatedAt: Date.now(),
      });
      const record = await getClosedSaleById(input.id);

      // Notify owner of confirmed sale
      if (record) {
        notifyOwner({
          title: `\u2705 Sale Confirmed: ${record.customerName}`,
          content: `Pylon sale reviewed and confirmed.\n\nCustomer: ${record.customerName}\nAddress: ${record.installAddress}\nTotal: $${parseFloat(record.totalContractPrice).toLocaleString()}\nRef: ${record.pylonReference || 'N/A'}`,
        }).catch((e) => {
          console.warn('[ClosedSales] Confirm notification failed:', e);
        });
      }

      return { success: true, ...record };
    }),

  dismissPylonSale: publicProcedure
    .input(z.object({
      id: z.number().int(),
    }))
    .mutation(async ({ input }) => {
      // Dismiss a pending Pylon sale - delete the draft record
      await updateClosedSale(input.id, {
        projectStatus: "dismissed",
        updatedAt: Date.now(),
      });
      return { success: true, id: input.id };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number().int(),
      data: closedSaleInput.partial().extend({
        projectStatus: z.enum([
          "pylon-pending-review",
          "dismissed",
          "contract-signed",
          "cooling-off",
          "pre-installation",
          "dnsp-applied",
          "dnsp-approved",
          "permit-applied",
          "permit-approved",
          "scheduled",
          "installation",
          "inspection",
          "commissioning",
          "pto-received",
          "complete",
        ]).optional(),
        scheduledInstallDate: z.number().optional(),
        installCompleteDate: z.number().optional(),
        ptoDate: z.number().optional(),
        finalPaymentReceived: z.enum(["yes", "no"]).optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      await updateClosedSale(input.id, {
        ...input.data,
        updatedAt: Date.now(),
      });
      const record = await getClosedSaleById(input.id);
      return { success: true, ...record };
    }),

  bulkPylonImport: publicProcedure
    .input(z.object({
      files: z.array(z.object({
        filename: z.string(),
        base64: z.string(),
      })).min(1).max(20),
    }))
    .mutation(async ({ input }) => {
      const results: { filename: string; success: boolean; customerName?: string; error?: string; id?: number }[] = [];

      for (const file of input.files) {
        try {
          // Decode base64 to buffer
          const pdfBuffer = Buffer.from(file.base64, "base64");

          // Extract text from PDF
          const pdfText = await extractPdfText(pdfBuffer);
          if (!pdfText) {
            results.push({ filename: file.filename, success: false, error: "Failed to extract text from PDF" });
            continue;
          }

          // Parse the PDF content
          const saleData = parsePylonPdf(pdfText, file.filename);
          if (!saleData) {
            results.push({ filename: file.filename, success: false, error: "Failed to parse sale data — no Pylon reference found" });
            continue;
          }

          // Check for duplicates
          const existing = await getClosedSaleByPylonRef(saleData.pylonReference);
          if (existing) {
            results.push({ filename: file.filename, success: false, customerName: saleData.customerName, error: `Duplicate — already exists (ref: ${saleData.pylonReference})` });
            continue;
          }

          // Upload PDF to S3 storage
          let contractDocumentUrl = "";
          try {
            const storageKey = `pylon-contracts/${saleData.pylonReference.replace(/[^a-zA-Z0-9-]/g, "_")}_${saleData.customerName.replace(/\s+/g, "_")}.pdf`;
            const { url } = await storagePut(storageKey, pdfBuffer, "application/pdf");
            contractDocumentUrl = url;
          } catch (storageErr) {
            console.error("[BulkPylon] Failed to upload PDF to storage:", storageErr);
          }

          // Calculate balance due
          const balanceDue = saleData.totalContractPrice - saleData.depositAmount;

          // Insert closed sale with pylon-pending-review status
          const now = Date.now();
          const saleId = await insertClosedSale({
            customerName: saleData.customerName,
            customerEmail: saleData.customerEmail || undefined,
            customerPhone: saleData.customerPhone,
            installAddress: saleData.installAddress,
            systemSizeDc: saleData.systemSizeDc?.toString() || undefined,
            panelBrand: saleData.panelBrand || undefined,
            panelModel: saleData.panelModel || undefined,
            panelQuantity: saleData.panelQuantity || undefined,
            panelWattage: saleData.panelWattage || undefined,
            inverterBrand: saleData.inverterBrand || undefined,
            inverterModel: saleData.inverterModel || undefined,
            inverterQuantity: saleData.inverterQuantity || 1,
            batteryBrand: saleData.batteryBrand || undefined,
            batteryModel: saleData.batteryModel || undefined,
            batteryCapacityKwh: saleData.batteryCapacityKwh?.toString() || undefined,
            batteryQuantity: saleData.batteryQuantity || undefined,
            totalContractPrice: saleData.totalContractPrice.toString(),
            depositAmount: saleData.depositAmount.toString(),
            depositPaid: "yes",
            depositDate: saleData.contractSignedDate,
            numberOfStcs: saleData.numberOfStcs || undefined,
            stcRebateValue: saleData.stcRebateValue?.toString() || undefined,
            balanceDue: balanceDue.toString(),
            pylonReference: saleData.pylonReference,
            contractSignedDate: saleData.contractSignedDate,
            contractDocumentUrl: contractDocumentUrl || undefined,
            annualProductionEstimate: saleData.annualProductionEstimate || undefined,
            phases: saleData.phases,
            projectStatus: "pylon-pending-review",
            dealOwner: "George Fotopoulos",
            leadSource: "Pylon",
            leadPhone: saleData.customerPhone,
            createdAt: now,
            updatedAt: now,
          });

          results.push({ filename: file.filename, success: true, customerName: saleData.customerName, id: saleId || undefined });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          results.push({ filename: file.filename, success: false, error: errMsg });
        }
      }

      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        notifyOwner({
          title: `📋 ${successCount} Pylon PDF${successCount > 1 ? 's' : ''} Imported (Pending Review)`,
          content: `Bulk import completed: ${successCount} new sale${successCount > 1 ? 's' : ''} pending review.\n\n${results.filter(r => r.success).map(r => `• ${r.customerName}`).join('\n')}`,
        }).catch(() => {});
      }

      return { results, total: input.files.length, success: successCount, failed: input.files.length - successCount };
    }),
});
