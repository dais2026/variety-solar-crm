import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import nodemailer from "nodemailer";
import { getMeetingsNeedingReminder, markReminderSent } from "./db";
import { createTrackingPixel, getTrackingPixelHtml } from "./emailTracking";

/**
 * Express handler for the scheduled meeting reminder heartbeat.
 * Called hourly by the Manus platform.
 *
 * Logic:
 * 1. Authenticate as cron
 * 2. Find meetings starting in the next 22-26 hours that haven't had a reminder sent
 * 3. Send a reminder email to each customer
 * 4. Mark reminder as sent
 */
export async function scheduledMeetingReminderHandler(req: Request, res: Response) {
  try {
    // Authenticate - must be a cron request
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }

    console.log("[MeetingReminder] Heartbeat triggered, taskUid:", user.taskUid);

    // Look for meetings starting in 22-26 hours from now (gives a 4-hour window to catch hourly runs)
    const now = Date.now();
    const windowStartMs = now + 22 * 60 * 60 * 1000; // 22 hours from now
    const windowEndMs = now + 26 * 60 * 60 * 1000;   // 26 hours from now

    const meetings = await getMeetingsNeedingReminder(windowStartMs, windowEndMs);

    if (meetings.length === 0) {
      console.log("[MeetingReminder] No meetings needing reminders in the next 22-26 hours");
      res.json({ ok: true, sent: 0, message: "No reminders needed" });
      return;
    }

    console.log(`[MeetingReminder] Found ${meetings.length} meetings needing reminders`);

    // Setup SMTP transport
    const smtpHost = process.env.SMTP_HOST || "smtppro.zoho.com";
    const smtpPort = parseInt(process.env.SMTP_PORT || "465");
    const smtpUser = process.env.SMTP_USER || "george@varietysolar.com.au";
    const smtpPass = process.env.SMTP_PASS || "";

    if (!smtpPass) {
      console.error("[MeetingReminder] SMTP credentials not configured");
      res.status(500).json({ error: "SMTP not configured", timestamp: new Date().toISOString() });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    let sentCount = 0;
    const errors: string[] = [];

    for (const meeting of meetings) {
      try {
        // Format meeting time for the email
        const startDate = new Date(meeting.meetingStartTime);
        const dateOptions: Intl.DateTimeFormatOptions = {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Australia/Melbourne",
        };
        const timeOptions: Intl.DateTimeFormatOptions = {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Australia/Melbourne",
        };
        const formattedDate = startDate.toLocaleDateString("en-AU", dateOptions);
        const formattedTime = startDate.toLocaleTimeString("en-AU", timeOptions);

        const firstName = meeting.customerName.split(" ")[0];

        const emailText = [
          `Hi ${firstName},`,
          "",
          `This is a friendly reminder about your upcoming meeting with George Fotopoulos from Variety Solar.`,
          "",
          `Date: ${formattedDate}`,
          `Time: ${formattedTime} (Melbourne Time)`,
          meeting.location ? `Location: ${meeting.location}` : "",
          "",
          `If you need to reschedule, please book a new time here: https://calendly.com/variety-solar/new-meeting`,
          "",
          "Looking forward to seeing you!",
          "",
          "Kind regards,",
          "George Fotopoulos",
          "Variety Solar",
          "0493 835 449",
        ]
          .filter((line) => line !== undefined && line !== "")
          .join("\n");

        // Create tracking pixel for reminder email
        const baseUrl = process.env.VITE_APP_URL || `https://varietysolar-gfcrm.manus.space`;
        const trackingId = await createTrackingPixel({
          leadName: meeting.customerName,
          recipientEmail: meeting.customerEmail,
          subject: `Reminder: ${meeting.subject} - Tomorrow`,
          emailType: "meeting_reminder",
        });
        const trackingPixel = getTrackingPixelHtml(trackingId, baseUrl);

        await transporter.sendMail({
          from: `"George Fotopoulos - Variety Solar" <${smtpUser}>`,
          to: meeting.customerEmail,
          subject: `Reminder: ${meeting.subject} - Tomorrow`,
          text: emailText,
          html: `<pre style="font-family: sans-serif; white-space: pre-wrap;">${emailText}</pre>${trackingPixel}`,
        });

        await markReminderSent(meeting.id);
        sentCount++;
        console.log(`[MeetingReminder] Sent reminder to ${meeting.customerEmail} for meeting ${meeting.id}`);
      } catch (err) {
        const errMsg = `Failed to send reminder for meeting ${meeting.id}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[MeetingReminder] ${errMsg}`);
        errors.push(errMsg);
      }
    }

    res.json({
      ok: true,
      sent: sentCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[MeetingReminder] Handler error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}
