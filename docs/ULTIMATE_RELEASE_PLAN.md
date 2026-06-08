# WoofWatcher Ultimate Release Plan

## What The App Is

WoofWatcher is a premium mobile-first dog care operating system for owners, households, caregivers, sitters, trainers, walkers, and vets. It coordinates a dog's daily care through shared routines, quick logging, health watch, records, handoffs, report exports, and WoofGuide AI assistance.

It is not a generic pet tracker. The product is designed around a real dog with care quirks, anxiety context, eating patterns, health signals, household handoffs, and records that need to be trusted.

## Full Premium Release Definition

Full Premium Release means the app is credible enough for a dog owner to use every day, show publicly, and pay for. The release must satisfy these standards:

- onboarding creates an account, household, dog profile, and baseline routine
- Today Command clearly answers what the dog needs now
- Quick Log and Full Log cover the core care categories without dead ends
- meal, water, walk, potty, play, training, mood, medication, weight, vomit, symptoms, grooming, alone time, notes, and sticky notes are represented
- routines and reminders can be assigned to household caregivers
- records cover vaccines, vet visits, diet, insurance, microchip, documents, and pet credential data
- handoff/report flows produce useful summaries for sitters, family, trainers, and vets
- WoofGuide is grounded in dog context and respects the medical boundary
- offline and sync state is visible and recoverable where architecture supports it
- empty, loading, error, and failed-sync states are designed and useful
- tests cover care-domain logic and key mobile behavior
- deployment docs and production env/security expectations are clear
- CI verifies install, behavior tests, typecheck, and CI-safe builds

## Feature Map And Current Status

| Area | Current status | Release gap |
| --- | --- | --- |
| Account/Auth | Mobile uses Clerk auth screens and provider guardrails. API uses Clerk auth helpers. | Confirm end-to-end account onboarding in Expo runtime and document provider setup. |
| Household | API has household routes and provisioning logic. Mobile context supports shared state. First-run setup captures a household caregiver baseline. | Improve auth-connected household setup UI, roles, invites, and caregiver permissions. |
| Dog Profile | Profile exists in care state/screens, shared onboarding readiness detects missing profile setup, mobile editor captures credential fields, and first-run setup can save the core dog profile. | Add multiple-dog model, profile photo, and richer credential polish. |
| Today Command | Mobile has a Today Command model, home surface, and setup nudge driven by shared onboarding readiness. The nudge now routes to a dedicated setup flow. | Add richer action routing, explanations, empty states, reminders, and interaction polish. |
| Quick Log | Mobile log surface supports many care event types, inline notes, and post-log sticky note capture. | Improve progressive composer validation, type-specific fields, and post-save routing. |
| Full Log | Care entries persist locally and through API sync. Mobile Log has filters, entry editing, sticky-note actions, a detail sheet, sync/error visibility, and shareable entry handoff text. | Add audit policy for edits/deletes, richer search, and dedicated log history views. |
| Meal/Diet | Domain has diet progress logic, mobile meal progress UI, and first-run setup for food, normal portion, and meal schedule. | Add richer daily target setup, portion presets, feeding streaks, and appetite pattern explanations. |
| Water | Event taxonomy includes water. | Add water-specific quick actions, daily hydration summary, and report language. |
| Walk | Event taxonomy and status count walks. | Add distance/location where feasible, route notes, dog interaction outcomes, and streaks. |
| Potty | Potty status and logs exist. | Add stool/pee detail capture, pattern summary, and clearer health watch connection. |
| Play/Training | Event taxonomy supports play and training. | Add training goals, skills, progress history, and trainer handoff fields. |
| Mood/Energy | Avatar and health screens use mood/energy signals. | Add structured mood/energy logging and trend charts. |
| Medication | Canonical medication event type exists. | Add medication schedule, dose, due/upcoming state, and adherence summary. |
| Weight | Records and log taxonomy support weight. | Add weight chart, goal range, and vet report summary. |
| Vomit/Symptom | Health Watch detects yellow bile and urgent signals. | Add richer symptom composer, frequency views, red-flag checklist, and vet-note export. |
| Grooming | Event taxonomy supports grooming. | Add grooming-specific fields and reminders. |
| Alone Time | Event taxonomy supports alone time. | Add separation/anxiety pattern tracking and handoff notes. |
| Sticky Notes | Domain tests cover sticky note append/sanitize behavior. Mobile Log can attach multiple sticky notes to existing logs, show them in timeline/detail views, and include them in entry handoff text. | Add richer sticky-note colors, pinning, and report filtering. |
| Routines/Reminders | Routine board domain logic exists; calendar UI has assignment/completion concepts; first-run setup can create a starter routine with owner assignment. | Add reminder notifications, recurring rules, missed routine nudges, recurring setup polish, and owner load balancing. |
| Records | Domain has record vault, pet credential summary, and due-status logic for date-backed records. Mobile Records includes a dog ID card, due/current/reference badges, and profile-level microchip, insurance, vet, and emergency-contact fallbacks before uploaded records exist. | Add document upload/storage, richer receipt capture, server reminders for expiring records, and credential card image/PDF export. |
| Handoff/Reports | Domain supports care pass and handoff summaries. Mobile Records now previews sitter, vet, trainer, and caregiver Care Pass sections before sharing, and Progress Report can be shared by period. | Add generated PDF/report artifacts, storage history, print layout, and richer audience templates. |
| WoofGuide | API routes and mobile WoofGuide screen exist. Mobile now shows deterministic suggested action cards for health watch, records, diet setup, routines, meal logging, and Care Pass preview. | Add structured writes from action cards, log drafts, reminder creation, vet note/report drafting flows, and stronger source citations. |
| Offline/Sync | Mobile care sync handles local/pending/failed status and retry separation. | Add durable outbox, conflict-safe state updates, sync dashboard, and recovery tests. |
| Design | Warm brand assets and Phoenix art exist. | Need full premium design system, motion spec, high-end screen polish, accessibility pass, and Figma alignment. |
| CI/QA | GitHub Actions verifies install, focused tests, typecheck, API/web builds. | Add mobile runtime smoke, API route tests, Playwright or Expo smoke, accessibility and visual regression where feasible. |

