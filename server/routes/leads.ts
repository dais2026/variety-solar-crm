/**
 * Leads Routes - CRUD operations for leads
 */

import { Router } from "express";
import { getLeads, getLeadById, createLead, updateLead, createActivity } from "../_core/db.js";
import { requireAuth } from "./auth.js";

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Get all leads
router.get("/", async (req, res) => {
  try {
    const { status, limit = "100", offset = "0" } = req.query;
    
    const leads = await getLeads({
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({ leads });
  } catch (error) {
    console.error("[Leads] Get all error:", error);
    res.status(500).json({ error: "Failed to get leads" });
  }
});

// Get single lead
router.get("/:id", async (req, res) => {
  try {
    const lead = await getLeadById(parseInt(req.params.id));
    
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json({ lead });
  } catch (error) {
    console.error("[Leads] Get one error:", error);
    res.status(500).json({ error: "Failed to get lead" });
  }
});

// Create new lead
router.post("/", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      suburb,
      state,
      postcode,
      status = "new",
      source,
      notes,
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First name and last name required" });
    }

    const lead = await createLead({
      ownerId: req.user.id,
      firstName,
      lastName,
      email,
      phone,
      address,
      suburb,
      state,
      postcode,
      status,
      source,
      notes,
    });

    // Log activity
    await createActivity({
      leadId: lead.id,
      userId: req.user.id,
      type: "lead_created",
      description: `Lead created: ${firstName} ${lastName}`,
    });

    res.status(201).json({ lead });
  } catch (error) {
    console.error("[Leads] Create error:", error);
    res.status(500).json({ error: "Failed to create lead" });
  }
});

// Update lead
router.put("/:id", async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const existingLead = await getLeadById(leadId);
    
    if (!existingLead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      suburb,
      state,
      postcode,
      status,
      source,
      notes,
    } = req.body;

    await updateLead(leadId, {
      firstName,
      lastName,
      email,
      phone,
      address,
      suburb,
      state,
      postcode,
      status,
      source,
      notes,
    });

    const updatedLead = await getLeadById(leadId);

    // Log activity
    await createActivity({
      leadId,
      userId: req.user.id,
      type: "lead_updated",
      description: `Lead updated: ${updatedLead.first_name} ${updatedLead.last_name}`,
      metadata: JSON.stringify({ status }),
    });

    res.json({ lead: updatedLead });
  } catch (error) {
    console.error("[Leads] Update error:", error);
    res.status(500).json({ error: "Failed to update lead" });
  }
});

// Delete lead
router.delete("/:id", async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const lead = await getLeadById(leadId);
    
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // TODO: Add deleteLead to db module
    res.json({ success: true });
  } catch (error) {
    console.error("[Leads] Delete error:", error);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

// Search leads
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || (q as string).length < 2) {
      return res.status(400).json({ error: "Search query too short" });
    }

    // Get all leads and filter (for simplicity - use proper search in production)
    const leads = await getLeads({ limit: 100 });
    
    const searchTerm = (q as string).toLowerCase();
    const filtered = leads.filter((lead: any) => 
      lead.first_name?.toLowerCase().includes(searchTerm) ||
      lead.last_name?.toLowerCase().includes(searchTerm) ||
      lead.email?.toLowerCase().includes(searchTerm) ||
      lead.phone?.includes(searchTerm)
    );

    res.json({ leads: filtered });
  } catch (error) {
    console.error("[Leads] Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// Get lead activities
router.get("/:id/activities", async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const lead = await getLeadById(leadId);
    
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // TODO: Add getLeadActivities to db module
    res.json({ activities: [] });
  } catch (error) {
    console.error("[Leads] Get activities error:", error);
    res.status(500).json({ error: "Failed to get activities" });
  }
});

export default router;