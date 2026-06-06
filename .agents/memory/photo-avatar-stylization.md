---
name: Photo→avatar stylization
description: How the WoofWatcher photo→illustrated-avatar feature is wired (Gemini image-edit) and the Express body-limit gotcha that breaks base64 image uploads.
---

# Photo → illustrated avatar (image-to-image)

The mobile "Portrait Studio" sends a user dog photo to the api-server, which calls
Gemini's image model to repaint it in the app's storybook style.

- Provider: Replit AI Integration for Gemini (no user API key; billed to credits).
  Env vars `AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY`.
- Model: `gemini-2.5-flash-image` (nano-banana, flash). Good + cheap for stylization;
  only use a pro image model if the user explicitly asks for higher quality.
- Image-edit call shape: `ai.models.generateContent({ model, contents:[{ role:"user",
  parts:[{ inlineData:{ mimeType, data: <base64-no-prefix> } }, { text: prompt }] }] })`.
  The returned image is in `response.candidates[0].content.parts[].inlineData.data`
  (base64) — find the part that has `inlineData.data`; a text-only part means the model
  refused/returned no image.

## Gotcha: Express default JSON body limit breaks image uploads
**Rule:** any endpoint that accepts a base64 image MUST raise the body-parser limit.
**Why:** `express.json()` defaults to 100kb. Phone photos are MBs, so the request is
rejected and the Replit proxy returns an **HTML error page** (not JSON) — the symptom is
a client `SyntaxError: Unexpected token '<' ... is not valid JSON`, which looks like a
routing bug but is actually payload-too-large.
**How to apply:** set `express.json({ limit: "15mb" })` (and matching urlencoded). Also
downscale client-side (expo-image-manipulator, ~900px, jpeg 0.7) to keep payloads small.

## Cost protection (paid upstream)
The stylize endpoint is unauthenticated, so it has an in-memory per-IP + global rate
limiter (returns 429) and the Gemini client uses `httpOptions.timeout`. Keep these — an
exposed endpoint hitting a paid model is a cost-exhaustion vector. If real auth is added,
prefer user/session-scoped quotas.
