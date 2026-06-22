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
| Account/Auth | Mobile uses Clerk auth screens and provider guardrails. API uses Clerk auth helpers. Privacy & Safety now exposes owner data export, deletion request preparation, and launch safety gates. | Confirm end-to-end account onboarding in Expo runtime, provider-backed self-serve deletion, and document provider setup. |
| Household | API has household routes and provisioning logic. Mobile context supports shared state. First-run setup captures a household caregiver baseline. Household Responsibility now derives care-team routine ownership, open/overdue/unassigned counts, visible today log activity, and next household action copy, then surfaces it in Calendar and More. Household Access now derives synced account members, local-only caregivers, routine-only owners, invite readiness, permission labels, and next-step copy, then surfaces it in More. | Improve auth-connected household setup UI, provider-backed role enforcement, invite approval, and caregiver editing. |
| Dog Profile | Profile exists in care state/screens, shared onboarding readiness detects missing profile setup, mobile editor captures credential fields, and first-run setup can save the core dog profile. | Add multiple-dog model, profile photo, and richer credential polish. |
| Today Command | Mobile has a Today Command model, home surface, setup nudge, action routing, sync/health context, and routine-board alignment for partial meals plus overdue assigned routines. PWA Phoenix Home now has generated pixel-room copy, a first-screen household pulse card, and a combined Health/Bile snapshot for food gap, bedtime snack proof, vomiting, energy, and weight. | Add reminder notifications, richer empty states, and interaction polish. |
| Quick Log | Mobile log surface supports many care event types, inline notes, post-log sticky note capture, Home one-tap routine-aware meal/walk/potty logs with rich meal detail, Home medication quick logs with routine dose/outcome/visibility detail, Home water quick logs with household-visible refill detail, explicit household-visible walk quick logs, and household-visible potty quick logs. | Improve progressive composer validation, deeper deep-linked composer defaults, and post-save routing. |
| Full Log | Care entries persist locally and through API sync. Mobile Log has text search plus type filters, entry editing, sticky-note actions, a detail sheet, sync/error visibility, audit history for create/edit/sticky-note/delete actions, a durable offline outbox banner for retryable care changes, shareable entry handoff text, and route-param type preselection for Reminder Center actions. Successful deletes create a separate non-health audit note. | Add dedicated log history views and server-backed retention policy for deleted entries. |
| Meal/Diet | Domain has diet progress logic, mobile meal progress UI, and first-run setup for food, normal portion, and meal schedule. The PWA now has a first-class Diet & Treats route with daily meal target/progress, meals today, treats today, hydration context, avoid list, and direct Log Meal/Log Treat/Edit Diet Profile actions. | Add richer daily target setup, portion presets, feeding streaks, and appetite pattern explanations. |
| Water | Event taxonomy includes water. Home quick log can record household-visible fresh-water refills. Shared care-domain logic derives daily hydration status, refill-equivalent progress, last log, caregiver participation, Records Hydration UI, Care Pass report language, and weekly Care Trends refill context. | Add configurable water goals, water-specific composer options, hydration trend history, reminder nudges, and vet-safe pattern context for unusual drinking changes. |
| Walk | Event taxonomy and status count walks. Shared walk activity now derives today's visible walk count, duration, distance when logged, places/routes, dog interaction counts, social outcome notes, caregiver participation, Records Walk Activity UI, and Care Pass report language. Home walk quick logs now explicitly stay household-visible. The full Log composer captures route/place, distance, dog interactions, social outcome notes, and household visibility, Saved Routes derives repeat route templates for Records and Care Pass reports from visible walk logs, and weekly Care Trends compares walk minutes against the prior 7-day window. | Add route maps, dog park template presets, weekly streak visualization, saved route maps, and location integration where feasible. |
| Potty | Potty status and logs exist. The Log composer captures pee/poop kind, stool condition, stool color, routine/accident/urgent/straining context, sticky notes, and household visibility. Shared Potty Health now derives today's visible pee/poop counts, stool review count, abnormal conditions, stool colors, potty context, latest detail, caregivers, Records Potty Health UI, Care Pass report language, and weekly Care Trends potty-watch signals. | Add longer trend history, richer red-flag checklist copy, accident/urgency follow-up workflows, and longer-range vet report patterns. |
| Play/Training | Event taxonomy supports play and training. The Log composer now captures structured training skill/cue, win/practice/struggle outcome, duration, next-practice notes, sticky notes, and household visibility. Shared Training Progress derives visible 30-day sessions, minutes, wins, struggles, skills, caregivers, latest context, Records UI, and Care Pass report language. | Add formal training goals, skill plans, behavior trigger taxonomy, trainer-assigned homework, and longer-range progress charts. |
| Mood/Energy | Avatar and health screens use mood/energy signals. Home now derives tested avatar motion states from health watch, recent care logs, routine status, quiet hours, and low energy. | Add structured mood/energy logging, trend charts, Rive/Lottie/Reanimated state assets, and runtime animation QA. |
| Medication | Canonical medication event type exists. Shared domain logic now derives medication adherence from routines and household-visible logs, including taken, due, missed, upcoming, dose, owner, logged-by context, adherence percentage, and next medication action. Mobile Records shows a Medication Plan surface. Home quick log and the full Log composer now attach medication routine, dose, taken/skipped outcome, and household visibility; skipped medication logs do not count as taken. Medication follow-ups now derive missed-dose, due-now, and refill due-soon/overdue actions from routines, logs, and medication records; Records shows those follow-ups and Care Pass reports include medication adherence plus refill language. Medication history now shows recent household-visible medication logs with dose, outcome, caregiver, routine id, notes, medicine/dose/caregiver/note search, and taken/skipped/missed/needs-review filters. | Add real notification delivery, calendar recurrence polish, and stricter medication schedule schemas before pharmacy/vet integrations. |
| Weight | Weight logs update the living profile. Shared Weight Trend logic derives household-visible recent weigh-ins, current weight, goal distance, previous-change, caregiver participation, Records chart inputs, and Care Pass report language. | Add richer goal range setup, long-range trend history, vet-reviewed weight-plan language, and weight-goal reminders. |
| Vomit/Symptom | Health Watch detects yellow bile, urgent signals, and non-diagnostic pattern cards with evidence and owner next steps. | Add richer symptom composer, frequency views, red-flag checklist, and vet-note export. |
| Grooming | Event taxonomy supports grooming. The Log composer captures grooming type, duration, coat/skin notes, products/groomer context, next due date, sticky notes, and household visibility. Shared Grooming Care derives visible 45-day grooming status, products, caregivers, next due date, Records UI, and Care Pass language. | Add grooming reminders, groomer contacts, recurring schedules, richer coat/skin follow-up workflows, and longer-range grooming reports. |
| Alone Time | The Log composer captures alone-time duration, return state, trigger/context, calming support, recovery minutes, sticky notes, and household visibility. Shared Alone Time logic derives 30-day household-visible separation/anxiety patterns, status, triggers, supports, caregiver participation, latest context, Records UI, and Care Pass handoff language. | Add formal trigger taxonomy, gradual-alone-time plans, longer-range charts, trainer/vet-reviewed language, and reminder/nudge workflows. |
| Sticky Notes | Domain tests cover sticky note append/sanitize behavior. Mobile Log can attach multiple sticky notes to existing logs, show them in timeline/detail views, and include them in entry handoff text. | Add richer sticky-note colors, pinning, and report filtering. |
| Routines/Reminders | Routine board domain logic exists; calendar UI has assignment/completion concepts; first-run setup can create a starter routine with owner assignment. Household Responsibility now turns routine-board status into owner loads, unassigned routine warnings, visible log counts, and a next household action. Reminder Center now combines routine status, medication follow-ups, record reminders, and grooming due dates into one Calendar owner action list with urgent/watch/total counts, notification-readiness copy, and row routing to routine edit, Records, Medication log, or Grooming log. | Add provider-backed reminder notifications, recurring rules, recurring setup polish, richer owner load balancing, and notification preferences. |
| Records | Domain has record vault, pet credential summary, due-status logic, and record reminders for expired, due-soon, and missing-critical records. Mobile Records includes a dog ID card, due/current/reference badges, reminder rows, profile-level microchip, insurance, vet, and emergency-contact fallbacks before uploaded records exist, plus print-ready Dog ID credential HTML with separate share actions for normal text and printable source. Privacy & Safety makes document storage rules visible before upload is enabled. PWA Records and Timeline are directly routable work surfaces. | Add document upload/storage, richer receipt capture, server reminders for expiring records, and credential card image/PDF export. |
| Handoff/Reports | Domain supports care pass and handoff summaries. Mobile Records previews sitter, vet, trainer, and caregiver Care Pass sections before sharing, stores shared Care Pass artifacts in report history, and Care Pass exports include audience checklists plus Health Pattern Review, Hydration, Walk Activity, Training Progress, Alone Time, Weight Trend, Grooming Care, Potty Health, and Weekly Care Trends next steps. Care Pass artifacts now include escaped print-ready HTML, stable file names, visible print-ready/restored report history metadata, and separate resend/printable-source share actions. The PWA now exposes scoped Vet, Sitter, Trainer, and Emergency Care Pass export cards backed by `buildScopedCarePass`, plus direct Reports and Care Pass routes. | Add binary PDF generation, native export/download, server-backed report storage, longer-range trend reports, and richer audience templates. |
| WoofGuide | API routes and mobile WoofGuide screen exist. Mobile now shows deterministic suggested action cards and owner-reviewed drafts for missing meal logs, record reminders, vet notes, and Care Pass review. The PWA now has a first-class WoofGuide route with owner-reviewed action cards that route into Meal Log, Care Pass review, Records review, and a bounded vet-note draft. | Add provider-backed source citations, report-draft persistence, permission-aware assistant writes, and stronger audit history. |
| Monetization | Free, Plus, and Family pricing preview exists. Shared care-domain logic now defines Free/Plus/Family entitlement gates, and the mobile Plus screen shows included and locked features before checkout. | Add provider-backed checkout, entitlement enforcement at API/UI boundaries, grandfathering/trial policy, support/refund terms, and App Store subscription approval. |
| Offline/Sync | Mobile care sync handles local/pending/failed status, retry separation, a durable outbox summary, CareContext exposure, a Log screen recovery banner with retry counts/action, a More Sync Health dashboard for household sync status, care-log audit trails, and conflict-safer care-document refresh that keeps newer local/offline profile, routine, record, and report changes instead of accepting stale server data. PWA Settings now exposes full backup, import, same-household transfer, reset, local-only provider readiness, sync blockers, and privacy/safety truth. | Add deeper multi-device conflict policy, native runtime recovery QA, server-backed delete retention, and broader recovery tests. |
| Design | Warm brand assets and Phoenix art exist. Critical mobile actions now have screen-reader labels on Privacy, Premium, WoofGuide, and More; shared board controls, route-local Plans/Log/Health/Premium/Setup action controls, Plans schedule/routine controls, Calendar event-management controls, Log search/filter controls, Records medication/report controls, More household/profile/tool controls, Privacy export/delete actions, Avatar Studio compact owner-input controls, shared auth action controls, and living Phoenix room cue chips have a 48px touch target; inline mobile route actions and the living Phoenix room pressable use shared hit-slop contracts before native traversal. Home has a tested avatar motion state model and actionable motion row. PWA Phoenix Home now includes richer state copy plus household and Health/Bile cards. PWA Avatar Studio now has a direct prototype route with local reference photo memory and required avatar state inventory. PWA Achievements now has a direct evidence-based milestone route for routine streak, training consistency, happy tummy week, bedtime snack proof, calm alone time, and records completeness. | Need full premium design system, Rive/Lottie/Reanimated motion assets, high-end screen polish, full accessibility pass, visual regression, and Figma alignment. |
| CI/QA | GitHub Actions verifies install, focused tests, typecheck, API/web builds, mobile Expo web export smoke, and can be manually dispatched if a push hook misses. Focused tests include static mobile readiness smoke for route registration, tabs, router links, launch-blocking safety copy, CI smoke wiring, critical action accessibility labels, shared mobile touch targets, route-local action touch targets, Plans schedule/routine touch targets, Calendar event-management touch targets, Log search/filter touch targets, Records medication/report touch targets, More household/profile/tool touch targets, Privacy export/delete touch targets, inline route action hit slop, living Phoenix room tap contracts, release-grade app identity, EAS profile readiness, mobile release runbook coverage, Home avatar motion wiring, medication history search/filter wiring, hydration visibility from Home quick log to Records, Walk Activity wiring, Saved Routes wiring, Weekly Care Trends wiring, Training Progress wiring, Alone Time wiring, Weight Trend wiring, Grooming Care wiring, Potty Health wiring, Reminder Center wiring/action routing, Full Log search wiring, durable sync outbox wiring, household Sync Health wiring, Household Responsibility wiring, Household Access wiring, Care Log Audit Trail wiring, PWA Achievements and Settings route wiring, and conflict-safe care-document refresh wiring. | Add native simulator/device smoke, API route tests, Playwright or simulator screenshot checks, full accessibility traversal, and visual regression where feasible. |

