import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module to prevent real database calls
vi.mock("./db", () => ({
  insertSmsLogBatch: vi.fn().mockResolvedValue(undefined),
  getSmsLogs: vi.fn().mockResolvedValue([]),
  getSmsLogCount: vi.fn().mockResolvedValue(0),
  getRecordingsForLead: vi.fn().mockResolvedValue([]),
  insertRecording: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateRecordingTranscript: vi.fn().mockResolvedValue(undefined),
  updateRecordingSummary: vi.fn().mockResolvedValue(undefined),
}));

// Mock the global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("sms router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("balance", () => {
    it("returns parsed balance when API responds with OK", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "OK: 435",
      });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.balance();

      expect(result).toEqual({ success: true, balance: 435 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api-adv.php")
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("action=balance")
      );
    });

    it("returns error when API responds with error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "ERROR: Invalid credentials",
      });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.balance();

      expect(result.success).toBe(false);
      expect(result.balance).toBe(0);
    });
  });

  describe("send", () => {
    it("sends SMS and parses OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "OK:0400000000:12345",
      });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.send({
        to: "0400000000",
        message: "Test message",
        from: "TestSender",
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        number: "0400000000",
        status: "ok",
        ref: "12345",
      });
      // Verify 'from' param is included when specified
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("from=TestSender");
    });

    it("sends without 'from' param when sender is blank (shared number pool)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "OK:0400000000:12345",
      });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.send({
        to: "0400000000",
        message: "Test message",
        from: "",
      });

      expect(result.success).toBe(true);
      // Verify 'from' param is NOT included when blank
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).not.toContain("from=");
    });

    it("handles BAD response from API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "BAD:0400000000:Invalid number",
      });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.send({
        to: "0400000000",
        message: "Test message",
        from: "TestSender",
      });

      expect(result.success).toBe(false);
      expect(result.results[0]).toEqual({
        number: "0400000000",
        status: "bad",
        reason: "Invalid number",
      });
    });

    it("rejects empty message", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.sms.send({
          to: "0400000000",
          message: "",
          from: "TestSender",
        })
      ).rejects.toThrow();
    });

    it("allows multi-part messages up to 320 characters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "OK:0400000000:12345",
      });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.send({
        to: "0400000000",
        message: "a".repeat(200),
        from: "TestSender",
      });

      expect(result.success).toBe(true);
      expect(result.parts).toBe(2);
      // Verify maxsplit param is sent
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("maxsplit=2");
    });

    it("rejects message over 320 characters", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.sms.send({
          to: "0400000000",
          message: "a".repeat(321),
          from: "TestSender",
        })
      ).rejects.toThrow();
    });
  });

  describe("bulkSend", () => {
    it("sends personalised messages to multiple recipients individually", async () => {
      // Each recipient gets their own API call
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "OK:0400000000:111",
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "OK:0400000001:222",
        });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.bulkSend({
        recipients: [
          { phone: "0400000000", name: "Alice" },
          { phone: "0400000001", name: "Bob" },
        ],
        message: "Hi {name}, this is a test.",
        from: "TestSender",
      });

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);

      // Verify each call was made individually with personalised message
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const firstCallUrl = mockFetch.mock.calls[0][0] as string;
      const secondCallUrl = mockFetch.mock.calls[1][0] as string;
      expect(firstCallUrl).toContain("message=Hi+Alice");
      expect(secondCallUrl).toContain("message=Hi+Bob");
    });

    it("handles mixed success and failure", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "OK:0400000000:111",
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "BAD:0400000001:Invalid",
        });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.bulkSend({
        recipients: [
          { phone: "0400000000", name: "Alice" },
          { phone: "0400000001", name: "Bob" },
        ],
        message: "Hi {name}, bulk test",
        from: "TestSender",
      });

      expect(result.success).toBe(false);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it("uses 'there' as fallback when name is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "OK:0400000000:111",
      });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      await caller.sms.bulkSend({
        recipients: [{ phone: "0400000000", name: "" }],
        message: "Hi {name}, test",
        from: "TestSender",
      });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("message=Hi+there");
    });

    it("returns personalMessage in results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "OK:0400000000:111",
      });

      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.sms.bulkSend({
        recipients: [{ phone: "0400000000", name: "George" }],
        message: "Hi {name}, your quote is ready.",
        from: "TestSender",
      });

      expect(result.results[0].personalMessage).toBe("Hi George, your quote is ready.");
      expect(result.results[0].name).toBe("George");
    });

    it("rejects empty recipients array", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.sms.bulkSend({
          recipients: [],
          message: "Test",
          from: "TestSender",
        })
      ).rejects.toThrow();
    });
  });
});
