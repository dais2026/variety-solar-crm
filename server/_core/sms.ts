/**
 * SMS Broadcast Integration
 * Replaces any existing SMS service with SMSBroadcast API
 */

const SMS_USERNAME = process.env.SMS_BROADCAST_USERNAME;
const SMS_PASSWORD = process.env.SMS_BROADCAST_PASSWORD;
const SMS_API_URL = "https://api.smsbroadcast.com.au/api-adv.php";

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

export interface SMSResponse {
  status: string;
  messageId?: string;
  error?: string;
}

// Check if SMS is configured
export function isConfigured(): boolean {
  return !!(SMS_USERNAME && SMS_PASSWORD);
}

// Send SMS
export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  if (!isConfigured()) {
    return { success: false, error: "SMSBroadcast not configured" };
  }

  // Format phone number (Australian format)
  let formattedNumber = to.replace(/[\s\-()]/g, "");
  
  // Add country code if not present
  if (!formattedNumber.startsWith("61") && !formattedNumber.startsWith("+61")) {
    if (formattedNumber.startsWith("0")) {
      formattedNumber = "61" + formattedNumber.substring(1);
    } else {
      formattedNumber = "61" + formattedNumber;
    }
  }
  
  // Remove + if present
  formattedNumber = formattedNumber.replace("+", "");

  try {
    const params = new URLSearchParams({
      username: SMS_USERNAME!,
      password: SMS_PASSWORD!,
      to: formattedNumber,
      message: message,
      maxsplit: 3,
    });

    const response = await fetch(`${SMS_API_URL}?${params.toString()}`);
    const text = await response.text();
    
    // Parse response
    // OK:12345678 or ERROR:Invalid number
    if (text.startsWith("OK:")) {
      return {
        success: true,
        messageId: text.substring(3).trim(),
        status: "sent",
      };
    } else if (text.startsWith("ERROR:")) {
      return {
        success: false,
        error: text.substring(6).trim(),
        status: "failed",
      };
    }
    
    return { success: false, error: "Unknown response", status: "failed" };
  } catch (error: any) {
    console.error("[SMS] Send error:", error);
    return { success: false, error: error.message, status: "failed" };
  }
}

// Send SMS to lead
export async function sendLeadSMS(
  leadId: number,
  phone: string,
  message: string
): Promise<SMSResult> {
  const result = await sendSMS(phone, message);
  
  // TODO: Log SMS in database
  if (result.success) {
    console.log(`[SMS] Sent to lead ${leadId}: ${result.messageId}`);
  } else {
    console.error(`[SMS] Failed to send to lead ${leadId}: ${result.error}`);
  }
  
  return result;
}

// Send bulk SMS
export async function sendBulkSMS(
  recipients: Array<{ phone: string; message: string; leadId?: number }>
): Promise<{ sent: number; failed: number; results: SMSResult[] }> {
  const results: SMSResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const result = await sendSMS(recipient.phone, recipient.message);
    results.push(result);
    
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    
    // Rate limiting - 1 SMS per second
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { sent, failed, results };
}

// Schedule SMS (placeholder for future)
export async function scheduleSMS(
  to: string,
  message: string,
  scheduledAt: Date
): Promise<{ success: boolean; scheduledId?: string; error?: string }> {
  const now = new Date();
  const delay = scheduledAt.getTime() - now.getTime();
  
  if (delay < 0) {
    return { success: false, error: "Scheduled time is in the past" };
  }

  // For now, just schedule it with a simple timeout
  // In production, use a proper job queue
  const scheduledId = `scheduled_${Date.now()}`;
  
  setTimeout(async () => {
    await sendSMS(to, message);
  }, delay);

  return { success: true, scheduledId };
}

export default {
  isConfigured,
  sendSMS,
  sendLeadSMS,
  sendBulkSMS,
  scheduleSMS,
};