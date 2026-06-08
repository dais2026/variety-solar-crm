/**
 * AI Routes - OpenAI integration for CRM assistant
 */

import { Router } from "express";
import { createCompletion, createCompletionWithFunctions, transcribeAudio, textToSpeech, isConfigured } from "../_core/llm.js";
import { requireAuth } from "./auth.js";
import { getLeadById, createCall, createActivity } from "../_core/db.js";

const router = Router();

// Apply auth middleware
router.use(requireAuth);

// Chat with AI assistant
router.post("/chat", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "OpenAI not configured" });
    }

    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array required" });
    }

    // Build system prompt with context
    let systemPrompt = `You are a helpful CRM assistant for a solar energy company called Variety Solar in Australia.
Your role is to help sales staff with:
- Lead qualification and follow-up
- Call script suggestions
- Customer objection handling
- Product information about solar panels, batteries, and installation
- Scheduling appointments

Be professional, concise, and helpful. Always be honest if you don't know something.
Do not make up information about pricing, warranties, or technical specifications.`;

    // Add lead context if provided
    if (context?.leadId) {
      const lead = await getLeadById(context.leadId);
      if (lead) {
        systemPrompt += `\n\nCurrent lead context:\n- Name: ${lead.first_name} ${lead.last_name}\n- Status: ${lead.status}\n- Email: ${lead.email || "N/A"}\n- Phone: ${lead.phone || "N/A"}\n- Address: ${lead.address || "N/A"}\n- Notes: ${lead.notes || "N/A"}`;
      }
    }

    const response = await createCompletion(messages, { systemPrompt });

    res.json({ response });
  } catch (error: any) {
    console.error("[AI] Chat error:", error);
    res.status(500).json({ error: error.message || "AI request failed" });
  }
});

// Get call script suggestions
router.post("/call-script", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "OpenAI not configured" });
    }

    const { leadId, scriptType = "introduction" } = req.body;
    
    let leadContext = "";
    if (leadId) {
      const lead = await getLeadById(leadId);
      if (lead) {
        leadContext = `Lead name: ${lead.first_name} ${lead.last_name}\nStatus: ${lead.status}`;
      }
    }

    const messages = [
      { role: "user" as const, content: `Generate a ${scriptType} script for a solar sales call. ${leadContext}\n\nInclude:\n1. Opening greeting\n2. Key talking points\n3. Common objections and responses\n4. Closing questions\n\nFormat as a structured outline.` },
    ];

    const response = await createCompletion(messages, {
      systemPrompt: "You are an expert solar sales coach. Generate helpful, professional call scripts.",
      maxTokens: 1500,
    });

    res.json({ script: response });
  } catch (error: any) {
    console.error("[AI] Call script error:", error);
    res.status(500).json({ error: error.message || "Failed to generate script" });
  }
});

// Analyze lead sentiment
router.post("/analyze-lead", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "OpenAI not configured" });
    }

    const { leadId, notes } = req.body;
    
    let leadContext = "";
    if (leadId) {
      const lead = await getLeadById(leadId);
      if (lead) {
        leadContext = `Lead: ${lead.first_name} ${lead.last_name}\nStatus: ${lead.status}\nNotes: ${lead.notes || "None"}`;
      }
    }

    const messages = [
      { 
        role: "user" as const, 
        content: `Analyze this lead and provide insights:\n\n${leadContext}\n\nAdditional notes: ${notes || "N/A"}\n\nProvide:\n1. Lead quality score (1-10)\n2. Recommended next actions\n3. Key insights about the customer\n4. Suggested follow-up timing` 
      },
    ];

    const response = await createCompletion(messages, {
      systemPrompt: "You are a sales analyst. Analyze leads and provide actionable insights.",
      maxTokens: 800,
    });

    res.json({ analysis: response });
  } catch (error: any) {
    console.error("[AI] Analyze error:", error);
    res.status(500).json({ error: error.message || "Analysis failed" });
  }
});

// Transcribe audio
router.post("/transcribe", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "OpenAI not configured" });
    }

    const { audioData, format = "mp3" } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: "Audio data required" });
    }

    // Decode base64 audio
    const buffer = Buffer.from(audioData, "base64");
    
    const result = await transcribeAudio(buffer, {
      prompt: "Solar energy sales call in Australia. Include product names, company names, and technical terms.",
    });

    res.json({ transcription: result.text });
  } catch (error: any) {
    console.error("[AI] Transcribe error:", error);
    res.status(500).json({ error: error.message || "Transcription failed" });
  }
});

// Text to speech
router.post("/speak", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "OpenAI not configured" });
    }

    const { text, voice = "alloy", speed = 1.0 } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Text required" });
    }

    const audioBuffer = await textToSpeech(text, { voice, speed });

    res.json({ 
      audio: audioBuffer.toString("base64"),
      format: "mp3"
    });
  } catch (error: any) {
    console.error("[AI] TTS error:", error);
    res.status(500).json({ error: error.message || "Speech synthesis failed" });
  }
});

// Generate follow-up email
router.post("/generate-email", async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({ error: "OpenAI not configured" });
    }

    const { leadId, emailType = "follow-up" } = req.body;
    
    let leadContext = "";
    if (leadId) {
      const lead = await getLeadById(leadId);
      if (lead) {
        leadContext = `Customer: ${lead.first_name} ${lead.last_name}\nEmail: ${lead.email || "N/A"}\nStatus: ${lead.status}`;
      }
    }

    const messages = [
      { 
        role: "user" as const, 
        content: `Write a professional ${emailType} email for a solar company.\n\n${leadContext}\n\nMake it friendly, professional, and include a clear call to action.` 
      },
    ];

    const response = await createCompletion(messages, {
      systemPrompt: "You are a professional business writer. Write clear, concise emails that convert.",
      maxTokens: 1000,
    });

    res.json({ email: response });
  } catch (error: any) {
    console.error("[AI] Email generation error:", error);
    res.status(500).json({ error: error.message || "Email generation failed" });
  }
});

export default router;