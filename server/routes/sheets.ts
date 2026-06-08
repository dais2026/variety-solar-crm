/**
 * Sheets Routes - Google Sheets integration
 */

import { Router } from "express";
import { importLeadsFromSheet, exportLeadsToSheet, getSheetInfo, isConfigured } from "../_core/google-sheets.js";
import { getLeads } from "../_core/db.js";
import { requireAuth } from "./auth.js";

const router = Router();

router.use(requireAuth);

// Import leads from Google Sheet
router.post("/import", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "Google Sheets not configured" });
    }

    const result = await importLeadsFromSheet();

    res.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error("[Sheets] Import error:", error);
    res.status(500).json({ error: error.message || "Import failed" });
  }
});

// Export leads to Google Sheet
router.post("/export", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "Google Sheets not configured" });
    }

    const { status } = req.body;
    
    const leads = await getLeads({ status });
    await exportLeadsToSheet(leads);

    res.json({ success: true, exported: leads.length });
  } catch (error: any) {
    console.error("[Sheets] Export error:", error);
    res.status(500).json({ error: error.message || "Export failed" });
  }
});

// Get sheet info
router.get("/info", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "Google Sheets not configured" });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return res.status(400).json({ error: "No spreadsheet ID configured" });
    }

    const info = await getSheetInfo(spreadsheetId);
    res.json(info);
  } catch (error: any) {
    console.error("[Sheets] Info error:", error);
    res.status(500).json({ error: error.message || "Failed to get sheet info" });
  }
});

export default router;