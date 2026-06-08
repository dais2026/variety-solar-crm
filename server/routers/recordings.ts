import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { storageGetSignedUrl } from "../storage";
import { transcribeAudio } from "../_core/voiceTranscription";
import { invokeLLM } from "../_core/llm";
import {
  insertRecording,
  getRecordingsByLead,
  getRecordingById,
  updateRecordingTranscript,
  updateRecordingSummary,
  updateRecordingStatus,
  getAllRecordings,
  deleteRecording,
} from "../db";

export const recordingsRouter = router({
  /**
   * Upload an audio recording for a lead.
   * Accepts base64-encoded audio data from the frontend.
   */
  upload: publicProcedure
    .input(
      z.object({
        leadPhone: z.string().min(1),
        leadName: z.string().min(1),
        title: z.string().optional(),
        audioBase64: z.string().min(1),
        mimeType: z.string().default("audio/webm"),
        durationSeconds: z.number().optional(),
        source: z.enum(["live_recording", "upload"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Decode base64 audio data
      const audioBuffer = Buffer.from(input.audioBase64, "base64");

      // Check file size (16MB limit for transcription)
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        throw new Error(`Audio file too large (${sizeMB.toFixed(1)}MB). Maximum is 16MB.`);
      }

      // Determine file extension from MIME type
      const extMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
        "audio/m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
      };
      const ext = extMap[input.mimeType] || "webm";

      // Upload to S3
      const fileKey = `recordings/${input.leadPhone.replace(/[^0-9+]/g, "")}/${Date.now()}.${ext}`;
      const { key, url } = await storagePut(fileKey, audioBuffer, input.mimeType);

      // Insert record into database
      const recordId = await insertRecording({
        leadPhone: input.leadPhone,
        leadName: input.leadName,
        title: input.title || `Discovery Session - ${new Date().toLocaleDateString()}`,
        audioKey: key,
        audioUrl: url,
        mimeType: input.mimeType,
        durationSeconds: input.durationSeconds || null,
        transcript: null,
        aiSummary: null,
        transcriptionStatus: "pending",
        source: input.source,
        userId: ctx.user?.id || null,
        createdAt: Date.now(),
      });

      return { id: recordId, audioUrl: url };
    }),

  /**
   * Trigger transcription for a recording.
   * This is called after upload to start the async transcription process.
   */
  transcribe: publicProcedure
    .input(z.object({ recordingId: z.number() }))
    .mutation(async ({ input }) => {
      const recording = await getRecordingById(input.recordingId);
      if (!recording) {
        throw new Error("Recording not found");
      }

      // Update status to processing
      await updateRecordingStatus(input.recordingId, "processing");

      try {
        // Get a signed URL for the audio file so Whisper can access it
        const signedUrl = await storageGetSignedUrl(recording.audioKey);

        // Transcribe the audio
        const result = await transcribeAudio({
          audioUrl: signedUrl,
          language: "en",
          prompt: "Transcribe this solar energy discovery session conversation. The discussion may include topics like solar panels, batteries, electricity usage, roof type, budget, and home energy systems.",
        });

        // Check if it's an error response
        if ("error" in result) {
          await updateRecordingTranscript(input.recordingId, "", "failed");
          return { success: false, error: result.error, details: result.details };
        }

        // Save transcript
        await updateRecordingTranscript(input.recordingId, result.text, "completed");

        return {
          success: true,
          transcript: result.text,
          language: result.language,
          duration: result.duration,
        };
      } catch (error) {
        await updateRecordingTranscript(input.recordingId, "", "failed");
        throw error;
      }
    }),

  /**
   * Generate an AI summary from the transcript.
   * Extracts structured information relevant to solar sales.
   */
  summarize: publicProcedure
    .input(z.object({ recordingId: z.number() }))
    .mutation(async ({ input }) => {
      const recording = await getRecordingById(input.recordingId);
      if (!recording) {
        throw new Error("Recording not found");
      }
      if (!recording.transcript) {
        throw new Error("No transcript available. Please transcribe first.");
      }

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an AI assistant for Variety Solar, a solar energy company. Analyze the following discovery session transcript and extract key information into a structured summary. Focus on actionable sales intelligence.`,
          },
          {
            role: "user",
            content: `Please analyze this discovery session transcript and provide a structured summary:\n\n${recording.transcript}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "discovery_summary",
            strict: true,
            schema: {
              type: "object",
              properties: {
                customerNeeds: {
                  type: "string",
                  description: "What the customer is looking for (solar, battery, EV, etc.)",
                },
                systemSizeDiscussed: {
                  type: "string",
                  description: "Any system sizes mentioned (kW for solar, kWh for battery)",
                },
                budget: {
                  type: "string",
                  description: "Budget range or price sensitivity mentioned",
                },
                roofDetails: {
                  type: "string",
                  description: "Roof type, orientation, shading issues mentioned",
                },
                currentElectricity: {
                  type: "string",
                  description: "Current electricity usage, bills, or provider mentioned",
                },
                objections: {
                  type: "string",
                  description: "Any concerns, objections, or hesitations raised",
                },
                nextSteps: {
                  type: "string",
                  description: "Agreed next steps or follow-up actions",
                },
                keyInsights: {
                  type: "string",
                  description: "Other important notes or insights from the conversation",
                },
                urgency: {
                  type: "string",
                  description: "How urgent is the customer's need (high/medium/low and why)",
                },
              },
              required: [
                "customerNeeds",
                "systemSizeDiscussed",
                "budget",
                "roofDetails",
                "currentElectricity",
                "objections",
                "nextSteps",
                "keyInsights",
                "urgency",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const summaryText = (response.choices?.[0]?.message?.content as string) || "";
      await updateRecordingSummary(input.recordingId, summaryText);

      return { success: true, summary: summaryText };
    }),

  /**
   * Get all recordings for a specific lead (by phone number).
   */
  getByLead: publicProcedure
    .input(z.object({ leadPhone: z.string().min(1) }))
    .query(async ({ input }) => {
      return getRecordingsByLead(input.leadPhone);
    }),

  /**
   * Get a single recording by ID.
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getRecordingById(input.id);
    }),

  /**
   * Delete a recording by ID.
   */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const recording = await getRecordingById(input.id);
      if (!recording) {
        throw new Error("Recording not found");
      }
      await deleteRecording(input.id);
      return { success: true };
    }),

  /**
   * Get all recordings across all leads.
   */
  getAll: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;
      return getAllRecordings(limit, offset);
    }),
});
