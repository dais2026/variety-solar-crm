import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { createTrackingPixel, getTrackingPixelHtml } from "../emailTracking";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import * as crypto from "crypto";
import nodemailer from "nodemailer";
import { insertMeetingSent } from "../db";

/**
 * Generate a proper .ics (iCalendar) file content for a meeting invite.
 */
function generateICS(params: {
  subject: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
}): string {
  const uid = crypto.randomUUID() + "@varietysolar.com.au";
  const now = formatICSDate(new Date());
  const start = formatICSDate(params.startTime);
  const end = formatICSDate(params.endTime);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Variety Solar//CRM Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(params.subject)}`,
    `DESCRIPTION:${escapeICS(params.description)}`,
    `LOCATION:${escapeICS(params.location)}`,
    `ORGANIZER;CN=${escapeICS(params.organizerName)}:mailto:${params.organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeICS(params.attendeeName)}:mailto:${params.attendeeEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${escapeICS(params.organizerName)}:mailto:${params.organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=George Fotopoulos:mailto:fotios8548@gmail.com`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Determine the UTC offset for Australia/Melbourne on a given date.
 * Handles AEST (+10:00) and AEDT (+11:00) transitions automatically.
 */
function getMelbourneOffset(date: Date): string {
  // Use Intl to get the actual offset for Melbourne on this date
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  if (tzPart) {
    // Format is like "GMT+11" or "GMT+10"
    const match = tzPart.value.match(/GMT([+-]\d+)/);
    if (match) {
      const offsetHours = parseInt(match[1]);
      const sign = offsetHours >= 0 ? "+" : "-";
      return `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;
    }
  }
  // Fallback to AEST
  return "+10:00";
}

export const calendarRouter = router({
  /**
   * Send a calendar invite to a customer via email with .ics attachment.
   * Uses nodemailer with SMTP to send the email with the .ics as an inline calendar invite.
   */
  sendInvite: protectedProcedure
    .input(
      z.object({
        customerName: z.string().min(1),
        customerEmail: z.string().email(),
        customerAddress: z.string().optional().default(""), // Used as default location if location is empty
        subject: z.string().min(1),
        location: z.string().optional().default(""),
        date: z.string(), // ISO date string (YYYY-MM-DD)
        startTime: z.string(), // HH:mm format
        duration: z.number().min(15).max(480), // minutes
        notes: z.string().optional().default(""),
      })
    )
    .mutation(async ({ input }) => {
      const organizerName = "George Fotopoulos";
      const organizerEmail = process.env.SMTP_USER || "george@varietysolar.com.au";

      // Parse start time in Melbourne timezone (handles DST automatically)
      // Create date in Melbourne timezone by using the Intl API to determine offset
      const naiveDateStr = `${input.date}T${input.startTime}:00`;
      // Use a temporary date to determine the correct UTC offset for Melbourne on this date
      const tempDate = new Date(naiveDateStr + "Z");
      const melbourneOffset = getMelbourneOffset(tempDate);
      const startDate = new Date(naiveDateStr + melbourneOffset);

      // Calculate end time
      const endDate = new Date(startDate.getTime() + input.duration * 60 * 1000);

      // Use customer address as fallback location if no explicit location provided
      const meetingLocation = input.location || input.customerAddress || "";

      // Generate description
      const description = [
        `Solar Consultation with ${input.customerName}`,
        meetingLocation ? `Location: ${meetingLocation}` : "",
        input.notes ? `Notes: ${input.notes}` : "",
        "",
        "Variety Solar",
        "George Fotopoulos",
        "0493 835 449",
      ]
        .filter(Boolean)
        .join("\n");

      // Generate .ics content
      const icsContent = generateICS({
        subject: input.subject,
        description: description.replace(/\n/g, "\\n"),
        location: meetingLocation,
        startTime: startDate,
        endTime: endDate,
        organizerName,
        organizerEmail,
        attendeeName: input.customerName,
        attendeeEmail: input.customerEmail,
      });

      // Format date for email body
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
      const formattedStartTime = startDate.toLocaleTimeString("en-AU", timeOptions);
      const formattedEndTime = endDate.toLocaleTimeString("en-AU", timeOptions);

      // Email body (plain text)
      const emailText = [
        `Hi ${input.customerName.split(" ")[0]},`,
        "",
        `You're invited to a meeting with George Fotopoulos from Variety Solar.`,
        "",
        `Subject: ${input.subject}`,
        `Date: ${formattedDate}`,
        `Time: ${formattedStartTime} – ${formattedEndTime} (Melbourne Time)`,
        meetingLocation ? `Location: ${meetingLocation}` : "",
        "",
        `Please accept the calendar invite attached to add this to your calendar.`,
        "",
        input.notes ? `Additional notes: ${input.notes}` : "",
        "",
        `If you need to reschedule, please book a new time here: https://calendly.com/variety-solar/new-meeting`,
        "",
        "Kind regards,",
        "George Fotopoulos",
        "Variety Solar",
        "0493 835 449",
      ]
        .filter((line) => line !== undefined)
        .join("\n");

      // Send email via SMTP
      const smtpHost = process.env.SMTP_HOST || "smtppro.zoho.com";
      const smtpPort = parseInt(process.env.SMTP_PORT || "465");
      const smtpUser = process.env.SMTP_USER || "george@varietysolar.com.au";
      const smtpPass = process.env.SMTP_PASS || "";

      if (!smtpPass) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Email SMTP credentials not configured. Please contact admin.",
        });
      }

      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        // Create tracking pixel for this email
        const baseUrl = process.env.VITE_APP_URL || `https://varietysolar-gfcrm.manus.space`;
        const trackingId = await createTrackingPixel({
          leadName: input.customerName,
          recipientEmail: input.customerEmail,
          subject: `Meeting Invite: ${input.subject}`,
          emailType: "meeting_invite",
        });
        const trackingPixel = getTrackingPixelHtml(trackingId, baseUrl);

        // Send invite to customer (with tracking pixel in HTML version)
        await transporter.sendMail({
          from: `"George Fotopoulos - Variety Solar" <${smtpUser}>`,
          to: input.customerEmail,
          bcc: smtpUser,
          subject: `Meeting Invite: ${input.subject}`,
          text: emailText,
          html: `<pre style="font-family: sans-serif; white-space: pre-wrap;">${emailText}</pre>${trackingPixel}`,
          icalEvent: {
            filename: "invite.ics",
            method: "REQUEST",
            content: icsContent,
          },
        });

        // Send invite directly TO Gmail so Google Calendar auto-creates the event
        await transporter.sendMail({
          from: `"George Fotopoulos - Variety Solar" <${smtpUser}>`,
          to: "fotios8548@gmail.com",
          subject: `Meeting Invite: ${input.subject}`,
          text: emailText,
          icalEvent: {
            filename: "invite.ics",
            method: "REQUEST",
            content: icsContent,
          },
        });

        // Log the meeting to the database
        try {
          await insertMeetingSent({
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            customerPhone: "",
            subject: input.subject,
            location: meetingLocation || null,
            meetingStartTime: startDate.getTime(),
            meetingEndTime: endDate.getTime(),
            durationMinutes: input.duration,
            notes: input.notes || null,
            status: "scheduled",
            sentAt: Date.now(),
          });
        } catch (logErr) {
          console.warn("[Calendar] Failed to log meeting to DB:", logErr);
          // Don't fail the invite send if logging fails
        }

        return {
          success: true,
          formattedDate,
          formattedStartTime,
          formattedEndTime,
          message: `Calendar invite sent to ${input.customerName} at ${input.customerEmail}`,
        };
      } catch (error: any) {
        console.error("[Calendar] Failed to send email:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send email: ${error.message || "Unknown error"}`,
        });
      }
    }),
});
