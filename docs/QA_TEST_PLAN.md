# QA Test Plan

## Current Automated Baseline

Run focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

CI must pass `WoofWatcher Verify` on `main`.

Latest local evidence, 2026-06-08:

- PASS: 61 focused tests with the command above.
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
- Care Pass generation and report artifacts.
- Care Pass audience checklists and Health Pattern Review next steps.
- Record vault and due status.
- Pet credential fallbacks.
- Sticky notes.
- WoofGuide deterministic actions.
- Setup wizard.
- Premium plan packaging and checkout-disabled guard.

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
10. Preview and share sitter/vet/trainer/caregiver Care Pass.
11. Confirm Care Pass includes the audience checklist, Health Pattern Review, and non-diagnostic boundary before sharing.
12. Confirm report history stores shared Care Pass.
13. Ask WoofGuide about recent changes and verify non-diagnostic wording.
14. Review Health Watch pattern cards and confirm evidence, owner next steps, and vet-boundary language are visible.
15. Force offline or failed sync state and confirm visibility.

## Missing QA

- Expo runtime smoke.
- API integration tests.
- Auth onboarding smoke.
- Visual regression or screenshot review.
- Accessibility pass.
- Document upload/security tests.
- Payment/paywall tests when monetization is enabled.
