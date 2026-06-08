import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock data
const mockTrackingRecords = [
  {
    id: 1,
    trackingId: "abc123def456",
    leadName: "Dave Collins",
    recipientEmail: "dave@example.com",
    subject: "Meeting Invite: Solar Consultation",
    emailType: "meeting_invite",
    sentAt: 1717480000000,
    openCount: 3,
    firstOpenedAt: 1717480100000,
    lastOpenedAt: 1717480300000,
    notificationDismissed: false,
  },
  {
    id: 2,
    trackingId: "xyz789ghi012",
    leadName: "Tom Zed",
    recipientEmail: "tom@example.com",
    subject: "Meeting Reminder: Solar Install",
    emailType: "meeting_reminder",
    sentAt: 1717470000000,
    openCount: 0,
    firstOpenedAt: null,
    lastOpenedAt: null,
    notificationDismissed: false,
  },
];

const mockOpenEvents = [
  {
    id: 1,
    trackingId: "abc123def456",
    openedAt: 1717480100000,
    ipAddress: "203.0.113.1",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
  },
  {
    id: 2,
    trackingId: "abc123def456",
    openedAt: 1717480200000,
    ipAddress: "203.0.113.1",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  },
  {
    id: 3,
    trackingId: "abc123def456",
    openedAt: 1717480300000,
    ipAddress: "198.51.100.5",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  },
];

// Mock the db module
vi.mock("./db", () => ({
  getEmailTrackingList: vi.fn(async (limit: number, offset: number) => {
    return mockTrackingRecords.slice(offset, offset + limit);
  }),
  getRecentEmailOpens: vi.fn(async () => {
    return mockTrackingRecords.filter(r => !r.notificationDismissed);
  }),
  getEmailOpensByTrackingId: vi.fn(async (trackingId: string) => {
    return mockOpenEvents.filter(e => e.trackingId === trackingId);
  }),
  dismissEmailOpenNotification: vi.fn(async () => {}),
  createEmailTracking: vi.fn(async () => {}),
  recordEmailOpen: vi.fn(async (trackingId: string) => {
    const record = mockTrackingRecords.find(r => r.trackingId === trackingId);
    if (!record) return null;
    return { leadName: record.leadName, subject: record.subject };
  }),
}));

// Mock notification to prevent real API calls
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async () => true),
}));

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sample-user",
      email: "george@varietysolar.com.au",
      name: "George Fotopoulos",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("Email Tracking Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("emailTracking.list", () => {
    it("returns all tracked emails with default pagination", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.emailTracking.list();

      expect(result.emails).toHaveLength(2);
      expect(result.emails[0].trackingId).toBe("abc123def456");
      expect(result.emails[0].leadName).toBe("Dave Collins");
      expect(result.emails[0].openCount).toBe(3);
      expect(result.emails[1].trackingId).toBe("xyz789ghi012");
      expect(result.emails[1].openCount).toBe(0);
    });

    it("respects limit and offset parameters", async () => {
      const { getEmailTrackingList } = await import("./db");
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      await caller.emailTracking.list({ limit: 10, offset: 1 });

      expect(getEmailTrackingList).toHaveBeenCalledWith(10, 1);
    });

    it("uses default limit of 50 and offset of 0 when no input provided", async () => {
      const { getEmailTrackingList } = await import("./db");
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      await caller.emailTracking.list();

      expect(getEmailTrackingList).toHaveBeenCalledWith(50, 0);
    });
  });

  describe("emailTracking.recentOpens", () => {
    it("returns only emails that have been opened", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.emailTracking.recentOpens();

      // Only Dave Collins has openCount > 0
      expect(result.opens).toHaveLength(1);
      expect(result.opens[0].leadName).toBe("Dave Collins");
      expect(result.opens[0].openCount).toBe(3);
      expect(result.count).toBe(1);
    });

    it("returns count matching the number of opened emails", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.emailTracking.recentOpens();

      expect(result.count).toBe(result.opens.length);
    });
  });

  describe("emailTracking.openDetails", () => {
    it("returns open events for a specific tracking ID", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.emailTracking.openDetails({
        trackingId: "abc123def456",
      });

      expect(result.opens).toHaveLength(3);
      expect(result.opens[0].ipAddress).toBe("203.0.113.1");
      expect(result.opens[2].ipAddress).toBe("198.51.100.5");
    });

    it("returns empty array for unknown tracking ID", async () => {
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.emailTracking.openDetails({
        trackingId: "nonexistent",
      });

      expect(result.opens).toHaveLength(0);
    });
  });

  describe("emailTracking.dismissNotification", () => {
    it("calls dismissEmailOpenNotification and returns success", async () => {
      const { dismissEmailOpenNotification } = await import("./db");
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.emailTracking.dismissNotification({
        trackingId: "abc123def456",
      });

      expect(result.success).toBe(true);
      expect(dismissEmailOpenNotification).toHaveBeenCalledWith("abc123def456");
    });

    it("calls dismiss with the correct tracking ID", async () => {
      const { dismissEmailOpenNotification } = await import("./db");
      const ctx = createContext();
      const caller = appRouter.createCaller(ctx);

      await caller.emailTracking.dismissNotification({
        trackingId: "xyz789ghi012",
      });

      expect(dismissEmailOpenNotification).toHaveBeenCalledWith("xyz789ghi012");
    });
  });
});