## Missing Features

1. Auth-connected first-run onboarding for account provisioning, household invite/join flow, and post-setup confirmation.
2. Multiple dogs and dog switcher.
3. Provider-backed household invite approval, caregiver editing, and role-specific permission enforcement.
4. Deeper multi-device conflict handling, server-backed delete retention policy, and native recovery QA for care state edits.
5. Records document upload/storage, server reminders for expiring records, and credential card image/PDF export.
6. Binary PDF artifacts, native export/download, and server-backed report storage for vet, sitter, trainer, and household review.
7. WoofGuide provider-backed actions with source citations, persisted report drafts, permission checks, and audit history.
8. Provider-backed reminder notification flow, including medication delivery rules and notification preferences for the existing Reminder Center candidates.
9. High-end motion, transitions, avatar state animation, and accessibility polish.
10. Production deployment wiring and release runbook.

## Design And Polish Gaps

- Current mobile UI is functional but not yet a final premium visual system.
- Need component inventory for buttons, chips, cards, tabs, status banners, forms, empty states, and report surfaces.
- Need motion rules for log confirmation, sync recovery, routine completion, report generation, and assistant actions. Avatar state rules now exist as a tested foundation, but the final art/animation pipeline is not complete.
- Need full accessibility pass for contrast, dynamic type, and native screen-reader traversal. Critical mobile action labels, shared touch targets, route-local action touch targets, Plans schedule/routine touch targets, inline hit slop, and keyboard flow contracts are now statically protected.
- Need visual hierarchy audit across Today, Log, Calendar, Records, More, WoofGuide, and auth screens.
- Need Figma design system or equivalent component spec before major visual overhaul.

