# QA Test Plan

## Current Automated Baseline

Run focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

CI must pass `WoofWatcher Verify` on `main`.

Latest local evidence, 2026-06-11:

- PASS: 101 focused tests with the command above.
- BLOCKED LOCALLY: `pnpm run typecheck` could not run because `pnpm`, `npm`, `corepack`, and `node_modules` were unavailable in the current Windows shell.

## Required Automated Coverage

- Event taxonomy and normalization.
- Routine board matching.
- Meal progress and meal completion fields.
- Medication adherence for taken, due, missed, and upcoming medication routines, including private-log exclusion and Records mobile wiring.
- Medication quick-log and full Log composer defaults for routine dose, taken/skipped outcome, household visibility, and skipped-medication adherence behavior.
- Medication follow-ups for missed doses, due-now doses, refill records, notification-rule copy, Records mobile wiring, and Care Pass report language.
- Medication history for recent household-visible medication logs, including dose, outcome, caregiver, routine id, note, private-log exclusion, and Records mobile wiring.
- Care sync local/pending/failed/retry behavior.
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
- Mobile readiness static smoke for critical route registration, tab coverage, string router links, launch-blocking safety copy, CI Expo web export wiring, Records printable report and Dog ID actions, and screen-reader labels for critical Privacy, Premium, WoofGuide, and More actions.
- Expo app identity smoke for release-grade slug, URL scheme, iOS bundle id, Android package id, and absence of Replit placeholders.
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
15. Add sticky note to a log.
16. Add vaccine, insurance, microchip, vet, receipt, and document records.
17. Confirm Records shows expired, due-soon, and missing-critical reminders but does not warn on reference-only microchip/policy values; share the Dog ID card text and printable Dog ID source.
18. Preview and share sitter/vet/trainer/caregiver Care Pass.
19. Confirm Care Pass includes the audience checklist, Health Pattern Review, and non-diagnostic boundary before sharing.
20. Confirm report history stores shared Care Pass with printable export metadata, separate resend action, and printable-source share action.
21. Ask WoofGuide about recent changes and verify non-diagnostic wording.
22. Open WoofGuide suggested actions and confirm owner review appears before saving a meal log, creating a reminder, inserting a vet note, or reviewing Care Pass.
23. Open Privacy & Safety from More, share the care-data export, and confirm it includes care data counts without auth/session tokens.
24. Prepare an account deletion request and confirm it is non-destructive and says manual review/export first.
25. Confirm AI disclosure, document storage rules, and payment launch blockers are visible.
26. Review Health Watch pattern cards and confirm evidence, owner next steps, and vet-boundary language are visible.
27. Confirm the Home avatar motion row changes for a recent meal, upcoming walk, overdue routine, quiet hours, low energy, and Health Watch signal.
28. Force offline or failed sync state and confirm visibility.

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
