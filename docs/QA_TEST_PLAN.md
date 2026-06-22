# QA Test Plan

## Current Automated Baseline

Run focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

CI must pass `WoofWatcher Verify` on `main`.

Latest local evidence, 2026-06-21:

- PASS: 251 focused tests with the command above.
- PASS: PixelLab asset verifier checks 353 Phoenix room/sprite/template assets with 0 missing and 0 invalid.
- PASS: focused Avatar Studio readiness and mobile static QA now verify animated family-pack labels, the dedicated template-strip registry, and live accessory/mood/sprite readiness for Retriever, Husky, and Doodle.
- PASS: Avatar Studio pack manifest coverage now locks the live Shepherd pack, the full animated non-shepherd launch-pack set, and the PixelLab verifier to one source of truth.
- PASS: shared mobile safe-area layout helpers now protect the floating tab shell, Home, Log, Plans, Health, More, Records, Avatar Studio, Setup, Premium, Privacy, and the shared auth shell from drifting back to hardcoded bottom-clearance padding before native screenshot QA happens.
- PASS: WoofGuide composer safe-area hardening now uses the shared mobile layout contract, with focused coverage for flat native devices, notched native devices, and web fallback composer clearance.
- PASS: docked mobile sheets now use the shared modal-sheet safe-area contract, with focused flat/notched-device coverage and static readiness checks for Plans, Log, More, Records, and the error recovery sheet.
- PASS: floating feedback toasts now use the shared mobile layout contract, with focused flat/notched/web coverage and static readiness checks for Home quick-log feedback and Avatar Studio save feedback.
- PASS: centered text-entry modals now use the shared mobile layout contract, with focused flat/notched-device coverage and static readiness checks for the Log sticky-note prompt and More household/name prompt modals.
- PASS: route top safe-area clearance now uses the shared mobile layout contract, with focused native/web notch coverage and static readiness checks for Home, Log, Plans, Health, More, Records, Avatar Studio, Setup, Premium, Privacy, and the shared auth shell.
- PASS: error recovery debug controls now use the shared mobile layout contract, with focused flat/notched/web top-offset coverage and a static readiness check for the app error fallback before native screenshot QA is available.
- PASS: WoofGuide owner-review draft sheets now use the shared modal-sheet safe-area contract, and mobile readiness protects the assistant review surface from reverting to fixed-only sheet padding before native screenshot QA is available.
- PASS: keyboard-heavy Setup, WoofGuide, Log sticky-note prompt, and Records sheet surfaces now use the shared keyboard-avoidance safe-area contract, with focused flat/notched/web coverage and static readiness checks before native screenshot QA is available.
- PASS: inline route actions now use `MOBILE_INLINE_HIT_SLOP` from the shared mobile layout contract, and static readiness protects Home, Plans, More, Records, Privacy, and WoofGuide from reverting to literal route-local hit slop before native accessibility traversal is available.
- PASS: route-local action controls now use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout contract, and static readiness protects Plans add/discover controls, Log sync/detail controls, Premium hero mark, and Setup finish-later action from drifting below 48px before native accessibility traversal is available.
- PASS: Avatar Studio compact owner-input controls now use `MIN_MOBILE_TOUCH_TARGET`, and static readiness protects Studio tabs, coat swatches, and face-marking option pills from reverting to local 40/42/36px sizing before native accessibility traversal is available.
- PASS: Health/Bile Watch route controls now use `MIN_MOBILE_TOUCH_TARGET`, and static readiness protects the segmented Health/Bile tabs plus Log health note and Records hero actions from reverting to local 36/42px sizing before native accessibility traversal is available.
- PASS: Plans schedule and routine controls now use `MIN_MOBILE_TOUCH_TARGET`, and static readiness protects the schedule tabs, schedule mark-done status control, Daily Routine add button, and routine done button from reverting to 21/30/32/36px local sizing before native accessibility traversal is available.
- PASS: Log, Records, and More compact owner-action controls now use `MIN_MOBILE_TOUCH_TARGET`, and static readiness protects Quick Log type chips, timeline filters, search clear, Records medication search/filter controls, report artifact actions, report period tabs, More invite, and dog-profile unit pills from reverting below 48px before native accessibility traversal is available.
- PASS: Calendar event discovery and upcoming-event controls now use `MIN_MOBILE_TOUCH_TARGET`, and static readiness protects the discover icon, suggested-event icon, upcoming-event icon, and remove-event control from reverting to 28/38/40px route-local sizing before native accessibility traversal is available.
- PASS: Error recovery debug and close controls now use `MIN_MOBILE_TOUCH_TARGET`, and static readiness protects the development error-details button plus modal close control from reverting to 44px route-local sizing before native accessibility traversal is available.
- PASS: Home header navigation controls now use `MIN_MOBILE_TOUCH_TARGET`, and static readiness protects the More menu and Health Watch notification buttons from reverting to 42px route-local sizing before native accessibility traversal is available.
- LIMIT: mobile TypeScript could not run in this checkout because `node_modules/typescript` is missing (`tsc-missing`).
- REMOTE CI: GitHub Actions `WoofWatcher Verify` runs continue to fail before job start or without executing workflow steps with GitHub's account billing/spending-limit blocker; checked examples include `27865345974` for commit `5159a3b`, `27865371635` for commit `24d8575`, `27869581404` for commit `8d08825`, `27873733286` for commit `f542db3`, `27878278274` for commit `c915eac`, `27882750930` for commit `de55710`, `27890798715` for commit `0ce53ea`, `27894565111` for commit `0c6371b`, `27898593508` for commit `81647b3`, `27902673966` for commit `c0b1815`, `27907301395` for commit `9411286`, `27911939637` for commit `940a449`, `27916377118` for commit `a6b3951`, and `27920782525` for commit `fbe03bb`. Run `27920782525` completed in 5 seconds with `steps: []`, and the failed-job log was absent (`log not found: 82614005423`). Use the Actions run list as live evidence instead of treating this static doc as current CI state.

