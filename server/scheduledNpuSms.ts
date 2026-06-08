import { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import {
  getNpuSmsSentByPhone,
  insertNpuSmsSent,
  insertSmsLog,
  getSmsTemplate,
} from "./db";

const SPREADSHEET_ID = "1oVFGomjgmbYlX7YJUFWKH0-1snrjCkcBsUC6AW4rmgA";

/**
 * Fetch leads from the Google Sheet via public CSV export.
 */
async function fetchSheetCSV(): Promise<string[][]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;

  const response = await fetch(csvUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status}`);
  }

  const text = await response.text();
  return parseCSV(text);
}

/**
 * Parse CSV text properly, handling quoted fields.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (char === "\n" || (char === "\r" && text[i + 1] === "\n")) {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i += char === "\r" ? 2 : 1;
      } else if (char === "\r") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Send SMS via SMS Broadcast API.
 */
async function sendSms(to: string, message: string): Promise<{ ok: boolean; ref?: string }> {
  const username = ENV.smsBroadcastUsername;
  const password = ENV.smsBroadcastPassword;
  if (!username || !password) {
    console.error("[ScheduledNPU] SMS credentials not configured");
    return { ok: false };
  }

  const params = new URLSearchParams({
    username,
    password,
    to,
    message,
    maxsplit: "5",
  });

  try {
    const resp = await fetch(`https://api.smsbroadcast.com.au/api-adv.php?${params.toString()}`);
    const text = await resp.text();
    const ok = text.includes("OK:");
    const ref = ok ? text.split("OK:")[1]?.split(":")[0]?.trim() : undefined;
    return { ok, ref };
  } catch (err) {
    console.error("[ScheduledNPU] Failed to send SMS:", err);
    return { ok: false };
  }
}

/**
 * Express handler for the scheduled NPU SMS heartbeat.
 * Called periodically by the Manus platform.
 * 
 * Logic:
 * 1. Authenticate as cron
 * 2. Fetch all leads from Google Sheet
 * 3. Find leads with "Called NPU" discovery status
 * 4. For each, check if SMS already sent (npu_sms_sent table)
 * 5. If not sent, send the NPU template SMS and log it
 */
export async function scheduledNpuSmsHandler(req: Request, res: Response) {
  try {
    // Authenticate - must be a cron request
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }

    console.log("[ScheduledNPU] Heartbeat triggered, taskUid:", user.taskUid);

    // Fetch leads from Google Sheet
    const values = await fetchSheetCSV();
    if (values.length < 2) {
      res.json({ ok: true, processed: 0, message: "No leads found in sheet" });
      return;
    }

    // Parse leads - column F (index 5) is "outcome" / discovery status
    const leads = values.slice(1)
      .filter(row => row.length > 5 && row[1] && row[1].trim() !== "")
      .map(row => ({
        name: (row[1] || "").trim(),
        phone: (row[2] || "").trim(),
        email: (row[3] || "").trim(),
        discovery: (row[5] || "").trim(),
      }));

    // Find leads with "Called NPU" status
    const npuLeads = leads.filter(lead => 
      lead.discovery.toLowerCase() === "called npu" && lead.phone
    );

    console.log(`[ScheduledNPU] Found ${npuLeads.length} leads with "Called NPU" status`);

    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Get the NPU SMS template
    const template = await getSmsTemplate("npu");

    for (const lead of npuLeads) {
      try {
        // Check if already sent
        const existing = await getNpuSmsSentByPhone(lead.phone);
        if (existing) {
          skippedCount++;
          continue;
        }

        // Personalise the message
        const firstName = lead.name.split(" ")[0];
        const message = template.replace(/\{name\}/g, firstName);

        // Send SMS
        const result = await sendSms(lead.phone, message);
        if (!result.ok) {
          errors.push(`Failed to send to ${lead.name} (${lead.phone})`);
          continue;
        }

        // Log the SMS
        const parts = Math.ceil(message.length / 160);
        await insertSmsLog({
          direction: "sent",
          phone: lead.phone,
          contactName: lead.name,
          message,
          parts,
          cost: parts * 0.09,
          status: "delivered",
          createdAt: Date.now(),
        });

        // Track as sent to prevent duplicates
        await insertNpuSmsSent({ leadPhone: lead.phone, leadName: lead.name, sentAt: Date.now() });

        sentCount++;
        console.log(`[ScheduledNPU] SMS sent to ${lead.name} (${lead.phone})`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Error processing ${lead.name}: ${errMsg}`);
      }
    }

    const response = {
      ok: true,
      totalNpuLeads: npuLeads.length,
      sent: sentCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log("[ScheduledNPU] Heartbeat complete:", response);
    res.json(response);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[ScheduledNPU] Handler error:", error);
    res.status(500).json({
      error,
      stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}
