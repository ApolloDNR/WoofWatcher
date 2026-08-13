# WoofWatcher V1 Release Status

- Integration branch: `release/woofwatcher-v1`
- Last verified implementation checkpoint: `f6a5a22b3e9b2224b275b43f29afee525e841cf1`
- Verified implementation tree: `72aa44cb48bc68ce437136ea0a0b032f4bba5b15`
- Checkpoint CI: [WoofWatcher Verify #977 — PASS](https://github.com/ApolloDNR/WoofWatcher/actions/runs/31746688906)
- Durable baseline: `0f1107b170b0a9c89548a51f5cdeb664ba98246f`
- Baseline code commit: `b6934f7a`
- Main at recovery start: `47234396`
- Scope: free, local-first V1
- Browser verdict: PASS
- Native verdict: PENDING NATIVE

## Current milestone

M1 — Serialized Care Snapshot Persistence: COMPLETE

Next: M2 — Coordinated Privacy Export and Local Reset

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
- Recovery-key and legacy-import writes remain outside coordinated reset and can race owner-key removal; M2 owns this release blocker.
- Later local-only hardening commits were pruned and are being reconstructed from tests and documented behavior.
