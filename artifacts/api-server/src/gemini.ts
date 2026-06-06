import { GoogleGenAI } from "@google/genai";

let cached: GoogleGenAI | null = null;

export function isGeminiConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL &&
      process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  );
}

/**
 * Lazily construct the Gemini client. Returns null when the integration env
 * vars are absent so callers can degrade gracefully (e.g. respond 503) instead
 * of crashing the whole API server at module load.
 */
export function getGemini(): GoogleGenAI | null {
  if (!isGeminiConfigured()) return null;
  if (!cached) {
    cached = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        timeout: 60_000,
      },
    });
  }
  return cached;
}
