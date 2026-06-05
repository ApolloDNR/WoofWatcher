# WoofWatcher OpenAI Integration

Status: integration route wired; no approved `OPENAI_API_KEY` is present in this environment.

## Intended Assistant Job

The live assistant should:

- Read Phoenix's care summary, recent logs, health watch, today plan, and records.
- Help Apollo and his girlfriend decide what to track next.
- Explain likely care patterns in plain language.
- Preserve veterinary boundaries and urgent red flags.
- Produce caregiver handoff summaries and monthly report notes.

The assistant must not:

- Diagnose Phoenix.
- Replace a veterinarian.
- Tell caregivers to ignore urgent symptoms.
- Expose API keys or private local data.

## Current Integration

- Local server route: `server.mjs` handles `/api/care-helper`.
- Vercel serverless route: `api/care-helper.js`.
- Shared server helper: `src/openai-care-helper.js`.
- Client behavior: `src/app.js` tries the live helper first when configured and falls back to deterministic local review.
- The route uses the OpenAI Responses API with `OPENAI_MODEL` or `gpt-5.5` by default.
- `OPENAI_API_KEY` is read only on the server and is never sent to browser code.
- The prompt receives summarized Phoenix context from `getAssistantContext`, not the full browser backup.
- Responses are forced to preserve the veterinarian/urgent-care boundary.

## Current Local Mode

`src/woof-core.js` exposes `getAssistantContext`, which returns a deterministic local answer. This keeps v1 useful before live OpenAI credentials exist.

## Enable Live Mode

Set these environment variables on the local server or Vercel project:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-5.5
```

`OPENAI_MODEL` is optional. Keep the key in local env or host env only; do not paste it into chat or client JavaScript.

## Verification

Tests cover status detection, compact Phoenix context, request shaping, output extraction, and the required veterinary boundary:

```powershell
npm test
```
