# WoofWatcher V1 — Work Mode Handoff

Date: 2026-08-20
Canonical integration branch: `release/woofwatcher-v1`
Canonical PR: #12
Canonical release gate: issue #13
Production/App Store status: **NOT APPROVED**
Owner native visual approval: **NOT YET GRANTED**

## Mission

Finish the V1 engineering closeout around coordinated local-data deletion/reset, prove the exact branch head, then create a signed native candidate that Apollo can actually use on-device. Do not add unrelated features or start a parallel release branch.

## Start here

1. PR #12
2. issue #13
3. `docs/release/STATUS.md`
4. this handoff
5. the reset/storage/privacy implementation and focused tests referenced by issue #13

## Current verified state

- PR #12 is open, draft, mergeable, and is the single V1 integration candidate.
- The branch contains 37 post-main commits and substantial V1 recovery/hardening work.
- Exact branch head before this handoff was `8ee8cd6c2acea509d5a75dbe70b4e822ed903f16`, with successful GitHub verification.
- The remaining uncertainty is not whether an app exists; it is whether every destructive-reset owner and native release behavior is genuinely complete and truthfully represented.
- `docs/release/STATUS.md` was known to be stale relative to the branch and must be reconciled to code reality.

## Engineering closeout — do before merge/native approval

Audit implementation, do not merely tick boxes from old docs.

### Coordinated reset / deletion

Prove all of the following in code and adversarial tests:

- Care destructive-reset delegate participates in the coordinated reset runtime.
- Avatar destructive-reset delegate participates in the coordinated reset runtime.
- Every removable storage writer participates in reset generation / permit / drain semantics.
- Active app-owned file operations drain before deletion begins.
- Every owned file directory, including credential-owned/private storage, is removed or truthfully reported as a failure.
- Same-origin runtime/browser caches that can recreate old state are cleared or bypassed as part of reset.
- Live walk capture/state participates in reset ownership.
- Export and reset are mutually exclusive where concurrency can produce inconsistent archives or resurrected state.
- No stale writer can recreate deleted data after reset completion.
- Privacy UI reports complete success only when complete; partial failure must be visible and actionable, never catch-and-ignore.

### Tests

Add/repair focused tests first where behavior is missing. Include adversarial cases such as:

- reset begins while a writer is active
- writer attempts post-reset stale write
- file deletion fails
- cache clear fails
- walk capture is active
- export overlaps reset
- one owner fails while others succeed
- retry/relaunch after partial failure

Then run exact-head full CI.

## Release-document truth

Update `docs/release/STATUS.md` only after inspecting current code and tests. Record:

- exact branch head
- implemented milestone
- what remains engineering-blocked
- what remains environment/device-gated
- no claims of production-safe deletion unless the adversarial proof exists

## Native candidate gate

After engineering closeout is green, produce a real signed candidate rather than more browser-only screenshots.

### iOS physical-device QA

Test at minimum:

- install / first launch
- navigation and safe areas
- large text / Dynamic Type
- VoiceOver
- touch targets and one-handed use
- permission prompts
- haptics where used
- deep links/back behavior
- file import/export/native sharing
- offline use, background/foreground, kill/relaunch
- active walk flow
- meals, care/vet, documents, avatar/profile flows
- destructive reset and export on device
- error/empty/loading states

### Android physical-device QA

Equivalent TalkBack, navigation/back, permissions, storage/share, offline/relaunch, reset/export, and layout verification.

Record exact build IDs / binary identity and screenshots/video evidence.

## Visual/product standard

WoofWatcher should feel like a polished pet-care companion, not a web dashboard wrapped as mobile. Prefer calm hierarchy, native-feeling navigation, obvious primary actions, readable records, warm trust, and restrained motion. Do not hide data integrity problems behind polished UI.

## Safety boundaries

Do not:

- merge PR #12 until engineering gate is proven
- submit App Store / Play Store
- publish production
- claim native approval from browser testing
- add broad new features

## Definition of done for the Work session

1. reset/deletion issue #13 engineering items evidenced in code/tests
2. `docs/release/STATUS.md` reconciled to exact reality
3. exact-head CI green
4. signed native candidate(s) produced if credentials/environment allow
5. physical-device QA evidence, or a precise credential/device blocker if not possible
6. Apollo receives a build he can actually preview/use
7. explicit statement that store release still requires Apollo approval of the exact binary
