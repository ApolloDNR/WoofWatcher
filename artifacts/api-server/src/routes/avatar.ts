import { Router, type IRouter, type Request, type Response } from "express";
import { ai } from "../gemini";

const router: IRouter = Router();

const STYLE_PROMPT = `Transform this photo of a dog into a warm, hand-painted children's-book style illustrated portrait.
Soft painterly brushwork, gentle warm lighting, rounded friendly proportions, expressive sparkling eyes, a calm happy expression.
Keep the dog's real breed, fur colors, markings and distinctive features clearly recognizable.
Center the dog, head and chest visible, looking toward the viewer.
Plain soft cream-to-sage gradient background, no text, no border, no frame.
Cohesive cozy storybook aesthetic suitable for a premium pet-care app avatar.`;

const MODEL = "gemini-2.5-flash-image";
const MAX_INPUT_BYTES = 7 * 1024 * 1024;

// Lightweight in-memory throttle to protect a paid upstream model from abuse.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const GLOBAL_MAX_PER_WINDOW = 60;
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

router.post("/avatar-stylize", async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (rateLimited(ip)) {
      res.status(429).json({ error: "Too many portraits at once. Please wait a moment and try again." });
      return;
    }

    const body =
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const mimeType =
      typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "image/jpeg";

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const cleaned = imageBase64.includes(",")
      ? imageBase64.slice(imageBase64.indexOf(",") + 1)
      : imageBase64;

    const approxBytes = Math.floor((cleaned.length * 3) / 4);
    if (approxBytes > MAX_INPUT_BYTES) {
      res.status(413).json({ error: "Image too large. Please use an image under 7MB." });
      return;
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: cleaned } },
            { text: STYLE_PROMPT },
          ],
        },
      ],
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData?.data) {
      const textPart = parts.find((p) => p.text)?.text;
      res.status(502).json({
        error: textPart || "The model did not return an image. Please try a clearer photo.",
      });
      return;
    }

    res.json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    });
  } catch (error: unknown) {
    res.status(502).json({ error: (error as Error).message });
  }
});

export default router;
