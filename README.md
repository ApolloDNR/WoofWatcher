# WoofWatcher v1

WoofWatcher is a local-first care command center for Phoenix, Apollo's anxious rescued shepherd mix. It is built to help two caregivers coordinate care without relying on memory or constant texting.

## What v1 Does

- Tracks meals, treats, walks, dog park visits, training, social interactions, vomit incidents, health notes, vet notes, weight checks, medication, and general care notes.
- Lets caregivers edit Phoenix's daily routine schedule, care times, ownership, and notes.
- Tracks Phoenix-specific care goals for weight, training, anxiety, social exposure, health, and custom milestones.
- Shows a monthly care calendar with day-level meals, walks, training, social exposure, vomit days, follow-ups, and selected-day evidence.
- Reviews training and social progress with calm wins, rough spots, dog interactions, and next focus areas.
- Shows today's routine, completed items, next care items, caregiver load, and a copyable handoff note.
- Exports a care room transfer package with Phoenix state, caregiver handoff, health context, and the monthly report for another caregiver/device to import.
- Highlights health patterns and red flags without making a veterinary diagnosis.
- Stores and edits records for vaccines, vet visits, weight goals, medication, microchip details, and care instructions.
- Builds a monthly report that can be copied, downloaded, or printed to PDF.
- Saves locally in the browser with `localStorage`, with JSON backup export and import/restore.
- Installs as a mobile PWA through Safari/Chrome home-screen install.
- Runs a local care helper by default, with a server-side OpenAI Responses API route when `OPENAI_API_KEY` is configured.

## Run Locally

From this folder:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.mjs --port=4190
```

Then open:

```text
http://127.0.0.1:4190
```

If global Node works on the machine, these also work:

```powershell
npm test
npm run check
npm run start
npm run smoke:render
npm run screenshots
```

## Test

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --test
```

`npm run smoke:render` first tries an interactive Chrome DevTools smoke. If the local DevTools WebSocket does not answer, it falls back to Chrome-rendered DOM checks for the home, schedule, goals, calendar, progress, log, records, report, and assistant routes.

## Data

All v1 data is stored locally in the browser under:

```text
woofwatcher.v1.state
```

Use `Backup` to download the current JSON state before resetting or moving devices.

Use `Transfer` to download an importable care room package when another caregiver needs the current Phoenix state plus handoff/report context.

Use `Import` to restore either a WoofWatcher JSON backup or a care room transfer package into the current browser.

## OpenAI Status

The helper panel is intentionally local-first because no `OPENAI_API_KEY` has been approved or stored for this project. The route `/api/care-helper` is already wired for local server and Vercel use:

- `GET /api/care-helper` reports whether the server has a key without exposing it.
- `POST /api/care-helper` sends Phoenix's summarized context to the OpenAI Responses API only when the server has `OPENAI_API_KEY`.
- If the key is missing or the API is unavailable, the app falls back to deterministic local care review.

Optional env:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-5.5
```

## Design Reference

The generated v1 concept is saved at:

```text
docs/woofwatcher-v1-concept.png
```
