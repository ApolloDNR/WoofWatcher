# QA Test Plan

## Current Automated Baseline

Run focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

CI must pass `WoofWatcher Verify` on `main`.

Latest local evidence, 2026-06-09:

- PASS: 88 focused tests with the command above.
- BLOCKED LOCALLY: `pnpm run typecheck` could not run because `pnpm`, `npm`, `corepack`, and `node_modules` were unavailable in the current Windows shell.

## Required Automated Coverage

- Event taxonomy and normalization.
- Routine board matching.
- Meal progress and meal completion fields.
- Care sync local/pending/failed/retry behavior.
- Today Command priority selection, routine-board alignment, and overdue assigned routine routing.
- Home Quick Log routine matching and meal detail enrichment.
- Health Watch signals and medical boundary.
- Health Watch pattern cards with evidence, owner next steps, and steady-state behavior.
- Care Pass generation, report artifacts, print-ready escaped HTML payloads, legacy artifact print recovery, and Records print-source sharing for future PDF/export flows.
- Care Pass audience checklists and Health Pattern Review next steps.
- Record vault and due status.
- Record reminders for expired, due-soon, missing-critical, and reference-only records.
- Pet credential fallbacks.
- Sticky notes.
- WoofGuide deterministic actions and owner-reviewed draft payloads for meal logs, record reminders, vet notes, and Care Pass review.
- Setup wizard.
- Premium plan packaging and checkout-disabled guard.
- Premium entitlement policy for Free, Plus, and Family feature gates before checkout is enabled.
- Avatar motion state derivation for health watch, recent care logs, due routines, quiet hours, and low energy.
- Privacy/account safety export, deletion request, AI disclosure, document storage gates, and payment launch blockers.
- Mobile readiness static smoke for critical route registration, tab coverage, string router links, launch-blocking safety copy, CI Expo web export wiring, Records printable report actions, and screen-reader labels for critical Privacy, Premium, WoofGuide, and More actions.
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
8. Add sticky note to a log.
9. Add vaccine, insurance, microchip, vet, receipt, and document records.
10. Confirm Records shows expired, due-soon, and missing-critical reminders but does not warn on reference-only microchip/policy values.
11. Preview and share sitter/vet/trainer/caregiver Care Pass.
12. Confirm Care Pass includes the audience checklist, Health Pattern Review, and non-diagnostic boundary before sharing.
13. Confirm report history stores shared Care Pass with printable export metadata, separate resend action, and printable-source share action.
14. Ask WoofGuide about recent changes and verify non-diagnostic wording.
15. Open WoofGuide suggested actions and confirm owner review appears before saving a meal log, creating a reminder, inserting a vet note, or reviewing Care Pass.
16. Open Privacy & Safety from More, share the care-data export, and confirm it includes care data counts without auth/session tokens.
17. Prepare an account deletion request and confirm it is non-destructive and says manual review/export first.
18. Confirm AI disclosure, document storage rules, and payment launch blockers are visible.
19. Review Health Watch pattern cards and confirm evidence, owner next steps, and vet-boundary language are visible.
20. Confirm the Home avatar motion row changes for a recent meal, upcoming walk, overdue routine, quiet hours, low energy, and Health Watch signal.
21. Force offline or failed sync state and confirm visibility.

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
