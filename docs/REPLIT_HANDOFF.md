# WoofWatcher Replit Handoff

Last updated: 2026-06-05

## Short Version

WoofWatcher is functionally built as a local-first Phoenix care PWA. The current UI should be treated as a functional placeholder, not the final visual direction. Replit should keep the care model, storage, tests, safety boundaries, and product contract, then rebuild the UI into a high-end mobile-first experience.

## Run

```bash
node server.mjs
```

The server uses `process.env.PORT` when Replit provides it. Locally it defaults to `4178`.

## Verify

```bash
node --test
node --check src/woof-core.js
node --check src/woof-product-view-model.js
node --check src/openai-care-helper.js
node --check src/app.js
node --check server.mjs
node --check service-worker.js
node --check api/care-helper.js
node --check scripts/render-smoke.mjs
```

## Source Of Truth

- `src/woof-core.js`: care model, normalization, summaries, plans, health watch, Bile Watch, Household Pulse, avatar state, report, Care Pass, WoofGuide context.
- `src/woof-product-view-model.js`: stable UI-builder contract. Use this for a new high-end UI.
- `src/app.js`: current local-first app wiring and functional placeholder UI.
- `styles.css`: current placeholder styling. Replace freely.
- `test/`: Node test coverage for the care model, OpenAI helper, deployment config, and product view model.
- `docs/VISION_LOCK.md`: product vision source.
- `docs/superpowers/specs/2026-06-05-woofwatcher-visual-lock-design.md`: approved visual/product direction.

## Product Contract

Import this in any redesigned UI:

```js
import { buildProductViewModel } from "./src/woof-product-view-model.js";
```

The contract returns:

- `navigation`: fixed five tabs: `Phoenix`, `Log`, `Plans`, `Health`, `More`.
- `phoenix`: profile, avatar state, Household Pulse, monthly summary, recent timeline.
- `log`: quick actions, detail fields by type, caregiver options, recent entries.
- `plans`: today plan, reminders, routines, goals, notification readiness.
- `health`: Health Watch, Bile Watch, non-diagnostic boundary.
- `more`: Diet Profile, caregivers, records, Care Pass, report text, WoofGuide.
- `uiGuidance`: instructions and boundaries for replacing the UI.

## Redesign Rules

Replace the visual layer. Do not rewrite or weaken the care logic unless tests are updated intentionally.

Keep:

- Local-first `localStorage` key: `woofwatcher.v1.state`.
- JSON backup/import.
- Care Pass export/import.
- Non-diagnostic veterinary language.
- Phoenix privacy assumptions.
- Five-tab navigation.
- Diet Profile, Treat details, Training Win details, Alone Time.
- Bile Watch and bedtime snack proof.
- WoofGuide local-first behavior when no `OPENAI_API_KEY` exists.

Do not:

- Claim veterinary diagnosis or treatment.
- Hide backup/import/export.
- Remove local mode.
- Publicly expose private Phoenix data without an explicit demo/privacy decision.
- Copy the current CSS avatar as final art.

## High-End UI Prompt For Replit

Use this prompt after importing the repo:

```text
Rebuild the WoofWatcher UI into a high-end mobile-first dog care app. Do not copy the existing placeholder CSS. Keep the existing JavaScript care model, tests, localStorage key, backup/import/export, and non-diagnostic health language.

Use src/woof-product-view-model.js as the product data contract. Build a premium playful storybook utility interface with five tabs: Phoenix, Log, Plans, Health, More. Phoenix should feel like the interface: illustrated German Shepherd avatar, mood/state, next best action, Household Pulse, and recent care. Log should be effortless and fast, with optional detail drawers for meals, treats, training wins, and alone time. Plans should coordinate meals, walks, bedtime snack, reminders, and goals. Health should show Bile Watch and red-flag boundaries carefully. More should contain Diet Profile, Care Team, Records, Care Pass, and WoofGuide.

Visual direction: warm ivory surfaces, deep navy shell, forest green action states, copper warmth, soft sage panels, polished illustration, premium but not childish. Make it look like a real iOS-quality product, not a dashboard template. Avoid marketing pages. The first screen should be the actual app.
```

## OpenAI

Live AI is optional and server-side only.

Environment:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
```

If no key exists, the app must keep deterministic local WoofGuide mode.

## Current Gaps For Replit

- Replace placeholder UI and CSS.
- Replace CSS Phoenix avatar with production illustration or animation.
- Decide whether this remains private Phoenix-only or gains a public demo profile.
- Decide whether to deploy publicly, protected, or local-only.
- If adding accounts/cloud sync, preserve privacy and exportability.
