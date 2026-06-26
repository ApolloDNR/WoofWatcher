# Codex Progress Report - 2026-06-25

## Cross-Platform Install Guard

- Two-day beta risk addressed: the root package `preinstall` script no longer
  depends on `sh -c`, which was blocking Windows package/export attempts before
  Expo could run.
- `package.json` now calls `node scripts/enforce-pnpm-install.mjs`.
- The Node guard still removes forbidden `package-lock.json` and `yarn.lock`
  files and still rejects npm/yarn installs through `npm_config_user_agent`.
- Mobile readiness protects the guard because package/export proof is part of
  the 48-hour beta path.

## Expo Web Export Config

- Two-day beta risk addressed: the mobile Expo app config now explicitly
  declares the intended `ios`, `android`, and `web` platform set.
- `artifacts/woofwatcher-mobile/app.json` now sets `expo.web.bundler` to
  `metro`, matching the committed `smoke:web` export path.
- Mobile readiness protects both settings inside the existing Expo web export
  smoke test.
- A direct package-local Expo CLI export attempt now advances past the earlier
  `No platforms are configured to use the Metro bundler` error.
- The current local stop is truthful dependency state, not app config:
  `Cannot determine the project's Expo SDK version because the module 'expo' is
  not installed`.

## Mobile Beta Doctor

- Two-day beta risk addressed: the repo now has one root command that tells
  Apollo, Replit, or a device helper what blocks mobile beta export.
- `package.json` now exposes `doctor:mobile-beta`.
- `scripts/mobile-beta-doctor.mjs` checks `pnpm`, the root install guard, the
  mobile `smoke:web` command, Expo iOS/Android/web + Metro config, mobile Expo
  dependency resolution, PixelLab verifier presence, and `/care-twin-qa` owner
  proof steps.
- In this cleaned Windows shell, the doctor truthfully exits blocked on two
  issues: `pnpm` is not on PATH, and the mobile package cannot resolve `expo`.

## Package Manager Pin

- Two-day beta risk addressed: local, Replit, Corepack, and CI runners now have
  one pnpm version to converge on instead of guessing.
- `package.json` declares `packageManager: pnpm@10.24.0`, matching
  `.github/workflows/verify.yml`.
- `scripts/mobile-beta-doctor.mjs` now checks the root package-manager pin
  against the GitHub Actions pnpm setup version before export handoff.
- Mobile readiness protects the package-manager pin, the CI workflow version,
  and the doctor alignment check.
- The doctor now passes the package-manager gate and still truthfully blocks
  this cleaned Windows shell on missing local `pnpm` plus missing mobile `expo`
  dependency resolution.

## Corepack Bootstrap Guidance

- Two-day beta risk addressed: a helper no longer has to infer how to recover
  from the missing-pnpm blocker.
- `scripts/mobile-beta-doctor.mjs` now checks Corepack as a warning-level
  bootstrap helper and prints the exact activation command:
  `corepack prepare pnpm@10.24.0 --activate`.
- If Corepack is absent, the doctor says to install pnpm 10.24.0 directly or
  use Replit/WSL.
- The direct doctor run in this cleaned Windows shell now reports one Corepack
  warning and the same two true blockers: no `pnpm` on PATH and no mobile
  `expo` dependency resolution.

## Verification

- Red/green readiness: `mobileReadiness.test.ts` first failed on the missing
  guard script, then passed with 79 tests after wiring.
- Red/green export-config readiness: `mobileReadiness.test.ts` first failed on
  missing `expo.platforms` / `expo.web.bundler` expectations, then passed after
  wiring.
- Red/green doctor readiness: `mobileReadiness.test.ts` first failed on the
  missing doctor script, then passed after the command and script were wired.
- Red/green package-manager readiness: `mobileReadiness.test.ts` first failed
  on the missing root `packageManager`, then passed after `pnpm@10.24.0` and
  the doctor check were wired.
- Red/green Corepack guidance readiness: `mobileReadiness.test.ts` first failed
  on missing `Corepack` guidance, then passed after the doctor printed the
  pnpm 10.24.0 Corepack activation command.
- Direct guard check with `npm_config_user_agent=pnpm/9.0.0`: passed.
- Direct guard check with `npm_config_user_agent=npm/10.0.0`: failed as
  expected with the pnpm-only warning.
- Targeted beta QA/readiness suite: 101 passing.
- Focused behavior/readiness suite: 402 passing.
- PixelLab asset verification: 149 valid files, 0 missing, 0 invalid.
- `git diff --check`: passed with expected Windows line-ending warnings only.

## Still Open

- Local `pnpm` is not on PATH in this cleaned Windows shell.
- Mobile TypeScript/export still need a dependency-complete environment with the
  Expo/mobile package layer; current direct export stops because `expo` is not
  installed into the mobile package resolution layer.
- Real iOS/Android owner-preview screenshots and Mission note proof remain the
  external two-day beta gate.
