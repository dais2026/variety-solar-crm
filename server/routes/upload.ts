/**
 * Upload Routes - File uploads to S3
 */

import { Router } from "express";
import { uploadAudio, isConfigured } from "../_core/storage.js";
import { requireAuth } from "./auth.js";
import { createCall, createActivity } from "../_core/db.js";

const router = Router();

router.use(requireAuth);

// Upload call recording
router.post("/recording", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "Storage not configured" });
    }

    const { audioData, leadId, duration } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: "Audio data required" });
    }

    // Decode base64 audio
    const buffer = Buffer.from(audioData, "base64");
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `recording-${timestamp}.mp3`;

    // Upload to S3
    const result = await uploadAudio(buffer, filename, {
      leadId: leadId ? parseInt(leadId) : undefined,
      userId: req.user.id,
      duration: duration ? parseInt(duration) : undefined,
    });

    // Create call record
    if (leadId) {
      await createCall({
        leadId: parseInt(leadId),
        userId: req.user.id,
        direction: "outbound",
        duration: duration ? parseInt(duration) : 0,
        status: "completed",
        recordingUrl: result.url,
      });

      await createActivity({
        leadId: parseInt(leadId),
        userId: req.user.id,
        type: "call_recorded",
        description: "Call recording uploaded",
        metadata: JSON.stringify({ duration, url: result.url }),
      });
    }

    res.json({
      success: true,
      url: result.url,
      key: result.key,
    });
  } catch (error: any) {
    console.error("[Upload] Recording error:", error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

// Upload general file
router.post("/file", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "Storage not configured" });
    }

    const { fileData, filename, contentType, prefix = "uploads" } = req.body;
    
    if (!fileData || !filename) {
      return res.status(400).json({ error: "File data and filename required" });
    }

    const buffer = Buffer.from(fileData, "base64");
    
    const { uploadFile } = await import("../_core/storage.js");
    const result = await uploadFile(`${prefix}/${filename}`, buffer, {
      contentType: contentType || "application/octet-stream",
      metadata: {
        uploadedBy: String(req.user.id),
        uploadedAt: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      url: result.url,
      key: result.key,
    });
  } catch (error: any) {
    console.error("[Upload] File error:", error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

export default router;