## Missing Features

1. Auth-connected first-run onboarding for account provisioning, household invite/join flow, and post-setup confirmation.
2. Multiple dogs and dog switcher.
3. Household invite flow and role-specific permissions.
4. Durable offline outbox and conflict handling for care state edits.
5. Edit/delete audit policy for care logs.
6. Records document upload/storage, server reminders for expiring records, and credential card image/PDF export.
7. Generated PDF/report artifacts and stored report history for vet, sitter, trainer, and household review.
8. WoofGuide action-card writes that can create structured logs, reminders, notes, vet notes, and report drafts.
9. Reminder notification flow.
10. High-end motion, transitions, avatar state animation, and accessibility polish.
11. Production deployment wiring and release runbook.

## Design And Polish Gaps

- Current mobile UI is functional but not yet a final premium visual system.
- Need component inventory for buttons, chips, cards, tabs, status banners, forms, empty states, and report surfaces.
- Need motion rules for log confirmation, sync recovery, avatar mood, routine completion, report generation, and assistant actions.
- Need accessibility pass for contrast, touch target sizes, dynamic type, keyboard flow, and screen-reader labels.
- Need visual hierarchy audit across Today, Log, Calendar, Records, More, WoofGuide, and auth screens.
- Need Figma design system or equivalent component spec before major visual overhaul.

## Data And Backend Gaps

- Confirm database schema supports multiple dogs, household roles, record documents, report artifacts, and notification preferences.
- Add storage provider for uploaded records and generated reports.
- Add role-aware authorization checks beyond basic household membership.
- Add audit trail for destructive changes and important medical/record edits.
- Add API tests for care entries, care state, household provisioning, WoofGuide events, and rate limits.
- Add background/retry strategy for mobile offline outbox.

## Test And QA Gaps

