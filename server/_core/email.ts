/**
 * Email Service - Zoho SMTP
 * Replaces any existing email service
 */

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtppro.zoho.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Create transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter!;
}

// Check if email is configured
export function isConfigured(): boolean {
  return !!(SMTP_USER && SMTP_PASS);
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Send email
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const transport = getTransporter();
  
  if (!transport) {
    return { success: false, error: "Email not configured" };
  }

  try {
    const toAddresses = Array.isArray(options.to) 
      ? options.to.join(", ") 
      : options.to;
    
    const ccAddresses = options.cc 
      ? (Array.isArray(options.cc) ? options.cc.join(", ") : options.cc)
      : undefined;
    
    const bccAddresses = options.bcc 
      ? (Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc)
      : undefined;

    const info = await transport.sendMail({
      from: SMTP_USER,
      to: toAddresses,
      cc: ccAddresses,
      bcc: bccAddresses,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    console.log(`[Email] Sent: ${info.messageId}`);
    
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error("[Email] Send error:", error);
    return { success: false, error: error.message };
  }
}

// Send email to lead
export async function sendLeadEmail(
  leadId: number,
  to: string,
  subject: string,
  content: string,
  isHtml: boolean = false
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `[Variety Solar] ${subject}`,
    [isHtml ? "html" : "text"]: content,
  });
}

// Send bulk email
export async function sendBulkEmail(
  recipients: Array<{ to: string; subject: string; text?: string; html?: string }>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient.to,
      subject: `[Variety Solar] ${recipient.subject}`,
      text: recipient.text,
      html: recipient.html,
    });
    
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    
    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return { sent, failed };
}

// Send templated email
export async function sendTemplatedEmail(
  to: string,
  template: "welcome" | "follow-up" | "quote" | "reminder",
  data: Record<string, string>
): Promise<EmailResult> {
  const templates: Record<string, { subject: string; text: string; html: string }> = {
    welcome: {
      subject: "Welcome to Variety Solar",
      text: `Dear ${data.name || "Customer"},\n\nThank you for your interest in Variety Solar. Our team will be in touch soon.\n\nBest regards,\nThe Variety Solar Team`,
      html: `<p>Dear ${data.name || "Customer"},</p><p>Thank you for your interest in Variety Solar. Our team will be in touch soon.</p><p>Best regards,<br>The Variety Solar Team</p>`,
    },
    "follow-up": {
      subject: "Following up on your solar inquiry",
      text: `Dear ${data.name || "Customer"},\n\nJust wanted to check in regarding your solar inquiry. We'd love to answer any questions you might have.\n\nBest regards,\nThe Variety Solar Team`,
      html: `<p>Dear ${data.name || "Customer"},</p><p>Just wanted to check in regarding your solar inquiry. We'd love to answer any questions you might have.</p><p>Best regards,<br>The Variety Solar Team</p>`,
    },
    quote: {
      subject: "Your Solar Quote",
      text: `Dear ${data.name || "Customer"},\n\nPlease find your solar quote attached. Contact us if you have any questions.\n\nBest regards,\nThe Variety Solar Team`,
      html: `<p>Dear ${data.name || "Customer"},</p><p>Please find your solar quote attached. Contact us if you have any questions.</p><p>Best regards,<br>The Variety Solar Team</p>`,
    },
    reminder: {
      subject: "Appointment Reminder",
      text: `Dear ${data.name || "Customer"},\n\nThis is a reminder about your upcoming appointment on ${data.date || "the scheduled date"} at ${data.time || "the scheduled time"}.\n\nBest regards,\nThe Variety Solar Team`,
      html: `<p>Dear ${data.name || "Customer"},</p><p>This is a reminder about your upcoming appointment on ${data.date || "the scheduled date"} at ${data.time || "the scheduled time"}.</p><p>Best regards,<br>The Variety Solar Team</p>`,
    },
  };

  const templateData = templates[template];
  if (!templateData) {
    return { success: false, error: "Invalid template" };
  }

  // Replace placeholders
  let text = templateData.text;
  let html = templateData.html;
  
  for (const [key, value] of Object.entries(data)) {
    text = text.replace(new RegExp(`{{${key}}}`, "g"), value);
    html = html.replace(new RegExp(`{{${key}}}`, "g"), value);
  }

  return sendEmail({
    to,
    subject: templateData.subject,
    text,
    html,
  });
}

export default {
  isConfigured,
  sendEmail,
  sendLeadEmail,
  sendBulkEmail,
  sendTemplatedEmail,
};