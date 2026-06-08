import type { Express } from "express";
import { insertSmsLogBatch } from "../db";
import type { InsertSmsLogEntry } from "../../drizzle/schema";

/**
 * Register the inbound SMS webhook endpoint.
 *
 * SMS Broadcast sends an HTTP GET request with query params:
 *   ?to=614xxxxxxxx&from=614xxxxxxxx&message=Hello%20World&ref=abc123
 *
 * We store the message in the sms_log table with direction = 'received'.
 */
export function registerSmsWebhook(app: Express) {
  app.get("/api/sms/inbound", async (req, res) => {
    try {
      const { to, from, message, ref } = req.query;

      if (!from || !message) {
        res.status(400).json({ error: "Missing required parameters (from, message)" });
        return;
      }

      const logEntry: InsertSmsLogEntry = {
        direction: "received",
        phone: String(from),
        contactName: null, // We'll try to match this to a lead name on the frontend
        message: String(message),
        senderName: to ? String(to) : null,
        parts: 1,
        cost: 0, // Inbound messages don't cost credits
        status: "delivered",
        userId: null,
        createdAt: Date.now(),
      };

      await insertSmsLogBatch([logEntry]);

      console.log(`[SMS Webhook] Received message from ${from}: "${String(message).substring(0, 50)}..."`);

      // SMS Broadcast expects a 200 response to confirm receipt
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("[SMS Webhook] Error processing inbound message:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Also support POST for flexibility
  app.post("/api/sms/inbound", async (req, res) => {
    try {
      const { to, from, message, ref } = req.body;

      if (!from || !message) {
        res.status(400).json({ error: "Missing required parameters (from, message)" });
        return;
      }

      const logEntry: InsertSmsLogEntry = {
        direction: "received",
        phone: String(from),
        contactName: null,
        message: String(message),
        senderName: to ? String(to) : null,
        parts: 1,
        cost: 0,
        status: "delivered",
        userId: null,
        createdAt: Date.now(),
      };

      await insertSmsLogBatch([logEntry]);

      console.log(`[SMS Webhook] Received message from ${from}: "${String(message).substring(0, 50)}..."`);

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("[SMS Webhook] Error processing inbound message:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
