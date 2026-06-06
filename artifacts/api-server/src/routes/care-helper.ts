import { Router, type IRouter, type Request, type Response } from "express";
import { getGemini } from "../gemini";
// @ts-ignore — vanilla JS module, no types
import { buildCareHelperInstructions, buildCareHelperInput, ensureVeterinaryBoundary, CARE_HELPER_BOUNDARY } from "../openai-care-helper.js";

const router: IRouter = Router();

const MODEL = "gemini-2.5-flash";

// Lightweight in-memory throttle to protect a paid upstream model from abuse.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const GLOBAL_MAX_PER_WINDOW = 120;
const hits = new Map<string, number[]>();
let globalHits: number[] = [];

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  globalHits = globalHits.filter((t) => t > cutoff);
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= MAX_PER_WINDOW || globalHits.length >= GLOBAL_MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  globalHits.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) {
    for (const [k, v] of hits) if (v.every((t) => t <= cutoff)) hits.delete(k);
  }
  return false;
}

function extractGeminiText(response: any): string {
  const direct = typeof response?.text === "string" ? response.text : "";
  if (direct.trim()) return direct.trim();
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p: { text?: string }) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
  return text;
}

router.get("/care-helper", (_req: Request, res: Response) => {
  const configured = Boolean(getGemini());
  res.json({
    configured,
    model: MODEL,
    boundary: CARE_HELPER_BOUNDARY,
    mode: configured ? "gemini" : "local",
  });
});

router.post("/care-helper", async (req: Request, res: Response) => {
  const ai = getGemini();

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (ai && rateLimited(ip)) {
    res.status(429).json({ error: "Too many questions at once. Please wait a moment and try again." });
    return;
  }

  // Graceful fallback so WoofGuide always responds instead of erroring out.
  if (!ai) {
    res.json({
      answer: ensureVeterinaryBoundary(
        "WoofGuide's AI assistant isn't available right now. In the meantime, keep tracking meals, timing, appetite, vomit events, stool, energy, and any red flags so the next caregiver has full context.",
      ),
      mode: "local",
      model: MODEL,
    });
    return;
  }

  try {
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: buildCareHelperInput({ question: body.question, context: body.context }) }],
        },
      ],
      config: {
        systemInstruction: buildCareHelperInstructions(),
        maxOutputTokens: 700,
        temperature: 0.6,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const answer = ensureVeterinaryBoundary(extractGeminiText(response));
    res.json({ answer, mode: "gemini", model: MODEL });
  } catch (error: unknown) {
    const err = error as Error;
    req.log?.error({ err }, "care-helper failed");
    res.status(502).json({
      error: err.message,
      mode: "gemini",
      boundary: CARE_HELPER_BOUNDARY,
    });
  }
});

export default router;
