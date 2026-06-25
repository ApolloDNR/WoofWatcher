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

## Verification

- Red/green readiness: `mobileReadiness.test.ts` first failed on the missing
  guard script, then passed with 79 tests after wiring.
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
  Expo/mobile package layer.
- Real iOS/Android owner-preview screenshots and Mission note proof remain the
  external two-day beta gate.
