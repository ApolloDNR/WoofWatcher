# Codex Progress Report - 2026-06-26

## Machine-Readable Beta Doctor

- Two-day beta risk addressed: Replit, native helpers, or automation no longer
  need to scrape human console text to know whether the mobile beta export path
  is ready.
- `package.json` now exposes `doctor:mobile-beta:json`.
- `scripts/mobile-beta-doctor.mjs --json` emits one JSON payload with `name`,
  `purpose`, `result`, `checks`, `issues`, `warnings`, `proofCommands`, and
  `nextActions`.
- The human `pnpm run doctor:mobile-beta` output remains available for Apollo
  and manual helpers.
- In this cleaned Windows shell, the JSON doctor truthfully reports
  `result: BLOCKED` because `pnpm` is not on PATH and the mobile package cannot
  resolve `expo`.
- The JSON payload still shows the useful pass signals: Node 24 runtime, root
  package-manager/CI alignment, Windows-friendly install guard, mobile package
  presence, Expo iOS/Android/web + Metro config, EAS preview/production
  iOS/Android build profile coverage, and PixelLab verifier presence.

## Beta Handoff Dependency Proof

- `Share Beta Handoff` now carries the dependency/export proof commands inside
  the generated packet instead of requiring Apollo, Replit, Fable, or a device
  helper to cross-reference release docs.
- The packet lists `corepack prepare pnpm@10.24.0 --activate`,
  `pnpm install`, `pnpm run doctor:mobile-beta`,
  `pnpm run doctor:mobile-beta:json`, and
  `pnpm --filter @workspace/woofwatcher-mobile run smoke:web`.
- The handoff states that dependency proof only counts when both doctor
  commands report no blockers, and that a blocked JSON payload should be
  attached to the handoff instead of being treated as readiness.
- The JSON doctor now exposes the same sequence as structured `proofCommands`
  for helpers that need a machine-readable run order.

## Provider Setup Proof

- Provider Launch Setup now names the proof needed for every production gate
  instead of only saying ready/open.
- `launchProviderSetup.ts` adds `proofRequired` to production auth, household
  database sync, records/media storage, WoofGuide AI, Plus payments, push
  notifications, Apple/Google store accounts, and account deletion.
- More renders `Proof needed:` under each provider row, and the native Share
  Provider Plan packet now includes a `Proof Needed` section.
- This remains a launch-prep checklist only. It does not claim Clerk, Supabase,
  storage, AI, payments, push, store, or deletion approval.

## Beta Handoff Provider Proof

- `Share Beta Handoff` now accepts the live Provider Launch Setup plan from
  More and includes the same `Provider proof needed` checklist.
- The packet now carries dependency proof, current device mission/proof gaps,
  provider evidence, and launch truth boundaries in one owner-readable handoff
  for Apollo, Replit, Fable, or a native helper.
- The beta handoff function keeps its old timestamp-only call form while adding
  a structured options form for the provider plan.
- Provider proof collection remains evidence only; it does not approve stores,
  payments, AI, storage, database, or public launch.

## Verification

- Red/green JSON doctor readiness: `mobileReadiness.test.ts` first failed on
  the missing `doctor:mobile-beta:json` root script, then passed with 81 tests
  after the script and JSON mode were wired.
- Red/green beta handoff readiness: `betaHandoffPacket.test.ts` first failed on
  the missing dependency proof command section, then passed after the share text
  was updated.
- Red/green structured doctor proof: `mobileReadiness.test.ts` first failed on
  missing `proofCommands`, then passed after the doctor JSON emitted the exact
  command sequence.
- Red/green provider setup proof: `launchProviderSetup.test.ts` first failed on
  missing `proofRequired` and `Proof Needed` output, then passed after the
  model/share text were updated; `mobileReadiness.test.ts` protects More's
  visible `Proof needed:` row copy.
- Red/green beta handoff provider proof: `betaHandoffPacket.test.ts` first
  failed because the new options object was rendered as `[object Object]` and
  no provider proof existed in the packet, then passed after
  `buildBetaHandoffPacketShareText` accepted provider setup options and More
  passed `launchProviderSetupPlan`.
- Direct text doctor: exits blocked with the expected two issues, missing pnpm
  and missing mobile `expo` dependency resolution.
- Direct JSON doctor: exits blocked with valid JSON and the same two issues.
- Targeted beta QA/readiness suite: 103 passing.
- Focused behavior/readiness suite: 404 passing.
- PixelLab asset verification: 149 valid files, 0 missing, 0 invalid.
- `git diff --check`: passed with expected Windows line-ending warnings only.

## Still Open

- Install or enable exact `pnpm@10.24.0` in a dependency-complete environment.
- Run `pnpm install`, `pnpm run doctor:mobile-beta`,
  `pnpm run doctor:mobile-beta:json`, and mobile export/smoke from Replit,
  Git Bash/WSL, CI after billing is fixed, or another environment where the
  mobile package can resolve Expo.
- Capture the real `/care-twin-qa` iOS/Android screenshots and Mission note
  proof before claiming internal beta proof.

## Owner Preview Storage-Proof Doctor Guard

- `scripts/mobile-beta-doctor.mjs --json` now source-validates the Owner
  Preview Care Pass storage proof chain.
- The guard only passes when the release QA matrix still asks for the Care Pass
  Report History storage-status proof, the native QA share script still carries
  route-loop proof lines, and `/care-twin-qa` still renders the Owner route-loop
  proof text.
- Red/green evidence: `mobileReadiness.test.ts` first failed on the missing
  doctor check, then passed after the source-backed contract was added.
- Verification passed: 81-test mobile readiness, 102-test release QA/native
  capture readiness, 420-test zero-dependency behavior/readiness suite,
  PixelLab asset verification at 149 files, and `git diff --check` with
  expected Windows line-ending warnings only.
- Direct JSON doctor still reports `BLOCKED` on the real local export issues:
  missing pnpm and missing mobile Expo dependency resolution.
- Remote verify run `28240015482` for commit `2f23753` failed before job
  execution with job `83664251661`, `steps: []`, and `log not found:
  83664251661`, matching the standing GitHub billing/spending-limit blocker.

## Beta Handoff Storage-Proof Line

- `buildBetaHandoffPacketShareText` now explicitly includes the Care Pass Report
  History storage-status proof under `Required beta proof after export`.
- The packet tells helpers to confirm Report History says `Saved on this device`
  or `Ready to upload` before claiming beta proof.
- The mobile beta doctor's Owner Preview storage-proof source guard now checks
  the beta handoff packet for that line too.
- Red/green evidence: `betaHandoffPacket.test.ts` first failed on the missing
  line, then passed after the packet and doctor guard were updated.
- Verification passed: beta handoff packet test, 81-test mobile readiness,
  420-test zero-dependency behavior/readiness suite, PixelLab asset
  verification at 149 files, and `git diff --check` with expected Windows
  line-ending warnings only.
- Direct JSON doctor still reports `BLOCKED` on the real local export issues:
  missing pnpm and missing mobile Expo dependency resolution.
- Remote verify run `28256289432` for commit `941d4f0` failed before job
  execution with job `83720072278`, `steps: []`, and `log not found:
  83720072278`, matching the standing GitHub billing/spending-limit blocker.
