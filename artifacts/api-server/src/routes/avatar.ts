import { Router, type IRouter, type Request, type Response } from "express";
import { getGemini } from "../gemini";
import { requireAuth } from "../lib/auth";
import { makeRateLimiter } from "../lib/rateLimit";

const router: IRouter = Router();

const STYLE_PROMPT = `Transform this photo of a dog into a warm, hand-painted children's-book style illustrated portrait.
Soft painterly brushwork, gentle warm lighting, rounded friendly proportions, expressive sparkling eyes, a calm happy expression.
Keep the dog's real breed, fur colors, markings and distinctive features clearly recognizable.
Center the dog, head and chest visible, looking toward the viewer.
Plain soft cream-to-sage gradient background, no text, no border, no frame.
Cohesive cozy storybook aesthetic suitable for a premium pet-care app avatar.`;

const MODEL = "gemini-2.5-flash-image";
const MAX_INPUT_BYTES = 7 * 1024 * 1024;

// Shared painterly identity so every emotion looks like the same dog in the same app style.
const BASE_STYLE = `Warm hand-painted children's-book illustration of THIS dog.
Soft painterly brushwork, gentle warm lighting, rounded friendly proportions, expressive sparkling eyes.
Keep the dog's real breed, fur colors, markings and distinctive features clearly recognizable across every image.
Center the dog, head and chest visible. No text, no border, no frame. Cohesive cozy storybook aesthetic for a premium pet-care app avatar.`;

// Per-mood expression + a distinct cozy background so the scene shifts with feeling.
const EMOTION_PROMPTS: Record<string, string> = {
  happy:
    "Expression: pure joy — bright open smile, tongue peeking, sparkling happy eyes, ears relaxed. Background: sunny golden meadow with soft warm light.",
  excited:
    "Expression: eager and playful — ears perked up, alert bright eyes, energetic open-mouth grin ready to play. Background: vibrant park with a hint of motion and warm daylight.",
  calm:
    "Expression: serene and content — soft half-closed eyes, gentle relaxed closed-mouth smile, cozy and settled. Background: snug warm living room with soft evening glow.",
  anxious:
    "Expression: gentle worry — ears slightly back, soft pleading eyes, a little unsure but still endearing and cute. Background: muted cool soft-focus indoor scene, calm and quiet.",
  unwell:
    "Expression: tired and under the weather — droopy resting eyes, head low and soft, snuggled and sleepy. Background: dim cozy bed with a soft blanket and gentle low light.",
};

const EMOTION_LIST = ["happy", "excited", "calm", "anxious", "unwell"] as const;

const rateLimited = makeRateLimiter({ maxPerWindow: 6, globalMaxPerWindow: 60 });

router.post("/avatar-stylize", requireAuth, async (req: Request, res: Response) => {
  try {
    const ai = getGemini();
    if (!ai) {
      res.status(503).json({
        error: "Portrait Studio isn't configured yet. Please try again later.",
      });
      return;
    }

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

async function generateEmotion(
  ai: NonNullable<ReturnType<typeof getGemini>>,
  cleaned: string,
  mimeType: string,
  emotion: string,
): Promise<{ imageBase64: string; mimeType: string } | { error: string }> {
  try {
    const prompt = `${BASE_STYLE}\n\n${EMOTION_PROMPTS[emotion] ?? ""}`;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType, data: cleaned } }, { text: prompt }],
        },
      ],
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      const textPart = parts.find((p) => p.text)?.text;
      return { error: textPart || "No image returned." };
    }
    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
  } catch (error: unknown) {
    return { error: (error as Error).message };
  }
}

// Generate a full SET of emotion avatars from a single photo, so the user's own
// dog becomes the live, emoting avatar across the app.
router.post("/avatar-emotions", requireAuth, async (req: Request, res: Response) => {
  try {
    const ai = getGemini();
    if (!ai) {
      res.status(503).json({
        error: "Portrait Studio isn't configured yet. Please try again later.",
      });
      return;
    }

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

    const results = await Promise.all(
      EMOTION_LIST.map((emotion) => generateEmotion(ai, cleaned, mimeType, emotion)),
    );

    const images: Record<string, { imageBase64: string; mimeType: string }> = {};
    const errors: Record<string, string> = {};
    EMOTION_LIST.forEach((emotion, i) => {
      const r = results[i];
      if ("imageBase64" in r) images[emotion] = r;
      else errors[emotion] = r.error;
    });

    if (Object.keys(images).length === 0) {
      res.status(502).json({
        error: "Couldn't paint the portraits. Please try a clearer, well-lit photo.",
        errors,
      });
      return;
    }

    res.json({ images, errors });
  } catch (error: unknown) {
    res.status(502).json({ error: (error as Error).message });
  }
});

export default router;
