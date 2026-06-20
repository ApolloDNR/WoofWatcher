# QA Test Plan

## Current Automated Baseline

Run focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts
```

CI must pass `WoofWatcher Verify` on `main`.

Latest local evidence, 2026-06-19:

- PASS: 280 focused behavior/readiness tests with the command above.
- PASS: mobile TypeScript check with bundled Node and workspace TypeScript.
- PASS: PixelLab asset verifier checked 148 Phoenix room/sprite/template/emote/accessory/seed-strip/Option B runtime assets with 0 missing and 0 invalid.
- PASS: Expo web export completed through the package-local Expo CLI and Metro resolver patch.
- PASS: Headless Chrome visual smoke captured `/portrait` and Home from the exported web build.
- REMOTE CI: GitHub Actions `WoofWatcher Verify` is currently blocked before job start by the account billing/spending-limit issue documented in `docs/BLOCKERS_FOR_APOLLO.md`. Use the Actions run list as live evidence instead of treating this static doc as current CI state.

## Required Automated Coverage

- Event taxonomy and normalization.
- Routine board matching.
- Meal progress and meal completion fields.
- Medication adherence for taken, due, missed, and upcoming medication routines, including private-log exclusion and Records mobile wiring.
- Medication quick-log and full Log composer defaults for routine dose, taken/skipped outcome, household visibility, and skipped-medication adherence behavior.
- Medication proof attachment seams for local proof URI/name/source, local-only storage status, proof-attached timeline state, audit history, and explicit owner confirmation after proof is attached.
- Medication follow-ups for missed doses, due-now doses, refill records, notification-rule copy, Records mobile wiring, and Care Pass report language.
- Medication history for recent household-visible medication logs, including dose, outcome, caregiver, routine id, note, private-log exclusion, medicine/dose/caregiver/note search, taken/skipped/missed/needs-review outcome filters, filtered summary copy, empty-state copy, and Records mobile wiring.
- Water quick-log defaults for household-visible fresh-water refills.
- Hydration summary derivation for visible water logs, refill equivalents, daily goal percentage, caregiver participation, Records mobile wiring, and Care Pass report language.
- Walk quick-log defaults for household-visible activity evidence, including Home/Log active-session start behavior.
- Walk session lifecycle for active in-progress walks, newest-open-session detection, timer-backed finish, route/place, distance, dog interactions, social outcome, notes, audit history, and mobile Home/Log wiring.
- Walk Activity derivation for visible walk logs, duration, distance when logged, dog interactions, social outcomes, places/routes, caregiver participation, Records mobile wiring, and Care Pass report language.
- Saved walk route templates derived from household-visible route/place logs, including private-log exclusion, stale-log exclusion, repeat-route grouping, visits, average duration, distance, dog interactions, caregiver list, social outcome snippets, Records mobile wiring, walk composer fields, and Care Pass report language.
- Weekly Care Trends derived from household-visible logs, including current-versus-previous 7-day windows, meal completion, walk minutes, water refills, potty/medication/health watch signals, caregiver participation, Records mobile wiring, and Care Pass report language.
- Training Progress derived from household-visible training logs, including skill/cue, outcome, duration, next-practice notes, private-log exclusion, Records mobile wiring, Log composer fields, and trainer Care Pass report language.
- Alone Time derivation from household-visible departure logs, including duration, return state, trigger/context, calming support, recovery minutes, private-log exclusion, Records mobile wiring, Log composer fields, and Care Pass handoff language.
- Weight Trend derivation from household-visible weigh-ins, including goal parsing, profile fallback, private-log exclusion, current/previous change, Records chart wiring, and Care Pass report language.
- Grooming Care derivation from household-visible grooming logs, including duration, type, coat/skin notes, products/groomer context, next due date, private-log exclusion, Records mobile wiring, Log composer fields, and Care Pass report language.
- Potty quick-log defaults for household-visible potty evidence.
- Incident Watch derivation from household-visible incident logs, including alias normalization, private-log exclusion, alert/follow-up counts, injury checks, trigger/exposure extraction, 7/30/lookback trend windows, rising/improving/steady/clear trend labels, owner follow-up tasks, trainer goal suggestions, Records mobile routing, and Care Pass report language.
- Potty composer, detail-sheet correction, and Potty Health derivation for visible potty logs, pee/poop counts, outcome/location/pee-detail/stool-detail edits, stale-detail clearing when outcomes change, stool review signals, condition summaries, stool colors, accident/urgent/straining context, caregiver participation, audit history, Records mobile wiring, and Care Pass report language.
- Care sync local/pending/failed/retry behavior, durable outbox derivation, retryable create/update counts, mobile Log outbox visibility, household Sync Health dashboard derivation, More Sync Health visibility, and conflict-safe care document refresh reconciliation.
- Household Responsibility derivation for care-team routine ownership, open/overdue/unassigned routines, visible today log counts, next household action copy, and Calendar/More mobile wiring.
- Household Access derivation for synced members, local-only caregivers, routine-only owners, invite readiness, permission labels, next-step copy, and More mobile wiring.
- Access Pass derivation for local helper permission drafts, sitter/trainer/vet/emergency permission boundaries, blocked actions, provider-gated sharing copy, My Care Today assigned routines, and More mobile wiring.
- Reminder Center derivation for routine reminders, missed/due medication follow-ups, expiring/missing records, grooming due dates, private-log exclusion, urgency sorting, display limits, notification-readiness copy, and Calendar mobile wiring.
- Reminder Center action routing for routine edit, Records review, Medication log preselection, Grooming log preselection, and accessible row labels.
- Care log audit trail creation, sanitization, sticky-note/edit/delete audit events, correction-history summary cards, changed-field chips, non-health deletion audit notes, and mobile Log detail wiring.
- Care log search across title, note, caregiver, nested details, sticky notes, normalized type aliases, type filters, newest-first sorting, active-filter summary copy, and Log mobile wiring.
- Today Command priority selection, routine-board alignment, and overdue assigned routine routing.
- Home Quick Log routine matching and meal detail enrichment.
- Health Watch signals and medical boundary.
- Health Watch pattern cards with evidence, owner next steps, and steady-state behavior.
- Care Pass generation, report artifacts, print-ready escaped HTML payloads, legacy artifact print recovery, and Records print-source sharing for future PDF/export flows.
- Care Pass audience checklists and Health Pattern Review next steps.
- Record vault and due status.
- Record reminders for expired, due-soon, missing-critical, and reference-only records.
- Pet credential fallbacks, escaped print-ready Dog ID credential HTML, and Records printable Dog ID sharing.
- Sticky notes.
- WoofGuide deterministic actions and owner-reviewed draft payloads for meal logs, record reminders, vet notes, and Care Pass review.
- Setup wizard.
- Premium plan packaging and checkout-disabled guard.
- Premium entitlement policy for Free, Plus, and Family feature gates before checkout is enabled.
- Avatar motion state derivation for health watch, recent care logs, due routines, quiet hours, and low energy.
- Privacy/account safety export, deletion request, AI disclosure, document storage gates, and payment launch blockers.
- Mobile readiness static smoke for critical route registration, tab coverage, string router links, launch-blocking safety copy, CI Expo web export wiring, Records printable report and Dog ID actions, Hydration/Walk/Potty Records wiring, and screen-reader labels for critical Privacy, Premium, WoofGuide, and More actions.
- Expo app identity smoke for release-grade slug, URL scheme, iOS bundle id, Android package id, and absence of Replit placeholders.
- Expo/EAS release profile smoke for committed iOS/Android development, preview, production, and submit paths.
- Mobile release runbook smoke for iOS, Android, TestFlight, Google Play, Fable, and web dashboard/PWA handoff coverage.
- CI `build:ci` runs a mobile Expo web export smoke and verifies emitted HTML/JavaScript assets.

## Manual Mobile QA

1. Sign up/sign in.
2. Complete setup: dog profile, diet, routine, caregiver.
3. Confirm Today shows next needed care.
4. Log a meal with expected, served, eaten, skipped/partial, note, and caregiver visibility.
5. Use Home Quick Log for a meal and confirm it records the open routine, expected portion, served amount, eaten amount, complete status, and household visibility.
6. Confirm a visible matching meal log changes the routine from due/missed to handled and shows complete/partial/skipped status.
7. Confirm a private meal log stays out of shared household routine status.
8. Add a medication routine, use Home quick log for Meds, and confirm it records the matching routine, dose, taken outcome, and household visibility.
9. Use the Log medication composer and confirm the Medication routine panel, dose field, taken/skipped choice, and household visibility toggle are visible.
10. Open a pending medication log, attach proof from the photo library, and confirm the detail sheet shows Proof status: Attached, the attachment name, and Local-only proof saved without marking the log confirmed.
11. Confirm the timeline changes from Proof needed to Proof attached while Needs review remains until an adult owner confirms the medication log.
12. Confirm Records Medication Plan shows taken status, dose, logged-by context, and adherence percentage after a visible taken medication log.
13. Confirm a skipped medication log does not count as taken, a private medication log does not satisfy the household Medication Plan, and an overdue unlogged medication becomes missed.
14. Add a medication refill record with a near due date and confirm Records Medication Follow-ups shows the refill action and notification-rule copy.
15. Preview the vet Care Pass and confirm Medication includes adherence status, taken/upcoming doses, and refill follow-up language.
16. Confirm Records Medication History shows recent visible taken/skipped medication logs with dose, caregiver, relative time, and notes, while private medication logs stay out.
17. Use Home Quick Log for Water and confirm it records a household-visible fresh-water refill.
18. Confirm Records Hydration updates refill-equivalent progress, caregivers, latest water log, and next-step copy after water logs.
19. Preview a Care Pass and confirm the Hydration section summarizes today without making medical claims.
20. Use Home Quick Log for Walk and confirm it starts a household-visible active walk session, changes Home to Walk active, and routes an already-active walk to the Log finish flow.
21. Finish the active walk from Log with route/place, distance, dog interactions, social outcome notes, and optional note; confirm the same log records duration/audit history and Records Walk Activity updates minutes, places, latest walk, and next-step copy.
22. Log the same route more than once and confirm Records Saved Routes groups the route, shows visits, average duration, dog interactions, suggested use, and the latest social note.
23. Mark a walk private and confirm it stays out of shared Walk Activity, Saved Routes, routine status, and Care Pass route context.
24. Preview a trainer or sitter Care Pass and confirm Walk Activity includes route/place, dog interaction context, and Saved Routes.
25. Confirm Records Care Trends summarizes the last 7 days, meal completion, walk minutes, and review signals while ignoring private logs.
26. Preview a Care Pass and confirm Care Trends adds weekly context without making medical claims.
27. Add a Training log with skill/cue, win/practice/struggle outcome, duration, next-practice note, sticky note, and household visibility.
28. Confirm Records Training Progress updates sessions, minutes, wins, skills, latest session, and next-practice guidance while ignoring private training logs.
29. Preview a trainer Care Pass and confirm Training Progress includes session count, skills, latest outcome, trigger/context when present, and next-practice notes.
30. Use Home Quick Log for Potty and confirm it records household-visible potty routine evidence.
31. Add a potty log with pee/poop kind, soft/off condition, stool color, accident/urgent/straining context, and a sticky note; then open the log detail sheet, use Clarify potty log to correct outcome/location/pee/stool detail, and confirm Records Potty Health updates pee, poop, review count, color/context detail, latest detail, audit history, and stool detail next-step copy without carrying stale fields.
32. Preview a vet or sitter Care Pass and confirm Potty Health summarizes stool color and potty context without making medical claims.
33. Add sticky note to a log.
34. Add vaccine, insurance, microchip, vet, receipt, and document records.
35. Confirm Records shows expired, due-soon, and missing-critical reminders but does not warn on reference-only microchip/policy values; share the Dog ID card text and printable Dog ID source.
36. Preview and share sitter/vet/trainer/caregiver Care Pass.
37. Confirm Care Pass includes the audience checklist, Health Pattern Review, and non-diagnostic boundary before sharing.
38. Confirm report history stores shared Care Pass with printable export metadata, separate resend action, and printable-source share action.
39. Ask WoofGuide about recent changes and verify non-diagnostic wording.
40. Open WoofGuide suggested actions and confirm owner review appears before saving a meal log, creating a reminder, inserting a vet note, or reviewing Care Pass.
41. Open Privacy & Safety from More, share the care-data export, and confirm it includes care data counts without auth/session tokens.
42. Prepare an account deletion request and confirm it is non-destructive and says manual review/export first.
43. Confirm AI disclosure, document storage rules, and payment launch blockers are visible.
44. Review Health Watch pattern cards and confirm evidence, owner next steps, and vet-boundary language are visible.
45. Confirm the Home avatar motion row changes for a recent meal, upcoming walk, overdue routine, quiet hours, low energy, and Health Watch signal.
46. Force offline or failed sync state and confirm the Log shows the Offline Outbox banner, retryable create/update counts, pending count, failed-sync message, and Retry sync action.
47. Open More and confirm Sync Health shows household status, care-log count, care-team count, outbox waiting count, next-step guidance, and a refresh/retry action with accessible label.
48. Edit profile, routine, record, or report state offline or during a stale refresh; confirm the newer local care document is kept and pushed back instead of overwritten by older server data.
49. Open Calendar and confirm Household Responsibility shows handled/open/overdue/unassigned routine counts plus the next household step.
50. Open More and confirm Responsibility Center shows the same household next step, member routine loads, visible log counts, and routes to Calendar.
51. Create a log, add a sticky note, edit its title or note, open details, and confirm Correction history summarizes the latest update/changed fields while Audit trail still shows create, sticky-note, and edit evidence.
52. Delete a log and confirm a separate deleted-log audit note appears without counting as a health or routine-completion event.
53. Add an Alone Time log with duration, return state, trigger/context, calming support, recovery minutes, sticky note, and household visibility.
54. Confirm Records Alone Time updates status, minutes, anxious/distress counts, triggers, supports, latest context, and next-step copy while private alone logs stay out.
55. Preview a sitter/trainer Care Pass and confirm Alone Time summarizes the latest return state, recovery, trigger, and calming support without diagnosing anxiety.
56. Add two visible Weight logs and one private Weight log; confirm Records Weight Trend uses only visible weigh-ins for the chart and goal distance.
57. Update the weight goal and confirm Records shows the correct to-go/over-goal copy.
58. Preview a vet Care Pass and confirm Weight Trend includes current weight, goal, latest weigh-in, and owner-reported context language.
59. Open More and confirm Household Access shows synced members, invite-needed caregivers, routine-only owners, and the correct invite code state.
60. Add a local caregiver and assign a routine to someone not in the synced account member list; confirm Household Access marks them as invite needed instead of silently treating them as synced.
61. Confirm the Household Access invite action is disabled without an invite code and uses the share action when a household invite code exists.
62. Add a Grooming log with type, duration, coat/skin note, product or groomer context, next due date, sticky note, and household visibility.
63. Confirm Records Grooming Care updates status, minutes, type counts, products, next due date, latest context, and next-step copy while private grooming logs stay out.
64. Preview a sitter or vet Care Pass and confirm Grooming Care summarizes latest grooming, product context, next due date, and owner-reported/non-diagnostic boundary language.
65. Open Calendar and confirm Reminder Center combines overdue routines, missed/due medication follow-ups, due-soon records, and grooming due dates into one owner action list with urgent/watch/total counts and no claim that real push notifications are enabled.
66. Tap Reminder Center rows and confirm they route to the expected concrete workflow: routine edit, Records, Medication log, or Grooming log with the composer type preselected.
67. Open Log, search by caregiver, route/place, medication detail, and sticky-note text, then combine search with type chips and confirm the summary and empty state update correctly.
68. Open Records Medication History, search by medicine, dose, caregiver, and note text, then switch Taken, Skipped, Missed, and Needs review filters and confirm summary and empty-state copy update correctly.
69. Open Avatar Studio, switch to Emotes, tap each Phoenix mood state, and confirm the mood grid uses the corresponding PixelLab emote art instead of the same head crop with a color wash while the top hero remains the live Studio care-twin room.
70. Switch Avatar Studio to the Retriever template, open Emotes, and confirm all 10 moods use the Retriever starter pack instead of Phoenix art. Switch to an unfinished template and confirm it falls back to that template's own base still rather than the wrong dog.
71. Switch Avatar Studio to the Husky / Spitz template, open Emotes, and confirm all 10 moods use the Husky starter pack, including Home Alone and Not Feeling Well, with no Retriever or Phoenix fallback art.
72. Switch Avatar Studio to the Bully template, open Emotes, and confirm all 10 moods use the Bully starter pack, including Home Alone and Not Feeling Well, with no Husky, Retriever, or Phoenix fallback art.
73. Open More and confirm CareTwin Roster shows Phoenix/the primary dog as the live care twin with Live, Future, and Gated metrics.
74. Tap Add future dog, save a planned dog such as London, and confirm it appears as Provider-gated without changing Phoenix's active logs or profile.
75. Tap the provider-gated future dog and confirm the app explains that multi-dog switching requires provider-backed multi-dog care documents before logs, routines, records, and reports can be separated.
76. Open Privacy & Safety export after adding a future dog and confirm staged pet roster data is included without auth/session tokens.
77. Open More, create an Access Pass draft for a sitter, and confirm the card shows Drafts, permission boundary copy, and a Share Draft Summary action without claiming remote access is live.
78. Open More with routines assigned to the current user and confirm My Care Today shows assigned, open, overdue counts plus the next assigned routine.
79. Open Privacy & Safety export after creating an Access Pass draft and confirm Access Pass data is included without auth/session tokens.
80. Open More, tap Adventure Mode, and confirm the route presents a private RPG care quest board without claiming live maps, public sharing, or cloud photo storage.
81. With household-visible walk, training, play, or alone-time logs present, confirm Adventure Mode derives level/XP, completed proof, the next available quest, and a Save Memory action from real care evidence.
82. Save an Adventure memory draft, confirm it appears in the Memory shelf as local/private, then open Privacy & Safety export and confirm Adventure memories are included without auth/session tokens.
83. Open Phoenix Home and confirm the Care Quest board includes Adventure Mode with next quest, level, XP, memory count, and a direct route to the Adventure screen without pushing Quick Log or Next Up below usability.
84. Add an Incident log with trigger, exposure, injury check, action taken, follow-up, sticky note, and household visibility.
85. Open Records Incident Watch and confirm the trend signal, 7/30/lookback counts, follow-up plan, trainer goals, and non-diagnostic boundary are visible.
86. Tap an Incident Watch follow-up row and confirm it routes to the Incident composer or trainer Care Pass preview instead of becoming a dead recommendation.
87. Preview a trainer Care Pass and confirm Incident Watch includes trend, owner follow-ups, trainer goal ideas, and factual non-diagnostic language.

## Missing QA

- Simulator/device runtime smoke. CI web export smoke exists, but it does not replace native runtime rendering.
- API integration tests.
- Auth onboarding smoke.
- Visual regression or screenshot review.
- Rive/Lottie/Reanimated avatar asset runtime checks and a native-device visual pass for the PixelLab Phoenix, Retriever, Husky, and Bully emote packs.
- Full accessibility pass for contrast, dynamic type, keyboard flow, touch targets, and native screen-reader traversal. Static labels for critical mobile actions are now covered.
- Document upload/security tests.
- Self-serve provider-backed account deletion tests.
- Payment/paywall tests when monetization is enabled.

## Care Twin Native QA Matrix

Current evidence, 2026-06-19: `careTwinAssets.ts` now exports
`CARE_TWIN_RUNTIME_QA_SCENARIOS` plus `evaluateCareTwinRuntimeQaScenario`,
and `careTwinAssets.test.ts` verifies all 12 avatar motion states against the
expected sprite action, dogless room variant, zone, scene phase, priority need,
and layered readiness. The human device checklist lives in
`docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`.

Current evidence, 2026-06-19: the mobile app now has a development/internal
`/care-twin-qa` route that renders the full care-twin matrix with the production
`LivingPhoenixRoom` component. More links to `Care Twin QA` only under
`__DEV__`, and `mobileReadiness.test.ts` protects route registration, matrix
usage, and the native QA prompt surface.

Current evidence, 2026-06-19: `/care-twin-qa` now supports session-level
Pass/Needs tune review controls, per-scenario device notes, summary counts, and
a native share action backed by `careTwinQaReport.ts`. The shared report states
that native screenshot evidence is still required before launch.

Native QA still needs real iOS/Android screenshots for room/sprite scale, stage
cropping, touch response, and loop readability.

Latest local evidence, 2026-06-19:

- Mobile TypeScript compile passed for the WoofWatcher Expo app.
- Focused Node tests passed for care-twin assets, care-twin stage routing, avatar motion, Avatar Studio, and avatar template readiness.
- PixelLab asset verification passed with 149 registered assets, 0 missing, and 0 invalid.
- Expo web export passed from the package-local CLI.
- Chrome web visual smoke caught and then verified the Avatar Studio live-sprite overlay fix; Home rest-state behavior was then guarded in code so ambient awake loops do not override sleep/rest scenes.
- The latest Option B day-room pass still needs real iOS/Android screenshots for visual approval; local checks prove wiring and asset dimensions, not final phone-size taste.