## Data And Backend Gaps

- Confirm database schema supports multiple dogs, household roles, record documents, report artifacts, and notification preferences.
- Add storage provider for uploaded records and generated reports.
- Add role-aware authorization checks beyond basic household membership.
- Care-log edit/delete audit trail exists in mobile and care-domain; add broader audit trails for important medical records, documents, account actions, and role changes.
- Add API tests for care entries, care state, household provisioning, WoofGuide events, and rate limits.
- Add deeper multi-device conflict policy, server-backed delete retention, and broader background retry recovery policy.

## Test And QA Gaps

- Existing focused behavior tests cover care sync, durable sync outbox derivation and Log wiring, household Sync Health dashboard derivation and More wiring, Household Responsibility derivation and Calendar/More wiring, Household Access derivation and More wiring, Reminder Center derivation, Calendar wiring, row action routing, Log type preselection, Full Log search derivation and mobile wiring, Care Log Audit Trail derivation and mobile wiring, conflict-safe care-document refresh reconciliation, Today Command, Home Quick Log enrichment, walk quick-log visibility, walk activity summaries, saved walk route templates, full Log walk route fields, walk activity and Saved Routes Care Pass language, walk activity Records wiring, Weekly Care Trends derivation, private-log exclusion, Care Pass trend language, mobile Records trend wiring, Training Progress derivation, Log composer training fields, trainer Care Pass training language, mobile Records training wiring, Alone Time derivation, Log composer Alone Time fields, Care Pass Alone Time language, mobile Records Alone Time wiring, Weight Trend derivation, Care Pass Weight Trend language, mobile Records Weight Trend wiring, Grooming Care derivation, Log composer grooming fields, Care Pass Grooming Care language, mobile Records Grooming Care wiring, potty quick-log visibility, potty composer stool color/context capture, Potty Health summaries, Potty Health Care Pass language, Potty Health Records wiring, medication quick-log defaults, medication composer wiring, medication history search/outcome filters, water quick-log defaults, hydration summary derivation, hydration Care Pass language, hydration Records wiring, avatar motion states, event taxonomy, day status, medication adherence, medication follow-ups, medication history, Care Pass medication report language, care pass audience checklists, print-ready Care Pass HTML artifacts, legacy printable artifact recovery, print-ready Dog ID credential HTML, diet progress, Health Watch pattern cards, health handoff, record reminders, record vault, routine board, sticky notes, WoofGuide owner-reviewed draft payloads, privacy/account safety export gates, static mobile route readiness, critical mobile action accessibility labels, Records printable report and Dog ID actions, shared touch-target readiness for Health/Bile, Plans schedule/routine controls, Log search/filter controls, Records medication/report controls, More household/profile/tool controls, Privacy export/delete controls, auth action controls, living Phoenix room tap contracts, and mobile export-smoke CI wiring.
- Focused mobile readiness checks also protect the release-grade Expo app identity: slug, URL scheme, iOS bundle id, Android package id, and absence of Replit placeholders.
- Missing API integration tests.
- Missing native simulator/device runtime smoke. Static mobile route smoke and CI Expo web export smoke exist, but they do not replace native runtime rendering.
- Missing auth onboarding smoke.
- Missing visual regression or screenshot review for core screens.
- Missing generated report snapshot tests.
- Missing document upload/security tests.
- Missing full accessibility checks beyond static labels, shared tap-target contracts, keyboard offsets, and inline hit slop.

