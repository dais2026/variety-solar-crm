import Imap from "imap";
import { simpleParser } from "mailparser";
import { ENV, getGoogleToken } from "./_core/env";
import { insertClosedSale, getClosedSaleByPylonRef } from "./db";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";

// ─── PDF Parsing ────────────────────────────────────────────────────────────

/**
 * Extract structured sale data from a Pylon signed proposal PDF text content.
 */
export function parsePylonPdf(text: string, filename: string): PylonSaleData | null {
  try {
    // Extract reference number from filename or text
    const refFromFilename = filename.match(/##-[\d-]+/)?.[0] || "";
    const refFromText = text.match(/Reference #:\s*(##-[\d-]+)/)?.[1] || "";
    const pylonReference = refFromFilename || refFromText;

    if (!pylonReference) {
      console.warn("[PylonSales] No reference number found in PDF");
      return null;
    }

    // Extract customer name — appears after "ADDRESSED TO:"
    const nameMatch = text.match(/ADDRESSED TO:\s*\n\s*(.+)/i);
    const customerName = nameMatch?.[1]?.trim() || "";

    // Extract phone — line after name (digits pattern)
    const phoneMatch = text.match(/ADDRESSED TO:\s*\n\s*.+\n\s*([\d\s]+)/i);
    const customerPhone = phoneMatch?.[1]?.trim().replace(/\s+/g, " ") || "";

    // Extract email
    const emailMatch = text.match(/ADDRESSED TO:[\s\S]*?([\w.-]+@[\w.-]+\.\w+)/i);
    const customerEmail = emailMatch?.[1]?.trim() || "";

    // Extract address — lines after email until "Prepared by"
    const addressSection = text.match(/ADDRESSED TO:[\s\S]*?[\w.-]+@[\w.-]+\.\w+\s*\n([\s\S]*?)(?=Prepared by)/i);
    let installAddress = "";
    if (addressSection?.[1]) {
      installAddress = addressSection[1]
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join(", ");
    }

    // Fallback: extract address from filename
    if (!installAddress) {
      const addrFromFilename = filename.match(/at\s+(.+?)\s+\(##/i);
      if (addrFromFilename) {
        installAddress = addrFromFilename[1].trim();
      }
    }

    // Extract system size
    const systemSizeMatch = text.match(/([\d.]+)\s*kW(?:DC)?\s*\(STC\)/i) ||
      text.match(/([\d.]+)kW\s+SOLAR\s+SYSTEM/i);
    const systemSizeDc = systemSizeMatch ? parseFloat(systemSizeMatch[1]) : null;

    // Extract battery capacity
    const batteryCapMatch = text.match(/([\d.]+)\s*kWh\s+BATTERY\s+STORAGE/i) ||
      text.match(/Battery size\s*\n?\s*([\d.]+)\s*kWh/i);
    const batteryCapacityKwh = batteryCapMatch ? parseFloat(batteryCapMatch[1]) : null;

    // Extract panel info
    const panelMatch = text.match(/(\d+)\s*×\s*(\d+)W\s+(.+?)(?:\s*·|\n)/i);
    const panelQuantity = panelMatch ? parseInt(panelMatch[1]) : null;
    const panelWattage = panelMatch ? parseInt(panelMatch[2]) : null;
    const panelBrandModel = panelMatch?.[3]?.trim() || "";
    const panelBrand = panelBrandModel.split(" ")[0] || "";
    const panelModel = panelBrandModel;

    // Extract inverter info
    const inverterMatch = text.match(/(\d+)\s*×\s*(.+?)\s*\(AS4777/i) ||
      text.match(/Inverter\s*\n\s*(\d+)\s*×\s*(.+?)(?:\s*·|\n)/i);
    const inverterQuantity = inverterMatch ? parseInt(inverterMatch[1]) : 1;
    const inverterModel = inverterMatch?.[2]?.trim() || "";
    const inverterBrand = inverterModel.split(" ")[0] || "";

    // Extract battery model info
    const batteryModelMatch = text.match(/Battery storage[\s\S]*?(\d+)\s*×\s*(.+?)\s*·\s*([\d.]+)kWh/i);
    const batteryQuantity = batteryModelMatch ? parseInt(batteryModelMatch[1]) : null;
    const batteryModel = batteryModelMatch?.[2]?.trim() || "";
    const batteryBrand = batteryModel.split(" ")[0] || "";

    // Extract annual production estimate
    const productionMatch = text.match(/Estimated annual production\s*\n?\s*([\d,]+)\s*kWh/i);
    const annualProductionEstimate = productionMatch
      ? parseInt(productionMatch[1].replace(/,/g, ""))
      : null;

    // Extract total price (Total incl. GST)
    const totalMatch = text.match(/Total incl\. GST\s*\n?\s*\$([\d,]+\.?\d*)/i);
    const totalContractPrice = totalMatch
      ? parseFloat(totalMatch[1].replace(/,/g, ""))
      : 0;

    // Extract deposit
    const depositMatch = text.match(/(\d+)%\s*\(\$([\d,]+\.?\d*)\)\s*deposit/i);
    const depositPercent = depositMatch ? parseInt(depositMatch[1]) : 20;
    const depositAmount = depositMatch
      ? parseFloat(depositMatch[2].replace(/,/g, ""))
      : totalContractPrice * 0.2;

    // Extract STCs
    const stcMatch = text.match(/(\d+)\s*STCs?\s*×\s*\$([\d.]+)/i);
    const numberOfStcs = stcMatch ? parseInt(stcMatch[1]) : null;
    const stcRebateValue = stcMatch
      ? parseInt(stcMatch[1]) * parseFloat(stcMatch[2])
      : null;

    // Extract signed date
    const signedMatch = text.match(/Signed:\s*([\d/]+)\s+([\d:]+)/i);
    let contractSignedDate = Date.now();
    if (signedMatch) {
      const dateStr = signedMatch[1].replace(/\//g, "-") + "T" + signedMatch[2] + ":00Z";
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        contractSignedDate = parsed.getTime();
      }
    }

    // Extract phases
    const phasesMatch = text.match(/Single phase|Three phase|Two phase/i);
    let phases: "1-phase" | "2-phase" | "3-phase" = "1-phase";
    if (phasesMatch) {
      if (phasesMatch[0].toLowerCase().includes("three")) phases = "3-phase";
      else if (phasesMatch[0].toLowerCase().includes("two")) phases = "2-phase";
    }

    return {
      pylonReference,
      customerName,
      customerPhone,
      customerEmail,
      installAddress,
      systemSizeDc,
      batteryCapacityKwh,
      panelBrand,
      panelModel,
      panelQuantity,
      panelWattage,
      inverterBrand,
      inverterModel,
      inverterQuantity,
      batteryBrand,
      batteryModel,
      batteryQuantity,
      annualProductionEstimate,
      totalContractPrice,
      depositAmount,
      numberOfStcs,
      stcRebateValue,
      contractSignedDate,
      phases,
    };
  } catch (err) {
    console.error("[PylonSales] Error parsing PDF:", err);
    return null;
  }
}

export interface PylonSaleData {
  pylonReference: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  installAddress: string;
  systemSizeDc: number | null;
  batteryCapacityKwh: number | null;
  panelBrand: string;
  panelModel: string;
  panelQuantity: number | null;
  panelWattage: number | null;
  inverterBrand: string;
  inverterModel: string;
  inverterQuantity: number;
  batteryBrand: string;
  batteryModel: string;
  batteryQuantity: number | null;
  annualProductionEstimate: number | null;
  totalContractPrice: number;
  depositAmount: number;
  numberOfStcs: number | null;
  stcRebateValue: number | null;
  contractSignedDate: number;
  phases: "1-phase" | "2-phase" | "3-phase";
}

// ─── IMAP Fetch ─────────────────────────────────────────────────────────────

interface PylonEmail {
  uid: string;
  subject: string;
  customerName: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
  pdfText: string;
  receivedDate: string;
}

/**
 * Fetch Pylon "signed document" emails from Zoho IMAP.
 */
async function fetchPylonEmails(): Promise<PylonEmail[]> {
  const { zohoImapHost, zohoImapUser, zohoImapPassword } = ENV;

  if (!zohoImapUser || !zohoImapPassword) {
    throw new Error("IMAP credentials not configured");
  }

  return new Promise((resolve, reject) => {
    const emails: PylonEmail[] = [];

    const imap = new Imap({
      user: zohoImapUser,
      password: zohoImapPassword,
      host: zohoImapHost || "imappro.zoho.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) { imap.end(); reject(err); return; }

        // Search for Pylon signed document emails from last 7 days
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 7);
        const sinceDateStr = sinceDate.toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric"
        });

        imap.search(
          [["FROM", "pylon"], ["SINCE", sinceDateStr]],
          (err, results) => {
            if (err) { imap.end(); reject(err); return; }
            if (!results || results.length === 0) { imap.end(); resolve([]); return; }

            let pending = results.length;
            const f = imap.fetch(results, { bodies: "", struct: true });

            f.on("message", (msg) => {
              let buffer = "";
              msg.on("body", (stream) => {
                stream.on("data", (chunk: Buffer) => { buffer += chunk.toString("utf8"); });
                stream.on("end", async () => {
                  try {
                    const parsed = await simpleParser(buffer);
                    const subject = parsed.subject || "";

                    // Only process "signed their document" emails
                    if (!subject.toLowerCase().includes("signed their document")) {
                      pending--;
                      if (pending === 0) { imap.end(); resolve(emails); }
                      return;
                    }

                    // Extract customer name from subject
                    const nameMatch = subject.match(/^(.+?)\s+has signed their document/i);
                    const customerName = nameMatch?.[1]?.trim() || "";

                    // Find PDF attachment
                    const pdfAttachment = parsed.attachments?.find(
                      att => att.contentType === "application/pdf" || att.filename?.endsWith(".pdf")
                    );

                    if (pdfAttachment) {
                      emails.push({
                        uid: String(parsed.messageId || Date.now()),
                        subject,
                        customerName,
                        pdfBuffer: pdfAttachment.content,
                        pdfFilename: pdfAttachment.filename || "signed-proposal.pdf",
                        pdfText: "", // Will be extracted later
                        receivedDate: parsed.date?.toISOString() || new Date().toISOString(),
                      });
                    }
                  } catch (e) {
                    console.error("[PylonSales] Error parsing email:", e);
                  }
                  pending--;
                  if (pending === 0) { imap.end(); resolve(emails); }
                });
              });
            });

            f.once("error", (err) => { imap.end(); reject(err); });
            f.once("end", () => {
              // If no messages matched, resolve
              if (pending === 0) { imap.end(); resolve(emails); }
            });
          }
        );
      });
    });

    imap.once("error", (err: Error) => reject(err));
    imap.connect();
  });
}

