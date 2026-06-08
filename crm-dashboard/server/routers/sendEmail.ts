import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import nodemailer from "nodemailer";
import { TRPCError } from "@trpc/server";
import { createTrackingPixel, getTrackingPixelHtml } from "../emailTracking";

/**
 * Email templates for quick sending
 */
const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  follow_up_quote: {
    subject: "Following Up — Your Solar Quote",
    body: `Hi {{name}},

I hope this message finds you well. I wanted to follow up on the solar quote we discussed recently.

Have you had a chance to review the proposal? I'm happy to answer any questions or walk you through the options again.

Looking forward to hearing from you.

Kind regards,
George Fotopoulos
Variety Solar`,
  },
  proposal_attached: {
    subject: "Your Solar Proposal — Variety Solar",
    body: `Hi {{name}},

Please find attached your personalised solar proposal. I've put together a solution based on your energy usage and property details.

Key highlights:
- System size and configuration tailored to your needs
- Expected savings and payback period
- Available rebates and incentives

Please don't hesitate to reach out if you have any questions or would like to discuss further.

Kind regards,
George Fotopoulos
Variety Solar`,
  },
  checking_in: {
    subject: "Checking In — Variety Solar",
    body: `Hi {{name}},

Just checking in to see how you're going with your solar decision. I know it can be a big choice, so I'm here if you need any more information or have questions.

No pressure at all — just wanted to make sure you have everything you need.

Best regards,
George Fotopoulos
Variety Solar`,
  },
  meeting_confirmation: {
    subject: "Meeting Confirmed — Variety Solar",
    body: `Hi {{name}},

Just confirming our upcoming meeting. I'm looking forward to discussing your solar options and answering any questions you may have.

If anything changes or you need to reschedule, please don't hesitate to let me know.

See you soon!

Kind regards,
George Fotopoulos
Variety Solar`,
  },
  thank_you: {
    subject: "Thank You — Variety Solar",
    body: `Hi {{name}},

Thank you for taking the time to speak with me today. I appreciate your interest in going solar and I'm confident we can find the right solution for your home.

I'll follow up shortly with the details we discussed. In the meantime, please don't hesitate to reach out if you have any questions.

Kind regards,
George Fotopoulos
Variety Solar`,
  },
};

export const sendEmailRouter = router({
  /**
   * Get available email templates
   */
  getTemplates: publicProcedure.query(() => {
    const templates = Object.entries(EMAIL_TEMPLATES).map(([key, value]) => ({
      id: key,
      label: key
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      subject: value.subject,
      body: value.body,
    }));
    return { templates };
  }),

  /**
   * Send a tracked email to a lead
   */
  send: publicProcedure
    .input(
      z.object({
        recipientName: z.string().min(1, "Recipient name is required"),
        recipientEmail: z.string().email("Valid email address is required"),
        subject: z.string().min(1, "Subject is required"),
        body: z.string().min(1, "Email body is required"),
        templateId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
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

        // Create tracking pixel
        const baseUrl = process.env.VITE_APP_URL || `https://varietysolar-gfcrm.manus.space`;
        const emailType = input.templateId || "custom";
        const trackingId = await createTrackingPixel({
          leadName: input.recipientName,
          recipientEmail: input.recipientEmail,
          subject: input.subject,
          emailType,
        });
        const trackingPixel = getTrackingPixelHtml(trackingId, baseUrl);

        // Convert plain text body to HTML (preserve line breaks)
        const htmlBody = input.body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");

        // Send the email with tracking pixel embedded
        await transporter.sendMail({
          from: `"George Fotopoulos - Variety Solar" <${smtpUser}>`,
          to: input.recipientEmail,
          bcc: smtpUser,
          subject: input.subject,
          text: input.body,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${htmlBody}</div>${trackingPixel}`,
        });

        return {
          success: true,
          trackingId,
          message: `Email sent to ${input.recipientName} (${input.recipientEmail})`,
        };
      } catch (error: any) {
        console.error("[SendEmail] Failed to send:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send email: ${error.message || "Unknown error"}`,
        });
      }
    }),
});