## Security, Privacy, And Compliance Gaps

- Do not commit secrets or env files.
- Production API must set `ALLOWED_ORIGINS`.
- Health and vet guidance must remain non-diagnostic.
- Add privacy copy for pet records, health notes, household sharing, and AI usage.
- Data export and manual deletion request preparation exist in mobile. Provider-backed self-serve deletion, retention rules, and audit policy still need approval before public launch.
- Add role-based access control and broader audit log for shared households, records, documents, and account actions.
- Add document storage rules for receipts, insurance, vaccine records, and medical documents.

## Deployment And Production Gaps

- CI is active and green on `main`.
- Need production env matrix for API, mobile, web/dashboard, and storage.
- Need deployment target decisions for API and web.
- Mobile release path is documented in `docs/release/MOBILE_RELEASE_RUNBOOK.md`, with Expo/EAS profiles committed for iOS and Android. App icons, splash, privacy manifests, store metadata, account credentials, and store submission approval remain release blockers.
- Need release runbook for migrations, smoke tests, rollback, and support triage.
- Need monitoring/logging policy for API errors, assistant usage, sync failures, and app crashes.

## Monetization Gaps

Monetization is not live because checkout is intentionally disabled. The current premium model and entitlement policy are:

- Free: dog profile, basic logs, starter routines, and local care history.
- Plus: advanced meal/diet tracking, Health Watch, records vault, Care Pass reports, WoofGuide reviewed drafts, and stored report history.
- Family: household roles, shared routine board, caregiver handoffs, and family calendar.
- Later add-ons: multiple dogs, generated PDFs, document storage, trainer/vet packs, priority AI actions, and partnerships.

