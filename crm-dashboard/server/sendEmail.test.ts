import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { Request, Response } from "express";

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });
vi.mock("nodemailer", () => ({
  default: { createTransport: (...args: any[]) => mockCreateTransport(...args) },
  createTransport: (...args: any[]) => mockCreateTransport(...args),
}));

// Mock emailTracking helpers
const mockCreateTrackingPixel = vi.fn().mockResolvedValue("test-tracking-id-123");
const mockGetTrackingPixelHtml = vi.fn().mockReturnValue('<img src="https://example.com/api/track/test-tracking-id-123.png" />');
vi.mock("./emailTracking", () => ({
  createTrackingPixel: (...args: any[]) => mockCreateTrackingPixel(...args),
  getTrackingPixelHtml: (...args: any[]) => mockGetTrackingPixelHtml(...args),
}));

function createContext() {
  return {
    user: { id: "owner-1", name: "George", openId: "owner-open-id", role: "admin" as const },
    req: { headers: {} } as unknown as Request,
    res: { clearCookie: vi.fn() } as unknown as Response,
  };
}

describe("sendEmail router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMTP_HOST = "smtppro.zoho.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "george@varietysolar.com.au";
    process.env.SMTP_PASS = "test-password";
    process.env.VITE_APP_URL = "https://varietysolar-gfcrm.manus.space";
  });

  describe("getTemplates", () => {
    it("returns a list of email templates", async () => {
      const caller = appRouter.createCaller(createContext());
      const result = await caller.sendEmail.getTemplates();

      expect(result.templates).toBeDefined();
      expect(result.templates.length).toBeGreaterThan(0);
      // Each template should have id, label, subject, body
      for (const t of result.templates) {
        expect(t.id).toBeTruthy();
        expect(t.label).toBeTruthy();
        expect(t.subject).toBeTruthy();
        expect(t.body).toBeTruthy();
      }
    });

    it("includes expected template types", async () => {
      const caller = appRouter.createCaller(createContext());
      const result = await caller.sendEmail.getTemplates();
      const ids = result.templates.map((t) => t.id);

      expect(ids).toContain("follow_up_quote");
      expect(ids).toContain("checking_in");
      expect(ids).toContain("thank_you");
      expect(ids).toContain("proposal_attached");
      expect(ids).toContain("meeting_confirmation");
    });

    it("templates contain {{name}} placeholder", async () => {
      const caller = appRouter.createCaller(createContext());
      const result = await caller.sendEmail.getTemplates();

      for (const t of result.templates) {
        expect(t.body).toContain("{{name}}");
      }
    });
  });

  describe("send", () => {
    it("sends an email with tracking pixel and returns success", async () => {
      const caller = appRouter.createCaller(createContext());
      const result = await caller.sendEmail.send({
        recipientName: "Kian Flanagan",
        recipientEmail: "kian@example.com",
        subject: "Following Up — Your Solar Quote",
        body: "Hi Kian,\n\nJust checking in on the quote.",
      });

      expect(result.success).toBe(true);
      expect(result.trackingId).toBe("test-tracking-id-123");
      expect(result.message).toContain("Kian Flanagan");
      expect(result.message).toContain("kian@example.com");
    });

    it("creates a tracking pixel with correct metadata", async () => {
      const caller = appRouter.createCaller(createContext());
      await caller.sendEmail.send({
        recipientName: "Jane Smith",
        recipientEmail: "jane@example.com",
        subject: "Test Subject",
        body: "Test body",
        templateId: "follow_up_quote",
      });

      expect(mockCreateTrackingPixel).toHaveBeenCalledWith({
        leadName: "Jane Smith",
        recipientEmail: "jane@example.com",
        subject: "Test Subject",
        emailType: "follow_up_quote",
      });
    });

    it("uses 'custom' as emailType when no templateId provided", async () => {
      const caller = appRouter.createCaller(createContext());
      await caller.sendEmail.send({
        recipientName: "Bob",
        recipientEmail: "bob@example.com",
        subject: "Custom email",
        body: "Hello Bob",
      });

      expect(mockCreateTrackingPixel).toHaveBeenCalledWith(
        expect.objectContaining({ emailType: "custom" })
      );
    });

    it("configures SMTP transporter with correct credentials", async () => {
      const caller = appRouter.createCaller(createContext());
      await caller.sendEmail.send({
        recipientName: "Test",
        recipientEmail: "test@example.com",
        subject: "Test",
        body: "Test",
      });

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: "smtppro.zoho.com",
        port: 465,
        secure: true,
        auth: {
          user: "george@varietysolar.com.au",
          pass: "test-password",
        },
      });
    });

    it("sends email with HTML body containing tracking pixel", async () => {
      const caller = appRouter.createCaller(createContext());
      await caller.sendEmail.send({
        recipientName: "Test",
        recipientEmail: "test@example.com",
        subject: "Subject Line",
        body: "Hello\nWorld",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining("George Fotopoulos"),
          to: "test@example.com",
          bcc: "george@varietysolar.com.au",
          subject: "Subject Line",
          text: "Hello\nWorld",
          html: expect.stringContaining("test-tracking-id-123"),
        })
      );
    });

    it("converts newlines to <br> in HTML body", async () => {
      const caller = appRouter.createCaller(createContext());
      await caller.sendEmail.send({
        recipientName: "Test",
        recipientEmail: "test@example.com",
        subject: "Test",
        body: "Line 1\nLine 2\nLine 3",
      });

      const htmlArg = mockSendMail.mock.calls[0][0].html;
      expect(htmlArg).toContain("Line 1<br>Line 2<br>Line 3");
    });

    it("throws error when SMTP_PASS is not configured", async () => {
      delete process.env.SMTP_PASS;
      const caller = appRouter.createCaller(createContext());

      await expect(
        caller.sendEmail.send({
          recipientName: "Test",
          recipientEmail: "test@example.com",
          subject: "Test",
          body: "Test",
        })
      ).rejects.toThrow(/SMTP credentials not configured/);
    });

    it("throws error when sendMail fails", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("Connection refused"));
      const caller = appRouter.createCaller(createContext());

      await expect(
        caller.sendEmail.send({
          recipientName: "Test",
          recipientEmail: "test@example.com",
          subject: "Test",
          body: "Test",
        })
      ).rejects.toThrow(/Failed to send email/);
    });

    it("validates required fields", async () => {
      const caller = appRouter.createCaller(createContext());

      // Empty recipient name
      await expect(
        caller.sendEmail.send({
          recipientName: "",
          recipientEmail: "test@example.com",
          subject: "Test",
          body: "Test",
        })
      ).rejects.toThrow();

      // Invalid email
      await expect(
        caller.sendEmail.send({
          recipientName: "Test",
          recipientEmail: "not-an-email",
          subject: "Test",
          body: "Test",
        })
      ).rejects.toThrow();

      // Empty subject
      await expect(
        caller.sendEmail.send({
          recipientName: "Test",
          recipientEmail: "test@example.com",
          subject: "",
          body: "Test",
        })
      ).rejects.toThrow();
    });
  });
});
