import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "george@varietysolar.com.au",
    name: "George Fotopoulos",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("closedSales router", () => {
  describe("closedSales.create", () => {
    it("creates a closed sale with minimum required fields", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.closedSales.create({
        customerName: "Test Customer",
        customerPhone: "0412345678",
        installAddress: "123 Test St, Melbourne VIC 3000",
        totalContractPrice: "18500",
        contractSignedDate: Date.now(),
        paymentMethod: "cash",
        propertyType: "house",
        roofType: "colorbond",
        phases: "1-phase",
        existingSolar: "no",
        mountingType: "roof",
        depositPaid: "no",
        switchboardCondition: "good",
        switchboardUpgrade: "no",
        trenchingRequired: "no",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.customerName).toBe("Test Customer");
      expect(result.customerPhone).toBe("0412345678");
      expect(result.totalContractPrice).toBe("18500.00");
      expect(result.projectStatus).toBe("contract-signed");
      expect(result.coolingOffExpiry).toBeDefined();
      expect(result.balanceDue).toBeDefined();
    });

    it("creates a closed sale with full system details", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.closedSales.create({
        customerName: "Full Detail Customer",
        customerPhone: "0498765432",
        customerEmail: "full@test.com",
        installAddress: "456 Solar Ave, Sydney NSW 2000",
        totalContractPrice: "24000",
        contractSignedDate: Date.now(),
        paymentMethod: "finance",
        propertyType: "house",
        roofType: "tile",
        phases: "3-phase",
        existingSolar: "no",
        mountingType: "roof",
        depositPaid: "yes",
        depositAmount: "2000",
        depositDate: Date.now(),
        switchboardCondition: "good",
        switchboardUpgrade: "no",
        trenchingRequired: "no",
        systemSizeDc: "10.36",
        panelBrand: "Trina",
        panelModel: "Vertex S+",
        panelQuantity: 24,
        panelWattage: 440,
        inverterBrand: "Sigenergy",
        inverterModel: "SigenStor 8kW",
        inverterQuantity: 1,
        batteryBrand: "Sigenergy",
        batteryModel: "AI Hub 10kWh",
        batteryCapacityKwh: "10",
        batteryQuantity: 1,
        stcRebateValue: "3200",
        numberOfStcs: 85,
        financeProvider: "Plenti",
        financeAmount: "20000",
        financeTerm: "5 years",
        cecInstaller: "John Smith CEC-A12345",
        dealOwner: "George Fotopoulos",
        leadSource: "Solar Quotes",
        notes: "Great customer, very enthusiastic about solar",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.customerName).toBe("Full Detail Customer");
      expect(result.panelBrand).toBe("Trina");
      expect(result.batteryBrand).toBe("Sigenergy");
      expect(result.batteryCapacityKwh).toBe("10.00");
      expect(result.financeProvider).toBe("Plenti");
      expect(result.pricePerWatt).toBeDefined();
      // Price per watt should be 24000 / (10.36 * 1000) = ~2.32
      expect(parseFloat(result.pricePerWatt!)).toBeCloseTo(2.32, 1);
    });


  });

  describe("closedSales.list", () => {
    it("returns a list of closed sales", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.closedSales.list({ limit: 10, offset: 0 });

      expect(result).toBeDefined();
      expect(result.sales).toBeDefined();
      expect(Array.isArray(result.sales)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });


  });

  describe("closedSales.update", () => {
    it("updates the project status of a closed sale", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // First create a sale
      const created = await caller.closedSales.create({
        customerName: "Status Update Test",
        customerPhone: "0411111111",
        installAddress: "789 Update Rd",
        totalContractPrice: "15000",
        contractSignedDate: Date.now(),
        paymentMethod: "cash",
        propertyType: "house",
        roofType: "colorbond",
        phases: "1-phase",
        existingSolar: "no",
        mountingType: "roof",
        depositPaid: "no",
        switchboardCondition: "good",
        switchboardUpgrade: "no",
        trenchingRequired: "no",
      });

      // Then update its status
      const updated = await caller.closedSales.update({
        id: created.id,
        data: { projectStatus: "pre-installation" },
      });

      expect(updated).toBeDefined();
      expect(updated.projectStatus).toBe("pre-installation");
    });
  });

  describe("closedSales.getById", () => {
    it("retrieves a specific closed sale by ID", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // First create a sale
      const created = await caller.closedSales.create({
        customerName: "Get By ID Test",
        customerPhone: "0422222222",
        installAddress: "101 Fetch Lane",
        totalContractPrice: "20000",
        contractSignedDate: Date.now(),
        paymentMethod: "cash",
        propertyType: "townhouse",
        roofType: "tile",
        phases: "1-phase",
        existingSolar: "yes",
        mountingType: "roof",
        depositPaid: "no",
        switchboardCondition: "good",
        switchboardUpgrade: "no",
        trenchingRequired: "no",
      });

      // Then fetch it
      const fetched = await caller.closedSales.getById({ id: created.id });

      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.customerName).toBe("Get By ID Test");
      expect(fetched!.existingSolar).toBe("yes");
      expect(fetched!.propertyType).toBe("townhouse");
    });
  });
});
