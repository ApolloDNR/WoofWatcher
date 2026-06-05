# WoofWatcher v1

WoofWatcher is a local-first care command center for Phoenix, Apollo's anxious rescued shepherd mix. It is built to help two caregivers coordinate care without relying on memory or constant texting.

## What v1 Does

- Presents the app as a Phoenix-first care home with five main sections: `Phoenix`, `Log`, `Plans`, `Health`, and `More`.
- Uses a deterministic Phoenix avatar state and `Household Pulse` to surface mood, evidence, next best action, caregiver load, and latest care context.
- Adds an `Effortless Log` surface for one-tap care logging plus richer optional details for meals, treats, training wins, mood shifts, and alone time.
- Adds a first-class editable `Diet Profile` for normal food, portions, meal schedule, toppers, supplements, bedtime snack, treats, sensitivities, appetite quirks, and vet notes.
- Uses `Care Pass` language for report/transfer export and `WoofGuide` for Phoenix-context care review.
- Tracks meals, treats, walks, dog park visits, training, social interactions, vomit incidents, health notes, vet notes, weight checks, medication, and general care notes.
- Lets caregivers edit Phoenix's daily routine schedule, care times, ownership, and notes.
- Lets the care team edit caregiver names and roles, with caregiver choices flowing into Quick Log and handoff load.
- Turns the daily routine into a Reminder Center with completed, due, overdue, upcoming, and flexible care proof.
- Adds local notification readiness for due/overdue reminders, with permission prompts, test alerts, and app-open nudges.
- Tracks Phoenix-specific care goals for weight, training, anxiety, social exposure, health, and custom milestones.
- Shows a monthly care calendar with day-level meals, walks, training, social exposure, vomit days, follow-ups, and selected-day evidence.
- Reviews training and social progress with calm wins, rough spots, dog interactions, and next focus areas.
- Shows today's routine, completed items, next care items, caregiver load, and a copyable handoff note.
- Exports a care room transfer package with Phoenix state, caregiver handoff, health context, and the monthly report for another caregiver/device to import.
- Highlights health patterns and red flags without making a veterinary diagnosis.
- Adds Bile Watch for empty-stomach food gaps, bedtime snack proof, yellow bile logs, and vet-ready pattern tracking.
- Stores and edits records for vaccines, vet visits, weight goals, medication, microchip details, and care instructions.
- Builds a monthly report that can be copied, downloaded, or printed to PDF.
- Saves locally in the browser with `localStorage`, with JSON backup export and import/restore.
- Installs as a mobile PWA through Safari/Chrome home-screen install.
- Runs a local care helper by default, with a server-side OpenAI Responses API route when `OPENAI_API_KEY` is configured.
- Exposes `src/woof-product-view-model.js` as a stable product contract so a future Replit/high-end UI rebuild can replace the visual layer without breaking the care model.
- Adds `src/woof-privacy-cloud.js` for scoped Care Passes, caregiver invite drafts, role/scope access, and an honest cloud-sync readiness plan.

## Run Locally

From this folder:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.mjs --port=4190
```

Then open:

```text
http://127.0.0.1:4190
```

For Replit import, the repo includes `.replit`; Replit can run:

```bash
node server.mjs
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

`npm run smoke:render` first tries an interactive Chrome DevTools smoke. If the local DevTools WebSocket does not answer, it falls back to Chrome-rendered DOM checks for the `Phoenix`, `Log`, `Plans`, `Health`, and `More` routes.

## Data

All v1 data is stored locally in the browser under:

```text
woofwatcher.v1.state
```

Use `Backup` to download the current JSON state before resetting or moving devices.

Use `Care Pass` to download an importable care room package when another caregiver needs the current Phoenix state plus handoff/report context.

Use `Import` to restore either a WoofWatcher JSON backup or a care room transfer package into the current browser.

## Notification Status

WoofWatcher can request browser/PWA notification permission and show local due-care alerts while the app is open. It does not claim closed-app, cross-device, or caregiver-synced push notifications; those require a hosted notification service and caregiver account/privacy decisions.

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

The 2026-06-05 product vision lock is tracked at:

```text
docs/VISION_LOCK.md
```

The approved visual lock design spec is tracked at:

```text
docs/superpowers/specs/2026-06-05-woofwatcher-visual-lock-design.md
```

For the next high-end UI pass in Replit, use:

```text
docs/REPLIT_HANDOFF.md
```

That file intentionally says the current UI is a functional placeholder and points future builders to `src/woof-product-view-model.js`.

Cloud/caregiver backend foundation notes are tracked at:

```text
docs/CLOUD_CAREGIVER_FOUNDATION.md
```

## Completion Audit

Current proof and remaining gates are tracked in:

```text
docs/V1_COMPLETION_AUDIT.md
```