- Existing focused behavior tests cover care sync, Today Command, event taxonomy, day status, care pass, diet progress, health handoff, record vault, routine board, and sticky notes.
- Missing API integration tests.
- Missing Expo/mobile runtime smoke.
- Missing auth onboarding smoke.
- Missing visual regression or screenshot review for core screens.
- Missing generated report snapshot tests.
- Missing document upload/security tests.
- Missing accessibility checks.

## Security, Privacy, And Compliance Gaps

- Do not commit secrets or env files.
- Production API must set `ALLOWED_ORIGINS`.
- Health and vet guidance must remain non-diagnostic.
- Add privacy copy for pet records, health notes, household sharing, and AI usage.
- Add data export/delete strategy before public launch.
- Add role-based access control and audit log for shared households.
- Add document storage rules for receipts, insurance, vaccine records, and medical documents.

## Deployment And Production Gaps

- CI is active and green on `main`.
- Need production env matrix for API, mobile, web/dashboard, and storage.
- Need deployment target decisions for API and web.
- Need mobile release path: Expo/EAS, iOS bundle id, app icons, splash, privacy manifest, and app store metadata.
- Need release runbook for migrations, smoke tests, rollback, and support triage.
- Need monitoring/logging policy for API errors, assistant usage, sync failures, and app crashes.

## Monetization Gaps

Monetization is not implemented. Potential premium model:

- Free: one dog, one household, basic logs, basic records.
- Plus: multiple caregivers, reminders, reports, record documents, advanced health watch.
- Pro: trainers/sitters/vets handoff templates, multi-dog, export history, priority AI actions.
- Family/Team: household roles, multiple dogs, shared calendar, advanced reports.

No payment implementation should start until product scope, privacy terms, and support obligations are clearer.

## Autonomous Next-Task Queue

1. Add release-control docs and keep them current.
2. Extend setup into auth-connected household onboarding, invite/join decisions, and post-setup confirmation.
3. Add records document storage, richer receipt capture, server reminders for expiring records, and credential export.
4. Add generated PDF/report artifacts and stored report history.
5. Add durable offline outbox tests and implementation.
6. Add API integration tests for care state and entries.
7. Add structured WoofGuide action writes for log drafts, reminders, vet notes, and report drafts.
8. Add mobile runtime smoke or screenshot verification once local dependencies/browser support are available.
9. Build visual system pass in Figma or code, then implement screen-by-screen.

## Decisions Made Without Apollo

- Mobile remains the canonical app surface.
- Web app remains a prototype/dashboard surface until intentionally redesigned.
- Shared care logic belongs in `lib/care-domain`.
- `care_entries` is the append-style log record; `care_state` holds shared configuration.
- CI should run focused behavior tests plus typecheck/build on every push to `main`.
- Vite builds should not require `PORT` or `BASE_PATH` in CI; they default to local-safe values when absent.
- Expo app typecheck excludes Node test files because root focused tests run them separately.
- Pet credential fields can live on the dog profile as practical fallbacks before formal record documents are uploaded.
- Log details remain inside the Log workflow as a bottom sheet instead of a separate route until search/history needs justify a route.
- Care Pass reports preview before sharing; generated PDF artifacts and storage history remain separate production work.
- Record due-status belongs in `lib/care-domain` so Records UI, reminders, reports, and WoofGuide can classify expired, due-soon, current, and reference records consistently.
- WoofGuide suggested actions are deterministic view-model cards first; actual writes to logs, reminders, notes, and reports stay gated until audited action handlers exist.
- First-run care foundation setup belongs on a dedicated mobile route so profile, diet, starter routine, and caregiver basics can be saved together instead of scattered across separate screens.

## Blockers Requiring Apollo

- Confirm whether the latest ChatGPT share link contains new canonical product direction. The link was provided, but Codex could not read it through the standard web fetch path.
- Confirm preferred launch target: Expo preview only, TestFlight, public app store, or web dashboard first.
- Provide or confirm production accounts for Clerk, database, storage, AI provider, deployment, and mobile release tooling.
- Confirm privacy/legal requirements for storing dog medical records, vet notes, receipts, and AI-assisted health summaries.
- Confirm monetization model before payment or subscription work.
