import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { insertSmsLogBatch, getSmsLogs, getSmsLogCount, getSmsLogsByDirection, getSmsLogCountByDirection } from "../db";
import { InsertSmsLogEntry } from "../../drizzle/schema";

/**
 * SMS Broadcast API integration.
 * Docs: https://www.smsbroadcast.com.au/api-adv.php
 * - Send individual or bulk SMS (personalised per recipient)
 * - Check credit balance
 * - Multi-part SMS support (up to 320 chars = 2 parts)
 * - SMS sent/received log stored in database
 *
 * All procedures are protected — only authenticated users can access them.
 */

const MAX_SINGLE_SMS = 160;
const MAX_MULTIPART_SMS = 765; // 5 SMS parts max to support templates with signatures

async function callSmsApi(params: Record<string, string>): Promise<string> {
  const searchParams = new URLSearchParams({
    username: ENV.smsBroadcastUsername,
    password: ENV.smsBroadcastPassword,
    ...params,
  });

  const response = await fetch(
    `https://api.smsbroadcast.com.au/api-adv.php?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error(`SMS API HTTP error: ${response.status}`);
  }

  return response.text();
}

function parseSmsResponse(result: string) {
  const lines = result.trim().split("\n");
  const results: Array<{ number: string; status: "ok" | "bad" | "error"; ref?: string; reason?: string }> = [];

  for (const line of lines) {
    const parts = line.split(":");
    if (parts[0] === "OK") {
      results.push({ number: parts[1], status: "ok", ref: parts[2] });
    } else if (parts[0] === "BAD") {
      results.push({ number: parts[1], status: "bad", reason: parts[2] });
    } else if (parts[0] === "ERROR") {
      results.push({ number: "", status: "error", reason: parts.slice(1).join(":") });
    }
  }

  return results;
}

/** Calculate number of SMS parts needed */
function getSmsParts(messageLength: number): number {
  if (messageLength <= MAX_SINGLE_SMS) return 1;
  if (messageLength <= MAX_MULTIPART_SMS) return 2;
  return Math.ceil(messageLength / 153); // concatenated SMS uses 153 chars per part
}

export const smsRouter = router({
  /**
   * Check SMS credit balance
   */
  balance: publicProcedure.query(async () => {
    const result = await callSmsApi({ action: "balance" });

    if (result.startsWith("OK:")) {
      const balance = parseFloat(result.split(":")[1]);
      return { success: true, balance };
    }

    return { success: false, balance: 0, error: result };
  }),

  /**
   * Send SMS to one recipient (supports multi-part up to 320 chars)
   */
  send: publicProcedure
    .input(
      z.object({
        to: z.string().min(1, "Recipient number is required"),
        message: z.string().min(1, "Message is required").max(MAX_MULTIPART_SMS, `Message must be ${MAX_MULTIPART_SMS} characters or less`),
        from: z.string().max(11).default(""),
        contactName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const params: Record<string, string> = {
        to: input.to,
        message: input.message,
      };

      // Only include 'from' if a sender name is specified; blank uses shared number pool
      if (input.from) {
        params.from = input.from;
      }

      // Add maxsplit param for multi-part messages
      const parts = getSmsParts(input.message.length);
      if (parts > 1) {
        params.maxsplit = String(parts);
      }

      const result = await callSmsApi(params);
      const results = parseSmsResponse(result);
      const allSuccess = results.every((r) => r.status === "ok");

      // Log to database
      try {
        const logEntry: InsertSmsLogEntry = {
          direction: "sent",
          phone: input.to,
          contactName: input.contactName || null,
          message: input.message,
          senderName: input.from,
          parts,
          cost: parts,
          status: allSuccess ? "delivered" : "failed",
          userId: ctx.user?.id || null,
          createdAt: Date.now(),
        };
        await insertSmsLogBatch([logEntry]);
      } catch (err) {
        console.error("[SMS Log] Failed to log sent message:", err);
      }

      return { success: allSuccess, results, rawResponse: result, parts };
    }),

  /**
   * Send personalised bulk SMS - each recipient gets their own message with {name} replaced.
   * Supports multi-part SMS (up to 320 chars per message).
   */
  bulkSend: publicProcedure
    .input(
      z.object({
        recipients: z.array(
          z.object({
            phone: z.string().min(1, "Phone number is required"),
            name: z.string().default(""),
          })
        ).min(1, "At least one recipient required"),
        message: z.string().min(1, "Message is required").max(MAX_MULTIPART_SMS, `Message must be ${MAX_MULTIPART_SMS} characters or less`),
        from: z.string().max(11).default(""),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allResults: Array<{
        number: string;
        name: string;
        status: "ok" | "bad" | "error";
        ref?: string;
        reason?: string;
        personalMessage: string;
        parts: number;
      }> = [];

      const logEntries: InsertSmsLogEntry[] = [];

      // Send each message individually with personalised name
      for (const recipient of input.recipients) {
        const personalMessage = input.message.replace(/{name}/g, recipient.name || "there");

        // Skip if personalised message exceeds max multi-part limit
        if (personalMessage.length > MAX_MULTIPART_SMS) {
          allResults.push({
            number: recipient.phone,
            name: recipient.name,
            status: "bad",
            reason: `Message too long after personalisation (${personalMessage.length} chars)`,
            personalMessage,
            parts: 0,
          });
          continue;
        }

        const parts = getSmsParts(personalMessage.length);

        try {
          const params: Record<string, string> = {
            to: recipient.phone,
            message: personalMessage,
          };

          // Only include 'from' if a sender name is specified; blank uses shared number pool
          if (input.from) {
            params.from = input.from;
          }
          if (parts > 1) {
            params.maxsplit = String(parts);
          }

          const result = await callSmsApi(params);
          const parsed = parseSmsResponse(result);

          for (const r of parsed) {
            const status = r.status === "ok" ? "ok" : r.status;
            allResults.push({
              ...r,
              number: r.number || recipient.phone,
              name: recipient.name,
              personalMessage,
              parts,
            });
          }

          // Log entry
          logEntries.push({
            direction: "sent",
            phone: recipient.phone,
            contactName: recipient.name || null,
            message: personalMessage,
            senderName: input.from,
            parts,
            cost: parts,
            status: parsed.every((r) => r.status === "ok") ? "delivered" : "failed",
            userId: ctx.user?.id || null,
            createdAt: Date.now(),
          });
        } catch (err) {
          allResults.push({
            number: recipient.phone,
            name: recipient.name,
            status: "error",
            reason: err instanceof Error ? err.message : "Network error",
            personalMessage,
            parts,
          });

          logEntries.push({
            direction: "sent",
            phone: recipient.phone,
            contactName: recipient.name || null,
            message: personalMessage,
            senderName: input.from,
            parts,
            cost: 0,
            status: "failed",
            userId: ctx.user?.id || null,
            createdAt: Date.now(),
          });
        }
      }

      // Batch insert all log entries
      try {
        await insertSmsLogBatch(logEntries);
      } catch (err) {
        console.error("[SMS Log] Failed to batch log sent messages:", err);
      }

      const successCount = allResults.filter((r) => r.status === "ok").length;
      const failCount = allResults.filter((r) => r.status !== "ok").length;
      const totalParts = allResults.reduce((sum, r) => sum + (r.status === "ok" ? r.parts : 0), 0);

      return {
        success: failCount === 0,
        total: input.recipients.length,
        sent: successCount,
        failed: failCount,
        totalParts,
        results: allResults,
      };
    }),

  /**
   * Get SMS sent/received log from database
   */
  getLog: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const [logs, total] = await Promise.all([
        getSmsLogs(limit, offset),
        getSmsLogCount(),
      ]);
      return { logs, total, limit, offset };
    }),

  /**
   * Get received (inbound) SMS messages
   */
  getInbox: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const [logs, total] = await Promise.all([
        getSmsLogsByDirection("received", limit, offset),
        getSmsLogCountByDirection("received"),
      ]);
      return { logs, total, limit, offset };
    }),
});
