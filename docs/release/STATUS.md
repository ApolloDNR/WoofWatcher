# WoofWatcher V1 Release Status

- Integration branch: `release/woofwatcher-v1`
- Last verified implementation checkpoint: `05e9bc14b1f4e00a92b7966211dfcb8e8b5db285`
- Verified implementation tree: `f0bf1d37fb92132fcca1254cc58ae387223d28bc`
- Checkpoint CI: [WoofWatcher Verify #979 — PASS](https://github.com/ApolloDNR/WoofWatcher/actions/runs/31751735301)
- Durable baseline: `0f1107b170b0a9c89548a51f5cdeb664ba98246f`
- Baseline code commit: `b6934f7a`
- Main at recovery start: `47234396`
- Scope: free, local-first V1
- Browser verdict: PASS
- Native verdict: PENDING NATIVE

## Current milestone

M2A — Coordinated Local Reset Core: COMPLETE

Next: M2B — App-Wide Privacy Export and Local Reset Integration

## M2A durable checkpoint

- Remote branch and exact tree equality: PASS
- Independent adversarial review: PASS; zero critical, important, or minor findings
- Opaque generation permits revoke old asynchronous work and reject foreign/forged tokens: PASS
- Two-phase participants prepare deterministically before the transactional commit barrier: PASS
- Preparation failure performs zero destructive commits and preserves the current generation: PASS
- Concurrent and re-entrant reset/export callers coalesce onto exact in-flight promises: PASS
- Removable storage writes are FIFO, admission-aware, permit-checked, and drainable: PASS
- Immutable export capture and export/reset mutual exclusion: PASS
- New reset-core tests: 42/42 PASS
- Focused tests: 1,089/1,089 PASS
- Mobile beta doctor, store-material validation, TypeScript, and CI-safe builds: PASS
- Native release verdict: unchanged at PENDING NATIVE

M2 is not complete. The core is now durable and independently proved, but production providers and screens have not yet been moved onto it. M2B must register Care, Avatar, app-owned files, web runtime caches, and live walk capture; migrate every removable `woofwatcher*` writer; drain active file operations; remove all three owned directories including `WoofWatcherCredentials`; and replace Privacy's parallel catch-and-ignore wipe with honest complete/partial-failure UI.

## M1 durable checkpoint

- Remote branch and exact tree equality: PASS
- Independent adversarial review: PASS; no in-scope critical or important issues
- Primary care snapshots execute in FIFO order: PASS
- Owner wipe invalidates queued stale snapshots and drains the active write before key removal: PASS
- Concurrent owner-wipe calls coalesce onto one operation: PASS
- Hydration, retry, and legacy-import continuations cannot restore in-memory pre-wipe state: PASS
- Targeted persistence/sync/protection tests: 75/75 PASS
- Focused tests: 1,047/1,047 PASS
- Mobile beta doctor: READY_FOR_EXPORT
- TypeScript and CI-safe builds: PASS
- Expo web export: 260 files PASS
- Runtime routes: 47/47 PASS
- Live-preview routes: 56/56 PASS
- Native release verdict: unchanged at PENDING NATIVE

M2 remains a release blocker: recovery-key and legacy-import `AsyncStorage` writes are not yet registered with a global reset coordinator. An already-started write could finish after owner-key removal and recreate an owned recovery/import key. Deletion must not be represented as production-safe until M2 tracks, invalidates, and drains those writes and reports partial participant failures.

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
- Care recovery/import, Avatar, Home, supplies/travel, and QA storage writes remain outside the coordinated removable lane; M2B owns this release blocker.
- In-flight attachment, report, and Dog ID credential writes can recreate deleted directories; M2B must drain them and delete all three owned directories before reporting success.
- Web runtime caches can retain same-origin API responses until service-worker bypass and reset-cache cleanup are integrated in M2B.
- Later local-only hardening commits were pruned and are being reconstructed from tests and documented behavior.