/**
 * Extract text from PDF buffer using pdftotext equivalent (basic text extraction).
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  // Use a temporary approach: write to /tmp, run pdftotext, read result
  const { writeFileSync, readFileSync, unlinkSync } = await import("fs");
  const { execSync } = await import("child_process");
  const tmpPdf = `/tmp/pylon_${Date.now()}.pdf`;
  const tmpTxt = `/tmp/pylon_${Date.now()}.txt`;

  try {
    writeFileSync(tmpPdf, pdfBuffer);
    execSync(`pdftotext "${tmpPdf}" "${tmpTxt}"`, { timeout: 10000 });
    const text = readFileSync(tmpTxt, "utf-8");
    return text;
  } catch (err) {
    console.error("[PylonSales] pdftotext extraction failed:", err);
    return "";
  } finally {
    try { unlinkSync(tmpPdf); } catch {}
    try { unlinkSync(tmpTxt); } catch {}
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

/**
 * Heartbeat handler: Detect Pylon signed documents and create Closed Sale entries.
 */
export async function scheduledPylonSalesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      res.status(403).json({ error: "cron-only" });
      return;
    }

    console.log("[PylonSales] Starting Pylon signed document scan...");

    // Fetch Pylon emails
    let pylonEmails: PylonEmail[] = [];
    try {
      pylonEmails = await fetchPylonEmails();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[PylonSales] IMAP fetch failed:", errMsg);
      res.json({ ok: true, error: errMsg, processed: 0 });
      return;
    }

    console.log(`[PylonSales] Found ${pylonEmails.length} Pylon signed document email(s)`);

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const email of pylonEmails) {
      try {
        // Extract text from PDF
        const pdfText = await extractPdfText(email.pdfBuffer);
        if (!pdfText) {
          errors.push(`Failed to extract text from PDF: ${email.pdfFilename}`);
          continue;
        }

        // Parse the PDF content
        const saleData = parsePylonPdf(pdfText, email.pdfFilename);
        if (!saleData) {
          errors.push(`Failed to parse sale data from PDF: ${email.pdfFilename}`);
          continue;
        }

        // Check for duplicates
        const existing = await getClosedSaleByPylonRef(saleData.pylonReference);
        if (existing) {
          console.log(`[PylonSales] Skipping duplicate: ${saleData.pylonReference} (${saleData.customerName})`);
          skipped++;
          continue;
        }

        // Upload PDF to S3 storage
        let contractDocumentUrl = "";
        try {
          const storageKey = `pylon-contracts/${saleData.pylonReference.replace(/[^a-zA-Z0-9-]/g, "_")}_${saleData.customerName.replace(/\s+/g, "_")}.pdf`;
          const { url } = await storagePut(storageKey, email.pdfBuffer, "application/pdf");
          contractDocumentUrl = url;
        } catch (storageErr) {
          console.error("[PylonSales] Failed to upload PDF to storage:", storageErr);
          // Continue without the document URL — we still want the sale recorded
        }

        // Calculate balance due
        const balanceDue = saleData.totalContractPrice - saleData.depositAmount;

        // Insert closed sale
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

        if (saleId) {
          processed++;
          console.log(`[PylonSales] ✓ Created closed sale #${saleId}: ${saleData.customerName} (${saleData.pylonReference}) — $${saleData.totalContractPrice}`);

          // Notify owner of new Pylon sale pending review
          await notifyOwner({
            title: `📋 Pylon Sale Pending Review: ${saleData.customerName}`,
            content: `Pylon signed document received — please review in CRM before confirming.\n\nCustomer: ${saleData.customerName}\nAddress: ${saleData.installAddress}\nSystem: ${saleData.systemSizeDc}kW Solar + ${saleData.batteryCapacityKwh}kWh Battery\nTotal: $${saleData.totalContractPrice.toLocaleString()}\nDeposit: $${saleData.depositAmount.toLocaleString()}\nRef: ${saleData.pylonReference}`,
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Error processing ${email.customerName}: ${errMsg}`);
        console.error(`[PylonSales] Error processing ${email.customerName}:`, errMsg);
      }
    }

    console.log(`[PylonSales] Complete: ${processed} processed, ${skipped} skipped, ${errors.length} errors`);

    res.json({
      ok: true,
      processed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[PylonSales] Handler error:", errMsg);
    res.status(500).json({
      error: errMsg,
      stack: err instanceof Error ? err.stack : undefined,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
