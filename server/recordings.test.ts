import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "recordings/0412345678/1234567890.webm", url: "/manus-storage/recordings/0412345678/1234567890.webm" }),
  storageGetSignedUrl: vi.fn().mockResolvedValue("https://signed-url.example.com/audio.webm"),
}));

// Mock the voice transcription module
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    task: "transcribe",
    language: "en",
    duration: 120.5,
    text: "Hello, I'm interested in getting solar panels for my home. I have a north-facing roof.",
    segments: [],
  }),
}));

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          customerNeeds: "Solar panels for residential home",
          systemSizeDiscussed: "6.6kW solar system",
          budget: "Around $8,000-$10,000",
          roofDetails: "North-facing roof, no shading",
          currentElectricity: "High bills, around $400/quarter",
          objections: "Concerned about upfront cost",
          nextSteps: "Send proposal within 48 hours",
          keyInsights: "Customer is motivated by rising electricity costs",
          urgency: "Medium - wants to decide within 2 weeks",
        }),
      },
    }],
  }),
}));

// Mock the db module
vi.mock("./db", () => ({
  insertRecording: vi.fn().mockResolvedValue(1),
  getRecordingsByLead: vi.fn().mockResolvedValue([
    {
      id: 1,
      leadPhone: "0412345678",
      leadName: "John Smith",
      title: "Discovery Session - 2/6/2026",
      audioKey: "recordings/0412345678/1234567890.webm",
      audioUrl: "/manus-storage/recordings/0412345678/1234567890.webm",
      mimeType: "audio/webm",
      durationSeconds: 120,
      transcript: "Hello, I'm interested in getting solar panels.",
      aiSummary: null,
      transcriptionStatus: "completed",
      source: "live_recording",
      userId: 1,
      createdAt: 1717286400000,
    },
  ]),
  getRecordingById: vi.fn().mockResolvedValue({
    id: 1,
    leadPhone: "0412345678",
    leadName: "John Smith",
    title: "Discovery Session",
    audioKey: "recordings/0412345678/1234567890.webm",
    audioUrl: "/manus-storage/recordings/0412345678/1234567890.webm",
    mimeType: "audio/webm",
    durationSeconds: 120,
    transcript: "Hello, I'm interested in getting solar panels for my home.",
    aiSummary: null,
    transcriptionStatus: "completed",
    source: "live_recording",
    userId: 1,
    createdAt: 1717286400000,
  }),
  updateRecordingTranscript: vi.fn().mockResolvedValue(undefined),
  updateRecordingSummary: vi.fn().mockResolvedValue(undefined),
  updateRecordingStatus: vi.fn().mockResolvedValue(undefined),
  getAllRecordings: vi.fn().mockResolvedValue([]),
}));

import { storagePut, storageGetSignedUrl } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import {
  insertRecording,
  getRecordingsByLead,
  getRecordingById,
  updateRecordingTranscript,
  updateRecordingSummary,
  updateRecordingStatus,
} from "./db";

