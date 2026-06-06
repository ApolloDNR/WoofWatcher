import { Router, type IRouter, type Request, type Response } from "express";
import { getGemini } from "../gemini";
// @ts-ignore — vanilla JS module, no types
import { buildCareHelperInstructions, buildCareHelperInput, ensureVeterinaryBoundary, CARE_HELPER_BOUNDARY } from "../openai-care-helper.js";
import { requireAuth } from "../lib/auth";
import { makeRateLimiter } from "../lib/rateLimit";

const router: IRouter = Router();

const MODEL = "gemini-2.5-flash";

const rateLimited = makeRateLimiter({ maxPerWindow: 12, globalMaxPerWindow: 120 });

function extractGeminiText(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p: { text?: string }) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
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

router.post("/care-helper", requireAuth, async (req: Request, res: Response) => {
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
