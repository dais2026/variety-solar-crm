/**
 * Calls Routes - Call management
 */

import { Router } from "express";
import { getLeadById, createCall, createActivity } from "../_core/db.js";
import { requireAuth } from "./auth.js";

const router = Router();

router.use(requireAuth);

// Get all calls
router.get("/", async (req, res) => {
  try {
    const { leadId, limit = "50", offset = "0" } = req.query;
    
    // TODO: Implement getCalls in db module
    res.json({ calls: [] });
  } catch (error) {
    console.error("[Calls] Get all error:", error);
    res.status(500).json({ error: "Failed to get calls" });
  }
});

// Get single call
router.get("/:id", async (req, res) => {
  try {
    // TODO: Implement getCallById in db module
    res.json({ call: null });
  } catch (error) {
    console.error("[Calls] Get one error:", error);
    res.status(500).json({ error: "Failed to get call" });
  }
});

// Create new call (log a call)
router.post("/", async (req, res) => {
  try {
    const { leadId, direction = "outbound", duration = 0, notes, recordingUrl } = req.body;
    
    if (!leadId) {
      return res.status(400).json({ error: "Lead ID required" });
    }

    const lead = await getLeadById(parseInt(leadId));
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const call = await createCall({
      leadId: parseInt(leadId),
      userId: req.user.id,
      direction,
      duration,
      status: "completed",
      notes,
      recordingUrl,
    });

    await createActivity({
      leadId: parseInt(leadId),
      userId: req.user.id,
      type: "call_completed",
      description: `${direction === "inbound" ? "Incoming" : "Outgoing"} call (${duration}s)`,
      metadata: JSON.stringify({ callId: call.id, duration }),
    });

    res.status(201).json({ call });
  } catch (error) {
    console.error("[Calls] Create error:", error);
    res.status(500).json({ error: "Failed to create call" });
  }
});

// Update call
router.put("/:id", async (req, res) => {
  try {
    const { notes, status } = req.body;
    
    // TODO: Implement updateCall in db module
    res.json({ success: true });
  } catch (error) {
    console.error("[Calls] Update error:", error);
    res.status(500).json({ error: "Failed to update call" });
  }
});

// Get calls for a lead
router.get("/lead/:leadId", async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId);
    
    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // TODO: Implement getCallsByLeadId in db module
    res.json({ calls: [] });
  } catch (error) {
    console.error("[Calls] Get by lead error:", error);
    res.status(500).json({ error: "Failed to get calls" });
  }
});

export default router;