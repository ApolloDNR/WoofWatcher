# WoofWatcher Claude/Fable Operating Notes

## Read First

Before changing code, read these files in order:

0. `docs/handoff/HANDOFF_2026-07-18.md` (latest handoff - current state of the app)
0.1. The `premium-living-app` project skill (`.claude/skills/premium-living-app/`) -
   the operating SOP for all product work in this repo: honesty rules, craft
   bar, verification recipes, audit procedures, data-safety laws, release
   pipeline. Invoke it before changing product code.
0.5. `docs/design/APOLLO_MASTER_VISION_PROMPT.md` (the operative vision - hold every change against it)
1. `AGENTS.md`
2. `README.md`
3. `docs/design/FABLE_HANDOFF_2026-06-13.md`
4. `docs/release/MOBILE_RELEASE_RUNBOOK.md`
5. `docs/ULTIMATE_RELEASE_PLAN.md`
6. `docs/QA_TEST_PLAN.md`
7. `docs/BLOCKERS_FOR_APOLLO.md`

## Product Direction

WoofWatcher is a premium mobile-first dog-care operating system.

Core line: Real care. Pixel heart.

Tagline: Your dog's day, brought to life.

The canonical product surface is the Expo app in `artifacts/woofwatcher-mobile`. The PWA/web dashboard in `artifacts/woofwatcher` is secondary and should visually align after mobile is strong.

## Current Assignment

Polish WoofWatcher for iOS and Android first. Focus on premium neo-retro pixel care UI, emotional polish, clear navigation, excellent safe-area behavior, fast logging, and no dead ends.

Do not rebuild the app from scratch. Preserve the existing architecture and workflows.

## Preserve

- Expo mobile app identity and EAS config.
- Local-first care model and persistence.
- `lib/care-domain` shared care logic.
- Routines/logs relationship.
- Meal served-to-outcome lifecycle.
- Potty parent/outcome flow.
- Household Pulse and Alone Time.
- Health Watch and Bile Watch non-diagnostic language.
- Records, Care Pass, report artifacts, and printable-source paths.
- WoofGuide owner-reviewed safety boundary.
- Privacy/export/delete request guardrails.
- Tests and CI behavior.

## Design Priorities

1. Mobile Home/Phoenix room.
2. Quick Log and meal/potty flows.
3. Health Watch and Bile Watch.
4. Records and Care Pass.
5. WoofGuide.
6. Avatar Studio.
7. Achievements.
8. Settings.
9. Web/PWA visual alignment after mobile.

## Hard Rules

- Do not claim cloud sync, payments, push notifications, live AI, document storage, TestFlight, Google Play, or App Store submission is enabled unless provider setup exists.
- Do not add veterinary diagnosis or treatment claims.
- Do not commit secrets.
- Do not delete care workflows to make visuals simpler.
- Do not introduce dead buttons.
- Keep text readable; use pixel style as accent, not body copy.

## Verification

Run focused tests after meaningful changes:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts artifacts\woofwatcher\src\vanilla\*.test.js lib\care-domain\test\*.test.ts
```

When package tooling is available:

```powershell
pnpm install --frozen-lockfile
pnpm run build:ci
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Before handoff, summarize changed files, verification results, remaining blockers, and screenshots or simulator/device notes.
