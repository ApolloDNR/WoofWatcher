# WoofWatcher V1 Release Status

- Integration branch: `release/woofwatcher-v1`
- Last verified implementation checkpoint: `f9c82e6854dee9d9e618d43e18499147eac33638`
- Verified implementation tree: `5f598046cfb4d1f22cc6104c5d3d81b0d5477bbc`
- Checkpoint CI: [WoofWatcher Verify #973 — PASS](https://github.com/ApolloDNR/WoofWatcher/actions/runs/31742621630)
- Durable baseline: `0f1107b170b0a9c89548a51f5cdeb664ba98246f`
- Baseline code commit: `b6934f7a`
- Main at recovery start: `47234396`
- Scope: free, local-first V1
- Browser verdict: PASS
- Native verdict: PENDING NATIVE

## Current milestone

M0 — Durable Release Control: COMPLETE

Next: M1 — Serialized Care Snapshot Persistence

## M0 durable checkpoint

- Remote branch and exact tree equality: PASS
- Independent review: PASS; zero unresolved issues
- Frozen install with Node 24 and pnpm 10.24.0: PASS
- Focused tests: 1,041/1,041 PASS
- Mobile beta doctor: READY_FOR_EXPORT
- Store-material validation: PASS; owner/native release gates remain open
- TypeScript and CI-safe builds: PASS
- Expo web export: 260 files / 1,943 modules PASS
- Runtime routes: 47/47 PASS
- Live-preview routes: 56/56 PASS
- Native release verdict: unchanged at PENDING NATIVE

The first M0 run exposed a `pnpm/action-setup` v6.0.1 bootstrap regression, not a damaged lockfile. The repair pins the corrected v6.0.10 commit and fails fast unless the runner resolves pnpm 10.24.0 before installation.

## Recovered baseline verification

- Focused tests: 1,037/1,037 PASS
- TypeScript and CI build: PASS
- Expo web export: 260 files / 1,943 modules PASS
- Runtime routes: 47/47 PASS
- Live-preview routes: 56/56 PASS
- Historical rendered Chromium navigation: 544/544 PASS

## Active risks

- Physical iOS/Android, VoiceOver/TalkBack, large text, Back/deep-link history, safe areas, touch targets, haptics, permissions, and native sharing remain unproved.
- Later local-only hardening commits were pruned and are being reconstructed from tests and documented behavior.
