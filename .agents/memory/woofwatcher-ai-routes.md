---
name: WoofWatcher AI routes use Gemini, not OpenAI
description: Which AI provider the api-server's AI features must use, and the legacy OpenAI trap.
---

# WoofWatcher AI features must go through the Gemini integration

The api-server has the **Gemini** AI integration configured (`AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY`), accessed via `getGemini()` in `gemini.ts`. There is **no** OpenAI key (`OPENAI_API_KEY` is never set).

**Why:** The repo still contains legacy modules written against OpenAI's REST API (`openai-care-helper.js`, `woofguide-events.js`, both pointing at `api.openai.com`). Because `OPENAI_API_KEY` is absent, anything that depends on it silently fails — the WoofGuide `/api/care-helper` route returned **501** in production until it was re-pointed at Gemini. `woofguide-events` only "works" because it has a local deterministic fallback.

**How to apply:**
- Any new or fixed AI feature in the api-server should call `getGemini()` and degrade gracefully (200 local fallback) when it returns null — mirror the pattern in `routes/avatar.ts`.
- The legacy OpenAI `.js` modules are still useful for their prompt builders / boundary helpers (e.g. `buildCareHelperInstructions`, `ensureVeterinaryBoundary`) — reuse those, but do not rely on their network calls.
- `gemini-2.5-flash` spends output budget on hidden "thinking" tokens; set `thinkingConfig: { thinkingBudget: 0 }` for short chat answers or they truncate mid-sentence.
- Endpoints that hit the paid model must be rate-limited (in-memory IP + global window, like `avatar.ts`); `/api/care-helper` is not auth-gated.