## Required Automated Coverage

- Event taxonomy and normalization.
- Routine board matching.
- Meal progress and meal completion fields.
- Medication adherence for taken, due, missed, and upcoming medication routines, including private-log exclusion and Records mobile wiring.
- Medication quick-log and full Log composer defaults for routine dose, taken/skipped outcome, household visibility, and skipped-medication adherence behavior.
- Medication follow-ups for missed doses, due-now doses, refill records, notification-rule copy, Records mobile wiring, and Care Pass report language.
- Medication history for recent household-visible medication logs, including dose, outcome, caregiver, routine id, note, private-log exclusion, medicine/dose/caregiver/note search, taken/skipped/missed/needs-review outcome filters, filtered summary copy, empty-state copy, and Records mobile wiring.
- Water quick-log defaults for household-visible fresh-water refills.
- Hydration summary derivation for visible water logs, refill equivalents, daily goal percentage, caregiver participation, Records mobile wiring, and Care Pass report language.
- Walk quick-log defaults for household-visible activity evidence.
- Walk Activity derivation for visible walk logs, duration, distance when logged, dog interactions, social outcomes, places/routes, caregiver participation, Records mobile wiring, and Care Pass report language.
- Saved walk route templates derived from household-visible route/place logs, including private-log exclusion, stale-log exclusion, repeat-route grouping, visits, average duration, distance, dog interactions, caregiver list, social outcome snippets, Records mobile wiring, walk composer fields, and Care Pass report language.
- Weekly Care Trends derived from household-visible logs, including current-versus-previous 7-day windows, meal completion, walk minutes, water refills, potty/medication/health watch signals, caregiver participation, Records mobile wiring, and Care Pass report language.
- Training Progress derived from household-visible training logs, including skill/cue, outcome, duration, next-practice notes, private-log exclusion, Records mobile wiring, Log composer fields, and trainer Care Pass report language.
- Alone Time derivation from household-visible departure logs, including duration, return state, trigger/context, calming support, recovery minutes, private-log exclusion, Records mobile wiring, Log composer fields, and Care Pass handoff language.
- Weight Trend derivation from household-visible weigh-ins, including goal parsing, profile fallback, private-log exclusion, current/previous change, Records chart wiring, and Care Pass report language.
- Grooming Care derivation from household-visible grooming logs, including duration, type, coat/skin notes, products/groomer context, next due date, private-log exclusion, Records mobile wiring, Log composer fields, and Care Pass report language.
- Potty quick-log defaults for household-visible potty evidence.
- Potty composer and Potty Health derivation for visible potty logs, pee/poop counts, stool review signals, condition summaries, stool colors, accident/urgent/straining context, caregiver participation, Records mobile wiring, and Care Pass report language.
- Care sync local/pending/failed/retry behavior, durable outbox derivation, retryable create/update counts, mobile Log outbox visibility, household Sync Health dashboard derivation, More Sync Health visibility, and conflict-safe care document refresh reconciliation.
- Household Responsibility derivation for care-team routine ownership, open/overdue/unassigned routines, visible today log counts, next household action copy, and Calendar/More mobile wiring.
- Household Access derivation for synced members, local-only caregivers, routine-only owners, invite readiness, permission labels, next-step copy, and More mobile wiring.
- Reminder Center derivation for routine reminders, missed/due medication follow-ups, expiring/missing records, grooming due dates, private-log exclusion, urgency sorting, display limits, notification-readiness copy, and Calendar mobile wiring.
- Reminder Center action routing for routine edit, Records review, Medication log preselection, Grooming log preselection, and accessible row labels.
- Care log audit trail creation, sanitization, sticky-note/edit/delete audit events, non-health deletion audit notes, and mobile Log detail wiring.
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
- Route-local mobile action control touch-target readiness for Home header navigation, Plans schedule/routine controls, Calendar event-management controls, ErrorFallback recovery controls, Log search/filter controls, Records medication/report controls, More household/profile controls, Health/Bile, Premium, Setup, and Avatar Studio compact controls.
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
10. Confirm Records Medication Plan shows taken status, dose, logged-by context, and adherence percentage after a visible taken medication log.
11. Confirm a skipped medication log does not count as taken, a private medication log does not satisfy the household Medication Plan, and an overdue unlogged medication becomes missed.
12. Add a medication refill record with a near due date and confirm Records Medication Follow-ups shows the refill action and notification-rule copy.
13. Preview the vet Care Pass and confirm Medication includes adherence status, taken/upcoming doses, and refill follow-up language.
14. Confirm Records Medication History shows recent visible taken/skipped medication logs with dose, caregiver, relative time, and notes, while private medication logs stay out.
15. Use Home Quick Log for Water and confirm it records a household-visible fresh-water refill.
16. Confirm Records Hydration updates refill-equivalent progress, caregivers, latest water log, and next-step copy after water logs.
17. Preview a Care Pass and confirm the Hydration section summarizes today without making medical claims.
18. Use Home Quick Log for Walk and confirm it records a household-visible walk routine log.
19. Add a walk with duration, place/route, distance, dog interactions, social outcome notes, and household visibility; confirm Records Walk Activity updates minutes, places, latest walk, and next-step copy.
20. Log the same route more than once and confirm Records Saved Routes groups the route, shows visits, average duration, dog interactions, suggested use, and the latest social note.
21. Mark a walk private and confirm it stays out of shared Walk Activity, Saved Routes, routine status, and Care Pass route context.
22. Preview a trainer or sitter Care Pass and confirm Walk Activity includes route/place, dog interaction context, and Saved Routes.
23. Confirm Records Care Trends summarizes the last 7 days, meal completion, walk minutes, and review signals while ignoring private logs.
24. Preview a Care Pass and confirm Care Trends adds weekly context without making medical claims.
25. Add a Training log with skill/cue, win/practice/struggle outcome, duration, next-practice note, sticky note, and household visibility.
26. Confirm Records Training Progress updates sessions, minutes, wins, skills, latest session, and next-practice guidance while ignoring private training logs.
27. Preview a trainer Care Pass and confirm Training Progress includes session count, skills, latest outcome, trigger/context when present, and next-practice notes.
28. Use Home Quick Log for Potty and confirm it records household-visible potty routine evidence.
29. Add a potty log with pee/poop kind, soft/off condition, stool color, accident/urgent/straining context, and a sticky note; confirm Records Potty Health updates pee, poop, review count, color/context detail, latest detail, and stool detail next-step copy.
30. Preview a vet or sitter Care Pass and confirm Potty Health summarizes stool color and potty context without making medical claims.
31. Add sticky note to a log.
32. Add vaccine, insurance, microchip, vet, receipt, and document records.
33. Confirm Records shows expired, due-soon, and missing-critical reminders but does not warn on reference-only microchip/policy values; share the Dog ID card text and printable Dog ID source.
34. Preview and share sitter/vet/trainer/caregiver Care Pass.
35. Confirm Care Pass includes the audience checklist, Health Pattern Review, and non-diagnostic boundary before sharing.
36. Confirm report history stores shared Care Pass with printable export metadata, separate resend action, and printable-source share action.
37. Ask WoofGuide about recent changes and verify non-diagnostic wording.
38. Open WoofGuide suggested actions and confirm owner review appears before saving a meal log, creating a reminder, inserting a vet note, or reviewing Care Pass.
39. Open Privacy & Safety from More, share the care-data export, and confirm it includes care data counts without auth/session tokens.
40. Prepare an account deletion request and confirm it is non-destructive and says manual review/export first.
41. Confirm AI disclosure, document storage rules, and payment launch blockers are visible.
42. Review Health Watch pattern cards and confirm evidence, owner next steps, and vet-boundary language are visible.
43. Confirm the Home avatar motion row changes for a recent meal, upcoming walk, overdue routine, quiet hours, low energy, and Health Watch signal.
44. Force offline or failed sync state and confirm the Log shows the Offline Outbox banner, retryable create/update counts, pending count, failed-sync message, and Retry sync action.
45. Open More and confirm Sync Health shows household status, care-log count, care-team count, outbox waiting count, next-step guidance, and a refresh/retry action with accessible label.
46. Edit profile, routine, record, or report state offline or during a stale refresh; confirm the newer local care document is kept and pushed back instead of overwritten by older server data.
47. Open Calendar and confirm Household Responsibility shows handled/open/overdue/unassigned routine counts plus the next household step.
48. Open More and confirm Responsibility Center shows the same household next step, member routine loads, visible log counts, and routes to Calendar.
49. Create a log, add a sticky note, edit its title or note, open details, and confirm Audit trail shows create, sticky-note, and edit evidence.
50. Delete a log and confirm a separate deleted-log audit note appears without counting as a health or routine-completion event.
51. Add an Alone Time log with duration, return state, trigger/context, calming support, recovery minutes, sticky note, and household visibility.
52. Confirm Records Alone Time updates status, minutes, anxious/distress counts, triggers, supports, latest context, and next-step copy while private alone logs stay out.
53. Preview a sitter/trainer Care Pass and confirm Alone Time summarizes the latest return state, recovery, trigger, and calming support without diagnosing anxiety.
54. Add two visible Weight logs and one private Weight log; confirm Records Weight Trend uses only visible weigh-ins for the chart and goal distance.
55. Update the weight goal and confirm Records shows the correct to-go/over-goal copy.
56. Preview a vet Care Pass and confirm Weight Trend includes current weight, goal, latest weigh-in, and owner-reported context language.
57. Open More and confirm Household Access shows synced members, invite-needed caregivers, routine-only owners, and the correct invite code state.
58. Add a local caregiver and assign a routine to someone not in the synced account member list; confirm Household Access marks them as invite needed instead of silently treating them as synced.
59. Confirm the Household Access invite action is disabled without an invite code and uses the share action when a household invite code exists.
60. Add a Grooming log with type, duration, coat/skin note, product or groomer context, next due date, sticky note, and household visibility.
61. Confirm Records Grooming Care updates status, minutes, type counts, products, next due date, latest context, and next-step copy while private grooming logs stay out.
62. Preview a sitter or vet Care Pass and confirm Grooming Care summarizes latest grooming, product context, next due date, and owner-reported/non-diagnostic boundary language.
63. Open Calendar and confirm Reminder Center combines overdue routines, missed/due medication follow-ups, due-soon records, and grooming due dates into one owner action list with urgent/watch/total counts and no claim that real push notifications are enabled.
64. Tap Reminder Center rows and confirm they route to the expected concrete workflow: routine edit, Records, Medication log, or Grooming log with the composer type preselected.
65. Open Log, search by caregiver, route/place, medication detail, and sticky-note text, then combine search with type chips and confirm the summary and empty state update correctly.
66. Open Records Medication History, search by medicine, dose, caregiver, and note text, then switch Taken, Skipped, Missed, and Needs review filters and confirm summary and empty-state copy update correctly.

## Missing QA

- Simulator/device runtime smoke. CI web export smoke exists, but it does not replace native runtime rendering.
- API integration tests.
- Auth onboarding smoke.
- Visual regression or screenshot review.
- Rive/Lottie/Reanimated avatar asset runtime checks.
- Full accessibility pass for contrast, dynamic type, keyboard flow, touch targets, and native screen-reader traversal. Static labels for critical mobile actions are now covered.
- Document upload/security tests.
- Self-serve provider-backed account deletion tests.
- Payment/paywall tests when monetization is enabled.
