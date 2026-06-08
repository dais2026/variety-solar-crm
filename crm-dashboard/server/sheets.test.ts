import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ENV
vi.mock("./_core/env", () => ({
  ENV: {
    googleSheetsToken: "ya29.test-token-abc123-this-is-a-mock-google-oauth2-access-token-that-needs-to-be-longer-than-one-hundred-characters-to-pass-validation",
  },
  getGoogleToken: () => "ya29.test-token-abc123-this-is-a-mock-google-oauth2-access-token-that-needs-to-be-longer-than-one-hundred-characters-to-pass-validation",
}));

// Mock db functions
const mockInsertDeletedLead = vi.fn();
const mockGetDeletedLeads = vi.fn();
const mockRemoveDeletedLead = vi.fn();

vi.mock("./db", () => ({
  insertDeletedLead: (...args: any[]) => mockInsertDeletedLead(...args),
  getDeletedLeads: (...args: any[]) => mockGetDeletedLeads(...args),
  removeDeletedLead: (...args: any[]) => mockRemoveDeletedLead(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Sheets Router - appendCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertDeletedLead.mockResolvedValue(undefined);
    mockGetDeletedLeads.mockResolvedValue([]);
    mockRemoveDeletedLead.mockResolvedValue(undefined);
  });

  it("should call Google Sheets API with correct URL and payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        updates: {
          updatedRange: "LEADS MAY26!A23:X23",
          updatedRows: 1,
        },
      }),
    });

    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    const result = await caller.sheets.appendCustomer({
      dateStamp: "02.06.26",
      name: "John Smith",
      contactNumber: "0412345678",
      email: "john@example.com",
      address: "123 Test St",
      outcome: "Awaiting Information",
      leadSource: "Solar Quotes",
      status: "",
      product: "PV+BATT",
      saleStatus: "Pending",
      notes: "Test note",
      svr: "SVR-Yes",
      phases: "1",
      rooftopSolar: "Yes",
      hotWater: "Gas",
      heatingCooling: "Split",
      cooktop: "Gas",
      vppNightUse: "Yes",
      ev: "No",
      brands: "Tesla",
      size: "10kW",
    });

    expect(result.success).toBe(true);
    expect(result.updatedRows).toBe(1);

    // Verify fetch was called with correct URL
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("sheets.googleapis.com");
    expect(url).toContain("1oVFGomjgmbYlX7YJUFWKH0-1snrjCkcBsUC6AW4rmgA");
    expect(url).toContain("LEADS%20MAY26");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer ya29.test-token-abc123-this-is-a-mock-google-oauth2-access-token-that-needs-to-be-longer-than-one-hundred-characters-to-pass-validation");

    // Verify the body contains the row data in correct order
    const body = JSON.parse(options.body);
    expect(body.values[0][0]).toBe("02.06.26");
    expect(body.values[0][1]).toBe("John Smith");
    expect(body.values[0][2]).toBe("0412345678");
    expect(body.values[0][3]).toBe("john@example.com");
  });

  it("should throw error when API returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    await expect(
      caller.sheets.appendCustomer({
        dateStamp: "02.06.26",
        name: "John Smith",
        contactNumber: "0412345678",
        email: "john@example.com",
        address: "123 Test St",
        outcome: "Awaiting Information",
        leadSource: "Solar Quotes",
        status: "",
        product: "PV+BATT",
        saleStatus: "Pending",
        notes: "",
        svr: "",
        phases: "",
        rooftopSolar: "",
        hotWater: "",
        heatingCooling: "",
        cooktop: "",
        vppNightUse: "",
        ev: "",
        brands: "",
        size: "",
      })
    ).rejects.toThrow();
  });

  it("should reject when name is empty", async () => {
    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    await expect(
      caller.sheets.appendCustomer({
        dateStamp: "02.06.26",
        name: "",
        contactNumber: "0412345678",
        email: "john@example.com",
        address: "123 Test St",
        outcome: "Awaiting Information",
        leadSource: "Solar Quotes",
        status: "",
        product: "PV+BATT",
        saleStatus: "Pending",
        notes: "",
        svr: "",
        phases: "",
        rooftopSolar: "",
        hotWater: "",
        heatingCooling: "",
        cooktop: "",
        vppNightUse: "",
        ev: "",
        brands: "",
        size: "",
      })
    ).rejects.toThrow();
  });
});