describe("Email Tracking Helpers", () => {
  describe("createTrackingPixel", () => {
    it("creates a tracking record and returns a tracking ID", async () => {
      const { createTrackingPixel } = await import("./emailTracking");
      const { createEmailTracking } = await import("./db");

      const trackingId = await createTrackingPixel({
        leadName: "Test Lead",
        recipientEmail: "test@example.com",
        subject: "Test Subject",
        emailType: "meeting_invite",
      });

      expect(trackingId).toBeTruthy();
      expect(typeof trackingId).toBe("string");
      expect(trackingId.length).toBe(32); // 16 bytes hex = 32 chars
      expect(createEmailTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingId,
          leadName: "Test Lead",
          recipientEmail: "test@example.com",
          subject: "Test Subject",
          emailType: "meeting_invite",
          openCount: 0,
          notificationDismissed: false,
        })
      );
    });

    it("generates unique tracking IDs for each call", async () => {
      const { createTrackingPixel } = await import("./emailTracking");

      const id1 = await createTrackingPixel({
        leadName: "Lead 1",
        recipientEmail: "lead1@example.com",
        subject: "Subject 1",
      });

      const id2 = await createTrackingPixel({
        leadName: "Lead 2",
        recipientEmail: "lead2@example.com",
        subject: "Subject 2",
      });

      expect(id1).not.toBe(id2);
    });

    it("defaults emailType to 'general' when not specified", async () => {
      const { createTrackingPixel } = await import("./emailTracking");
      const { createEmailTracking } = await import("./db");

      await createTrackingPixel({
        leadName: "Test Lead",
        recipientEmail: "test@example.com",
        subject: "Test Subject",
      });

      expect(createEmailTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          emailType: "general",
        })
      );
    });
  });

  describe("getTrackingPixelHtml", () => {
    it("returns an img tag with the correct tracking URL", async () => {
      const { getTrackingPixelHtml } = await import("./emailTracking");

      const html = getTrackingPixelHtml("test-tracking-id", "https://example.com");

      expect(html).toContain("https://example.com/api/track/test-tracking-id.png");
      expect(html).toContain('width="1"');
      expect(html).toContain('height="1"');
      expect(html).toContain('style="display:none');
    });

    it("uses the provided base URL correctly", async () => {
      const { getTrackingPixelHtml } = await import("./emailTracking");

      const html = getTrackingPixelHtml("abc123", "https://varietysolar-gfcrm.manus.space");

      expect(html).toContain("https://varietysolar-gfcrm.manus.space/api/track/abc123.png");
    });
  });

  describe("trackingPixelHandler", () => {
    it("returns a 1x1 PNG pixel with correct headers", async () => {
      const { trackingPixelHandler } = await import("./emailTracking");

      const req = {
        params: { trackingId: "abc123def456.png" },
        headers: {
          "x-forwarded-for": "203.0.113.1",
          "user-agent": "Mozilla/5.0 Test",
        },
        socket: { remoteAddress: "127.0.0.1" },
      } as any;

      const headers: Record<string, string> = {};
      let statusCode = 0;
      let sentBody: Buffer | null = null;

      const res = {
        set: (h: Record<string, string>) => {
          Object.assign(headers, h);
        },
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        send: (body: Buffer) => {
          sentBody = body;
        },
      } as any;

      await trackingPixelHandler(req, res);

      expect(statusCode).toBe(200);
      expect(headers["Content-Type"]).toBe("image/png");
      expect(headers["Cache-Control"]).toContain("no-store");
      expect(sentBody).toBeInstanceOf(Buffer);
      expect(sentBody!.length).toBeGreaterThan(0);
    });

    it("records the email open event", async () => {
      const { trackingPixelHandler } = await import("./emailTracking");
      const { recordEmailOpen } = await import("./db");

      const req = {
        params: { trackingId: "abc123def456.png" },
        headers: {
          "x-forwarded-for": "203.0.113.1",
          "user-agent": "Mozilla/5.0 Test",
        },
        socket: { remoteAddress: "127.0.0.1" },
      } as any;

      const res = {
        set: () => {},
        status: () => res,
        send: () => {},
      } as any;

      await trackingPixelHandler(req, res);

      // The handler strips .png from the param
      expect(recordEmailOpen).toHaveBeenCalledWith(
        "abc123def456",
        "203.0.113.1",
        "Mozilla/5.0 Test"
      );
    });

    it("still returns pixel even if recording fails", async () => {
      const { trackingPixelHandler } = await import("./emailTracking");
      const { recordEmailOpen } = await import("./db");
      (recordEmailOpen as any).mockRejectedValueOnce(new Error("DB error"));

      const req = {
        params: { trackingId: "unknown.png" },
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      } as any;

      let statusCode = 0;
      const res = {
        set: () => {},
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        send: () => {},
      } as any;

      await trackingPixelHandler(req, res);

      // Should still return 200 with the pixel
      expect(statusCode).toBe(200);
    });

    it("sends owner notification when email is opened", async () => {
      const { trackingPixelHandler } = await import("./emailTracking");
      const { notifyOwner } = await import("./_core/notification");

      const req = {
        params: { trackingId: "abc123def456.png" },
        headers: {
          "x-forwarded-for": "10.0.0.1",
          "user-agent": "TestAgent",
        },
        socket: { remoteAddress: "10.0.0.1" },
      } as any;

      const res = {
        set: () => {},
        status: () => res,
        send: () => {},
      } as any;

      await trackingPixelHandler(req, res);

      expect(notifyOwner).toHaveBeenCalledWith({
        title: expect.stringContaining("Dave Collins"),
        content: expect.stringContaining("Meeting Invite: Solar Consultation"),
      });
    });
  });
});