No payment implementation should start until product scope, privacy terms, support/refund obligations, provider-backed deletion, and App Store subscription requirements are clearer. The current entitlement policy exists so checkout work can later enforce the same Free, Plus, and Family boundaries instead of inventing them in payment code.

## Autonomous Next-Task Queue

1. Add release-control docs and keep them current.
2. Extend setup into auth-connected household onboarding, invite/join decisions, and post-setup confirmation.
3. Add records document storage, richer receipt capture, server reminders for expiring records, and credential export.
4. Add binary PDF artifacts, native export/download, and server-backed report storage.
5. Add deeper multi-device conflict policy, server-backed delete retention, and native offline recovery QA.
6. Add API integration tests for care state and entries.
7. Add native simulator/device smoke or screenshot verification once local dependencies/browser support are available.
8. Add provider-backed self-serve account deletion, document storage rules, and retention/audit policy after Apollo approves providers/legal scope.
9. Add provider-backed notification delivery, reminder preferences, and runtime permission handling for existing Reminder Center candidates.
10. Add provider-backed WoofGuide source citations, permission-aware writes, and persisted report drafts.
11. Build visual system pass in Figma or code, then implement screen-by-screen.

## Decisions Made Without Apollo

- Mobile remains the canonical app surface.
- Web app remains a prototype/dashboard surface until intentionally redesigned.
- Shared care logic belongs in `lib/care-domain`.
- `care_entries` is the append-style log record; `care_state` holds shared configuration.
- CI should run focused behavior tests plus typecheck/build on every push to `main`.
- Vite builds should not require `PORT` or `BASE_PATH` in CI; they default to local-safe values when absent.
- Expo app typecheck excludes Node test files because root focused tests run them separately.
- Pet credential fields can live on the dog profile as practical fallbacks before formal record documents are uploaded, and the Records Dog ID can produce print-ready HTML before image/PDF export exists.
- Log details remain inside the Log workflow as a bottom sheet instead of a separate route until search/history needs justify a route.
- Care log audit trails live in `lib/care-domain`; edits and sticky notes append audit events to the entry, while successful deletes create a separate non-health note entry so deleted logs do not continue satisfying routines or health summaries.
- Care Pass reports preview before sharing; print-ready HTML now exists on stored artifacts and Records exposes resend/print-source actions, while binary PDF generation and server-backed report storage remain separate production work.
- Record due-status belongs in `lib/care-domain` so Records UI, reminders, reports, and WoofGuide can classify expired, due-soon, current, and reference records consistently.
- WoofGuide suggested actions are deterministic view-model cards with owner-reviewed draft handlers first; provider-backed generation, permission-aware writes, and durable report drafts stay gated until privacy/account safety and AI policy are ready.
- First-run care foundation setup belongs on a dedicated mobile route so profile, diet, starter routine, and caregiver basics can be saved together instead of scattered across separate screens.
- Care Pass report history stores shared report snapshots in the care document with print-ready HTML payloads, print metadata, and legacy printable recovery; generated binary PDFs and server-backed artifact storage remain separate production work.
- Privacy & Safety can export owner care data and prepare deletion requests now; actual destructive account deletion and storage-backed document deletion remain provider-gated.
- Medication adherence is derived from routines plus household-visible medication logs before adding notification delivery, pharmacy, or vet integration workflows.
- Medication logs preserve taken versus skipped outcome before notification delivery is added.
- Medication follow-ups derive missed-dose, due-now, and refill actions in shared care-domain logic before device push notifications or pharmacy/vet integrations are added.
- Reminder Center derives routine, medication, record, and grooming reminder candidates in shared care-domain logic before device push notifications, runtime permissions, provider-backed reminder preferences, or automatic writes are added.
- Full Log search lives in shared care-domain logic before adding routed long-history views, server-backed retention, or provider search indexes.
- Medication history derives and filters recent household-visible medication evidence before adding clinical medication schedule schemas.
- Daily hydration derives household-visible water evidence before adding configurable goals, trend history, reminder delivery, or medical hydration interpretation.
- Walk Activity derives household-visible activity evidence before adding saved route maps, richer dog park templates, location integrations, or weekly activity trend products.
- Potty Health derives household-visible pee/poop, stool condition, stool color, and potty context evidence before adding trend history, accident/urgency follow-up workflows, longer-range vet reports, or medical interpretation.
- Weekly Care Trends derives safe 7-day household context from visible logs before adding predictive AI, clinical interpretation, or longer-range charting.
- Training Progress derives visible practice context from owner-entered logs before adding formal training plans, behavior diagnosis, or trainer-assigned homework workflows.
- Alone Time derives visible departure/return context from owner-entered logs before adding formal separation-training plans, trainer/vet-reviewed language, or anxiety interpretation.
- Weight Trend derives visible owner-entered weigh-ins before adding vet-reviewed weight plans, long-range charts, or weight-goal reminder automation.
- Grooming Care derives visible owner-entered grooming logs before adding groomer contacts, recurring grooming reminders, coat/skin follow-up workflows, or clinical grooming interpretation.
- Durable sync outbox is derived from local, pending, and failed care entries before adding conflict-safe state recovery, native offline runtime QA, or deeper conflict policy.
- Household Sync Health belongs in More as a household trust surface that summarizes whether shared care is current, syncing, loading, or needs retry; the Log outbox remains the tactical recovery surface for individual failed care changes.
- Care document refresh preserves newer local/offline profile, routine, record, and report changes before accepting server data, then pushes the newer document back with the server's current version.
- Household Responsibility derives from routine-board truth before richer role permissions, so Calendar and More show one shared view of owner loads, overdue work, unassigned routines, visible log activity, and the next household action.
- Household Access derives synced members, local-only caregivers, routine-only owners, and practical permission labels before provider-backed role enforcement, so More can show who can actually sync care versus who still needs an invite.
- Expo/EAS is the mobile release path for v1. iOS and Android profiles live in `artifacts/woofwatcher-mobile/eas.json`; store submission remains blocked until Apollo provides Expo, Apple Developer, Google Play, privacy/legal, and launch approval.

## Blockers Requiring Apollo

- Confirm whether the latest ChatGPT share link contains new canonical product direction. The link was provided, but Codex could not read it through the standard web fetch path.
- Confirm preferred launch target: Expo preview only, TestFlight, public app store, or web dashboard first.
- Provide or confirm production accounts for Clerk, database, storage, AI provider, deployment, and mobile release tooling.
- Confirm privacy/legal requirements for storing dog medical records, vet notes, receipts, and AI-assisted health summaries.
- Confirm monetization model before payment or subscription work.
