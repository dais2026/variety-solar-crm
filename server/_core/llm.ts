/**
 * Standalone OpenAI Integration - Replaces Manus Forge API
 * 
 * Features:
 * - Chat completion with function calling
 * - Whisper API for transcription
 * - Text-to-speech for voice responses
 */

import OpenAI from "openai";

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const WHISPER_MODEL = "whisper-1";
const TTS_MODEL = "tts-1";

// Initialize OpenAI client
const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

// Types
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface FunctionCallResult {
  functionName: string;
  arguments: Record<string, any>;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: any[];
  toolChoice?: any;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface SpeechOptions {
  voice?: string;
  speed?: number;
  model?: string;
}

// Available voices for TTS
export const TTS_VOICES = {
  alloy: "alloy",
  echo: "echo",
  fable: "fable",
  onyx: "onyx",
  nova: "nova",
  shimmer: "shimmer",
} as const;

// Default system prompt for CRM assistant
const DEFAULT_SYSTEM_PROMPT = `You are a helpful CRM assistant for a solar energy company called Variety Solar.
Your role is to help sales staff with:
- Lead qualification and follow-up
- Call script suggestions
- Customer objection handling
- Product information
- Scheduling appointments

Be professional, concise, and helpful. Always be honest if you don't know something.
Do not make up information about pricing, warranties, or technical specifications without verification.`;

// Check if OpenAI is configured
export function isConfigured(): boolean {
  return !!OPENAI_API_KEY;
}

// Chat completion with optional function calling
export async function createCompletion(
  messages: LLMMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  if (!openai) {
    throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY in .env");
  }

  const {
    model = LLM_MODEL,
    temperature = 0.7,
    maxTokens = 2000,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    tools,
    toolChoice,
  } = options;

  // Prepare messages with system prompt
  const preparedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      name: m.name,
    })),
  ];

  const requestOptions: OpenAI.Chat.ChatCompletionCreateParams = {
    model,
    messages: preparedMessages,
    temperature,
    max_tokens: maxTokens,
  };

  if (tools && tools.length > 0) {
    requestOptions.tools = tools;
    if (toolChoice) {
      requestOptions.tool_choice = toolChoice;
    }
  }

  try {
    const response = await openai.chat.completions.create(requestOptions);
    const message = response.choices[0]?.message;

    if (!message) {
      throw new Error("No response from OpenAI");
    }

    return message.content || "";
  } catch (error: any) {
    console.error("[OpenAI] Completion error:", error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

// Chat completion with function calling support
export async function createCompletionWithFunctions(
  messages: LLMMessage[],
  functions: Array<{
    name: string;
    description: string;
    parameters: any;
  }>,
  options: CompletionOptions = {}
): Promise<{ content: string; functionCall?: FunctionCallResult }> {
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }

  const {
    model = LLM_MODEL,
    temperature = 0.7,
    maxTokens = 2000,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = options;

  // Prepare messages
  const preparedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      name: m.name,
      function_call: m.function_call,
    })),
  ];

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: preparedMessages,
      temperature,
      max_tokens: maxTokens,
      tools: functions.map((f) => ({
        type: "function" as const,
        function: {
          name: f.name,
          description: f.description,
          parameters: f.parameters,
        },
      })),
    });

    const message = response.choices[0]?.message;

    if (!message) {
      throw new Error("No response from OpenAI");
    }

    // Handle function call
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      return {
        content: message.content || "",
        functionCall: {
          functionName: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
        },
      };
    }

    return { content: message.content || "" };
  } catch (error: any) {
    console.error("[OpenAI] Function calling error:", error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

// Transcription using Whisper
export async function transcribeAudio(
  audioBuffer: Buffer,
  options: {
    language?: string;
    prompt?: string;
  } = {}
): Promise<TranscriptionResult> {
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    const file = await openai.audio.transcriptions.create({
      file: {
        name: "audio.mp3",
        data: audioBuffer,
      } as any,
      model: WHISPER_MODEL,
      language: options.language,
      prompt: options.prompt,
    });

    return {
      text: file.text,
      language: (file as any).language,
    };
  } catch (error: any) {
    console.error("[OpenAI] Transcription error:", error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

// Text-to-speech
export async function textToSpeech(
  text: string,
  options: SpeechOptions = {}
): Promise<Buffer> {
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }

  const {
    voice = "alloy",
    speed = 1.0,
    model = TTS_MODEL,
  } = options;

  try {
    const response = await openai.audio.speech.create({
      model,
      voice: voice as OpenAI.SpeechCreateParams["voice"],
      input: text,
      speed,
    });

    // Convert response to buffer
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error("[OpenAI] TTS error:", error);
    throw new Error(`TTS failed: ${error.message}`);
  }
}

// Get available models
export function getAvailableModels(): string[] {
  return [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
  ];
}

// Create embedding for search
export async function createEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error("[OpenAI] Embedding error:", error);
    throw new Error(`Embedding failed: ${error.message}`);
  }
}

// Export OpenAI client for advanced usage
export function getOpenAIClient(): OpenAI | null {
  return openai;
}

export default {
  isConfigured,
  createCompletion,
  createCompletionWithFunctions,
  transcribeAudio,
  textToSpeech,
  getAvailableModels,
  createEmbedding,
  getOpenAIClient,
  TTS_VOICES,
};