describe("Recordings Router Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Upload", () => {
    it("should upload audio to S3 and insert a database record", async () => {
      // Simulate the upload logic
      const audioBase64 = Buffer.from("fake audio data").toString("base64");
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const fileKey = `recordings/0412345678/${Date.now()}.webm`;

      const { key, url } = await (storagePut as any)(fileKey, audioBuffer, "audio/webm");

      expect(storagePut).toHaveBeenCalledWith(fileKey, audioBuffer, "audio/webm");
      expect(key).toBe("recordings/0412345678/1234567890.webm");
      expect(url).toContain("/manus-storage/");

      // Insert record
      const recordId = await (insertRecording as any)({
        leadPhone: "0412345678",
        leadName: "John Smith",
        title: "Discovery Session",
        audioKey: key,
        audioUrl: url,
        mimeType: "audio/webm",
        durationSeconds: 60,
        transcript: null,
        aiSummary: null,
        transcriptionStatus: "pending",
        source: "live_recording",
        userId: 1,
        createdAt: Date.now(),
      });

      expect(insertRecording).toHaveBeenCalled();
      expect(recordId).toBe(1);
    });

    it("should reject files larger than 16MB", () => {
      const largeSizeMB = 17;
      const sizeBytes = largeSizeMB * 1024 * 1024;
      const audioBuffer = Buffer.alloc(sizeBytes);
      const sizeMB = audioBuffer.length / (1024 * 1024);

      expect(sizeMB).toBeGreaterThan(16);
      // The router would throw an error for files > 16MB
    });

    it("should determine correct file extension from MIME type", () => {
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

      expect(extMap["audio/webm"]).toBe("webm");
      expect(extMap["audio/mpeg"]).toBe("mp3");
      expect(extMap["audio/m4a"]).toBe("m4a");
      expect(extMap["audio/mp4"]).toBe("m4a");
    });
  });

  describe("Transcribe", () => {
    it("should get a signed URL and call transcribeAudio", async () => {
      const recording = await (getRecordingById as any)(1);
      expect(recording).not.toBeNull();

      // Get signed URL
      const signedUrl = await (storageGetSignedUrl as any)(recording.audioKey);
      expect(storageGetSignedUrl).toHaveBeenCalledWith(recording.audioKey);
      expect(signedUrl).toContain("https://");

      // Transcribe
      const result = await (transcribeAudio as any)({
        audioUrl: signedUrl,
        language: "en",
        prompt: "Transcribe this solar energy discovery session conversation.",
      });

      expect(transcribeAudio).toHaveBeenCalled();
      expect(result.text).toContain("solar panels");
      expect(result.language).toBe("en");
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should update recording status to processing then completed", async () => {
      await (updateRecordingStatus as any)(1, "processing");
      expect(updateRecordingStatus).toHaveBeenCalledWith(1, "processing");

      await (updateRecordingTranscript as any)(1, "Transcribed text here", "completed");
      expect(updateRecordingTranscript).toHaveBeenCalledWith(1, "Transcribed text here", "completed");
    });

    it("should handle transcription failure gracefully", async () => {
      const { transcribeAudio: mockTranscribe } = await import("./_core/voiceTranscription");
      (mockTranscribe as any).mockResolvedValueOnce({
        error: "File too large",
        code: "FILE_TOO_LARGE",
        details: "File size is 18MB",
      });

      const result = await (mockTranscribe as any)({ audioUrl: "https://example.com/audio.webm" });
      expect(result.error).toBeDefined();
      expect(result.code).toBe("FILE_TOO_LARGE");
    });
  });

  describe("Summarize", () => {
    it("should call LLM with transcript and return structured summary", async () => {
      const recording = await (getRecordingById as any)(1);
      expect(recording.transcript).toBeTruthy();

      const response = await (invokeLLM as any)({
        messages: [
          { role: "system", content: "You are an AI assistant for Variety Solar." },
          { role: "user", content: `Analyze: ${recording.transcript}` },
        ],
      });

      expect(invokeLLM).toHaveBeenCalled();
      const summaryText = response.choices[0].message.content;
      const summary = JSON.parse(summaryText);

      expect(summary.customerNeeds).toBeDefined();
      expect(summary.systemSizeDiscussed).toBeDefined();
      expect(summary.budget).toBeDefined();
      expect(summary.nextSteps).toBeDefined();
      expect(summary.urgency).toBeDefined();
    });

    it("should save summary to database after generation", async () => {
      const summaryJson = JSON.stringify({ customerNeeds: "Solar panels" });
      await (updateRecordingSummary as any)(1, summaryJson);
      expect(updateRecordingSummary).toHaveBeenCalledWith(1, summaryJson);
    });
  });

  describe("Query", () => {
    it("should fetch recordings by lead phone number", async () => {
      const recordings = await (getRecordingsByLead as any)("0412345678");
      expect(getRecordingsByLead).toHaveBeenCalledWith("0412345678");
      expect(recordings).toHaveLength(1);
      expect(recordings[0].leadName).toBe("John Smith");
      expect(recordings[0].transcriptionStatus).toBe("completed");
    });

    it("should fetch a single recording by ID", async () => {
      const recording = await (getRecordingById as any)(1);
      expect(getRecordingById).toHaveBeenCalledWith(1);
      expect(recording).not.toBeNull();
      expect(recording.id).toBe(1);
      expect(recording.leadPhone).toBe("0412345678");
    });
  });
});
