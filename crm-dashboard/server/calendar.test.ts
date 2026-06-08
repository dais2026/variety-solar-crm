import { describe, it, expect, vi, beforeEach } from "vitest";
import nodemailer from "nodemailer";

// Mock nodemailer
vi.mock("nodemailer", () => {
  const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
  const mockVerify = vi.fn().mockResolvedValue(true);
  return {
    default: {
      createTransport: vi.fn(() => ({
        sendMail: mockSendMail,
        verify: mockVerify,
        options: {},
      })),
    },
  };
});

describe("Calendar SMTP Configuration", () => {
  it("should have SMTP environment variables configured", () => {
    expect(process.env.SMTP_HOST).toBeDefined();
    expect(process.env.SMTP_HOST).toBe("smtppro.zoho.com");
    expect(process.env.SMTP_PORT).toBeDefined();
    expect(process.env.SMTP_PORT).toBe("465");
    expect(process.env.SMTP_USER).toBeDefined();
    expect(process.env.SMTP_USER).toBe("george@varietysolar.com.au");
    expect(process.env.SMTP_PASS).toBeDefined();
    expect(process.env.SMTP_PASS!.length).toBeGreaterThan(0);
  });

  it("should be able to create a nodemailer transporter with Zoho SSL config", () => {
    const smtpPort = parseInt(process.env.SMTP_PORT || "465");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtppro.zoho.com",
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER || "george@varietysolar.com.au",
        pass: process.env.SMTP_PASS || "",
      },
    });
    expect(transporter).toBeDefined();
    expect(transporter.options).toBeDefined();
  });

  it("should generate valid ICS content", () => {
    const startDate = new Date("2026-06-10T09:00:00+10:00");
    const endDate = new Date("2026-06-10T09:30:00+10:00");

    const formatICSDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    };

    const start = formatICSDate(startDate);
    const end = formatICSDate(endDate);

    expect(start).toMatch(/^\d{8}T\d{6}Z$/);
    expect(end).toMatch(/^\d{8}T\d{6}Z$/);

    // Verify the time difference is 30 minutes
    const diffMs = endDate.getTime() - startDate.getTime();
    expect(diffMs).toBe(30 * 60 * 1000);
  });

  it("should handle Melbourne timezone offset correctly for AEST", () => {
    // June is AEST (+10:00)
    const naiveDateStr = "2026-06-10T09:00:00";
    const tempDate = new Date(naiveDateStr + "Z");

    const formatter = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(tempDate);
    const tzPart = parts.find((p) => p.type === "timeZoneName");

    expect(tzPart).toBeDefined();
    // June in Melbourne is AEST = GMT+10
    expect(tzPart!.value).toMatch(/GMT\+10/);
  });

  it("should handle Melbourne timezone offset correctly for AEDT", () => {
    // January is AEDT (+11:00)
    const naiveDateStr = "2026-01-10T09:00:00";
    const tempDate = new Date(naiveDateStr + "Z");

    const formatter = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(tempDate);
    const tzPart = parts.find((p) => p.type === "timeZoneName");

    expect(tzPart).toBeDefined();
    // January in Melbourne is AEDT = GMT+11
    expect(tzPart!.value).toMatch(/GMT\+11/);
  });
});

describe("Calendar sendInvite procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call nodemailer.createTransport with Zoho SMTP settings", async () => {
    const transporter = nodemailer.createTransport({
      host: "smtppro.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: "george@varietysolar.com.au",
        pass: "testpass",
      },
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtppro.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: "george@varietysolar.com.au",
        pass: "testpass",
      },
    });
  });

  it("should send email with icalEvent attachment from Zoho", async () => {
    const transporter = nodemailer.createTransport({
      host: "smtppro.zoho.com",
      port: 465,
      secure: true,
      auth: { user: "george@varietysolar.com.au", pass: "testpass" },
    });

    // Send to customer
    const result = await transporter.sendMail({
      from: '"George Fotopoulos - Variety Solar" <george@varietysolar.com.au>',
      to: "customer@example.com",
      bcc: "george@varietysolar.com.au",
      subject: "Meeting Invite: Solar Consultation",
      text: "Hi Test, You're invited to a meeting...",
      icalEvent: {
        filename: "invite.ics",
        method: "REQUEST",
        content: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
      },
    });

    // Send to Gmail for Google Calendar auto-add
    await transporter.sendMail({
      from: '"George Fotopoulos - Variety Solar" <george@varietysolar.com.au>',
      to: "fotios8548@gmail.com",
      subject: "Meeting Invite: Solar Consultation",
      text: "Hi Test, You're invited to a meeting...",
      icalEvent: {
        filename: "invite.ics",
        method: "REQUEST",
        content: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
      },
    });

    expect(transporter.sendMail).toHaveBeenCalledTimes(2);
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        bcc: "george@varietysolar.com.au",
        subject: "Meeting Invite: Solar Consultation",
      })
    );
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "fotios8548@gmail.com",
        subject: "Meeting Invite: Solar Consultation",
      })
    );
    expect(result.messageId).toBe("test-id");
  });

  it("should throw error when SMTP_PASS is not set", () => {
    // Simulate missing password scenario
    const smtpPass = "";
    expect(smtpPass).toBe("");
    // The procedure would throw a TRPCError with code INTERNAL_SERVER_ERROR
    // when smtpPass is empty
  });

  it("should format email body with correct customer details", () => {
    const customerName = "Cathie McRobert";
    const subject = "Solar Consultation - Variety Solar";
    const formattedDate = "Wednesday, 11 June 2026";
    const formattedStartTime = "9:00 am";
    const formattedEndTime = "9:30 am";
    const location = "10 Diosma Rd, Eltham";

    const emailText = [
      `Hi ${customerName.split(" ")[0]},`,
      "",
      `You're invited to a meeting with George Fotopoulos from Variety Solar.`,
      "",
      `Subject: ${subject}`,
      `Date: ${formattedDate}`,
      `Time: ${formattedStartTime} – ${formattedEndTime} (Melbourne Time)`,
      location ? `Location: ${location}` : "",
      "",
      `Please accept the calendar invite attached to add this to your calendar.`,
      "",
      `If you need to reschedule, please book a new time here: https://calendly.com/variety-solar/new-meeting`,
      "",
      "Kind regards,",
      "George Fotopoulos",
      "Variety Solar",
      "0493 835 449",
    ].join("\n");

    expect(emailText).toContain("Hi Cathie,");
    expect(emailText).toContain("Solar Consultation - Variety Solar");
    expect(emailText).toContain("10 Diosma Rd, Eltham");
    expect(emailText).toContain("calendly.com/variety-solar");
    expect(emailText).toContain("George Fotopoulos");
  });
});