describe("Sheets Router - getLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch leads from Google Sheets CSV export and return parsed data", async () => {
    const csvContent = `DATE STAMP,Name,Contact Number,Email Address,Address,Lead Source,Product,Discovery,Status,Sale Status,NOTES,COSTS,SVR,Phases,Rooftop Solar,Hot Water,Heating Cooling,Cooktop,Product,VPP-NIGHT USE,EV,Brands,SIZE\n26.05.26,Charitha Parimi,0420 823 459,c.parimi@test.com,"43 Clara Avenue, Truganina Vic 3029",Solar Quotes,PV+BATT,Awaiting Information,,Pending,Test note,,SVR-Yes,1,Yes,Gas,Split,Gas,,Yes,No,Tesla,10kW\n27.05.26,John Smith,0412 345 678,john@test.com,"10 Main St, Melbourne Vic 3000",Referral,PV,Quote Received,,Pending,,,,,Yes,Electric,Ducted,Electric,,No,Yes,Enphase,6.6kW`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => csvContent,
    });

    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    const result = await caller.sheets.getLeads();

    expect(result.leads).toHaveLength(2);
    expect(result.leads[0].name).toBe("Charitha Parimi");
    expect(result.leads[0].contactNumber).toBe("0420 823 459");
    expect(result.leads[0].dateStamp).toBe("26.05.26");
    expect(result.leads[0].outcome).toBe("Awaiting Information");
    expect(result.leads[1].name).toBe("John Smith");
    expect(result.leads[1].product).toBe("PV");

    // Verify fetch was called with the CSV export URL (no auth needed)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("docs.google.com/spreadsheets");
    expect(url).toContain("export?format=csv");
    expect(url).toContain("1oVFGomjgmbYlX7YJUFWKH0-1snrjCkcBsUC6AW4rmgA");
  });

  it("should skip empty rows and header-like rows", async () => {
    const csvContent = `DATE STAMP,Name,Contact Number\n26.05.26,Valid Lead,0420 000 000\n,,\n27.05.26,Another Lead,0412 111 222`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => csvContent,
    });

    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    const result = await caller.sheets.getLeads();

    expect(result.leads).toHaveLength(2);
    expect(result.leads[0].name).toBe("Valid Lead");
    expect(result.leads[1].name).toBe("Another Lead");
  });

  it("should throw error when API returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    await expect(caller.sheets.getLeads()).rejects.toThrow();
  });
});

describe("Sheets Router - deleteLead (soft delete)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertDeletedLead.mockResolvedValue(undefined);
    mockGetDeletedLeads.mockResolvedValue([]);
    mockRemoveDeletedLead.mockResolvedValue(undefined);
  });

  it("should soft-delete a lead by inserting into deleted_leads table", async () => {
    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    const result = await caller.sheets.deleteLead({
      name: "John Smith",
      contactNumber: "0412345678",
    });

    expect(result.success).toBe(true);
    expect(mockInsertDeletedLead).toHaveBeenCalledTimes(1);
    expect(mockInsertDeletedLead).toHaveBeenCalledWith({
      leadName: "John Smith",
      leadPhone: "0412345678",
      deletedAt: expect.any(Number),
    });
  });

  it("should return deleted leads list", async () => {
    mockGetDeletedLeads.mockResolvedValue([
      { leadName: "Jane Doe", leadPhone: "0400111222" },
    ]);

    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    const result = await caller.sheets.getDeletedLeads();
    expect(result).toEqual([{ leadName: "Jane Doe", leadPhone: "0400111222" }]);
    expect(mockGetDeletedLeads).toHaveBeenCalledTimes(1);
  });

  it("should restore a deleted lead", async () => {
    const { sheetsRouter } = await import("./routers/sheets");
    const { router } = await import("./_core/trpc");
    const appRouter = router({ sheets: sheetsRouter });
    const caller = appRouter.createCaller({} as any);

    const result = await caller.sheets.restoreLead({
      name: "Jane Doe",
      contactNumber: "0400111222",
    });

    expect(result.success).toBe(true);
    expect(mockRemoveDeletedLead).toHaveBeenCalledWith("Jane Doe", "0400111222");
  });
});
