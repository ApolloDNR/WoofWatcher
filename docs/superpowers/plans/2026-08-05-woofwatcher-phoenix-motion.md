# Phoenix and Interaction Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver WoofWatcher renovation Slice 4: approved normalized Phoenix animation assets, one UI-thread motion controller, externally driven sprite rendering, coherent interaction entrances, complete Reduce Motion/lifecycle behavior, and native performance evidence that meets the approved contract.

**Architecture:** A typed production manifest is the single source of truth for action timing, pages, density variants, contact frames, landmarks, static poses, and decoded memory. Pure motion sampling converts one elapsed-time phase into frame, authored root correction, paw contact, shadow, and roam travel; a Reanimated frame callback owns that phase on the UI thread. `SpriteSheetPlayer` becomes a stateless paged renderer, while `LivingPhoenixRoom` supplies semantic action requests and renders one root, shadow, and accessory stack around an aligned current/next texture pair.

**Tech Stack:** Expo SDK 54, Expo Router 6, React Native 0.81, React 19, Reanimated 4.1, Node 24 built-in test runner with TypeScript stripping, PNG RGBA asset tooling, Xcode Instruments, Android Studio System Trace/Perfetto.

## Global Constraints

- Slices 1–3 are hard prerequisites for executing this Slice 4 plan end-to-end. If staffing overlaps, the schema/pipeline/math/reducer red-green work in Tasks 0–5 may be prepared against synthetic fixtures, but Task 0 cannot turn green, Task 3 cannot build/approve a candidate, and Tasks 6–11 cannot integrate until the universal shell, Home hierarchy, and core workflow components have landed and passed their own gates.
- Consume Slice 1's canonical section-router architecture. Do not add nested Health/More routes or edit `app/(tabs)/records.tsx`, `pack.tsx`, or `story.tsx` beyond their already-landed compatibility redirects.
- This is an incremental renovation of `artifacts/woofwatcher-mobile`; do not rewrite the care domain or change frameworks.
- SDK 54 Expo Router tabs remain; SDK 55 and Native Tabs are outside this slice.
- The canonical Home Phoenix slot is not frozen until Task 0 records the post-Slice-2 component measurement. The current 112-point value is a measured candidate, not an assumption; any approved change regenerates every density variant.
- After Task 0 freezes the measured logical slot as `S`, export exact nearest-neighbor `S`, `2S`, and `3S` frames. The currently observed pre-Slice-2 value is 112 points; it is not a production constant until the post-Slice-2 measurement is approved. Runtime scaling of a Phoenix frame into a different slot is forbidden.
- Walk uses 12 intentionally spaced hard-pixel poses at 12 fps, satisfying the approved 12–16 pose and 12–15 fps range.
- No runtime texture exceeds 4096 px in either dimension. Compute `framesPerPage = floor(4096 / (3S))` from the frozen slot; for `S = 112`, this is 12 frames because `12 × 336 = 4032`.
- While a scene is active, current plus next Phoenix textures stay at or below 20 MiB decoded at 3× density; only those actions may remain mounted during a transition. An inactive scene mounts none.
- While the Phoenix scene is active and visible, the semantic dwell/walk pair occupies the two warm slots. A reaction may temporarily replace only the non-current slot; after reaction completion the evicted dwell/walk atlas must be fully ready again before roam resumes. When the scene deactivates, both slots and every scene-owned fallback/effect image unmount and native cache eviction is requested; only logical action/phase metadata survives.
- One normalized phase drives frame, authored root, paw contact, shadow, and travel. No continuous visual motion may use React state or JS timers.
- Every state change resolves through the reviewer-signed transition matrix. An `aligned-crossfade` lasts exactly 100 ms and carries non-null direction-correct source/target contact IDs with a shared planted paw for its full sampled interval; a `contact-cut` swaps once at the matrix's defined signed contact and never renders both atlases together. No unreviewed/null-contact crossfade exists.
- Walking/dwell textures share root, approved logical frame box, contact phase, shadow, and accessory stack. A second shadow, accessory stack, silhouette, or runtime size transform is a defect.
- Motion pauses when the scene is offscreen or the app is inactive. Resume has no elapsed-time catch-up and starts at a deterministic meaningful pose.
- Visible card entrance delays are exactly 0/40/80 ms and all finish within 260 ms. Whole-screen and nested-card entrances must not run together.
- Reduce Motion disables perpetual sprite, roam, bob, shimmer, parallax, hearts, and translated entrances. Phoenix uses the action’s meaningful static pose; essential changes are instant or a maximum 100 ms opacity settle.
- Release baselines are iPhone 13 / iOS 18.6 and Pixel 7a / Android 15, plus the owner’s release-candidate devices. Record build SHA, fixture, profiler, thermal state, one warm-up, three measured runs, median, and worst run.
- Acceptance: median at least 59 fps; fewer than 1% of frames above 20 ms; no frame or JS task above 50 ms; Home-collapse alignment at most 1 px; touch-down visual response at most 50 ms.
- Asset preview approval, in-engine device review, performance traces, Reduce Motion capture, and owner acceptance are merge gates. Browser evidence never substitutes for native evidence.
- Use Node 24 and repository-pinned pnpm 10.24.0 for the full gate.
- Production Phoenix atlases render only at their approved logical size. The Phoenix API has no arbitrary width/height override. Retained non-Phoenix template atlases use the separate generic compatibility policy and never receive Phoenix landmark correction. If Task 0 freezes a value other than 112, every later literal in this plan is mechanically replaced with that approved value before Task 1 starts.
- Native proof requires a named external device operator with iOS signing/Xcode and Android Studio/Pixel access. If that operator, the baseline devices, signing, or the owner response is unavailable, report “implementation complete, merge blocked on native/owner gate”; do not substitute browser evidence.
- Pin `eas-cli` exactly to `21.6.0` in the mobile workspace and lockfile. Preserve `minimumReleaseAge: 1440`; because the coordinated release is less than 24 hours old on 2026-08-05, add only this closed exact-version set to `minimumReleaseAgeExclude`: `eas-cli@21.6.0`, `@expo/eas-build-job@21.6.0`, `@expo/eas-json@21.6.0`, and `@expo/steps@21.6.0`. A package-wide exception or lower/global disable is forbidden; the lockfile integrities plus pinned tarball and installed-manifest hashes are the trust boundary. Every EAS command in this plan runs through `pnpm --filter @workspace/woofwatcher-mobile exec eas`; an ambient/global `eas`, unversioned `npx`, or mismatched version is a hard preproduction failure. The 2026-08-05 feasibility probe downloaded `eas-cli-21.6.0.tgz` (`sha256 bb518b7fe97fa3bf0c8840d62be933ab1184478891c1f6aef4cfd27f01782561`), then the exact pinned-pnpm filtered add exited 0, materialized the workspace binary, printed `eas-cli/21.6.0`, and reproduced installed `oclif.manifest.json` SHA-256 `60cf395bd651e25be1f6a06d11404e0c27849c420101469165b0281be3177da1`. Its local help/manifest proves `project:init` has `--id`, `--json`, and `--non-interactive`; `project:info` has no flags; and `build:list` has `--limit`, `--json`, and `--non-interactive`.
- Viewport state is mandatory for every retained Phoenix or template rig. No focus-only/default-visible activity path is permitted.
- Art identity, approval-request metadata, owner response, and the later runtime release candidate are four different immutable records. No file contains its own hash, and runtime evidence must prove the reviewed art blobs are unchanged from the clean art-candidate tree.
- The approved seed feasibility probe is fixed input evidence: main seed `732907c58c1e5d81645fa1ddb2a97a1026c767c97004097562d8f9763135feac` is 680×680 with 55 opaque RGB colors; standing seed `5c3df1bad8939e85ca13f0d0d1e720f3607f92db462ff00b78b4f8a4e50492af` is 170×170 with 75 opaque RGB colors; their intersection is 0 and union is 130. Production therefore uses the explicit owner-approved per-action palette policy in Tasks 2–3: `main-55` for every action except `walk-loop`, and `standing-walk-75` for `walk-loop`. A single 55-color gate is forbidden.

---

## File Structure

### New production and pipeline files

- `artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.ts` — typed action/page/landmark contract and immutable production values.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.ts` — validates the post-Slice slot, seed hashes, source annotations, candidate identity, and external gate.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.test.ts` — fail-closed preproduction contract tests.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionGeneratedManifest.ts` — deterministic page and reviewed-landmark data emitted by the asset builder.
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/source-manifest.json` — human-reviewed seed, provenance, landmark, paw-contact, and slot-measurement source of truth.
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/source-manifest.schema.json` — Task 0's fail-closed schema for the source manifest created during Task 3.
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/preproduction.json` — frozen Slice commits, Home slot, seed hashes/approval references, and external gate.
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/candidate.json` — clean candidate commit/tree, preview hashes, and EAS build IDs.
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/phoenix-palette.json` — exact per-action palette registry: sorted `main-55` and `standing-walk-75` palettes plus the closed eleven-action assignment.
- Eleven exact `production/reference-canvases/` PNGs named with the literal Task 3 action IDs, plus their chroma-backed edit canvases — N-slot seed-anchored edit targets hashed before image generation.
- Eleven untouched chroma-source PNGs, chroma-helper intermediates, exact-canvas reprojections, and deterministic keyed/quantized alpha PNGs — four separate, hash-locked provenance boundaries.
- `artifacts/woofwatcher-mobile/scripts/lib/phoenix-sprite-pipeline.mjs` — PNG decode, normalization, nearest-neighbor resize, pagination, metrics, and preview composition.
- `artifacts/woofwatcher-mobile/scripts/build-phoenix-motion-assets.mjs` — deterministic production build.
- `artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-assets.mjs` — fail-closed asset audit.
- `artifacts/woofwatcher-mobile/scripts/hash-phoenix-motion-sources.mjs` — recomputes seed, palette, canvas, raw/keyed source, annotation, and candidate-tree hashes.
- `artifacts/woofwatcher-mobile/scripts/measure-phoenix-home-slot.mjs` — records the rendered post-Slice-2 Home slot and component/build identity.
- `artifacts/woofwatcher-mobile/scripts/build-phoenix-reference-canvases.mjs` — checked-in wrapper over the sprite-pipeline canvas recipe, including chroma backing and seed/frame lock map.
- `artifacts/woofwatcher-mobile/scripts/quantize-phoenix-source.mjs` — deterministic chroma removal boundary, binary-alpha conversion, despill/fringe rejection, and exact-palette mapping.
- `artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs` — rejects a missing/mismatched local EAS binary, missing authentication/project access, or unavailable credential/operator gate.
- `artifacts/woofwatcher-mobile/scripts/verify-eas-project-link.mjs` — validates the owner-authorized EAS UUID/full name, the noninteractive `project:init` result, and the committed Expo config without prompting or creating a project.
- `docs/release/phoenix-motion-preproduction/eas-project-link.json` — closed, committed UUID/full-name/owner/config-hash identity copied from the external owner authorization and verified EAS result.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.ts` — closed fixture parser, canonical JSON serializer, exact AsyncStorage materializer/read-back verifier, and lifecycle handshake contract.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts` — proves both committed fixture identities materialize the exact persisted keys/bytes the app reads.
- `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-home-slot-v1.json` — committed deterministic post-Slice Home slot fixture used before the motion profiler fixture exists.
- `artifacts/woofwatcher-mobile/scripts/build-phoenix-approval-request.mjs` — packages candidate hashes for review without asserting approval.
- `artifacts/woofwatcher-mobile/scripts/build-phoenix-approval-wrapper.mjs` — copies a validated external response plus queried immutable release-asset identity into the checked-in wrapper; it cannot originate/default approval fields.
- `artifacts/woofwatcher-mobile/scripts/validate-phoenix-motion-approval.mjs` — validates a separately authored owner-response record; it never creates approval identity.
- Eleven prompt Markdown files, one for each action ID enumerated in Task 3 — checked-in exact art direction used for each generated candidate.
- Eleven `production/sources` PNG files named by those action IDs — hash-locked raw candidates before deterministic normalization.
- The exact normalized master/runtime PNG inventory enumerated in Task 3.
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/previews/phoenix-motion-labeled-preview.png` — labeled review sheet.
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval-request.json` — candidate/hash packet generated for the owner.
- `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval.json` — checked-in wrapper that hashes and references, but is distinct from, the immutable external owner-response export.
- `docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.json` and `.png` — committed exact-build iPhone 13 slot/PixelRatio evidence.

### New runtime files

- `artifacts/woofwatcher-mobile/lib/externalSpriteAtlas.ts` — generic paged-atlas and external-frame contract shared by Phoenix and legacy template packs.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionMath.ts` — pure worklet-safe sampling and transition math.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionFrameDriver.ts` — pure injected-delta driver used by both Node tests and the Reanimated hook.
- `artifacts/woofwatcher-mobile/components/motion/PhoenixMotionController.ts` — single Reanimated frame callback and action state machine.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionControllerState.ts` — pure state machine, event reducer, and slot/readiness policy.
- `artifacts/woofwatcher-mobile/components/motion/ExternalSpriteClock.ts` — one generic external clock for retained template rigs.
- `artifacts/woofwatcher-mobile/components/avatar/TemplateSpriteRig.tsx` — non-Phoenix atlas/accessory branch.
- `artifacts/woofwatcher-mobile/components/phoenix/LivingPhoenixRig.tsx` — Phoenix-only Home controller/render branch.
- `artifacts/woofwatcher-mobile/components/phoenix/PhoenixTexturePair.tsx` — aligned current/next sprite layers.
- `artifacts/woofwatcher-mobile/components/phoenix/PhoenixSprite.tsx` — controller-backed decorative sprite wrapper.
- `artifacts/woofwatcher-mobile/hooks/useSceneActivity.ts` — focus/AppState/viewport activity gate.
- `artifacts/woofwatcher-mobile/lib/phoenixLifecycle.ts` — pure lifecycle adapter.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionInstrumentation.ts` — controller tick and rendered-layer probe contracts.
- `artifacts/woofwatcher-mobile/lib/phoenixMotionQa.ts` — structured native evidence gate.
- `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-v1.json` — exact typed fixture source whose tested loader produces the real three-key AsyncStorage bytes, clock/timezone, scene seed, route/collapse, and lifecycle handshake consumed by the QA surface.
- `artifacts/woofwatcher-mobile/lib/phoenixNativeMemoryEvidence.ts` — normalized iOS image-allocation/Android bitmap-allocation oracle types; app probe byte claims are excluded.
- `artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-evidence.mjs` — validates recorded device evidence.
- `artifacts/woofwatcher-mobile/scripts/extract-phoenix-motion-metrics.mjs` — reproducible Instruments/Perfetto export normalizer and threshold calculator.
- `artifacts/woofwatcher-mobile/scripts/profiler/phoenix-frame-timeline.sql` — checked-in Perfetto frame extraction query.
- `artifacts/woofwatcher-mobile/scripts/profiler/phoenix-js-tasks.sql` — checked-in Perfetto JavaScript-task query.
- `artifacts/woofwatcher-mobile/scripts/profiler/phoenix-bitmap-allocations.sql` and `phoenix-perfetto.pbtxt` — native Android decoded-bitmap allocation/release capture.
- `artifacts/woofwatcher-mobile/scripts/extract-phoenix-video-frames.mjs` — hashes every decoded video frame and validates signed frame-review coverage of transition windows.
- `artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-source.mjs` — AST-based timer/frame-clock ownership check.
- `docs/release/PHOENIX_MOTION_PREPRODUCTION.md`, `PHOENIX_MOTION_CALLSITE_INVENTORY.md`, `GAME_FEEL_CALLSITE_INVENTORY.md`, and `PHOENIX_MOTION_QA.md` — prerequisite, ownership, and native proof records.

### New tests

- `lib/phoenixMotionManifest.test.ts`
- `lib/phoenixMotionPreproduction.test.ts`
- `lib/phoenixMotionAssets.test.ts`
- `lib/externalSpriteAtlas.test.ts`
- `lib/phoenixMotionMath.test.ts`
- `lib/phoenixMotionController.test.ts`
- `lib/phoenixMotionInstrumentation.test.ts`
- `lib/phoenixLifecycle.test.ts`
- `lib/phoenixReduceMotion.test.ts`
- `lib/gameFeel.test.ts`
- `lib/phoenixMotionQa.test.ts`
- `lib/phoenixMotionMetricExtraction.test.ts`

### Existing files modified

- `lib/avatarLifeEngine.ts`, `lib/careTwinAssets.ts`, `lib/careTwinChoreography.ts`, `lib/careTwinRoam.ts`
- `lib/avatarRoomRuntime.ts`, `lib/avatarRoomRuntime.test.ts`, `lib/avatarTemplateSpriteAssets.ts`, `lib/avatarTemplateSpriteAssets.test.ts`, `lib/avatarStudio.test.ts`
- `components/SpriteSheetPlayer.tsx`, `components/LivingPhoenixRoom.tsx`
- `components/motion/GameFeel.tsx`, `components/board/BoardPrimitives.tsx`, `components/DayTrailScene.tsx`
- The post-Slice-1–3 components found by Task 6/9 discovery, including `components/health/RecordsScreen.tsx`, `components/more/AvatarStudioScreen.tsx`, `components/more/AdventureScreen.tsx`, `components/more/WoofGuideScreen.tsx`, `components/more/StoryProgressScreen.tsx`, `components/more/CareTeamSuppliesScreen.tsx`, their section routers, canonical tab-composition shells, and `_layout.tsx`; compatibility route redirects are not motion edit targets.
- `app/care-twin-qa.tsx`; the `/portrait`, `/adventure`, `/woofguide`, `/records`, `/pack`, and `/story` bridge files remain untouched.
- `lib/mobileReadiness.test.ts`, `package.json`, root `pnpm-workspace.yaml`, Phoenix asset READMEs, and release QA documentation.

---

### Task 0: Freeze the Post-Slice Slot, Seed, Candidate, and Native Gate

**Files:**
- Create: `docs/release/PHOENIX_MOTION_PREPRODUCTION.md`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.test.ts`
- Create: `artifacts/woofwatcher-mobile/scripts/measure-phoenix-home-slot.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/hash-phoenix-motion-sources.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/verify-eas-project-link.mjs`
- Create: `docs/release/phoenix-motion-preproduction/eas-project-link.json`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-home-slot-v1.json`
- Create: `artifacts/woofwatcher-mobile/components/qa/PhoenixHomeSlotProbe.tsx`
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/source-manifest.schema.json`
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/preproduction.json`
- Create after capture: `docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.json`
- Create after capture: `docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.png`
- Modify: `artifacts/woofwatcher-mobile/package.json`
- Modify: `artifacts/woofwatcher-mobile/eas.json`
- Modify: `artifacts/woofwatcher-mobile/app.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export interface PhoenixHomeSlotMeasurement {
  logicalWidth: number;
  logicalHeight: number;
  pixelRatio: number;
  renderedPixelWidth: number;
  renderedPixelHeight: number;
  viewportLogicalWidth: 390;
  viewportLogicalHeight: 844;
  screenshotPixelWidth: 1170;
  screenshotPixelHeight: 2532;
  platform: "ios";
  hardware: "iPhone 13";
  osVersion: "18.6";
  route: "/(tabs)";
  componentPath: string;
  fixtureId: "phoenix-home-slot-v1";
  fixtureSha256: string;
  measuredAt: string;
  build: {
    commit: string;
    tree: string;
    easBuildId: string;
    easProjectId: string;
    easProjectFullName: string;
    bundleIdentifier: "com.pegasusdreamscapes.woofwatcher";
    cfBundleVersion: string;
  };
  instrumentation: { componentPath: string; sourceSha256: string; probeVersion: 1 };
  evidence: {
    screenshotPath: "docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.png";
    screenshotSha256: string;
    screenshotBytes: number;
  };
}

export interface PhoenixHomeSlotEvidenceRef {
  measurementPath: "docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.json";
  measurementSha256: string;
  measurementBytes: number;
  screenshotPath: "docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.png";
  screenshotSha256: string;
  screenshotBytes: number;
}

export interface PhoenixFixtureStorageBytes {
  fixtureId: "phoenix-home-slot-v1" | "phoenix-motion-v1";
  sourceSha256: string;
  entries: readonly [
    { key: "woofwatcher.v2.state"; utf8Value: string; sha256: string; bytes: number },
    { key: "woofwatcher.petAvatarConfig.v1"; utf8Value: string; sha256: string; bytes: number },
    { key: "woofwatcher.homeWelcomeDismissed.v1"; utf8Value: "true"; sha256: string; bytes: 4 },
  ];
  aggregateSha256: string;
}

export interface PhoenixSeedRecord {
  path: string;
  sha256: string;
  purpose: "identity" | "standing-walk-source";
  ownerApprovalRef: string;
}

export interface PhoenixEasProjectIdentity {
  projectId: string;
  fullName: string;
  owner: string;
  slug: "woofwatcher";
  appConfigPath: "artifacts/woofwatcher-mobile/app.json";
  appConfigSha256: string;
  linkedWithEasCli: "21.6.0";
  ownerApprovalRef: string;
  ownerResponseSha256: string;
}

export interface PhoenixCandidateIdentityPolicy {
  artCandidate: {
    branch: "feature-branch";
    requiresCleanTree: true;
    immutableCommitAndTree: true;
    easProfile: "preview";
    platforms: readonly ["ios", "android"];
  };
  metadataRecord: {
    path: "assets/avatar/phoenix/production/candidate.json";
    writtenOnlyAfterBothBuilds: true;
    referencesArtCandidateParent: true;
  };
  ownerResponse: {
    externallyAuthoredBytes: true;
    checkedInWrapperHashesExternalBytes: true;
    wrapperNeverHashesItself: true;
  };
  runtimeCandidate: { separateCommitAndTree: true; unchangedArtBlobProofRequired: true };
  rejectionPolicy: "new-commit-never-amend";
}

export type PhoenixExternalGate =
  | {
      status: "available";
      operator: string;
      iosDevice: "iPhone 13 / iOS 18.6";
      androidDevice: "Pixel 7a / Android 15";
      xcodeVersion: string;
      androidStudioVersion: string;
      signingAvailable: true;
      adbAvailable: true;
      easAccessAvailable: true;
      easCli: { version: "21.6.0"; resolvedPath: string; authenticatedAccount: string; projectId: string; projectFullName: string };
      ownerDevices: readonly { owner: string; hardware: string; osVersion: string }[];
      ownerReviewChannel: string;
    }
  | {
      status: "blocked";
      coordinationOwner: string;
      unavailable: readonly ("operator" | "ios-device" | "android-device" | "signing" | "adb" | "eas" | "owner-review")[];
      reason: string;
      ownerReviewChannel: string;
    };

export interface PhoenixMotionPreproduction {
  sliceCommits: { slice1: string; slice2: string; slice3: string };
  slot: PhoenixHomeSlotMeasurement;
  slotEvidence: PhoenixHomeSlotEvidenceRef;
  seeds: readonly PhoenixSeedRecord[];
  sourceManifestSchemaSha256: string;
  candidateIdentityPolicy: PhoenixCandidateIdentityPolicy;
  easProject: PhoenixEasProjectIdentity;
  easProjectLinkCommit: string;
  externalGate: PhoenixExternalGate;
  slotFixture: PhoenixFixtureStorageBytes;
}
```

`validatePhoenixMotionPreproduction` rejects empty assigned/coordination identities, non-40-character commit/tree SHAs, non-64-character content hashes, a slot measured before the recorded Slice 2 commit, missing owner seed-approval references, a falsely available tool/device field, an available gate with zero owner devices, an empty blocked reason/list, or unequal slot width/height. It also rejects an absent/malformed EAS UUID, owner/full name not equal to `@${owner}/woofwatcher`, any disagreement among the committed link record, `app.json` `expo.owner`/`expo.slug`/`expo.extra.eas.projectId`, doctor output, slot build, and later evidence, or an EAS link commit that is not an ancestor of the measured build. It asserts `abs(renderedPixelWidth - round(logicalWidth * pixelRatio)) <= 1` and the equivalent height rule, requires the iPhone 13 capture to report `PixelRatio.get() === 3`, and verifies the committed JSON/PNG hashes, byte sizes, 1170×2532 screenshot, build identity, fixture, and instrumentation source. A blocked external gate may pass schema validation, but Task 0 remains explicitly `PREPRODUCTION BLOCKED`; it never prints green/ready.

- [ ] **Step 1: Write the failing preproduction tests**

Test that the two repository seed candidates are byte-locked to these exact current hashes:

```ts
assert.deepEqual(seedHashes, {
  "assets/avatar/phoenix/approved/phoenix-main-avatar-v2-crisp.png":
    "732907c58c1e5d81645fa1ddb2a97a1026c767c97004097562d8f9763135feac",
  "assets/avatar/phoenix/approved/phoenix-standing-walk-source-v2.png":
    "5c3df1bad8939e85ca13f0d0d1e720f3607f92db462ff00b78b4f8a4e50492af",
});
```

Also test rejection of a pre-Slice-2 measurement; a changed seed byte; a source annotation lacking per-frame root/pelvis/torso/paw/one-shot-role data; a missing signed transition pair/phase mapping; a missing real owner seed-approval/palette-exception reference; a policy that conflates the clean art tree, later metadata, external owner response, or runtime candidate; a self-hashed owner wrapper; PixelRatio 1 or mismatched logical/physical dimensions; a missing committed fixture/evidence artifact; an EAS version other than 21.6.0; a lowered/removed `minimumReleaseAge: 1440`, any package-wide EAS exclusion, or any missing/extra member of the four-item exact-version EAS exception set; absent `expo.owner` or `extra.eas.projectId`; malformed/mismatched UUID, owner, slug, full name, or owner response; and an external gate that claims `available` without both device/toolchains, the same linked EAS identity, and at least one owner release-candidate device. Fixture tests exercise absent, mismatched, and already-correct app linkage without network or prompt; the already-correct case performs zero writes and never spawns `project:init`.

- [ ] **Step 2: Run the red test**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts
```

Expected: FAIL because the module, tooling pin, instrumentation, and source-manifest schema do not exist.

- [ ] **Step 3: Verify the three prerequisite commits and discover the final Home owner**

From a clean tree after Slices 1–3 pass their gates, record their full commit SHAs. Run:

```bash
rg -n "LivingPhoenixRoom|PhoenixSprite|SpriteSheetPlayer|avatarRoomRuntime|entering=" \
  artifacts/woofwatcher-mobile/app artifacts/woofwatcher-mobile/components artifacts/woofwatcher-mobile/lib
```

Write the resulting canonical Home component path and the Slice commit SHAs to `PHOENIX_MOTION_PREPRODUCTION.md`. Compatibility redirects are recorded as exclusions, not implementation targets.

- [ ] **Step 4: Pin EAS and commit an explicit owner-authorized project link**

Add exact dev dependency `"eas-cli":"21.6.0"`, exact `eas.json` `cli.version`, the lockfile update, both EAS verifier scripts, and these four literal exact-version items under root `pnpm-workspace.yaml` `minimumReleaseAgeExclude`: `eas-cli@21.6.0`, `@expo/eas-build-job@21.6.0`, `@expo/eas-json@21.6.0`, and `@expo/steps@21.6.0`. Retain `minimumReleaseAge: 1440` byte-for-byte and forbid every package-wide EAS exception. Before any project command, obtain `eas-project-link-owner-response.json` outside Git from the named owner channel. Its closed object contains the existing project UUID, exact `@account/woofwatcher` full name, account/owner, slug `woofwatcher`, approval identity/time/reference, and no credentials. This task never creates a project. If that response, authenticated membership, or named account is unavailable, leave `app.json` untouched, record `PREPRODUCTION BLOCKED`, and stop live EAS work.

Install the dependency for real with repository-pinned pnpm 10.24.0—`--lockfile-only` is forbidden here—then run the local-only verifier before any project operation. That verifier resolves `eas-cli/package.json` from the mobile workspace, requires version `21.6.0`, resolves the binary used by filtered `pnpm exec`, verifies the installed `oclif.manifest.json` hash `60cf395bd651e25be1f6a06d11404e0c27849c420101469165b0281be3177da1`, verifies the exact release-age policy above, and makes no network/project query. Stage and commit that installed, verified tooling state first, including its package, lock, EAS config, verifier, test, and root policy changes; ignored `node_modules` is the only install residue. This creates the clean committed tree from which the live link operation must run.

Only after that clean tooling commit, require the approved response at the absolute path in `PHOENIX_EAS_LINK_OWNER_RESPONSE` to resolve outside the Git worktree. Copy it into an out-of-worktree temporary directory and write `project:init` JSON there, so only `app.json` and the checked-in link record enter the second commit:

```bash
pnpm_10="../tool-cache/corepack/v1/pnpm/10.24.0/bin/pnpm.cjs"
test -f "$pnpm_10"
test "$(node "$pnpm_10" --version)" = "10.24.0"
test "$(rg -c '^minimumReleaseAge: 1440$' pnpm-workspace.yaml)" = "1"
test "$(rg -c '^  - eas-cli@21\.6\.0$' pnpm-workspace.yaml)" = "1"
test "$(rg -c "^  - '@expo/eas-build-job@21\.6\.0'$" pnpm-workspace.yaml)" = "1"
test "$(rg -c "^  - '@expo/eas-json@21\.6\.0'$" pnpm-workspace.yaml)" = "1"
test "$(rg -c "^  - '@expo/steps@21\.6\.0'$" pnpm-workspace.yaml)" = "1"
! rg -n '^  - eas-cli$' pnpm-workspace.yaml
! rg -n "^  - '@expo/(eas-build-job|eas-json|steps)'$" pnpm-workspace.yaml
node "$pnpm_10" --filter @workspace/woofwatcher-mobile add --save-dev --save-exact eas-cli@21.6.0
node artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs \
  --expected-version 21.6.0 --local-install-only
git add pnpm-workspace.yaml pnpm-lock.yaml \
  artifacts/woofwatcher-mobile/package.json \
  artifacts/woofwatcher-mobile/eas.json \
  artifacts/woofwatcher-mobile/scripts/verify-eas-project-link.mjs \
  artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs \
  artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.test.ts
test -z "$(git diff --name-only)"
test -z "$(git ls-files --others --exclude-standard)"
git commit -m "chore(motion): install and verify pinned EAS tooling"
test -z "$(git status --porcelain)"
test -n "${PHOENIX_EAS_LINK_OWNER_RESPONSE:-}"
repo_root="$(git rev-parse --show-toplevel)"
owner_response_abs="$(realpath "$PHOENIX_EAS_LINK_OWNER_RESPONSE")"
case "$owner_response_abs" in "$repo_root"/*) echo "owner response must remain outside the worktree" >&2; exit 1;; esac
test -f "$owner_response_abs"
eas_link_tmp="$(mktemp -d)"
eas_link_tmp_abs="$(realpath "$eas_link_tmp")"
case "$eas_link_tmp_abs" in "$repo_root"/*) echo "EAS temp directory must remain outside the worktree" >&2; exit 1;; esac
cp -- "$owner_response_abs" "$eas_link_tmp/eas-project-link-owner-response.json"
eas_project_id="$(node artifacts/woofwatcher-mobile/scripts/verify-eas-project-link.mjs \
  --owner-response "$eas_link_tmp/eas-project-link-owner-response.json" --print-project-id)"
CI=1 node "$pnpm_10" --filter @workspace/woofwatcher-mobile exec eas project:init \
  --id "$eas_project_id" --non-interactive --json > "$eas_link_tmp/eas-project-init.json"
node artifacts/woofwatcher-mobile/scripts/verify-eas-project-link.mjs \
  --owner-response "$eas_link_tmp/eas-project-link-owner-response.json" \
  --init-json "$eas_link_tmp/eas-project-init.json" \
  --app-json artifacts/woofwatcher-mobile/app.json \
  --write-record docs/release/phoenix-motion-preproduction/eas-project-link.json
git add artifacts/woofwatcher-mobile/app.json \
  docs/release/phoenix-motion-preproduction/eas-project-link.json
test -z "$(git diff --name-only)"
test -z "$(git ls-files --others --exclude-standard)"
git commit -m "chore(motion): pin EAS and link approved project"
test -z "$(git status --porcelain)"
```

`project:init` must report `linked` or `already-linked`, write exact `expo.owner`, preserve exact slug, and write exact `expo.extra.eas.projectId`; mismatch fails without `--force`. The record stores the external-response and init-output hashes plus parsed identities, but neither temporary response file is committed or ignored because neither ever enters the worktree. The first clean-status assertion occurs only after the tooling inputs have been staged and committed; the link operation starts from that clean tree. Immediately before the second commit, `git status --porcelain --untracked-files=all` must show only the explicitly staged `app.json` and link-record paths, and it must show nothing afterward; ignored `node_modules` is expected from the real install. Tests prove a real pinned install occurs, `--lockfile-only` is never used, the unchanged 1440-minute policy and exact four-item exception set pass before the local install verifier and `project:init`, both transient paths remain outside the worktree, absent linkage writes once, mismatch fails, and already-correct linkage is byte-stable and prompt-free.

- [ ] **Step 5: Doctor the committed link without mutating the clean tree**

`verify-eas-tooling.mjs` resolves only the workspace binary, requires `eas-cli/21.6.0`, verifies the command manifest, reads the committed link record/config first, then runs `eas whoami`, supported `NO_COLOR=1 eas project:info` **without flags**, and `eas build:list --limit 1 --json --non-interactive`. Its closed parser requires exactly one `fullName` and one UUID `ID` row and exact equality to the committed record. It never calls unsupported `project:info --json` or `project:init`. Run:

```bash
test -z "$(git status --porcelain)"
before_app_sha="$(sha256sum artifacts/woofwatcher-mobile/app.json | cut -d' ' -f1)"
CI=1 node artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs \
  --expected-version 21.6.0 \
  --project-link docs/release/phoenix-motion-preproduction/eas-project-link.json
test "$before_app_sha" = "$(sha256sum artifacts/woofwatcher-mobile/app.json | cut -d' ' -f1)"
git diff --exit-code
test -z "$(git status --porcelain)"
```

The tests stub all three outputs, prove no prompt/write/init call, reject absent or mismatched config/output, prove the already-correct case leaves tracked and untracked status unchanged, and assert the manifest flags above. Zero existing builds may validly return `[]`; missing auth/membership/project access remains an external blocker, never an invitation to create/relink.

- [ ] **Step 6: Commit the reproducible slot harness before measuring**

Add `PhoenixHomeSlotProbe` behind the existing owner-only QA surface, not a consumer/development source edit that is later removed. Add `phoenix-home-slot-v1.json` with this closed source object: `{schemaVersion:1, fixtureId:"phoenix-home-slot-v1", clock:"2026-08-05T09:00:00-07:00", timezone:"America/Los_Angeles", locale:"en-US", dogName:"Phoenix", routine:{id:"qa-water",label:"Morning water",type:"water",time:"09:30",owner:"Alex",note:"Fixture routine"}, avatarUpdatedAt:"2026-08-05T16:00:00.000Z", homeWelcomeDismissed:true}`. `materializePhoenixFixtureStorage` rejects unknown keys and expands that source into the exact ordered three-key `PhoenixFixtureStorageBytes`. For `woofwatcher.v2.state`, it builds a `CareDoc` with `dataVersion: CURRENT_CARE_DOC_DATA_VERSION` (asserted as `1`), `createdAt: avatarUpdatedAt`, epoch `updatedAt`, `activePetId:"primary"`, Phoenix `profile.name/publicLabel`, and the production-default values for every other declared `profile`, `weight`, `householdSetup`, `launchSupportProfile`, `dietProfile`, and empty collection field; it calls the real exported `normalizeLaunchProviderProfile(null)` and `normalizeReminderNotificationPreferences(null)`, sets `routines` to the literal six-field routine, then wraps that complete object as `{doc,entries:[],serverVersion:0}`. The fixture test enumerates the exact `CareDoc` top-level key set and deep-compares every nested field to a hand-authored expected object, so an omitted field or nondeterministic current time fails. The second value is the full `createDefaultAvatarConfig("Phoenix", avatarUpdatedAt)` result under `woofwatcher.petAvatarConfig.v1`; the third is literal UTF-8 `true` under `woofwatcher.homeWelcomeDismissed.v1`. `seedPhoenixFixture` calls `clear()`, `multiSet()` with those bytes, reads all three keys back, and byte-compares them before the route can mount. Canonical JSON recursively sorts object keys, preserves array order, UTF-8 encodes without trailing newline, and hashes the exact stored strings plus ordered `key\0value\0` aggregate. The probe records native `onLayout` logical box, `PixelRatio.get()`, rendered image pixel dimensions, source/storage aggregate hashes, route/component, iOS bundle ID/`CFBundleVersion`, commit/tree, and screenshot marker. The probe remains committed and is excluded from consumer builds unless the explicit QA flag is present.

```bash
git add artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts \
  artifacts/woofwatcher-mobile/lib/fixtures/phoenix-home-slot-v1.json \
  artifacts/woofwatcher-mobile/components/qa/PhoenixHomeSlotProbe.tsx \
  artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.test.ts \
  artifacts/woofwatcher-mobile/scripts/measure-phoenix-home-slot.mjs
git commit -m "chore(motion): add slot measurement harness"
```

Expected: empty status; record this exact commit and tree as the measurement build identity.

- [ ] **Step 7: Measure and durably freeze the real post-Slice-2 slot**

Build that exact clean tree with the pinned CLI, install it on the iPhone 13 / iOS 18.6 baseline, invoke `seedPhoenixFixture` and require its three read-back byte hashes, open the committed `phoenix-home-slot-v1` QA fixture at the 390×844-point viewport, and capture the device screenshot at its native 1170×2532 pixels:

```bash
node artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs --expected-version 21.6.0 \
  --project-link docs/release/phoenix-motion-preproduction/eas-project-link.json
pnpm --filter @workspace/woofwatcher-mobile exec eas build \
  --profile preview --platform ios --non-interactive --json
node artifacts/woofwatcher-mobile/scripts/measure-phoenix-home-slot.mjs \
  --commit "$(git rev-parse HEAD)" --tree "$(git rev-parse HEAD^{tree})" \
  --probe-export phoenix-home-slot-probe.json \
  --screenshot phoenix-home-slot-device.png \
  --out docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.json \
  --copy-screenshot docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.png
```

The script rejects any build/tree or linked EAS UUID/full-name mismatch, `PixelRatio` other than 3 on this baseline, screenshot other than 1170×2532, or physical slot more than one platform-rounded pixel from `logical × 3`. If the approved square slot is 112, the recorded Phoenix box is 336×336 physical pixels and all later literals stand. If it differs, update every slot/density/page-budget literal in Tasks 1–11 before Task 1; runtime scaling is not an escape hatch. The JSON and screenshot are committed in Step 11, never left under `tmp` or represented only by a hash.

- [ ] **Step 8: Lock seeds and the complete human-annotation/art schema**

Create `preproduction.json` with schema version, measured slot evidence, the committed EAS UUID/full name/link commit/config hash, committed slot-fixture hashes, both seed records, and real approvals. Create `source-manifest.schema.json` with `additionalProperties:false` throughout. In addition to every prior art/provenance/landmark/role field, require signed transition contacts and exactly the 129 context-qualified directed pairs defined in Task 1. Each pair has closed 0/1-frame phase mappings over its exact source domain, non-null source/target contact IDs, shared paws, mode, reviewer/reference, and measured full-fade paw/root results; reaction entry/exit frames must match roles/completion policy. Missing, duplicate, extra, uncovered, or threshold-failing pairs block generation. Task 3 creates the reviewed manifest; generated TypeScript is only its deterministic projection.

An existing README or approval record counts only if it explicitly identifies the same path and SHA-256. If it does not, obtain a real owner seed-selection response before this gate can pass; record its durable reference/hash. The hashing script cannot create that response or infer approval from the file's directory name.

Record the literal `PhoenixCandidateIdentityPolicy` in `preproduction.json`: the clean art commit/tree exists before either EAS build; later `candidate.json` references that immutable parent plus both build IDs; an external owner-response export is hashed by a separate checked-in wrapper and never contains/wraps its own hash; the final runtime candidate is distinct and must prove identical art blobs. Rejection always creates a new art commit. Task 3 fills the later metadata/wrapper records under this tested policy.

Run:

```bash
node artifacts/woofwatcher-mobile/scripts/hash-phoenix-motion-sources.mjs \
  --preproduction artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/preproduction.json --check
```

Expected: PASS only when file hashes and embedded hashes agree.

- [ ] **Step 9: Record external operator availability before production work**

In `PHOENIX_MOTION_PREPRODUCTION.md`, record the named operator, exact Xcode/Android Studio versions, signing, adb, pinned EAS path/version/authenticated account, the committed project UUID/full name/link commit/config hash and membership check, both baseline devices, at least one actual current owner release-candidate device with owner/hardware/OS, owner review channel, and availability date. The EAS values must equal Step 4's owner response and Step 5's read-only doctor. If any field is unavailable, pure/runtime work may proceed, but mark Task 0 `PREPRODUCTION BLOCKED` and the eventual plan outcome `implementation complete, merge blocked on native/owner gate`; do not relink/create a project, describe the gate as green, approve art, or merge Slice 4.

- [ ] **Step 10: Run the preproduction gate**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts
node artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs --expected-version 21.6.0 \
  --project-link docs/release/phoenix-motion-preproduction/eas-project-link.json
node artifacts/woofwatcher-mobile/scripts/hash-phoenix-motion-sources.mjs \
  --preproduction artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/preproduction.json --check
```

Expected: unit/schema/hash checks PASS and the command prints the frozen logical/physical slot, PixelRatio, committed evidence/build identity, seed hashes, complete source-annotation schema, and external status. Overall status is `PREPRODUCTION READY` only for an available external gate; otherwise it is `PREPRODUCTION BLOCKED` even though schema tests pass.

- [ ] **Step 11: Commit the durable measurement and preproduction contract**

```bash
git add docs/release/PHOENIX_MOTION_PREPRODUCTION.md \
  artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionPreproduction.test.ts \
  artifacts/woofwatcher-mobile/scripts/measure-phoenix-home-slot.mjs \
  artifacts/woofwatcher-mobile/scripts/hash-phoenix-motion-sources.mjs \
  artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs \
  artifacts/woofwatcher-mobile/scripts/verify-eas-project-link.mjs \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts \
  artifacts/woofwatcher-mobile/lib/fixtures/phoenix-home-slot-v1.json \
  artifacts/woofwatcher-mobile/components/qa/PhoenixHomeSlotProbe.tsx \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/source-manifest.schema.json \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/preproduction.json \
  docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.json \
  docs/release/phoenix-motion-preproduction/phoenix-home-slot-ios.png \
  docs/release/phoenix-motion-preproduction/eas-project-link.json \
  artifacts/woofwatcher-mobile/app.json \
  pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore(motion): freeze Phoenix preproduction contract"
```

---

### Task 1: Lock the Typed Production Manifest

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/avatarLifeEngine.ts`

**Interfaces:**
- Produces: `PHOENIX_ACTION_SPECS`, `PHOENIX_TRANSITION_PAIRS`, action/semantic/reaction unions, `PhoenixSignedTransitionContact`, `PhoenixSignedTransitionPair`, `PhoenixActionDefinition`, landmarks, and atlas pages. Task 3 combines fixed specs with reviewed generated truth.
- Consumes: existing `CareTwinSpriteAction` and `AvatarLifeAnimation`; move both unions into `phoenixMotionManifest.ts` and re-export them from `avatarLifeEngine.ts` to prevent a circular import.

- [ ] **Step 1: Write the failing manifest contract test**

```ts
test("defines every Phoenix action with fixed production timing", () => {
  assert.deepEqual(Object.keys(PHOENIX_ACTION_SPECS).sort(), [
    "bark-loop", "celebrate-hop", "comfort-loop", "drink-loop",
    "ear-perk", "eat-loop", "health-watch", "idle-breathe",
    "sleep-loop", "tail-wag", "walk-loop",
  ]);
  const walk = PHOENIX_ACTION_SPECS["walk-loop"];
  assert.equal(walk.frameCount, 12);
  assert.equal(walk.fps, 12);
  assert.equal(walk.meaningfulPoseMinimum, 12);
  assert.equal(walk.anchor, "bottom-center");
  assert.deepEqual(walk.contactArtDirection.map(({ id, startFrame, endFrame, paws }) =>
    ({ id, startFrame, endFrame, paws })), [
    { id: "diagonal-a-wrap", startFrame: 11, endFrame: 1, paws: ["front-right", "rear-left"] },
    { id: "diagonal-b", startFrame: 2, endFrame: 4, paws: ["front-left", "rear-right"] },
    { id: "diagonal-a", startFrame: 5, endFrame: 7, paws: ["front-right", "rear-left"] },
    { id: "diagonal-b-late", startFrame: 8, endFrame: 10, paws: ["front-left", "rear-right"] },
  ]);
  assert.equal("contacts" in walk, false, "unreviewed art direction is not production contact truth");
  assert.equal(walk.slotSize, 112);
  assert.match(walk.requiredAsset, /production\/runtime\/walk-loop/);
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.test.ts
```

Expected: FAIL because `phoenixMotionManifest.ts` does not exist.

- [ ] **Step 3: Implement the manifest types and fixed action metadata**

Use these exact public types:

```ts
export type CareTwinSpriteAction =
  | "idle-breathe" | "tail-wag" | "ear-perk" | "walk-loop"
  | "eat-loop" | "drink-loop" | "sleep-loop" | "comfort-loop"
  | "celebrate-hop" | "health-watch" | "bark-loop";

export type AvatarLifeAnimation =
  | "idle" | "walk" | "eat" | "drink" | "sleep" | "comfort" | "celebrate";

export type PhoenixPawId = "front-left" | "front-right" | "rear-left" | "rear-right";

export interface PhoenixContactInterval {
  id: string;
  startFrame: number;
  endFrame: number;
  wrapsLoop: boolean;
  paws: readonly PhoenixPawId[];
}

export interface PhoenixContactArtDirection extends PhoenixContactInterval {
  provisional: true;
}

export interface PhoenixDwellTransitionContact extends PhoenixContactInterval {
  kind: "dwell-transition";
  compatibleWalkContactIds: readonly string[];
}

export type PhoenixSemanticDwellAction =
  | "idle-breathe" | "tail-wag" | "sleep-loop" | "comfort-loop" | "health-watch";
export type PhoenixSemanticAction = PhoenixSemanticDwellAction | "walk-loop";
export type PhoenixTransitionContext = "semantic" | "reaction-enter" | "reaction-exit";
export type PhoenixTransitionMode = "aligned-crossfade" | "contact-cut";

export interface PhoenixSignedTransitionContact extends PhoenixContactInterval {
  action: CareTwinSpriteAction;
  reviewer: string;
  reviewRef: string;
}

export interface PhoenixTransitionPhaseMapping {
  sourceFrame: number;
  waitFrames: 0 | 1;
  sourceContactId: string;
  targetContactId: string;
  targetFrame: number;
  sharedPaws: readonly [PhoenixPawId, ...PhoenixPawId[]];
}

export interface PhoenixSignedTransitionPair {
  id: string;
  context: PhoenixTransitionContext;
  fromAction: CareTwinSpriteAction;
  toAction: CareTwinSpriteAction;
  mode: PhoenixTransitionMode;
  sourceDomain: "all-frames" | "completion-boundary";
  phaseMappings: readonly PhoenixTransitionPhaseMapping[];
  reviewer: string;
  reviewRef: string;
}

export interface PhoenixOneShotFrameRoles {
  enter: readonly number[];
  action: readonly number[];
  settle: readonly number[];
  terminalHold: readonly number[];
}

export type PhoenixSettlePolicy =
  | { kind: "while-requested" }
  | { kind: "after-loops"; loops: 2; next: "semantic-dwell" }
  | { kind: "on-complete"; next: "semantic-dwell" };

export type PhoenixReactionAction =
  | "tail-wag" | "ear-perk" | "walk-loop" | "eat-loop" | "drink-loop"
  | "comfort-loop" | "celebrate-hop" | "health-watch" | "bark-loop";

export type PhoenixReactionPlaybackSpec =
  | { kind: "finite"; completion: "terminal-hold" | "two-loops" }
  | { kind: "held"; minimumWholeLoops: 1; releaseBoundary: "next-reviewed-loop-seam" };

export interface PhoenixFrameLandmarks {
  root: readonly [number, number];
  pelvis: readonly [number, number];
  shoulderY: number;
  eyeY: number;
  paws: Readonly<Partial<Record<PhoenixPawId, readonly [number, number]>>>;
  torsoBox: readonly [number, number, number, number];
}

export interface PhoenixAtlasPageDefinition {
  index: number;
  firstFrame: number;
  frameCount: number;
  logicalPath: string;
  logicalWidth: number;
  pixelWidthAt3x: number;
  decodedBytesAt3x: number;
}

export interface PhoenixActionSpec {
  id: CareTwinSpriteAction;
  mode: "loop" | "one-shot";
  frameCount: number;
  fps: number;
  meaningfulPoseMinimum: number;
  reducedMotionFrame: number;
  finalHoldFrames: readonly number[];
  contactArtDirection: readonly PhoenixContactArtDirection[];
  settle: PhoenixSettlePolicy;
  reactionPlayback: PhoenixReactionPlaybackSpec | null;
  anchor: "bottom-center";
  slotSize: 112;
  requiredAsset: string;
  fallbackAnimation: AvatarLifeAnimation;
  notes: string;
}

export interface PhoenixActionDefinition extends PhoenixActionSpec {
  pages: readonly PhoenixAtlasPageDefinition[];
  landmarks: readonly PhoenixFrameLandmarks[];
  contacts: readonly PhoenixContactInterval[];
  dwellTransitionContacts: readonly PhoenixDwellTransitionContact[];
  transitionContacts: readonly PhoenixSignedTransitionContact[];
  reactionEntryFrame: number;
  reactionExitFrames: readonly number[];
  frameRoles: PhoenixOneShotFrameRoles | null;
}
```

Define timing and provisional art direction before art begins; do not infer settle behavior from `mode` or contacts from pixels at runtime. `contactArtDirection` guides generation but is not copied into production `contacts` until the annotated-source review in Task 3:

| Action | Mode | Frames@fps / minimum | Reduced frame | Final holds | Provisional contact art direction (inclusive) | Semantic settle | Reaction playback |
|---|---|---|---:|---|---|---|---|
| `idle-breathe` | loop | 8@6 / 6 | 0 | `[]` | reviewed dwell contact required | while requested | not a reaction producer |
| `tail-wag` | loop | 8@8 / 6 | 0 | `[]` | reviewed dwell contact required | while requested | held; ≥1 whole loop, explicit token release at reviewed seam |
| `ear-perk` | one-shot | 6@7 / 5 | 5 | `[5]` | reviewed dwell contact required | on complete → semantic dwell | finite terminal hold |
| `walk-loop` | loop | 12@12 / 12 | 0 | `[]` | 11→1 wrap: front-right+rear-left; 2–4: front-left+rear-right; 5–7: front-right+rear-left; 8–10: front-left+rear-right | while requested | held; ≥1 whole loop, explicit token release at reviewed seam |
| `eat-loop` | loop | 8@7 / 6 | 0 | `[]` | reviewed dwell contact required | after exactly 2 loops → semantic dwell | finite two loops |
| `drink-loop` | loop | 8@7 / 6 | 0 | `[]` | reviewed dwell contact required | after exactly 2 loops → semantic dwell | finite two loops |
| `sleep-loop` | loop | 8@5 / 6 | 0 | `[]` | reviewed dwell contact required | while requested | not a reaction producer |
| `comfort-loop` | loop | 8@6 / 6 | 0 | `[]` | reviewed dwell contact required | while requested | held; ≥1 whole loop, explicit token release at reviewed seam |
| `celebrate-hop` | one-shot | 8@9 / 7 | 7 | `[7]` | reviewed dwell contact required | on complete → semantic dwell | finite terminal hold |
| `health-watch` | loop | 8@5 / 6 | 0 | `[]` | reviewed dwell contact required | while requested | held; ≥1 whole loop, explicit token release at reviewed seam |
| `bark-loop` | one-shot | 6@10 / 5 | 5 | `[5]` | reviewed dwell contact required | on complete → semantic dwell | finite terminal hold |

The provisional walk direction IDs are exactly `diagonal-a-wrap`, `diagonal-b`, `diagonal-a`, and `diagonal-b-late`; only the first wraps. Task 3 freezes all literal contacts and the closed `PHOENIX_TRANSITION_PAIRS` projection. The reachable matrix is exact: all 30 directed unequal pairs within the six `PhoenixSemanticAction` values, all 54 pairs from those six sources to the nine `PhoenixReactionAction` values (including four same-action reaction resets), and all 45 reaction-to-five-dwell exits—129 context-qualified pairs total. A visible reaction queues the latest newer reaction until its signed exit; only a still-loading, never-visible target may be superseded, so reaction→reaction is not an unmodeled edge.

Every pair contains one mapping for every required source frame: `all-frames` for semantic and reaction entry, or the exact manifest completion frames for reaction exit. Each mapping reaches a reviewer-signed source contact in `waitFrames:0|1`, names a signed target contact/frame, and has a nonempty shared-paw basis. For `aligned-crossfade`, both signed intervals must cover the complete 100 ms sample window and independent world-paw sampling must remain within 1 displayed pixel throughout. If that cannot be authored, the pair is explicitly `contact-cut`; the controller waits the same bounded 0/1 frames and atomically swaps at the mapped contact with zero two-atlas overlap. Same-action reaction resets are always contact cuts. Null/unmapped contact IDs are invalid for any realized transition.

Every non-walk action retains its signed dwell contact projection for walk/dwell review. A reaction's entry frame is the first `enter` role for one-shots or a signed loop entry; its exit frames are terminal hold, exact two-loop seam, or reviewed held-release boundary. `derivePhoenixSemanticDwellAction` maps current `AvatarLifePlan.spriteAction` deterministically: the five dwell actions preserve themselves; `walk-loop`, `eat-loop`, `drink-loop`, and `celebrate-hop` settle to `tail-wag`; `ear-perk` and `bark-loop` settle to `idle-breathe`. Fixed specs contain no final transition truth; Task 3 projects contacts, all 129 pairs, entry/exit frames, roles, and landmarks only from reviewed source data.

The `PhoenixReactionAction` union is deliberately the exact current producer closure. Task 7 adds a source-backed/table test equating it to every `spriteAction` producible by `describeCareTwinReactionForLog` plus `tapReactionFor`; adding a new producer without a playback policy fails. `idle-breathe` and `sleep-loop` remain semantic-only. A held reaction is distinct from a semantic while-requested action: it cannot complete until its exact producer token is released, and release cannot occur before one whole reviewed loop.

Use this exact fallback map: `idle-breathe`, `tail-wag`, `ear-perk`, and `bark-loop` → `idle`; `walk-loop` → `walk`; `eat-loop` → `eat`; `drink-loop` → `drink`; `sleep-loop` → `sleep`; `comfort-loop` → `comfort`; `celebrate-hop` → `celebrate`; `health-watch` → `comfort`. Each `requiredAsset` is the literal page-0 path shown in that action's Task 3 inventory row, and `notes` equals the action ID; these values carry no behavior.

- [ ] **Step 4: Re-export the action type and derive legacy track views**

In `avatarLifeEngine.ts`, keep consumer compatibility while removing duplicated facts:

```ts
export type { CareTwinSpriteAction } from "./phoenixMotionManifest.ts";
export type { AvatarLifeAnimation } from "./phoenixMotionManifest.ts";
export const CARE_TWIN_SPRITE_MANIFEST = Object.fromEntries(
  Object.values(PHOENIX_ACTION_SPECS).map((action) => [action.id, {
    key: action.id,
    frameCount: action.frameCount,
    fps: action.fps,
    loop: action.mode === "loop",
    anchor: action.anchor,
    slotSize: action.slotSize,
    requiredAsset: action.requiredAsset,
    fallbackAnimation: action.fallbackAnimation,
    notes: action.notes,
  }]),
) as Record<CareTwinSpriteAction, CareTwinSpriteTrack>;
```

Change `CareTwinSpriteTrack.slotSize` from the old literal `256` to the Task 0 frozen slot (112 if Task 0 confirms it) in the same edit.

- [ ] **Step 5: Run the manifest and life-engine tests**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarLifeEngine.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the manifest boundary**

```bash
git add artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarLifeEngine.ts
git commit -m "feat(motion): define Phoenix production manifest"
```

---

### Task 2: Build the Deterministic Sprite Pipeline

**Files:**
- Create: `artifacts/woofwatcher-mobile/scripts/lib/phoenix-sprite-pipeline.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/build-phoenix-motion-assets.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-assets.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/build-phoenix-reference-canvases.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/quantize-phoenix-source.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/build-phoenix-approval-request.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/build-phoenix-approval-wrapper.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/validate-phoenix-motion-approval.mjs`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionAssets.test.ts`
- Modify: `artifacts/woofwatcher-mobile/package.json`
- Modify: `artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js`

**Interfaces:**
- Consumes: `PHOENIX_ACTION_SPECS` through Node 24 `--experimental-strip-types`.
- Consumes: reviewed `production/source-manifest.json`; PNG files never supply their own semantic contacts or landmarks.
- Produces: `decodeToRgba`, `measureStripUnion`, `normalizeStripWithSharedScale`, `resizeNearest`, `reprojectSquareCanvas`, `paginateFrames`, `deriveApprovedPalettes`, `quantizeKeyedSource`, `auditAction`, `renderLabeledPreview`, and CLI commands `build:phoenix-reference-canvases`, `quantize:phoenix-source`, `build:phoenix-motion-assets`, `verify:phoenix-motion-assets`, `build:phoenix-approval-request`, `build:phoenix-approval-wrapper`, and `validate:phoenix-motion-approval`.

- [ ] **Step 1: Write failing pipeline tests using generated in-memory PNG fixtures**

Test exact behavior without checking in fake production art:

```ts
test("nearest-neighbor expansion preserves hard pixels", async () => {
  const source = {
    width: 2,
    height: 1,
    data: Buffer.from([12, 34, 56, 255, 0, 0, 0, 0]),
  };
  const expanded = resizeNearest(source, 4, 2);
  const at = (x: number, y: number) =>
    [...expanded.data.subarray((y * expanded.width + x) * 4, (y * expanded.width + x) * 4 + 4)];
  assert.deepEqual(at(0, 0), [12, 34, 56, 255]);
  assert.deepEqual(at(1, 1), [12, 34, 56, 255]);
  assert.deepEqual(at(2, 0), [0, 0, 0, 0]);
});

test("3x pages never exceed 4096 pixels", () => {
  assert.deepEqual(paginateFrames(16, 112, 3), [
    { firstFrame: 0, frameCount: 12, pixelWidth: 4032 },
    { firstFrame: 12, frameCount: 4, pixelWidth: 1344 },
  ]);
});
```

Also assert that indexed-color, RGB, and RGBA non-interlaced PNG inputs expand deterministically to the same RGBA pixels; binary alpha; transparent RGB zeroing; bottom-center normalization; locked seed input hashes unchanged; adjacent duplicate rejection; loop-seam ratio ≤2.5× median; paw baseline ≤1 source pixel; root/pelvis ≤2 source pixels; torso dimension change ≤4%; annotation/frame-count agreement; and decoded dwell+walk warm-pair plus reaction-transition budget ≤20 MiB.

Add independent fixtures where frame 7 is wider and frame 9 is taller than the seed. Assert one scale is derived from the maximum/union bounds across all slots plus the selected lock seed, every frame uses that exact scale, and neither extreme is cropped. Assert an N-slot canvas has exactly `N × 256` centered horizontal slot pixels inside an `(N × 256)²` canvas, slot 0 contains the selected seed, all other slots are empty, and its transparent and `#FF00FF` chroma forms have stable hashes. Derive `main-55` as the lexicographically sorted opaque RGB set from `phoenix-main-avatar-v2-crisp.png` and `standing-walk-75` from `phoenix-standing-walk-source-v2.png`; assert counts 55/75, intersection 0, union 130, exact seed hashes, and the closed assignment `{idle-breathe:"main-55",tail-wag:"main-55",ear-perk:"main-55",walk-loop:"standing-walk-75",eat-loop:"main-55",drink-loop:"main-55",sleep-loop:"main-55",comfort-loop:"main-55",celebrate-hop:"main-55",health-watch:"main-55",bark-loop:"main-55"}`. The keyed post-step and the **actual post-lock master plus every 1×/2×/3× page** must output alpha only in `{0,255}`, RGB zero under transparent pixels, opaque colors only from that action's assigned palette, no key-color fringe, and deterministic hashes distinct from the untouched generated source. A regression fixture applying the standing lockback to a `main-55` action must fail, while the same bytes under `walk-loop`/`standing-walk-75` pass.

Test `reprojectSquareCanvas` with 1024-, 1536-, and exact-target-square inputs. It rejects nonsquare/zero geometry, maps each destination pixel from `floor(dstCoordinate * sourceSize / targetSize)` with no smoothing, always emits exactly `(N*256)²`, and is byte-identical on repeat. The quantizer rejects a reprojected canvas whose N slots cannot each yield one nonempty frame; output-size drift from image generation is never silently accepted.

- [ ] **Step 2: Run the tests and confirm the missing exports**

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/phoenixMotionAssets.test.ts
```

Expected: FAIL because the pipeline library does not exist.

- [ ] **Step 3: Extract and harden PNG operations**

Move the reusable PNG decoder/encoder logic from `build-pixellab-sprite-strip.js` into `scripts/lib/phoenix-sprite-pipeline.mjs`. Export pure functions; accept indexed-color, RGB, and RGBA non-interlaced PNGs; deterministically expand each input to RGBA; reject unsupported/interlaced inputs with path and color type; zero RGB under alpha zero; and use integer-only nearest-neighbor resampling.

`measureStripUnion` splits the declared horizontal slots, finds each nontransparent bound, includes the selected lock seed bound when a lock exists, and returns `maxFrameWidth`, `maxFrameHeight`, and the union coverage. `normalizeStripWithSharedScale` computes exactly one `scale = min(S / maxFrameWidth, S / maxFrameHeight)` for the entire action, rounds every resized dimension with the same half-up rule, and places the content at bottom-center/root `(S / 2, S)`; it never chooses scale per frame or from the seed alone. The builder fails on an empty slot or any post-placement crop. For a locked index, normalize the approved seed with this same action-wide scale/root and replace only that indexed frame; compare the original seed input hash against Task 0 and the normalized lockback hash against `source-manifest.json`, without claiming original and resized bytes match.

`deriveApprovedPalettes` emits this closed `phoenix-palette.json` model: `{schemaVersion:1,palettes:{"main-55":{seedPath,seedSha256,opaqueColorCount:55,colors},"standing-walk-75":{seedPath,seedSha256,opaqueColorCount:75,colors}},intersectionCount:0,unionCount:130,actionPalette:{all eleven literal action keys}}`; `colors` are lowercase six-digit RGB hex values in bytewise lexicographic order. `walk-loop` alone maps to `standing-walk-75`; the other ten map to `main-55`. Task 0's external seed response must explicitly approve deterministic derivation and the standing-walk exception before art generation; Task 3's external art response binds the resulting registry hash. The built-in imagegen result first passes the installed chroma helper into an intermediate file. `reprojectSquareCanvas` then decodes and nearest-neighbor reprojects that square helper result to exactly `(frameCount*256)²`, even if imagegen returned another square size. `quantizeKeyedSource` maps alpha `<128` to transparent black and alpha `>=128` to opaque, maps each opaque RGB to its nearest color in the action's assigned palette using squared RGB distance with lexicographic tie-break, rejects nearest-palette squared distance above `48² = 2304`, and rejects any surviving opaque pixel whose squared distance from `#FF00FF` is below `64² = 4096`. After normalization and lockback, the final verifier decodes every master and page and fails unless alpha is binary, every opaque color belongs to that action's palette, transparent RGB is zero, and no fringe/key pixel remains. Preserve and hash untouched chroma source, chroma-helper intermediate, exact-canvas reprojection, and final keyed/quantized source as four distinct files.

- [ ] **Step 4: Implement deterministic pagination and metrics**

Use:

```js
export function paginateFrames(frameCount, slotSize = 112, density = 3) {
  const framesPerPage = Math.floor(4096 / (slotSize * density));
  return Array.from({ length: Math.ceil(frameCount / framesPerPage) }, (_, index) => {
    const firstFrame = index * framesPerPage;
    const count = Math.min(framesPerPage, frameCount - firstFrame);
    return { firstFrame, frameCount: count, pixelWidth: count * slotSize * density };
  });
}
```

Compute decoded bytes as `width × height × 4`; write a machine-readable metrics JSON beside the preview.

For a Task 0 slot of 112, assert `decodedActionBytes(12) === 5_419_008` and the worst allowed two-slot combination (12-frame walk plus any 8-frame dwell/reaction) is exactly `9_031_680` bytes, below `20 * 1024 * 1024`. Recompute those exact assertions if Task 0 changes the slot. The audit fails if three action atlases are included or if the dwell/walk pair plus any permitted replacement exceeds budget.

- [ ] **Step 5: Implement build and verification CLIs**

`build-phoenix-reference-canvases.mjs` retains the exact canvas behavior above. `build-phoenix-motion-assets.mjs` reads only keyed/quantized sources plus reviewed annotations and emits pages, landmarks, contacts, entry/exit frames, and all 129 signed transition pairs to `phoenixMotionGeneratedManifest.ts`. `verify-phoenix-motion-assets.mjs` independently derives the required 30 semantic + 54 entry + 45 exit keys, exact source-frame domains, and completion frames; rejects missing/extra/duplicate mappings, `waitFrames` outside `0|1`, null/unknown contacts, disjoint paws, same-action crossfades, or a crossfade whose source/target signed intervals do not cover every 4 ms sample across 100 ms within 1 px world-paw/root error. A contact cut must have one mapped instant and zero overlap samples. All prior palette/geometry/role/dwell/reviewer gates remain.

- [ ] **Step 6: Implement the candidate packet and external-response validator**

`build-phoenix-approval-request.mjs` and `build-phoenix-approval-wrapper.mjs` keep three identities separate:

1. `artCandidateCommit`/`artCandidateTree` are the clean tree built by EAS and contain the art, source provenance, manifests, previews, and registry, but not `candidate.json`, `approval-request.json`, or `approval.json`.
2. A later metadata commit writes `candidate.json` and `approval-request.json`, both referencing the immutable art parent and the two EAS build IDs. It never changes an art/source/preview/generated-manifest blob.
3. The owner authors or exports `owner-response.json` outside the repository. `approval.json` is a later checked-in wrapper containing that external artifact's ref/hash/size and parsed claims; the owner-response bytes contain no `ownerResponseSha256` field and the wrapper never hashes itself.

`candidate.json` has this exact closed shape:

```json
{
  "schemaVersion": 1,
  "easProjectId": "UUID equal to the committed Task 0 link",
  "easProjectFullName": "full name equal to the committed Task 0 link",
  "artCandidateCommit": "40 lowercase hex characters",
  "artCandidateTree": "40 lowercase hex characters",
  "metadataParentCommit": "same art candidate commit",
  "iosBuildId": "exact EAS build ID",
  "androidBuildId": "exact EAS build ID",
  "previewSha256": "64 lowercase hex characters",
  "seedSha256ByPath": {
    "assets/avatar/phoenix/approved/phoenix-main-avatar-v2-crisp.png": "64 lowercase hex characters",
    "assets/avatar/phoenix/approved/phoenix-standing-walk-source-v2.png": "64 lowercase hex characters"
  },
  "manifestSha256": "64 lowercase hex characters",
  "paletteRegistrySha256": "64 lowercase hex characters",
  "runtimeAssetSha256": ["one 64-character hash per page"]
}
```

`build-phoenix-approval-request.mjs` reads those hashes from the referenced tree with `git show "${art_candidate_commit}:${candidate_path}"` and `git ls-tree`, not from a possibly modified working copy. It may identify the requested reviewer/channel, but it emits no approval state, approval timestamp, acceptance statement, or approver identity. The external owner-response bytes have this exact closed shape:

```json
{
  "status": "approved",
  "approvedBy": "actual owner identity copied from the response",
  "approvedAt": "owner response timestamp",
  "ownerResponseRef": "durable message or signed-review reference",
  "easProjectId": "UUID equal to the committed Task 0 link",
  "easProjectFullName": "full name equal to the committed Task 0 link",
  "artCandidateCommit": "40 lowercase hex characters",
  "artCandidateTree": "40 lowercase hex characters",
  "iosBuildId": "exact EAS build ID",
  "androidBuildId": "exact EAS build ID",
  "previewSha256": "64 lowercase hex characters",
  "seedSha256ByPath": {
    "assets/avatar/phoenix/approved/phoenix-main-avatar-v2-crisp.png": "64 lowercase hex characters",
    "assets/avatar/phoenix/approved/phoenix-standing-walk-source-v2.png": "64 lowercase hex characters"
  },
  "manifestSha256": "64 lowercase hex characters",
  "paletteRegistrySha256": "64 lowercase hex characters",
  "palettePolicy": { "mainActions": "main-55", "walkAction": "standing-walk-75", "standingPaletteExceptionApproved": true },
  "runtimeAssetSha256": ["one 64-character hash per page"],
  "acceptance": ["identity", "hard-pixels", "walk-palette-exception", "actions", "gait", "crop", "roots-paws", "dwell-contacts", "seams", "settles"]
}
```

Use this exact closed wrapper type; `PhoenixOwnerResponse` is the exact external object shown immediately above:

```ts
interface PhoenixApprovalWrapper {
  schemaVersion: 1;
  ownerResponseArtifact: {
    provider: "github-draft-release";
    releaseTag: string;
    releaseTargetCommit: string;
    assetId: number;
    assetName: "owner-response.json";
    downloadUrl: string;
    sha256: string;
    bytes: number;
  };
  parsedResponse: PhoenixOwnerResponse;
}
```

The schema requires an HTTPS URL, positive numeric GitHub asset ID, 40-character release target, 64 lowercase hex hash, and positive integer bytes. `build-phoenix-approval-wrapper.mjs` requires an absent output path, schema-valid downloaded owner bytes, and the fresh `gh release view --json` export; it copies every parsed response field exactly, derives only release tag/target and asset URL/ID/size plus local byte hash, and has no owner/time/status/acceptance defaults or request-only mode. `validate-phoenix-motion-approval.mjs` redownloads or accepts that locally downloaded immutable owner response, verifies its bytes against the wrapper, parses it with unknown-key rejection, and compares it to `approval-request.json`. It uses Git to read and hash every referenced candidate blob from `artCandidateTree`, compares the current protected art/source/preview/generated-manifest inventory with those tree blobs, and within that protected inventory allows only the explicitly named later metadata files `candidate.json`, `approval-request.json`, `approval.json`, `README.md`, and `approved/README.md` to differ. Later runtime source files are outside this art validator and are tied separately by Task 10's runtime identity/unchanged-art proof. It fails on an absent external response identity/reference, either build ID, seed/palette entry, acceptance item, Git blob, or any art change. No checked-in command accepts `--approved-by`, supplies a default person, converts a request into approval, or hashes the wrapper as its response.

- [ ] **Step 7: Wire package scripts and preserve the legacy boundary**

Add:

```json
"build:phoenix-motion-assets": "node --experimental-strip-types scripts/build-phoenix-motion-assets.mjs",
"build:phoenix-reference-canvases": "node scripts/build-phoenix-reference-canvases.mjs",
"quantize:phoenix-source": "node scripts/quantize-phoenix-source.mjs",
"verify:phoenix-motion-assets": "node --experimental-strip-types scripts/verify-phoenix-motion-assets.mjs",
"build:phoenix-approval-request": "node scripts/build-phoenix-approval-request.mjs",
"build:phoenix-approval-wrapper": "node scripts/build-phoenix-approval-wrapper.mjs",
"validate:phoenix-motion-approval": "node scripts/validate-phoenix-motion-approval.mjs"
```

Make `verify-pixellab-assets.js` label legacy/source checks explicitly and invoke no live-runtime success claim.

- [ ] **Step 8: Run pipeline tests**

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/phoenixMotionAssets.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit the pipeline before adding art**

```bash
git add artifacts/woofwatcher-mobile/scripts/lib/phoenix-sprite-pipeline.mjs \
  artifacts/woofwatcher-mobile/scripts/build-phoenix-reference-canvases.mjs \
  artifacts/woofwatcher-mobile/scripts/quantize-phoenix-source.mjs \
  artifacts/woofwatcher-mobile/scripts/build-phoenix-motion-assets.mjs \
  artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-assets.mjs \
  artifacts/woofwatcher-mobile/scripts/build-phoenix-approval-request.mjs \
  artifacts/woofwatcher-mobile/scripts/build-phoenix-approval-wrapper.mjs \
  artifacts/woofwatcher-mobile/scripts/validate-phoenix-motion-approval.mjs \
  artifacts/woofwatcher-mobile/lib/phoenixMotionAssets.test.ts \
  artifacts/woofwatcher-mobile/scripts/verify-pixellab-assets.js \
  artifacts/woofwatcher-mobile/package.json
git commit -m "build(motion): add Phoenix sprite production pipeline"
```

---

### Task 3: Produce, Review, and Approve the Production Strips

**Files:**
- Create: the eleven `production/prompts` Markdown files named by the action IDs in the inventory below.
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/phoenix-palette.json`.
- Create: the eleven transparent and eleven `#FF00FF` `production/reference-canvases` PNGs named by the action IDs.
- Create: the eleven untouched `production/sources/chroma` PNGs, eleven chroma-helper `production/sources/keyed-intermediate` PNGs, eleven exact-canvas `production/sources/reprojected` PNGs, and eleven final `production/sources/keyed-quantized` PNGs named by the action IDs.
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/source-manifest.json`
- Create: every normalized master and density-aware runtime PNG listed in the exact inventory below.
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/previews/phoenix-motion-labeled-preview.png`
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/previews/phoenix-motion-metrics.json`
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/candidate.json`
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval-request.json`
- Create: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval.json`
- Modify: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/README.md`
- Modify: `artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/README.md`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionGeneratedManifest.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinAssets.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinAssets.test.ts`

**Interfaces:**
- Consumes: Task 1 manifest and Task 2 pipeline.
- Produces: approved, hash-locked Metro assets, generated page/landmark data, final `PHOENIX_ACTION_MANIFEST`, and `CareTwinPagedSpriteAsset` registry entries.

**Exact master inventory:**

| Directory under `assets/avatar/phoenix/production/masters` | Frames | Runtime page files |
|---|---:|---|
| `idle-breathe/frame-00.png` through `frame-07.png` | 8 | `runtime/idle-breathe/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `tail-wag/frame-00.png` through `frame-07.png` | 8 | `runtime/tail-wag/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `ear-perk/frame-00.png` through `frame-05.png` | 6 | `runtime/ear-perk/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `walk-loop/frame-00.png` through `frame-11.png` | 12 | `runtime/walk-loop/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `eat-loop/frame-00.png` through `frame-07.png` | 8 | `runtime/eat-loop/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `drink-loop/frame-00.png` through `frame-07.png` | 8 | `runtime/drink-loop/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `sleep-loop/frame-00.png` through `frame-07.png` | 8 | `runtime/sleep-loop/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `comfort-loop/frame-00.png` through `frame-07.png` | 8 | `runtime/comfort-loop/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `celebrate-hop/frame-00.png` through `frame-07.png` | 8 | `runtime/celebrate-hop/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `health-watch/frame-00.png` through `frame-07.png` | 8 | `runtime/health-watch/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |
| `bark-loop/frame-00.png` through `frame-05.png` | 6 | `runtime/bark-loop/page-0.png`, `page-0@2x.png`, `page-0@3x.png` |

- [ ] **Step 1: Write the failing registry test**

```ts
test("registers only approved paged density-aware Phoenix assets", () => {
  for (const action of Object.keys(PHOENIX_ACTION_MANIFEST) as CareTwinSpriteAction[]) {
    const asset = getCareTwinSpriteAsset(action);
    assert.ok(asset);
    assert.equal(asset.slotSize, 112);
    assert.equal(asset.pages.length, PHOENIX_ACTION_MANIFEST[action].pages.length);
    assert.ok(asset.pages.every((page) => page.source));
  }
  assert.notEqual(
    getCareTwinSpriteAsset("idle-breathe")?.pages[0].source,
    getCareTwinSpriteAsset("tail-wag")?.pages[0].source,
  );
});

test("generated geometry matches every fixed action spec", () => {
  for (const action of Object.keys(PHOENIX_ACTION_SPECS) as CareTwinSpriteAction[]) {
    const production = PHOENIX_ACTION_MANIFEST[action];
    assert.equal(production.landmarks.length, production.frameCount);
    assert.ok(production.pages.every((page) => page.frameCount <= 12));
    assert.ok(production.pages.every((page) => page.pixelWidthAt3x <= 4096));
  }
});
```

- [ ] **Step 2: Run the registry and verifier to capture the red state**

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/careTwinAssets.test.ts
pnpm --filter @workspace/woofwatcher-mobile run verify:phoenix-motion-assets
```

Expected: FAIL because production assets and approval do not exist.

- [ ] **Step 3: Lock prompts, then generate hash-lockable action sources through the approved art workflow**

The implementing worker must read and use the `game-studio:sprite-pipeline` skill for strip planning/validation and the built-in `imagegen` skill for art generation. First derive and hash the Task 2 closed `phoenix-palette.json`: `main-55` from the main seed, `standing-walk-75` from the standing seed, observed counts/intersection/union `55/75/0/130`, and the literal eleven-action assignment. The seed owner response must explicitly accept `standing-walk-75` as the bounded walk-only palette exception; absent that external acceptance, stop before prompts/generation.

Build and hash exactly one N-slot reference canvas per action with the checked-in wrapper from Task 2. Each canvas uses square 256-pixel edit slots, a centered horizontal strip, and a square canvas of `(N × 256)` by `(N × 256)` pixels; slot 0 contains the selected approved seed and slots `1..N-1` are transparent. The exact lock map is:

| Action | Canvas/lock seed | Normalized lockback |
|---|---|---|
| `idle-breathe`, `tail-wag`, `ear-perk`, `celebrate-hop`, `bark-loop` | `phoenix-main-avatar-v2-crisp.png` | frame 0 locked to that seed after applying the action-wide union scale |
| `walk-loop` | `phoenix-standing-walk-source-v2.png` | frame 0 locked to that standing seed after applying the action-wide union scale |
| `eat-loop`, `drink-loop`, `sleep-loop`, `comfort-loop`, `health-watch` | `phoenix-main-avatar-v2-crisp.png` | no lockback; manifest value `null` with rationale “continuous/state pose must not be replaced by standing seed” |

The wrapper emits a transparent canvas and a byte-identical-layout flat `#FF00FF` chroma form for each action; it rejects a seed outside slot 0, a nonempty later slot, wrong N/dimensions, or changed seed/canvas hash. `source-manifest.json` records both canvas hashes, dimensions, seed selection, lock index/null, and rationale.

Write one exact prompt per action with the prior canvas/palette/camera/root requirements plus signed transition-contact coverage: every semantic-source frame must reach a plantable contact in zero or one authored frame; reaction entry has a signed contact interval long enough for a 100 ms fade or an explicit cut; each completion boundary has a signed exit contact. This is art direction only—the 129 pair mappings become truth only after Task 3 review.

```bash
git add artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/phoenix-palette.json \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/reference-canvases \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/prompts
git commit -m "art(motion): lock Phoenix canvases palette and prompts"
```

Invoke built-in image generation once per candidate revision with that action's chroma canvas as the edit target. Save each untouched result under the matching action name in `artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/sources/chroma/` and immediately record tool, model/version if reported, prompt/canvas/seed hashes, raw output dimensions/hash, timestamp, and action. The 2026-08-05 tool probe found the installed chroma helper at `/root/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py` with SHA-256 `3f7b9b14ad5c90f37618bc1c16a039a2076abca12ddc41b3ae470e2b1cad6c0e`; Task 0 records/rechecks that exact resolved path/hash. Built-in imagegen promises neither native transparency nor requested geometry. After all eleven untouched action files exist, run this exact repository-root loop:

```bash
test "$(sha256sum /root/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py | cut -d' ' -f1)" = \
  3f7b9b14ad5c90f37618bc1c16a039a2076abca12ddc41b3ae470e2b1cad6c0e
while read -r action frames palette_id; do
  python /root/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py \
    --input "artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/sources/chroma/${action}.png" \
    --out "artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/sources/keyed-intermediate/${action}.png" \
    --auto-key border --soft-matte --transparent-threshold 12 \
    --opaque-threshold 220 --despill --force
  pnpm --filter @workspace/woofwatcher-mobile run quantize:phoenix-source -- \
    --input "assets/avatar/phoenix/production/sources/keyed-intermediate/${action}.png" \
    --palette assets/avatar/phoenix/production/phoenix-palette.json \
    --palette-id "$palette_id" --frames "$frames" --slot-size 256 \
    --reprojected-out "assets/avatar/phoenix/production/sources/reprojected/${action}.png" \
    --out "assets/avatar/phoenix/production/sources/keyed-quantized/${action}.png"
done <<'ACTION_TABLE'
idle-breathe 8 main-55
tail-wag 8 main-55
ear-perk 6 main-55
walk-loop 12 standing-walk-75
eat-loop 8 main-55
drink-loop 8 main-55
sleep-loop 8 main-55
comfort-loop 8 main-55
celebrate-hop 8 main-55
health-watch 8 main-55
bark-loop 6 main-55
ACTION_TABLE
```

Record and retain all four hashes/dimensions. The quantizer first performs Task 2's deterministic square-to-`(N*256)²` nearest-neighbor reprojection, then applies its exact alpha-128/assigned-palette-distance/key-fringe boundary and fails on nonsquare raw geometry, empty slots, out-of-palette distance, key fringe, nonbinary final alpha, nonzero transparent RGB, wrong final frame/slot geometry, or changed raw bytes. If this chroma route fails and model-native transparency is needed, stop and obtain the explicit approval required by the imagegen skill before using CLI `gpt-image-1.5`; record that approved fallback/tool/model in provenance. Never silently change generation path.

Validate the completed manifest against Task 0's unknown-key-closed schema. Image generation itself is not asserted to be seed-reproducible; the immutable raw-source hash is the provenance boundary, the keyed/quantized hash is the deterministic normalization input, and every subsequent split/normalize/page/preview output is byte-deterministic.

Use the pipeline to split only the keyed/quantized sources into the exact master inventory. Measure all slot content bounds first, include the selected seed bound when lockback applies, choose one shared scale from the action's maximum width/height, bottom-center every frame at one root, and apply the declared lockback after that shared scale is known. Never scale per frame, scale from the seed alone, or crop an extreme action pose. Immediately decode the **post-lock master and every emitted page** and enforce the action-assigned palette; this is where standing frame 0 legitimately passes `standing-walk-75`. Walk contains the provisional contact/compression/passing/lift art direction. Each one-shot uses these exact exhaustive, nonoverlapping role annotations: `ear-perk` enter `[0]`, action `[1,2]`, settle `[3,4]`, terminal hold `[5]`; `celebrate-hop` enter `[0,1]`, action `[2,3,4]`, settle `[5,6]`, terminal hold `[7]`; `bark-loop` enter `[0]`, action `[1,2]`, settle `[3,4]`, terminal hold `[5]`. Do not reuse idle pixels for tail wag or a reaction, and do not pad loops or one-shots with adjacent duplicates.

- [ ] **Step 4: Annotate every frame and lock the seed**

Record all prior landmarks/roles and reviewer-sign literal contacts. Then author the exact 129-key transition table: 30 semantic, 54 reaction-entry, and 45 reaction-exit pairs. For every independently derived source frame, record `waitFrames:0|1`, signed source/target contacts, target frame, shared paws, and deterministic mode. Crossfade is allowed only when both contact intervals cover all 26 samples at 0,4,…,100 ms with ≤1 px world-paw/root error; otherwise record a contact cut and prove zero overlap. Reaction targets use reviewed entry frames, exits use only policy-derived completion frames, and same-action reaction entries are cuts. The reviewer signs the table/hash; the builder rejects any uncovered phase, fabricated meaningful pose, null mapping, reaction→reaction edge, altered provenance, or threshold failure.

- [ ] **Step 5: Build the density variants and preview**

```bash
pnpm --filter @workspace/woofwatcher-mobile run build:phoenix-motion-assets
```

Expected: every action emits exact nearest-neighbor 1×/2×/3× pages and a labeled preview; no page dimension exceeds 4096.

- [ ] **Step 6: Register literal Metro sources for in-engine review**

Define a transitional asset shape that keeps the current player type-correct until Task 6 installs the generic atlas adapter and removes its private clock:

```ts
export interface CareTwinPagedSpriteAsset {
  source: ImageSourcePropType;
  columns: number;
  rows: 1;
  frameWidth: 112;
  frameHeight: 112;
  slotSize: 112;
  pages: readonly {
    firstFrame: number;
    frameCount: number;
    columns: number;
    source: ImageSourcePropType;
  }[];
}
```

Set compatibility fields from page 0 only for this temporary integration. Write literal Metro `require` calls for all eleven action paths enumerated above; Metro discovers matching `@2x`/`@3x` files. Never use a dynamic require. Render at the frozen logical slot only; this interface has no caller-selected Phoenix scale. Task 6 removes the compatibility fields after the generic paged renderer lands.

- [ ] **Step 7: Run the pre-approval audit**

```bash
node --experimental-strip-types artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-assets.mjs --allow-unapproved
```

Expected: all art/geometry/texture checks PASS and the only remaining gate is owner approval.

- [ ] **Step 8: Commit a clean candidate and build that exact tree**

Commit the reviewable art, generated manifest, transitional registry, canvases/palette, and prompt/raw/keyed provenance before asking for approval. `candidate.json`, `approval-request.json`, and `approval.json` must not exist in this tree:

```bash
git add artifacts/woofwatcher-mobile/assets/avatar/phoenix/production \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/README.md \
  artifacts/woofwatcher-mobile/lib/phoenixMotionGeneratedManifest.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.ts \
  artifacts/woofwatcher-mobile/lib/careTwinAssets.ts \
  artifacts/woofwatcher-mobile/lib/careTwinAssets.test.ts
git commit -m "assets(motion): stage Phoenix candidate for review"
git status --short
git rev-parse HEAD
git rev-parse HEAD^{tree}
test ! -e artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/candidate.json
test ! -e artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval-request.json
test ! -e artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval.json
```

Expected: empty status and exact candidate commit/tree captured. From this commit, create iOS and Android preview builds:

```bash
node artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs --expected-version 21.6.0
pnpm --filter @workspace/woofwatcher-mobile exec eas build --profile preview --platform ios --non-interactive --json
pnpm --filter @workspace/woofwatcher-mobile exec eas build --profile preview --platform android --non-interactive --json
```

After both builds exist, write the returned IDs plus the immutable parent commit/tree and path-keyed two-seed hashes to `candidate.json`, then build `approval-request.json` from Git blobs in that parent and commit only those metadata records:

```bash
pnpm --filter @workspace/woofwatcher-mobile run build:phoenix-approval-request -- \
  --candidate assets/avatar/phoenix/production/candidate.json
git diff --exit-code "$(jq -r .artCandidateCommit artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/candidate.json)" -- \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/masters \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/runtime \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/sources \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/reference-canvases \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/previews \
  artifacts/woofwatcher-mobile/lib/phoenixMotionGeneratedManifest.ts
git add artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/candidate.json \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval-request.json
git commit -m "docs(motion): record immutable Phoenix candidate builds"
```

The metadata commit's parent is the art candidate. The validator verifies each EAS build identifies that parent SHA. If either build cannot be created because Task 0's external gate is unavailable, stop approval and retain the explicit merge-blocked state; never create partial candidate metadata.

- [ ] **Step 9: Request and validate real owner approval of the exact candidate**

With repository-owner authorization, create a unique art-candidate draft release **before** requesting the provider-fixed response. The tag is never reused, no upload uses `--clobber`, and a pre-existing tag or asset blocks the candidate:

```bash
art_sha="$(jq -r .artCandidateCommit artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/candidate.json)"
art_tag="phoenix-motion-art-${art_sha:0:12}"
test "$(gh release view "$art_tag" --repo ApolloDNR/WoofWatcher >/dev/null 2>&1; echo $?)" -ne 0
gh release create "$art_tag" --repo ApolloDNR/WoofWatcher --target "$art_sha" --draft \
  --title "Phoenix motion art ${art_sha:0:12}" --notes "Immutable Slice 4 art candidate review"
gh release upload "$art_tag" --repo ApolloDNR/WoofWatcher \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval-request.json \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/previews/phoenix-motion-labeled-preview.png
gh release view "$art_tag" --repo ApolloDNR/WoofWatcher --json tagName,targetCommitish,assets,url \
  > phoenix-art-release-before-response.json
```

Present those release assets and the real Home renderer at frozen logical size on both baseline devices, and request review of identity, hard-pixel quality, the separate `standing-walk-75` exception, distinct actions, gait, crop, root/paw and dwell-contact stability, seams, and reaction settles. The owner authors/exports `owner-response.json` outside Git. Upload those exact external bytes once, query the returned asset identity, download them to a fresh directory, and bind URL/hash/size into `approval.json` before validation:

```bash
test -f owner-response.json
test "$(gh release view "$art_tag" --repo ApolloDNR/WoofWatcher --json assets \
  --jq '[.assets[].name] | index("owner-response.json") == null')" = true
gh release upload "$art_tag" --repo ApolloDNR/WoofWatcher \
  owner-response.json
gh release view "$art_tag" --repo ApolloDNR/WoofWatcher --json tagName,targetCommitish,assets,url \
  > phoenix-art-release.json
owner_dir="$(mktemp -d)"
gh release download "$art_tag" --repo ApolloDNR/WoofWatcher \
  --pattern owner-response.json --dir "$owner_dir"
sha256sum "$owner_dir/owner-response.json"
wc -c "$owner_dir/owner-response.json"
pnpm --filter @workspace/woofwatcher-mobile run build:phoenix-approval-wrapper -- \
  --owner-response "$owner_dir/owner-response.json" --release-query phoenix-art-release.json \
  --out assets/avatar/phoenix/production/approval.json
pnpm --filter @workspace/woofwatcher-mobile run validate:phoenix-motion-approval -- \
  --owner-response "$owner_dir/owner-response.json" --release-query phoenix-art-release.json
```

The validator requires the queried target/tag, unique GitHub asset ID, HTTPS `browser_download_url`, exact byte size, and downloaded SHA-256 to match the wrapper; it rejects a changed/deleted/replaced asset, any tag reuse, or a release target other than `artCandidateCommit`. If GitHub write/query/download access is unavailable, art approval stays blocked—another provider is not substituted. Then run the full gate:

```bash
pnpm --filter @workspace/woofwatcher-mobile run verify:phoenix-motion-assets
```

The first command remains RED until real owner-response bytes exist at the durable reference and a separate `approval.json` wrapper records their URL/hash/size plus parsed claims. It then passes only when the external bytes, actual owner identity, art candidate SHA/tree, both build IDs, preview, manifest, both path-keyed seed hashes, runtime assets, and all acceptance items match Git blobs from the art tree. A script cannot write or infer owner fields, and neither external response nor wrapper hashes itself. If rejected, change the affected source/master, rerun Steps 4–9, and create a new art commit/build/metadata chain; never amend or reuse the rejected candidate SHA.

- [ ] **Step 10: Run asset, registry, and compatibility gates**

```bash
pnpm --filter @workspace/woofwatcher-mobile run verify:phoenix-motion-assets
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionAssets.test.ts \
  artifacts/woofwatcher-mobile/lib/careTwinAssets.test.ts
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit only approved assets and registry**

```bash
git add artifacts/woofwatcher-mobile/assets/avatar/phoenix/production \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/README.md \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/README.md \
  artifacts/woofwatcher-mobile/lib/careTwinAssets.ts \
  artifacts/woofwatcher-mobile/lib/careTwinAssets.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionGeneratedManifest.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionManifest.ts
git commit -m "feat(motion): add approved normalized Phoenix strips"
```

This approval commit contains only the checked-in `approval.json` wrapper and the two named README records; `candidate.json`/`approval-request.json` are already immutable metadata from Step 8, while the external `owner-response.json` remains in durable review storage. Before commit, the validator compares all current art/source/preview/generated-manifest blobs to the reviewed art tree and rejects any changed path outside the explicit metadata/approval allowlist, so unreviewed art cannot enter this commit.

---

### Task 4: Implement Pure Phase, Contact, Travel, and Transition Math

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionMath.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionMath.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinRoam.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinRoam.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinChoreography.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinChoreography.test.ts`

**Interfaces:**
- Consumes: `PhoenixActionDefinition`, `RoamPlan`.
- Produces: `PhoenixMotionSample`, `samplePhoenixMotion`, `sampleComplementaryOpacity`, `staticPhoenixMotionSample`, worklet-safe `roamPoseAt`.

```ts
export interface PhoenixMotionInput {
  action: PhoenixActionDefinition;
  elapsedMs: number;
  roamPlan: RoamPlan | null;
  facing: "left" | "right";
  speed: number;
}
```

- [ ] **Step 1: Write independent failing phase/contact tests**

```ts
test("holds each declared paw through every full stance interval", () => {
  for (const facing of ["left", "right"] as const) {
    for (const speed of [0.75, 1, 1.25]) {
      const tracks = collectSamples({ durationMs: 60_000, stepMs: 4, facing, speed });
      for (const occurrence of independentContactOccurrences(walk.contacts, 60_000, speed)) {
        const stance = tracks.filter((s) => s.elapsedMs >= occurrence.startMs && s.elapsedMs <= occurrence.endMs);
        assert.deepEqual(new Set(stance.map((s) => s.activeContactId)), new Set([occurrence.id]));
        for (const paw of occurrence.paws) {
          assert.ok(range(stance.map((s) => s.worldPaws[paw]![0])) <= 1);
          assert.ok(range(stance.map((s) => s.worldPaws[paw]![1])) <= 1);
        }
      }
    }
  }
});

test("preserves the wrap stance and enters/exits dwell without phase drift", () => {
  const duration = 1000;
  const seam = [-1, 0, 1].map((offset) =>
    samplePhoenixMotion({ action: walk, elapsedMs: duration + offset, roamPlan: seamPlan, facing: "right", speed: 1 }));
  assert.equal(seam[0].activeContactId, "diagonal-a-wrap");
  assert.equal(seam[1].activeContactId, "diagonal-a-wrap");
  assert.ok(distance(seam[0].worldPaws["front-right"]!, seam[1].worldPaws["front-right"]!) <= 1);
  const boundary = sampleAroundEveryWalkDwellBoundary(manualRoamFixture);
  assert.ok(boundary.every(({ before, dwell, after }) =>
    before.travelX === dwell.travelX && dwell.travelX === after.startTravelX));
});

test("every walk-to-dwell alignment uses independently reviewed contact truth", () => {
  for (const dwell of allNonWalkDefinitions) {
    assert.ok(dwell.dwellTransitionContacts.length > 0);
    for (const target of dwell.dwellTransitionContacts) {
      assert.ok(target.endFrame !== target.startFrame);
      const compatible = literalReviewedWalkContacts.filter((walkContact) =>
        target.compatibleWalkContactIds.includes(walkContact.id));
      assert.ok(compatible.length > 0);
      assert.ok(compatible.every((walkContact) =>
        walkContact.paws.some((paw) => target.paws.includes(paw))));
      const samples = independentlySampleLiteralFrames(dwell, target.startFrame, target.endFrame);
      for (const paw of target.paws) {
        assert.ok(range(samples.map((sample) => sample.worldPaws[paw]![0])) <= 1);
        assert.ok(range(samples.map((sample) => sample.worldPaws[paw]![1])) <= 1);
      }
    }
  }
});

test("every reachable transition is signed, bounded, and contact-aligned", () => {
  const required = independentlyEnumerateTransitionKeys({
    semantic: ["idle-breathe", "tail-wag", "sleep-loop", "comfort-loop", "health-watch", "walk-loop"],
    reactions: ["tail-wag", "ear-perk", "walk-loop", "eat-loop", "drink-loop", "comfort-loop", "celebrate-hop", "health-watch", "bark-loop"],
  });
  assert.equal(required.length, 129);
  assert.deepEqual(new Set(PHOENIX_TRANSITION_PAIRS.map((pair) => pair.id)), new Set(required));
  for (const pair of PHOENIX_TRANSITION_PAIRS) {
    const domain = independentlyDeriveSourceDomain(pair, literalActionSpecs);
    assert.deepEqual(pair.phaseMappings.map((item) => item.sourceFrame).sort((a, b) => a - b), domain);
    for (const mapping of pair.phaseMappings) {
      assert.ok(mapping.waitFrames === 0 || mapping.waitFrames === 1);
      assert.ok(mapping.sourceContactId && mapping.targetContactId && mapping.sharedPaws.length);
      const samples = independentlySampleTransition(pair, mapping, 4);
      if (pair.mode === "aligned-crossfade") {
        assert.deepEqual(samples.map((sample) => sample.atMs), Array.from({ length: 26 }, (_, i) => i * 4));
        assert.ok(samples.every((sample) => mapping.sharedPaws.every((paw) =>
          distance(sample.sourceWorldPaws[paw]!, sample.targetWorldPaws[paw]!) <= 1)));
      } else {
        assert.equal(samples.filter((sample) => sample.bothAtlasesVisible).length, 0);
      }
    }
  }
});

test("matches independently integrated world travel after 60 seconds", () => {
  for (const facing of ["left", "right"] as const) {
    for (const speed of [0.75, 1, 1.25]) {
      const actual = samplePhoenixMotion({ action: walk, elapsedMs: 60_000, roamPlan: manualRoamFixture, facing, speed });
      const expected = integrateLiteralRoamSegments(manualRoamFixture.segments, 60_000, facing, speed);
      assert.ok(distance([actual.travelX, actual.travelY], expected) <= 1);
    }
  }
});

test("crossfade opacity is complementary", () => {
  for (const progress of [0, .1, .5, .9, 1]) {
    const opacity = sampleComplementaryOpacity(progress);
    assert.equal(opacity.current + opacity.next, 1);
  }
});
```

- [ ] **Step 2: Run the tests and confirm missing exports**

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/phoenixMotionMath.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the exact sample contract**

```ts
export interface PhoenixMotionSample {
  actionFrame: number;
  actionPhase: number;
  contactPhase: number;
  contactFrameDistance: number;
  rootX: number;
  rootY: number;
  travelX: number;
  travelY: number;
  activeContactId: string | null;
  plantedPaws: readonly PhoenixPawId[];
  worldPaws: Readonly<Partial<Record<PhoenixPawId, readonly [number, number]>>>;
  facing: "left" | "right";
  shadowScaleX: number;
  shadowOpacity: number;
  moving: boolean;
  completed: boolean;
  completedLoops: number;
}
```

The test helpers independently construct the exact 129 required transition keys/domains from the literal six semantic and nine producer actions; they do not call production enumeration, mapping, or correction helpers. They copy signed contact coordinates and sample both layers every 4 ms. Mutations deleting a pair/frame, nulling either contact ID, changing wait to 2, disjoining shared paws, or shifting one target paw/root by 2 px must fail. Keep the prior walk seam, facings, speed, drift, and 60-second oracles; a `reducedMotionFrame`/“meaningful pose” is never contact truth.

`samplePhoenixMotion` begins with `"worklet"`, derives `actionPhase` from one elapsed value, selects landmarks by frame, cancels authored root and named planted-paw drift, derives shadow compression from distance to contact, and samples roam travel using the same elapsed value. For one-shots, clamp at the declared terminal hold and set `completed=true`; for loops, wrap without an extra blank frame and expose `completedLoops = floor(elapsedMs / loopDurationMs)` so the controller can enforce exact finite settle counts.

- [ ] **Step 4: Remove synthetic motion recipes**

Delete `CareTwinMotionRecipe`, `MOTION_RECIPES`, and `motionRecipeForSpriteAction`. Keep action-selection choreography and replace timer durations with manifest-derived `durationMs` and an explicit `completion: "loop" | "return-to-primary"` field.

- [ ] **Step 5: Make roam sampling worklet-safe**

Add `"worklet"` to `roamPoseAt` and its called helpers, and return leg-local progress/contact alignment without changing the deterministic seeded plan API.

- [ ] **Step 6: Run the pure motion suite**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionMath.test.ts \
  artifacts/woofwatcher-mobile/lib/careTwinRoam.test.ts \
  artifacts/woofwatcher-mobile/lib/careTwinChoreography.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the pure engine**

```bash
git add artifacts/woofwatcher-mobile/lib/phoenixMotionMath.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionMath.test.ts \
  artifacts/woofwatcher-mobile/lib/careTwinRoam.ts \
  artifacts/woofwatcher-mobile/lib/careTwinRoam.test.ts \
  artifacts/woofwatcher-mobile/lib/careTwinChoreography.ts \
  artifacts/woofwatcher-mobile/lib/careTwinChoreography.test.ts
git commit -m "feat(motion): unify Phoenix phase and contact math"
```

---

### Task 5: Implement the Pure Controller State and Injected Frame Driver

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionControllerState.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionFrameDriver.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionController.test.ts`

**Interfaces:**
- Consumes: `samplePhoenixMotion`, action manifest, optional `RoamPlan`.
- Produces: pure `reducePhoenixController`, complete request/reaction/phase/window/error/lifecycle types, `PhoenixControllerMachineState`, `PhoenixControllerEvent`, `createPhoenixFrameDriver`, and `PhoenixFrameDriverSnapshot`. This task imports no React, React Native, Reanimated, or renderer module; its commit typechecks before Task 6's renderer API exists.

- [ ] **Step 1: Write failing state-machine tests against the pure controller-state module**

```ts
test("does not begin a transition before the next texture loads", () => {
  const initial = readyCurrent(createPhoenixControllerState("tail-wag", "walk-loop"));
  const requested = reducePhoenixController(initial, {
    type: "request", atElapsedMs: 12_000,
    request: { action: "walk-loop", intent: "semantic-walk", reactionId: null, transitionContext: "semantic" },
  });
  const page0 = reducePhoenixController(requested, {
    type: "atlas-page-ready", residencyEpoch: requested.residencyEpoch,
    generation: requested.requestGeneration, slot: requested.pendingSlot!,
    action: "walk-loop", pageIndex: 0, pageCount: 2, atElapsedMs: 12_016,
  });
  assert.equal(page0.phase, "loading-next");
  const allPages = reducePhoenixController(page0, {
    type: "atlas-page-ready", residencyEpoch: requested.residencyEpoch,
    generation: requested.requestGeneration, slot: requested.pendingSlot!,
    action: "walk-loop", pageIndex: 1, pageCount: 2, atElapsedMs: 12_017,
  });
  assert.equal(allPages.phase, "crossfading");
});

test("a page error preserves the current visible atlas", () => {
  const initial = readyWarmPair("idle-breathe", "walk-loop");
  const requested = reducePhoenixController(initial, {
    type: "request", atElapsedMs: 20_000,
    request: { action: "bark-loop", intent: "reaction", reactionId: makePhoenixReactionId("reaction:bark-1"), requestToken: makePhoenixReactionRequestToken("room:bark-1"), playback: { kind: "finite", completion: "terminal-hold" }, transitionContext: "reaction-enter" },
  });
  const failed = reducePhoenixController(requested, {
    type: "texture-error", error: {
      code: "decode-failed", stage: "next-action", action: "bark-loop",
      slot: requested.pendingSlot!, pageIndex: 0,
      generation: requested.requestGeneration, residencyEpoch: requested.residencyEpoch,
      message: "decode failed", recoverable: true,
    },
  });
  assert.equal(failed.currentSlot, initial.currentSlot);
  assert.equal(failed.phase, "steady");
  assert.equal(failed.lastError?.action, "bark-loop");
});

test("restores dwell and walk before roam resumes after reaction", () => {
  const afterReaction = reduceScenario(walkingPair, [requestReaction, reactionReady, transitionDone, reactionDone]);
  assert.equal(afterReaction.roam, "restoring-pair");
  assert.equal(afterReaction.phase, "loading-next");
  const restored = readyAndFinishRestoration(afterReaction);
  assert.deepEqual(new Set(slotActions(restored)), new Set(["idle-breathe", "walk-loop"]));
  assert.equal(restored.roam, "walking");
});

test("same-action reaction tokens reject stale completion", () => {
  const first = requestReaction(readyWarmPair("idle-breathe", "walk-loop"), "reaction:1", "ear-perk", 40_000);
  const second = requestReaction(first, "reaction:2", "ear-perk", 40_020);
  const stale = reducePhoenixController(second, {
    type: "driver-completion", completion: {
      token: makePhoenixDriverCompletionToken("0:1:reaction:1:terminal-hold:1"),
      kind: "terminal-hold", reactionId: makePhoenixReactionId("reaction:1"),
      requestToken: makePhoenixReactionRequestToken("room:reaction:1"), action: "ear-perk",
      generation: first.requestGeneration, residencyEpoch: first.residencyEpoch, completedLoops: 0,
    },
  });
  assert.equal(stale.activeReaction?.id, "reaction:2");
});

test("a producible held reaction cannot stick and releases only by exact token", () => {
  const requested = requestHeldReaction(
    readyWarmPair("health-watch", "walk-loop"),
    "reaction:health", "room:health", "comfort-loop", 51_000,
  );
  const playing = readyPendingPages(requested, 51_016);
  const oneLoop = driveUntilCompletion(playing, "held-loop-ready");
  assert.equal(oneLoop.machine.activeReaction?.status, "holding");
  assert.equal(oneLoop.completions.length, 1);
  const staleRelease = reducePhoenixController(oneLoop.machine, {
    type: "reaction-release", reactionId: makePhoenixReactionId("reaction:health"),
    requestToken: makePhoenixReactionRequestToken("room:stale"),
    generation: playing.requestGeneration, residencyEpoch: playing.residencyEpoch,
  });
  assert.equal(staleRelease.activeReaction?.status, "holding");
  const released = releaseExactHeldReaction(oneLoop.machine, "reaction:health", "room:health");
  const boundary = driveUntilCompletion(released, "held-release-boundary");
  assert.equal(boundary.machine.activeReaction, null);
  assert.equal(boundary.completions.filter((item) => item.kind === "held-release-boundary").length, 1);
});

test("a one-shot requested halfway through the global clock uses a signed entry pair", () => {
  const state = readyWarmPair("idle-breathe", "walk-loop", { elapsedMs: 37_500 });
  const requested = requestReaction(state, "reaction:half-clock", "bark-loop", 37_500);
  const ready = readyPendingPages(requested, 37_516);
  assert.equal(ready.activeTransition!.context, "reaction-enter");
  assert.equal(ready.activeTransition!.toAction, "bark-loop");
  assert.ok(ready.activeTransition!.source.contactId);
  assert.ok(ready.activeTransition!.target.contactId);
  assert.ok(ready.activeTransition!.sharedPaws.length > 0);
  assert.ok(ready.activeTransition!.waitFrames <= 1);
});

test("initial current-page failure exposes the approved seed fallback, never blank", () => {
  const boot = createPhoenixControllerState("idle-breathe", "walk-loop");
  const fallback = reducePhoenixController(boot, { type: "fallback-ready", residencyEpoch: 0 });
  const failed = reducePhoenixController(fallback, textureError({ stage: "boot-current" }));
  assert.equal(failed.visibility, "fallback");
  assert.equal(failed.fallback.status, "ready");
});
```

Also cover a second reaction arriving while the first target page loads, every out-of-order/stale page callback, a stale same-action completion, each of the four producible held-loop actions (`tail-wag`, `walk-loop`, `comfort-loop`, `health-watch`), finite two-loop `eat-loop`/`drink-loop`, an arbitrary-clock request for each reaction action, walk→dwell and dwell→walk alignment, both atlas roots at every 100 ms crossfade sample, current/next error stages, explicit retry, fallback load failure, deactivate/reactivate epochs, late callbacks after eviction, and reactivation load failure.

- [ ] **Step 2: Run the controller test and confirm failure**

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/phoenixMotionController.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the pure reducer in `phoenixMotionControllerState.ts`**

The reducer owns discrete slots, every-page readiness, semantic pair restoration, reaction identity, phase origins, boot/fallback/last-good visibility, lifecycle eviction, cancellation, and errors; it imports no UI module. Use these complete public types (all string IDs are validated nonempty at their constructors):

```ts
export type PhoenixTextureSlotId = "a" | "b";
export type PhoenixReactionId = string & { readonly __phoenixReactionId: unique symbol };
export type PhoenixReactionRequestToken = string & { readonly __phoenixReactionRequestToken: unique symbol };
export type PhoenixDriverCompletionToken = string & { readonly __phoenixDriverCompletionToken: unique symbol };
export type PhoenixRequestIntent = "semantic-dwell" | "semantic-walk" | "reaction";
export type PhoenixControllerPhase =
  | "boot-loading" | "steady" | "loading-next" | "waiting-signed-contact" | "crossfading"
  | "evicted" | "reactivating" | "fallback-error";
export type PhoenixRoamState = "dwelling" | "walking" | "reaction" | "restoring-pair" | "paused";
export type PhoenixSceneState = "active" | "evicted" | "reactivating";

export interface PhoenixResolvedTransition {
  pairId: string;
  context: PhoenixTransitionContext;
  mode: PhoenixTransitionMode;
  fromAction: CareTwinSpriteAction;
  toAction: CareTwinSpriteAction;
  waitFrames: 0 | 1;
  sharedPaws: readonly [PhoenixPawId, ...PhoenixPawId[]];
  source: { contactId: string; frame: number; originControllerElapsedMs: number; alignedActionElapsedMs: number };
  target: { contactId: string; frame: number; originControllerElapsedMs: number; alignedActionElapsedMs: number };
}

export type PhoenixPhasePolicy = PhoenixResolvedTransition;

export type PhoenixActionRequest =
  | { action: PhoenixSemanticAction; intent: "semantic-dwell" | "semantic-walk"; reactionId: null; transitionContext: "semantic" }
  | { action: PhoenixReactionAction; intent: "reaction"; reactionId: PhoenixReactionId; requestToken: PhoenixReactionRequestToken; playback: PhoenixReactionPlaybackSpec; transitionContext: "reaction-enter" };

export interface PhoenixReactionState {
  id: PhoenixReactionId;
  requestToken: PhoenixReactionRequestToken;
  action: PhoenixReactionAction;
  playback: PhoenixReactionPlaybackSpec;
  generation: number;
  status: "loading" | "playing" | "holding" | "release-requested" | "settling";
}

export interface PhoenixDriverCompletion {
  token: PhoenixDriverCompletionToken;
  kind: "terminal-hold" | "two-loops" | "held-loop-ready" | "held-release-boundary";
  reactionId: PhoenixReactionId;
  requestToken: PhoenixReactionRequestToken;
  action: PhoenixReactionAction;
  generation: number;
  residencyEpoch: number;
  completedLoops: number;
}

export interface PhoenixSemanticWindow {
  index: number;
  kind: "dwell" | "walk" | "reaction" | "restore";
  startElapsedMs: number;
  endElapsedMs: number;
  progress: number;
}

export type PhoenixTextureErrorCode =
  | "asset-missing" | "load-failed" | "decode-failed"
  | "evicted-before-ready" | "fallback-load-failed" | "texture-release-failed";

export interface PhoenixTextureError {
  code: PhoenixTextureErrorCode;
  stage: "boot-current" | "next-action" | "crossfade" | "reactivation" | "fallback" | "eviction";
  action: CareTwinSpriteAction | null;
  slot: PhoenixTextureSlotId | null;
  pageIndex: number | null;
  generation: number;
  residencyEpoch: number;
  message: string;
  recoverable: boolean;
}

export interface PhoenixLastGoodFrame {
  kind: "approved-seed" | "atlas-frame";
  action: CareTwinSpriteAction | null;
  slot: PhoenixTextureSlotId | null;
  frame: number;
  localRootX: number;
  localRootY: number;
  worldRootX: number;
  worldRootY: number;
  travelX: number;
  travelY: number;
  facing: -1 | 1;
  shadowScaleX: number;
  shadowOpacity: number;
  generation: number;
  residencyEpoch: number;
}

export interface PhoenixTextureSlotMachine {
  id: PhoenixTextureSlotId;
  action: CareTwinSpriteAction | null;
  pageCount: number;
  readyPages: readonly boolean[];
  status: "empty" | "loading" | "ready" | "error";
  errorPage: number | null;
  generation: number;
  residencyEpoch: number;
  phase: PhoenixPhasePolicy | null;
}

export interface PhoenixControllerMachineState {
  semanticDwellAction: PhoenixSemanticDwellAction;
  semanticWalkAction: "walk-loop";
  requestedAction: CareTwinSpriteAction;
  requestGeneration: number;
  currentRequest: PhoenixActionRequest;
  slots: Readonly<Record<PhoenixTextureSlotId, PhoenixTextureSlotMachine>>;
  currentSlot: PhoenixTextureSlotId;
  pendingSlot: PhoenixTextureSlotId | null;
  phase: PhoenixControllerPhase;
  roam: PhoenixRoamState;
  pausedFrom: Exclude<PhoenixRoamState, "paused"> | null;
  activeReaction: PhoenixReactionState | null;
  queuedReaction: Extract<PhoenixActionRequest, { intent: "reaction" }> | null;
  activeTransition: PhoenixResolvedTransition | null;
  consumedDriverCompletionTokens: readonly PhoenixDriverCompletionToken[];
  scene: PhoenixSceneState;
  residencyEpoch: number;
  visibility: "withheld" | "fallback" | "atlas";
  fallback: { status: "loading" | "ready" | "error"; residencyEpoch: number };
  lastGoodFrame: PhoenixLastGoodFrame | null;
  lastError: PhoenixTextureError | null;
}

export type PhoenixControllerEvent =
  | { type: "request"; request: PhoenixActionRequest; atElapsedMs: number }
  | { type: "atlas-page-ready"; residencyEpoch: number; generation: number; slot: PhoenixTextureSlotId; action: CareTwinSpriteAction; pageIndex: number; pageCount: number; atElapsedMs: number }
  | { type: "texture-error"; error: PhoenixTextureError }
  | { type: "fallback-ready"; residencyEpoch: number }
  | { type: "fallback-error"; residencyEpoch: number; message: string }
  | { type: "visible-frame-committed"; frame: PhoenixLastGoodFrame }
  | { type: "transition-complete"; residencyEpoch: number; generation: number; from: PhoenixTextureSlotId; to: PhoenixTextureSlotId }
  | { type: "contact-cut-committed"; residencyEpoch: number; generation: number; pairId: string; from: PhoenixTextureSlotId; to: PhoenixTextureSlotId }
  | { type: "driver-completion"; completion: PhoenixDriverCompletion }
  | { type: "reaction-release"; reactionId: PhoenixReactionId; requestToken: PhoenixReactionRequestToken; generation: number; residencyEpoch: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "scene-deactivate"; reason: "offscreen" | "background" | "unmount" }
  | { type: "scene-reactivate"; atElapsedMs: number }
  | { type: "cancel"; reason: "superseded" | "scene-inactive" | "unmount" };
```

`createPhoenixControllerState(dwellAction, walkAction)` starts in `boot-loading`: both semantic actions are logical slot assignments with readiness false, the active-scene fallback seed is loading, and visibility is withheld until either the approved fallback or meaningful current atlas pose is ready. Every accepted request increments `requestGeneration`, and a newly assigned slot copies both generation and `residencyEpoch`. A slot becomes ready only when every index `0..pageCount-1` reports ready for the same epoch/generation/action/count; duplicate/out-of-range/stale readiness is ignored. A request for a warm ready action aligns and crossfades immediately. A cold request loads only the non-current slot. A reaction requires unique `reactionId` plus producer-owned `requestToken`, may overwrite only the non-current slot, suspends roam, and never creates a third decoded slot. `reactionPlayback` must exactly equal the Task 1 manifest policy for its action or the reducer rejects it. A driver completion is accepted only when completion token, reaction ID, request token, action, generation, and epoch all match and that completion token has not been consumed; two consecutive same-action reactions cannot clear each other. On accepted finite/released completion, load/crossfade to semantic dwell, then replace the non-current reaction/old slot with the missing semantic walk atlas; roam remains `restoring-pair` until both report every page ready.

Finite `eat-loop`/`drink-loop` emit `two-loops` only after exactly two whole loops; one-shots emit `terminal-hold` only upon first arrival at the reviewed terminal hold. Producible `while-requested` reactions (`tail-wag`, `walk-loop`, `comfort-loop`, `health-watch`) emit `held-loop-ready` exactly once after at least one whole loop and enter `holding`; that signal does **not** complete the reaction. Only a matching producer `reaction-release` changes status to `release-requested`, and the driver then emits `held-release-boundary` exactly once at the next reviewed loop seam/contact boundary. Missing/stale/wrong-token release leaves the reaction visibly held; supersede/deactivate cancellation is separate and never masquerades as completion. This makes every current tap/log reaction releasable without a wall-clock timeout.

`resolveSignedTransition` selects the exact context/from/to pair and the mapping for the current source frame. It waits exactly the recorded `0|1` authored frames, then installs non-null source/target phase origins and contact IDs. An aligned crossfade samples both signed contact intervals from those distinct origins for 100 ms; a contact cut atomically promotes the target at the mapped instant without mounting two visible atlases. Reaction entry therefore begins at its reviewed signed entry contact, and reaction completion resolves a signed `reaction-exit` pair to the current semantic dwell—never a walk/dwell-only shortcut. A missing pair, source-frame row, contact, or shared paw is a reducer error rather than a frame-zero fallback.

On any next-slot error, keep current opacity/frame untouched, clear the pending transition, record the complete error, and restore an evicted semantic atlas if needed. Before notifying React of a current error, the frame driver copies the last actually rendered atlas/frame and current/next local correction into `lastGoodFrame` shared state and freezes it; no per-frame reducer dispatch occurs. During initial current failure, the ready approved-seed fallback remains visible; if the fallback itself fails, the room shows the explicit nonanimated `Phoenix unavailable` placeholder and `fallback-error`, never a blank image. There is no timer or automatic retry. `scene-deactivate` increments the residency epoch, marks both slots evicted/empty, clears readiness, withholds visibility, and retains only semantic action/phase/reaction metadata; every late callback from the prior epoch is ignored. `scene-reactivate` assigns current and partner actions to new loading slots at the frozen elapsed value and keeps the scene withheld until a meaningful current pose or explicit fallback is ready.

- [ ] **Step 4: Implement the pure injected frame driver**

Use complete UI-independent contracts:

```ts
export interface PhoenixLayerSample {
  action: CareTwinSpriteAction;
  frame: number;
  localRootX: number;
  localRootY: number;
  visualRootX: number;
  visualRootY: number;
}

export interface PhoenixFrameDriverSnapshot {
  controllerElapsedMs: number;
  semanticWindow: PhoenixSemanticWindow;
  current: PhoenixLayerSample;
  next: PhoenixLayerSample | null;
  worldRootX: number;
  worldRootY: number;
  travelX: number;
  travelY: number;
  facing: -1 | 1;
  shadowScaleX: number;
  shadowOpacity: number;
  transition: number;
  activeTransition: PhoenixResolvedTransition | null;
  lastGoodFrame: PhoenixLastGoodFrame | null;
  completion: PhoenixDriverCompletion | null;
}

export interface PhoenixFrameDriver {
  step(delta: { timeSincePreviousFrame: number | null }): PhoenixFrameDriverSnapshot;
  pause(): void;
  resume(): void;
  applyMachine(machine: PhoenixControllerMachineState): void;
  snapshot(): PhoenixFrameDriverSnapshot;
}
```

`createPhoenixFrameDriver` takes injected action/roam/window samplers and delta input. Its pause/resume delta rules remain exact. For every `aligned-crossfade` step it samples the realized pair's source and target origins, requires both non-null signed contact IDs, verifies the declared shared paw remains planted and the two world-paw/root positions differ by at most 1 displayed pixel, and emits both layers with complementary opacity. For `contact-cut`, it emits only the source before the boundary and only the target after it. A unit test keeps the prior `[null,16,17]` pause sequence and independently exercises every mapping in the 129-pair table; null/unmapped contact IDs, wait `2`, or two visible cut layers throw.

The driver, not the hook, detects the first threshold crossing for terminal hold, two loops, held minimum loop, and post-release reviewed boundary. That `step` returns a snapshot with one tokenized `completion`; every later step returns `completion:null` for the same threshold. `snapshot()` is observational and always returns `completion:null`, so polling cannot replay an event. Tokens are deterministically `${residencyEpoch}:${generation}:${reactionId}:${kind}:${ordinal}` and the reducer retains consumed tokens for the active generation. `applyMachine` with a new generation/epoch cancels old pending signals. Tests step across each threshold with large/small deltas, call `snapshot()` repeatedly, pause/resume, apply a superseding same-action machine, and prove exactly one matching signal and zero stale signals. This is the complete executable bridge by which Task 7 dispatches `driver-completion`; no hook guesses `completed` from frame numbers.

`samplePhoenixSemanticWindow(sceneSeed, controllerElapsedMs, roamPlan, activeReaction)` is a pure deterministic function returning the read-only window above; ambient choreography consumes that exact value in Task 7. The driver updates `lastGoodFrame` on the same step that produces visible channels, not through React state. Node tests import this module directly; no test imports a hook, TSX component, React Native, or Reanimated.

- [ ] **Step 5: Prove phase, identity, fallback, and lifecycle behavior**

Run the full table suite above. Assert all 129 reachable context pairs and every independently derived phase row, including each producer from every semantic source and every producer exit to all five dwell actions. A loading reaction may be superseded while invisible; once visible, a newer reaction is queued until signed exit, preventing an undeclared reaction→reaction transition. Prove crossfades always carry mapped contacts/shared paws through every opacity sample, cuts never overlap, the 0/1 wait bound holds, finite/held completion remains exact, and all prior fallback/lifecycle/stale-generation behavior survives.

- [ ] **Step 6: Run pure controller tests and typecheck this pre-renderer tree**

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/phoenixMotionController.test.ts
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS without importing `ExternalSpriteAtlas`, `SpriteSheetPlayer`, `PhoenixTexturePair`, React Native, or Reanimated from either new `lib/*` module.

- [ ] **Step 7: Commit the pure controller boundary**

```bash
git add artifacts/woofwatcher-mobile/lib/phoenixMotionControllerState.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFrameDriver.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionController.test.ts
git commit -m "feat(motion): add pure Phoenix controller and frame driver"
```

---

### Task 6: Make Sprite Rendering External and Migrate Every Non-Home Call Site

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/externalSpriteAtlas.ts`
- Create: `artifacts/woofwatcher-mobile/lib/externalSpriteAtlas.test.ts`
- Create: `artifacts/woofwatcher-mobile/components/motion/ExternalSpriteClock.ts`
- Create: `artifacts/woofwatcher-mobile/components/avatar/TemplateSpriteRig.tsx`
- Create: `docs/release/PHOENIX_MOTION_CALLSITE_INVENTORY.md`
- Modify: `artifacts/woofwatcher-mobile/components/SpriteSheetPlayer.tsx`
- Create: `artifacts/woofwatcher-mobile/components/phoenix/PhoenixSprite.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/avatarRoomRuntime.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/avatarRoomRuntime.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/avatarTemplateSpriteAssets.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/avatarTemplateSpriteAssets.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinAssets.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinAssets.test.ts`
- Modify: `artifacts/woofwatcher-mobile/components/LivingPhoenixRoom.tsx` (temporary external-frame compatibility; Task 7 replaces Phoenix scheduling)
- Modify: `artifacts/woofwatcher-mobile/components/more/AvatarStudioScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/WoofGuideScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/DayTrailScene.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- Consumes: Phoenix production pages and retained template idle/walk sheets through a generic contract; external `SharedValue<number>` frame.
- Produces: `ExternalSpriteAtlas`, `adaptTemplateSpriteAtlas`, stateless `SpriteSheetPlayer`, generic `useExternalSpriteClock`, an intermediate fixed-size externally clocked `PhoenixSprite`, and a discriminated `AvatarRoomRuntime` that never applies Phoenix geometry to a template. Task 7 replaces only the Phoenix wrapper's clock/render integration.

```ts
export interface ExternalSpriteAtlasPage {
  index: number;
  firstFrame: number;
  frameCount: number;
  columns: number;
  source: ImageSourcePropType;
}

export type ExternalSpriteRenderPolicy =
  | { kind: "phoenix-approved-slot"; logicalWidth: 112; logicalHeight: 112 }
  | {
      kind: "legacy-template-layout";
      layout: "home" | "studio";
      logicalWidth: number;
      logicalHeight: number;
    };

export interface ExternalSpriteAtlas {
  key: string;
  frameCount: number;
  fps: number;
  loop: boolean;
  sourceFrameWidth: number;
  sourceFrameHeight: number;
  pages: readonly ExternalSpriteAtlasPage[];
  renderPolicy: ExternalSpriteRenderPolicy;
  cachePolicy: "none" | "memory-disk";
}

export type AvatarRoomRuntime =
  | {
      kind: "phoenix-production";
      templateId: "shepherd";
      templateLabel: string;
      spriteLabel: string;
      idleAtlas: ExternalSpriteAtlas;
      walkAtlas: ExternalSpriteAtlas;
      landmarkCorrection: "phoenix-reviewed";
      underlayLayers: readonly AvatarRoomAccessoryLayer[];
      overlayLayers: readonly AvatarRoomAccessoryLayer[];
      activeSlots: readonly (keyof AvatarAccessorySlots)[];
    }
  | {
      kind: "template-idle-walk-pack";
      templateId: Exclude<AvatarTemplateId, "shepherd">;
      templateLabel: string;
      spriteLabel: string;
      idleAtlas: ExternalSpriteAtlas;
      walkAtlas: ExternalSpriteAtlas;
      landmarkCorrection: "none";
      underlayLayers: readonly AvatarRoomAccessoryLayer[];
      overlayLayers: readonly AvatarRoomAccessoryLayer[];
      activeSlots: readonly (keyof AvatarAccessorySlots)[];
    };
```

If Task 0 freezes a Phoenix slot other than 112, replace that literal in the first render-policy member. Template source frames remain the existing 256; their existing Home/Studio display dimensions are copied into a registry-owned legacy layout policy so the stateless player needs no caller width/height. No template is converted to Phoenix or corrected with Phoenix paws/root.

- [ ] **Step 1: Inventory post-Slices-1–3 call sites and freeze migration ownership**

Run only after the prerequisite commits recorded by Task 0 are checked out:

```bash
rg -n "SpriteSheetPlayer|PhoenixSprite|getAvatarRoomRuntime|avatarTemplateSpriteAssets|entering=" \
  artifacts/woofwatcher-mobile/app artifacts/woofwatcher-mobile/components artifacts/woofwatcher-mobile/lib
```

Seed `PHOENIX_MOTION_CALLSITE_INVENTORY.md` with the known post-Slice owners `components/more/AvatarStudioScreen.tsx`, `components/more/AdventureScreen.tsx`, `components/more/WoofGuideScreen.tsx`, and `components/health/RecordsScreen.tsx` before reconciling discovery. Write every result, its final component owner, atlas kind, action source, approved logical size, complete underlay/overlay/active-slot policy, and disposition. Required classifications are: canonical Home Phoenix → temporary external-frame compatibility here and Task 7 controller; Avatar Studio/template preview → generic template atlas; Adventure/WoofGuide/Records retained Phoenix decoration → fixed approved Phoenix slot with mandatory viewport; retained Day Trail Phoenix → fixed approved Phoenix slot; old command-stage/decorative Phoenix usages removed by Slices 2–3 → absent. Explicitly record `app/portrait.tsx`, `app/adventure.tsx`, `app/woofguide.tsx`, `app/(tabs)/records.tsx`, `pack.tsx`, and `story.tsx` as replace-only bridges/no edit. If any post-Slice direct caller is not classified, add its actual final component path before writing the red test; discovery never authorizes editing a bridge.

- [ ] **Step 2: Write failing generic-atlas and runtime tests**

```ts
assert.match(spritePlayer, /frame: Readonly<SharedValue<number>>/);
assert.doesNotMatch(spritePlayer, /useSharedValue|withRepeat|withTiming|useReducedMotion/);

test("keeps a non-Shepherd template through Home, Studio, and action changes", () => {
  const selected = avatarFixture({ templateId: "retriever", accessorySlots: { neck: "forest-bandana" } });
  const home = deriveAvatarRoomRuntime(selected, "idle-breathe");
  const walking = deriveAvatarRoomRuntime(selected, "walk-loop");
  const studio = deriveAvatarStudioPreview(selected);
  for (const runtime of [home, walking, studio]) {
    assert.equal(runtime.kind, "template-idle-walk-pack");
    assert.equal(runtime.templateId, "retriever");
    assert.equal(runtime.landmarkCorrection, "none");
    assert.deepEqual(runtime.underlayLayers, []);
    assert.deepEqual(runtime.overlayLayers, []);
    assert.deepEqual(runtime.activeSlots, []);
    assert.equal(runtime.idleAtlas.renderPolicy.kind, "legacy-template-layout");
  }
  assert.notEqual(home.idleAtlas.key, walking.walkAtlas.key);
});

test("preserves fitted accessory arrays, labels, order, and active slots", () => {
  const runtime = deriveAvatarRoomRuntime(avatarFixture({
    templateId: "shepherd",
    accessorySlots: { neck: "forest-bandana", room: "cozy-bed", fx: "heart-sparkles" },
  }), "idle-breathe");
  assert.deepEqual(runtime.underlayLayers.map(({ id, slot, fitStatus }) => ({ id, slot, fitStatus })), [
    { id: "cozy-bed", slot: "room", fitStatus: "template-fitted" },
  ]);
  assert.deepEqual(runtime.overlayLayers.map(({ id, slot, fitStatus }) => ({ id, slot, fitStatus })), [
    { id: "forest-bandana", slot: "neck", fitStatus: "template-fitted" },
    { id: "heart-sparkles", slot: "fx", fitStatus: "template-fitted" },
  ]);
  assert.deepEqual(runtime.activeSlots, ["neck", "room", "fx"]);
});

test("round-trips template selection and accessory across reload", async () => {
  const reloaded = await persistAndReloadAvatarSelection(retrieverWithBandana);
  assert.deepEqual(reloaded, retrieverWithBandana);
  assert.equal(deriveAvatarRoomRuntime(reloaded, "walk-loop").kind, "template-idle-walk-pack");
});
```

`retriever` and `forest-bandana` are valid persisted literals. The current registry truthfully marks Retriever's overlay pack pending, so that runtime has empty fitted-layer arrays while persistence retains the selection; the separate Shepherd/`forest-bandana`+`cozy-bed`+`heart-sparkles` fixture proves the real fitted underlay/overlay labels, order, sources, and active slots are preserved rather than collapsed.

- [ ] **Step 3: Run the red generic/runtime suite**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/externalSpriteAtlas.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarRoomRuntime.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarTemplateSpriteAssets.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Expected: FAIL because the generic contract is absent and `SpriteSheetPlayer` owns its clock.

- [ ] **Step 4: Add the generic atlas/adapter and preserve template anatomy**

Implement `adaptTemplateSpriteAtlas(asset, track, layout)` in `avatarTemplateSpriteAssets.ts`. It wraps the existing single-sheet idle/walk source as a one-page `ExternalSpriteAtlas`, preserves frame count/fps/loop/source frame 256×256, sets `cachePolicy: "none"` for every viewport-evicted rig, and copies the existing Home or Studio display dimensions into the registry-owned `legacy-template-layout`; it contains no Phoenix manifest import. Phoenix adapters also set `cachePolicy: "none"`; `SpriteSheetPlayer` passes it literally to `expo-image`. Convert the literal template registry through this adapter. Update `avatarRoomRuntime.ts` to return the discriminated union above while preserving the existing ordered `underlayLayers`, `overlayLayers`, their labels/fit status/sources, and `activeSlots`. Unknown/missing template art uses that template's declared fallback; it never falls through to Phoenix.

`useExternalSpriteClock({ atlas, active, reducedMotionFrame })` owns one Reanimated frame callback for a template rig and, for this one intermediate commit only, the compatibility Phoenix wrapper; it returns only `frame`. It uses `timeSincePreviousFrame ?? 0`, pauses without catch-up, and returns the supplied static frame under Reduce Motion. It has no root, paw, roam, reaction, or Phoenix-manifest imports. Task 7 removes this clock from every Phoenix import graph.

- [ ] **Step 5: Refactor the player to exact stateless generic props**

```ts
interface SpriteSheetPlayerProps {
  atlas: ExternalSpriteAtlas;
  frame: Readonly<SharedValue<number>>;
  onPageReady?: (pageIndex: number, pageCount: number) => void;
  onPageError?: (pageIndex: number, error: Error) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
```

Mount all pages for the atlas. Each page uses an animated style that shows it only when `frame.value` lies in its range and translates by its local column. Render dimensions come only from `atlas.renderPolicy`; callers cannot pass width/height. The final frame stays visible for one-shots, and no key-based remount controls time. Report ready/error separately for every page, including page index/count.

At the same time, make Phoenix pages implement `ExternalSpriteAtlas` through an explicit adapter in `careTwinAssets.ts`; Phoenix-only landmarks remain on `PhoenixActionDefinition`, never the generic atlas. Remove the transitional single-sheet fields from `CareTwinPagedSpriteAsset` after all tests compile.

- [ ] **Step 6: Implement a fixed-size compatibility Phoenix wrapper and migrate retained callers**

For this type-safe intermediate commit, `PhoenixSprite` accepts only `action`, explicit `active`, mandatory `inViewport`, `style`, and `testID`; it looks up the production `ExternalSpriteAtlas`, drives the stateless player with `useExternalSpriteClock({ active: active && inViewport })`, and renders at the approved slot. It accepts no asset, width, height, scale, reaction, or completion API. Task 7 replaces its implementation with the unified controller/texture pair without changing the fixed-size/viewport boundary. Retained Phoenix layouts reserve that exact slot. If a required context cannot use it, generate and re-approve a separate logical-size variant through Tasks 0–3; do not scale the 112-point page.

Make `TemplateSpriteRig` require `inViewport` and accept the registry-owned `home` or `studio` layout plus explicit route/app activity; use the generic atlas and external clock only when all activity inputs are true. Update `components/more/AvatarStudioScreen.tsx` to render that rig; test idle→walk→idle without remounting identity/accessory state. Update `AdventureScreen`, `WoofGuideScreen`, `RecordsScreen`, and retained `DayTrailScene` Phoenix uses to fixed-slot `PhoenixSprite` with real viewport values. Delete any obsolete decorative caller identified by the inventory. Keep `/portrait`, `/adventure`, `/woofguide`, `/records`, `/pack`, and `/story` bridge files untouched.

Extract `TemplateSpriteRig.tsx`. Update `LivingPhoenixRoom`'s template branch to consume `AvatarRoomRuntime.kind === "template-idle-walk-pack"`, Home-layout atlases, generic external clock, and the unchanged ordered `underlayLayers`, `overlayLayers`, and `activeSlots`. Adapt its existing Phoenix branch to the compatibility `PhoenixSprite` so the new stateless player API typechecks, while intentionally leaving the old semantic/body timers for Task 7. File separation gives the final timer-ownership check distinct Phoenix/template graphs.

- [ ] **Step 7: Prove all direct rendering is owned and template behavior survives**

```bash
rg -n "<SpriteSheetPlayer" artifacts/woofwatcher-mobile --glob '*.tsx'
```

Expected in this intermediate commit: exactly `components/phoenix/PhoenixSprite.tsx` and `components/avatar/TemplateSpriteRig.tsx`. Both receive an external shared frame; `SpriteSheetPlayer` itself has no clock. Task 7 changes the Phoenix caller from `PhoenixSprite` to `PhoenixTexturePair` and proves the final two callers.

- [ ] **Step 8: Run focused tests and typecheck**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/externalSpriteAtlas.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarRoomRuntime.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarTemplateSpriteAssets.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionController.test.ts
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit the generic renderer migration**

```bash
git add artifacts/woofwatcher-mobile/lib/externalSpriteAtlas.ts \
  artifacts/woofwatcher-mobile/lib/externalSpriteAtlas.test.ts \
  artifacts/woofwatcher-mobile/components/motion/ExternalSpriteClock.ts \
  artifacts/woofwatcher-mobile/components/avatar/TemplateSpriteRig.tsx \
  docs/release/PHOENIX_MOTION_CALLSITE_INVENTORY.md \
  artifacts/woofwatcher-mobile/lib/avatarRoomRuntime.ts \
  artifacts/woofwatcher-mobile/lib/avatarRoomRuntime.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarTemplateSpriteAssets.ts \
  artifacts/woofwatcher-mobile/lib/avatarTemplateSpriteAssets.test.ts \
  artifacts/woofwatcher-mobile/lib/avatarStudio.test.ts \
  artifacts/woofwatcher-mobile/lib/careTwinAssets.ts \
  artifacts/woofwatcher-mobile/lib/careTwinAssets.test.ts \
  artifacts/woofwatcher-mobile/components/LivingPhoenixRoom.tsx \
  artifacts/woofwatcher-mobile/components/SpriteSheetPlayer.tsx \
  artifacts/woofwatcher-mobile/components/phoenix/PhoenixSprite.tsx \
  artifacts/woofwatcher-mobile/components/DayTrailScene.tsx \
  artifacts/woofwatcher-mobile/components/more/AvatarStudioScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/WoofGuideScreen.tsx \
  artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
git commit -m "refactor(motion): externalize Phoenix and template atlas clocks"
```

If discovery added a retained final component, include its exact recorded path in this commit. `git diff --cached --name-only` must equal the inventory's migration paths plus the files listed above; fail on an unrecorded call site or a compatibility redirect.

---

### Task 7: Replace LivingPhoenixRoom Timers and Secondary Clocks

**Files:**
- Modify: `artifacts/woofwatcher-mobile/components/LivingPhoenixRoom.tsx`
- Create: `artifacts/woofwatcher-mobile/components/phoenix/LivingPhoenixRig.tsx`
- Create: `artifacts/woofwatcher-mobile/components/motion/PhoenixMotionController.ts`
- Create: `artifacts/woofwatcher-mobile/components/phoenix/PhoenixTexturePair.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/phoenix/PhoenixSprite.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/DayTrailScene.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/careTwinChoreography.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionInstrumentation.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionInstrumentation.test.ts`
- Create: `artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-source.mjs`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionSourceVerifier.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-source/living-room-renamed-timer.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- Consumes: Home semantic `AvatarLifePlan`, reactions, `RoamPlan`, Task 5's pure reducer/frame driver, and Task 6's generic stateless renderer.
- Produces: renderer-dependent `usePhoenixMotionController`, `PhoenixMotionController` hook result, `PhoenixTexturePair`, and one controller-backed Home/decorative rig with completion-owned actions. Task 6's generic atlas/player API is already committed before any file in this task imports it.

```ts
export interface UsePhoenixMotionControllerOptions {
  semanticDwellAction: CareTwinSpriteAction;
  semanticWalkAction: "walk-loop";
  roamPlan: RoamPlan | null;
  active: boolean;
  onReactionHoldSatisfied(identity: { reactionId: PhoenixReactionId; requestToken: PhoenixReactionRequestToken; generation: number; residencyEpoch: number }): void;
  onReactionComplete(reactionId: PhoenixReactionId): void;
  onError(error: PhoenixTextureError): void;
}

export interface PhoenixMotionController {
  machine: PhoenixControllerMachineState;
  elapsedMs: Readonly<SharedValue<number>>;
  semanticWindow: Readonly<SharedValue<PhoenixSemanticWindow>>;
  currentFrame: Readonly<SharedValue<number>>;
  nextFrame: Readonly<SharedValue<number>>;
  currentLocalRootX: Readonly<SharedValue<number>>;
  currentLocalRootY: Readonly<SharedValue<number>>;
  nextLocalRootX: Readonly<SharedValue<number>>;
  nextLocalRootY: Readonly<SharedValue<number>>;
  worldRootX: Readonly<SharedValue<number>>;
  worldRootY: Readonly<SharedValue<number>>;
  travelX: Readonly<SharedValue<number>>;
  travelY: Readonly<SharedValue<number>>;
  facing: Readonly<SharedValue<-1 | 1>>;
  shadowScaleX: Readonly<SharedValue<number>>;
  shadowOpacity: Readonly<SharedValue<number>>;
  transition: Readonly<SharedValue<number>>;
  requestAction(request: PhoenixActionRequest): void;
  releaseReaction(identity: { reactionId: PhoenixReactionId; requestToken: PhoenixReactionRequestToken; generation: number; residencyEpoch: number }): void;
  notifyAtlasPageReady(identity: { residencyEpoch: number; generation: number; slot: PhoenixTextureSlotId; action: CareTwinSpriteAction; pageIndex: number; pageCount: number }): void;
  notifyTextureError(error: PhoenixTextureError): void;
  notifyFallbackReady(residencyEpoch: number): void;
  notifyFallbackError(residencyEpoch: number, message: string): void;
  deactivate(reason: "offscreen" | "background" | "unmount"): void;
  reactivate(): void;
}
```

- [ ] **Step 1: Add failing injected-clock, rendered-inventory, and AST ownership tests**

```ts
test("one injected callback tick owns frame, travel, root, and shadow", () => {
  const probe = createPhoenixMotionProbe();
  const driver = createPhoenixFrameDriver(manualMotionFixture, probe);
  driver.step({ timeSincePreviousFrame: null });
  driver.step({ timeSincePreviousFrame: 16 });
  const tick = probe.ticks.at(-1)!;
  assert.deepEqual(tick.writes.map((write) => write.channel).sort(),
    ["frame", "root", "shadow", "travel"]);
  assert.equal(new Set(tick.writes.map((write) => write.callbackId)).size, 1);
});

test("the layer gate independently rejects duplicate rendered ownership", () => {
  const result = evaluatePhoenixLayerInventory(handAuthoredDuplicateShadowAndClockFixture);
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["expected one shadow, received two", "expected one motion clock, received two"]);
});
```

The first test drives the same `createPhoenixFrameDriver` called by the hook, using a hand-authored sample fixture and injected deltas; it does not reconstruct values from controller outputs. The inventory gate uses independent invalid/valid fixtures. Actual mounted layer registrations come from `PhoenixTexturePair`/`LivingPhoenixRig` and are exported by the native QA probe; Task 10's extractor/verifier requires their valid inventory in every measured run, so a fabricated unit inventory cannot satisfy release proof.

- [ ] **Step 2: Run readiness and confirm failure**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionInstrumentation.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-source.mjs
```

Expected: FAIL against the current independent clocks/timers and missing rendered instrumentation.

- [ ] **Step 3: Implement the renderer-dependent hook and texture pair now that Task 6 exists**

`usePhoenixMotionController` creates exactly one `useFrameCallback`. The callback passes Reanimated 4.1's `timeSincePreviousFrame` into Task 5's pure `PhoenixFrameDriver.step`, then writes elapsed/window, current/next frames, each layer's local reviewed root correction, shared world root/travel/facing/shadow, and last-good frame together. If that exact step carries a `PhoenixDriverCompletion`, it forwards the complete tokenized object once to the reducer on the React Native runtime. Accepted `held-loop-ready` invokes `onReactionHoldSatisfied`; accepted finite or `held-release-boundary` completion invokes `onReactionComplete`. No hook reconstructs completion from a frame number, and no hook test imports React Native: Node tests exercise the same injected driver while instrumentation verifies wiring.

Only after every target page is ready and `resolveSignedTransition` returns a complete mapping may rendering change. For `aligned-crossfade`, set `transition.value = withTiming(1, { duration: 100, easing: Easing.linear }, completion)` and carry pair/contact/shared-paw identities through the callback. For `contact-cut`, wait the mapped 0/1 source frames, atomically commit `contact-cut-committed`, and never start `withTiming` or show the pending layer. Supersede/error/deactivate invalidates both modes. Reaction completion notifies React only after the signed exit transition is accepted; stale identities are inert.

`PhoenixTexturePair` keeps the one root/shadow/accessory/effects stack. It renders two atlases only for an `aligned-crossfade` whose realized pair has non-null source/target contact IDs and shared paws; opacity is complementary and development invariants enforce both root and signed world-paw separation ≤1 px on every sample. A `contact-cut` renders exactly one atlas before and after its atomic boundary. Missing pair/contact data is a typed error, never a permissive fade. All prior epoch-aware page callbacks, fallback behavior, and fixed-size API remain.

Update `PhoenixSprite` and Day Trail/decorative owners to the controller implementation and require both `active` and `inViewport`; remove their temporary Task 6 `useExternalSpriteClock` import. After this step, `rg -n "<SpriteSheetPlayer"` returns exactly `PhoenixTexturePair.tsx` and `TemplateSpriteRig.tsx`.

- [ ] **Step 4: Replace the anchored and roaming rigs with one controller**

Extract the Phoenix-only branch into `LivingPhoenixRig.tsx`; `LivingPhoenixRoom` dispatches to it or Task 6's `TemplateSpriteRig` using the `AvatarRoomRuntime` discriminant. Create one Phoenix controller from `stageSpriteAction`, active reaction, and `roamPlan`. Delete `RoamingTwinRig`’s React leg state, x/y/depth tweens, scale tween, bob loop, and action-key resets. Render the controller’s root/travel/facing values through `PhoenixTexturePair` in both anchored and roaming scene states. Keep the Phoenix frame at its approved logical size; scene depth changes z-order/shadow only, never atlas scale.

- [ ] **Step 5: Remove non-authored body transforms**

Delete `breath`, `walkCycle`, `sceneMotionStyle`, `spriteRigStyle`, and `spriteShadowStyle` calculations based on sine waves. The authored strip supplies gait/breath/chew/hop; the controller supplies only manifest root correction, contact-derived shadow, and roam travel.

- [ ] **Step 6: Replace timer-owned reactions and care-event settle**

Convert `{id, action}` to `PhoenixActionRequest` with the exact reaction/request tokens, manifest playback, and `transitionContext:"reaction-enter"`; reject an action outside `PhoenixReactionAction`. The reducer resolves the signed entry pair from the currently visible semantic action. Completion resolves `reaction-exit` to `derivePhoenixSemanticDwellAction(currentPlan)`. A new reaction received after the first becomes visible is queued, not crossfaded reaction-to-reaction. Keep the exact finite/held completion and producer release rules; no wall-clock timeout participates.

For a momentary tap/log `roomReaction`, `held-loop-ready` calls `onReactionHoldSatisfied` in Home. Home performs the producer-side handshake `setRoomReaction(current => current && makePhoenixReactionId(String(current.id)) === reactionId ? null : current)` and passes the same removed ID/token back through `releaseReaction`; a stale callback cannot clear a newer prop. A persistent producer may leave its exact request present and therefore held. The controller accepts release only after the minimum-loop signal and completes at the next reviewed release boundary. Table tests run every value returned by `describeCareTwinReactionForLog` and `tapReactionFor`, including `tail-wag`, `walk-loop`, `comfort-loop`, and `health-watch`, and prove each either has a finite driver completion or executes this exact release handshake. Completion requests semantic dwell with signed contact alignment, then restores both warm roam atlases. No wall-clock JS timeout participates.

- [ ] **Step 7: Replace ambient interval with deterministic controller choreography**

Convert ambient behavior cadence into deterministic phase windows by consuming the controller's read-only `semanticWindow`/`elapsedMs` and the existing seeded roam plan. Do not reconstruct elapsed time, use a second clock, or use random values during rendering; choose the ambient sequence from the stable scene seed once.

- [ ] **Step 8: Make effects completion-owned and register one rendered stack**

Render ground shadow once, template underlays once, the current/pending sprite slots, template overlays once, and a single effects host. Preserve pet hit target, speech, status, and truthful care reaction semantics. Replace `petBurstTimer` and any heart teardown timeout with a Reanimated opacity/translation completion callback keyed by effect ID; completion clears only that ID on the React Native runtime. Task 8 prevents effect creation under Reduce Motion. Each actual rendered layer registers `{role, instanceId, motionClockId}` with the development/QA probe and unregisters on unmount.

- [ ] **Step 9: Enforce timer and frame-clock ownership with an AST rule**

`verify-phoenix-motion-source.mjs` parses `LivingPhoenixRoom.tsx` itself as a mandatory root, then follows separate import graphs from `LivingPhoenixRig.tsx` and `TemplateSpriteRig.tsx`. It fails on direct or aliased `setTimeout`, `setInterval`, `requestAnimationFrame`, `Animated.loop`, `withRepeat`, or an unowned `useFrameCallback`, printing source path and AST location. `LivingPhoenixRoom.tsx` may dispatch to both rigs but owns no timer/frame API. The Phoenix graph permits exactly one callback in `PhoenixMotionController.ts` and may not reach `ExternalSpriteClock.ts`; the template graph permits exactly one callback in `ExternalSpriteClock.ts` and may not reach the Phoenix controller. Any allowed nonvisual delay lives outside all three motion subtrees behind the explicitly named `CareSemanticScheduler` service, whose public events carry domain timestamps rather than animation callbacks.

`phoenixMotionSourceVerifier.test.ts` runs the rule against the real roots and against `lib/fixtures/phoenix-motion-source/living-room-renamed-timer.tsx`, whose dispatcher contains `const later = globalThis.setTimeout; later(...)`. The fixture must fail with its exact dispatcher path/location, proving alias/symbol resolution and explicit `LivingPhoenixRoom` scanning; a regex-only pass is insufficient.

- [ ] **Step 10: Run focused motion/readiness tests**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionMath.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionController.test.ts \
  artifacts/woofwatcher-mobile/lib/careTwinChoreography.test.ts \
  artifacts/woofwatcher-mobile/lib/careTwinRoam.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionInstrumentation.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionSourceVerifier.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
node artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-source.mjs
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit the Home controller integration**

```bash
git add artifacts/woofwatcher-mobile/components/LivingPhoenixRoom.tsx \
  artifacts/woofwatcher-mobile/components/phoenix/LivingPhoenixRig.tsx \
  artifacts/woofwatcher-mobile/components/motion/PhoenixMotionController.ts \
  artifacts/woofwatcher-mobile/components/phoenix/PhoenixTexturePair.tsx \
  artifacts/woofwatcher-mobile/components/phoenix/PhoenixSprite.tsx \
  artifacts/woofwatcher-mobile/components/DayTrailScene.tsx \
  artifacts/woofwatcher-mobile/app/'(tabs)'/index.tsx \
  artifacts/woofwatcher-mobile/lib/careTwinChoreography.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionInstrumentation.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionInstrumentation.test.ts \
  artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-source.mjs \
  artifacts/woofwatcher-mobile/lib/phoenixMotionSourceVerifier.test.ts \
  artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-source/living-room-renamed-timer.tsx \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
git commit -m "refactor(motion): unify Living Phoenix runtime"
```

---

### Task 8: Complete Lifecycle and Reduce Motion

**Files:**
- Create: `artifacts/woofwatcher-mobile/hooks/useSceneActivity.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixLifecycle.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixTextureResidency.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixLifecycle.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixReduceMotion.test.ts`
- Modify: `artifacts/woofwatcher-mobile/components/motion/PhoenixMotionController.ts`
- Modify: `artifacts/woofwatcher-mobile/components/phoenix/PhoenixSprite.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/phoenix/PhoenixTexturePair.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/avatar/TemplateSpriteRig.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/LivingPhoenixRoom.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: every retained viewport owner recorded in `PHOENIX_MOTION_CALLSITE_INVENTORY.md`

**Interfaces:**
- Produces: mandatory `useSceneActivity(inViewport: boolean): boolean`, `PhoenixTextureResidencyAdapter`, pure `deriveReducedPhoenixState`, `pausePhoenixClock`, `resumePhoenixClock`, and `staticPhoenixMotionSample(action)`.
- Consumes: Expo Router focus events, React Native `AppState`, OS Reduce Motion.

```ts
export interface PhoenixTextureReleaseResult {
  residencyEpoch: number;
  unmountedAssetKeys: readonly string[];
  nativeMemoryCacheCleared: boolean;
}

export interface PhoenixTextureResidencyAdapter {
  release(input: { residencyEpoch: number; unmountedAssetKeys: readonly string[] }): Promise<PhoenixTextureReleaseResult>;
}
```

The production adapter first verifies those exact keys are absent from the mounted layer registry, then calls `Image.clearMemoryCache()` from `expo-image` and resolves only when the native promise resolves; rejection is recorded as `texture-release-failed` and blocks evidence. This explicit global memory-cache clear is acceptable at scene deactivation because Phoenix pages use `cachePolicy="none"`; it is not counted as decoded-memory proof. Task 10 derives release from native allocation/cache artifacts.

- [ ] **Step 1: Write failing independent lifecycle/reduced-state tests**

```ts
test("reduced motion selects the declared meaningful frame and no effects", () => {
  const state = deriveReducedPhoenixState(PHOENIX_ACTION_MANIFEST["walk-loop"]);
  assert.equal(state.frame, PHOENIX_ACTION_MANIFEST["walk-loop"].reducedMotionFrame);
  assert.deepEqual(state.effects, { roam: false, bob: false, shimmer: false, parallax: false, hearts: false });
});

test("an injected activity sequence pauses, resumes, and cleans up without catch-up", () => {
  const source = createFakeSceneActivitySource();
  const driver = createPhoenixFrameDriver(manualMotionFixture);
  const subscription = bindSceneActivity(source, driver);
  driver.step({ timeSincePreviousFrame: null });
  driver.step({ timeSincePreviousFrame: 16 });
  source.emit({ focused: false });
  driver.step({ timeSincePreviousFrame: 30_000 });
  source.emit({ focused: true });
  driver.step({ timeSincePreviousFrame: null });
  driver.step({ timeSincePreviousFrame: 16 });
  assert.deepEqual(driver.elapsedWrites, [0, 16, 16, 16, 32]);
  subscription.remove();
  source.emit({ appState: "background" });
  assert.equal(driver.activityWriteCount, 2);
});
```

Table-test all eight focus/AppState/viewport combinations, focus loss during a crossfade, background during reaction, page readiness arriving after deactivation, reactivation after 60 seconds, and unmount cleanup. The expected elapsed sequence is specified directly; it does not call `pausePhoenixClock`/`resumePhoenixClock` to calculate its oracle. Also table-test every action's declared reduced frame and verify no Phoenix effect host is registered.

Add reducer/renderer tests for `scene-deactivate`: both slot statuses become `empty`, readiness arrays clear, epoch increments, current/next/fallback image views unmount, and only logical action/phase/reaction metadata remains. Feed late page-ready/error callbacks from the evicted epoch and prove they are ignored. Reactivate after 60 seconds and prove no elapsed catch-up, the scene stays withheld until the meaningful current frame is ready, then the semantic partner reloads; separately prove current-page and fallback load failures produce the defined fallback/placeholder. Run the same mandatory viewport test for every retained `PhoenixSprite` and `TemplateSpriteRig` owner from Task 6.

- [ ] **Step 2: Run the reduced-motion test and confirm failure**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixLifecycle.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixReduceMotion.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement pure lifecycle and reduced-state helpers**

In `phoenixLifecycle.ts`, represent a paused clock as `{ elapsedMs, needsFreshFrame: true }`; resume preserves elapsed time and the first `timeSincePreviousFrame: null` contributes zero. `deriveReducedPhoenixState` selects `reducedMotionFrame` and returns all perpetual effect flags false. Export injectable `SceneActivitySnapshot`, `SceneActivityEvent`, `reduceSceneActivity`, and `bindSceneActivity` so the hook and independent tests share the adapter but not their oracle.

- [ ] **Step 4: Implement `useSceneActivity`**

Use `useFocusEffect` to maintain route focus, subscribe to `AppState`, and combine both with the required `inViewport` argument. Clean up both listeners. Return true only for focused + active + visible. The TypeScript signature has no optional parameter or default, and source tests reject `useSceneActivity()` with no argument and any `PhoenixSprite`/`TemplateSpriteRig` call without explicit viewport state.

- [ ] **Step 5: Stop and resume the frame callback deterministically**

Warm dwell/walk residency is active-scene-only. When activity becomes false, dispatch `scene-deactivate`, call `frameCallback.setActive(false)`, retain no wall-clock timestamp, cancel any crossfade, and unmount `PhoenixTexturePair`, approved-seed fallback, template rig pages, and transient effects in the same committed render. Phoenix `ExternalSpriteAtlas` pages use `expo-image` with `cachePolicy="none"`; the typed residency-adapter call below runs only after unmount and invokes the platform image-memory release boundary. The reducer retains only logical semantic actions, phase origins, active reaction token, frozen elapsed, and scene seed—no ready page, native image view, or decoded-byte claim.

After the committed render reports the exact prior-epoch atlas/fallback/effect keys absent, call `PhoenixTextureResidencyAdapter.release({ residencyEpoch, unmountedAssetKeys })`; require its returned epoch/key list to match and `nativeMemoryCacheCleared === true`. A rejection dispatches the typed `texture-release-failed` error at stage `eviction` and blocks QA, without remounting an old key. On activation, dispatch `scene-reactivate`, create a new residency epoch, reload the logical current/partner pair, and set `needsFreshFrame`; the first callback contributes zero. Keep the visual scene withheld behind its room placeholder until all current pages and its meaningful phase sample are ready, then expose it and load/retain the partner. A load error follows Task 5's active-scene fallback/placeholder policy. Do not process catch-up time, restart at frame 0, or trust JS bookkeeping as proof of release. Task 10 must show native decoded allocation/cache release on both platforms before this gate can pass.

- [ ] **Step 6: Apply the complete Reduce Motion state**

Gate perpetual sprite phase, roam, parent transforms, shimmer, scanline drift, parallax, hearts, pet-heart burst, walk marks, sleep drift, and reaction translations. A reduced-mode action request still waits for every target page; current remains visible on load/error, then the ready meaningful frame promotes instantly (or with the same 100 ms opacity-only transition) without advancing phase. Preserve/restore the semantic pair only while the scene is active; offscreen/background eviction still wins. Essential reaction copy switches immediately, and zone changes snap to their correct anchor.

- [ ] **Step 7: Pass real Home visibility**

In Home, derive `inViewport` from the hero’s measured bounds and scroll position, changing React state only when the visibility threshold crosses. Pass the explicit result to `LivingPhoenixRoom`. Reconcile every Task 6 inventory row: `AvatarStudioScreen`, `AdventureScreen`, `WoofGuideScreen`, `RecordsScreen`, Day Trail, Home, and any discovered retained caller must calculate viewport visibility and pass it to `PhoenixSprite`/`TemplateSpriteRig`. There is no focus-only decorative default.

- [ ] **Step 8: Run reduced-motion, readiness, and type gates**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixLifecycle.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixReduceMotion.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionController.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit lifecycle and accessibility behavior**

```bash
git add artifacts/woofwatcher-mobile/hooks/useSceneActivity.ts \
  artifacts/woofwatcher-mobile/lib/phoenixLifecycle.ts \
  artifacts/woofwatcher-mobile/lib/phoenixTextureResidency.ts \
  artifacts/woofwatcher-mobile/lib/phoenixLifecycle.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixReduceMotion.test.ts \
  artifacts/woofwatcher-mobile/components/motion/PhoenixMotionController.ts \
  artifacts/woofwatcher-mobile/components/phoenix/PhoenixSprite.tsx \
  artifacts/woofwatcher-mobile/components/phoenix/PhoenixTexturePair.tsx \
  artifacts/woofwatcher-mobile/components/avatar/TemplateSpriteRig.tsx \
  artifacts/woofwatcher-mobile/components/LivingPhoenixRoom.tsx \
  artifacts/woofwatcher-mobile/components/DayTrailScene.tsx \
  artifacts/woofwatcher-mobile/components/more/AvatarStudioScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/WoofGuideScreen.tsx \
  artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx \
  artifacts/woofwatcher-mobile/app/'(tabs)'/index.tsx
git commit -m "feat(motion): pause scenes and complete Reduce Motion"
```

---

### Task 9: Centralize GameFeel and Remove Double Entrances

**Files:**
- Modify: `artifacts/woofwatcher-mobile/components/motion/GameFeel.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/DayTrailScene.tsx`
- Modify: post-Slice canonical tab composition shells `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`, `log.tsx`, `calendar.tsx`, `health.tsx`, `more.tsx`, `_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/health/HealthSectionRouter.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/StoryProgressScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/CareTeamSuppliesScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/DogProfileScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/AvatarStudioScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/WoofGuideScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/SettingsScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/PrivacyDataScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/LegalScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/HowWoofWatcherWorksScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/MoreSectionRouter.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/calendar-month.tsx`
- Create: `docs/release/GAME_FEEL_CALLSITE_INVENTORY.md`
- Create: `artifacts/woofwatcher-mobile/lib/gameFeel.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- Produces: `entranceTimingForSlot`, `MotionEntrance`, shared touch-down response.

- [ ] **Step 0: Rediscover entrance owners after Slices 1–3**

```bash
rg -n "entering=|enterUp|FadeIn|FadeInDown|Animated\.spring|MotionEntrance|<BoardCard" \
  artifacts/woofwatcher-mobile/app artifacts/woofwatcher-mobile/components
```

Seed `GAME_FEEL_CALLSITE_INVENTORY.md` with the canonical tab shells, `components/health/RecordsScreen.tsx`, and all **ten** bounded post-Slice More owners: `DogProfileScreen`, `AvatarStudioScreen`, `CareTeamSuppliesScreen`, `StoryProgressScreen`, `AdventureScreen`, `WoofGuideScreen`, `SettingsScreen`, `PrivacyDataScreen`, `LegalScreen`, and Slice 3's `HowWoofWatcherWorksScreen`. Each inventory row is exactly the prefix `- Owner: `, a backticked literal repo-relative path beginning `artifacts/woofwatcher-mobile/`, the separator ` — `, and one literal disposition: `screen`, `card`, or `none`. Then reconcile every `rg` result and every `.tsx` file under the canonical Health/More owner directories with final owner/disposition before writing the red test; discovery is not limited to files containing a known animation token. Explicitly exclude the `/portrait`, `/adventure`, `/woofguide`, `/records`, `/pack`, and `/story` replace-only bridges. If Slices 1–3 renamed or further decomposed a listed component, replace its path with the actual result; do not edit a bridge or resurrect a deleted monolith.

- [ ] **Step 1: Write failing timing-vocabulary tests**

```ts
test("entrance slots are 0/40/80 and finish by 260ms", () => {
  assert.deepEqual([0, 1, 2, 3, 8].map(entranceTimingForSlot), [
    { delayMs: 0, durationMs: 180 },
    { delayMs: 40, durationMs: 180 },
    { delayMs: 80, durationMs: 180 },
    { delayMs: 80, durationMs: 180 },
    { delayMs: 80, durationMs: 180 },
  ]);
});
```

Add table-driven inventory assertions that every visible root/card has exactly one owner (`screen` or `card`, never both), primary tab roots contain no 450/460 ms whole-screen fade/slide wrapper, and no final component contains `Animated.spring(slide)`. Source checks are secondary wiring guards; Task 10 proves behavior on rendered native routes.

- [ ] **Step 2: Run tests and confirm current timing failures**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/gameFeel.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement pure entrance timing and `MotionEntrance`**

```ts
export function entranceTimingForSlot(slot: number) {
  return { delayMs: [0, 40, 80][Math.max(0, Math.min(2, Math.floor(slot)))]!, durationMs: 180 };
}
```

`MotionEntrance` calls `useReducedMotion`; reduced mode renders without translation/entry animation. Normal mode uses one fade/rise transition with the returned timing and cubic easing, not a spring with unbounded completion. Replace direct Story wrappers in `StoryProgressScreen.tsx` and direct month/timeline `FadeIn`/`FadeInDown` wrappers in `calendar-month.tsx` so this component is the only entrance vocabulary.

- [ ] **Step 4: Make `BoardCard` use the shared entrance component**

Keep its `enter` prop, but delegate only to `MotionEntrance`. Replace direct entrances in the final Home composition, `StoryProgressScreen`, `RecordsScreen`, `CareTeamSuppliesScreen`, and Day Trail surfaces with `MotionEntrance`. Routers and route shells do not also animate their child screen. Cap every visible group to slots 0–2.

- [ ] **Step 5: Remove whole-screen entrances from primary roots**

Delete the RN `fade`/`slide` values and 450/460 ms effects from the canonical Home, Log, Plans/Calendar, Health, and More composition owners recorded by Step 0. `HealthSectionRouter` and `MoreSectionRouter` choose content but never wrap it in an entrance. Records/Story/Care Team content retains card entrances as its sole layer. Verify tab refocus does not change a key or remount the entrance boundary.

- [ ] **Step 6: Align touch-down feedback and haptics**

In `PressScale`, set scale on `onPressIn` and fire the configured haptic there once; keep navigation/action in `onPress`. Implement the five-tab button through the same primitive after Slice 1’s tab layout, preserving selected shape plus color and visible labels. Do not make Reduce Motion remove visible pressed-state opacity/color feedback.

- [ ] **Step 7: Run timing/readiness/type tests**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/gameFeel.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit interaction motion separately from Phoenix runtime**

```bash
git add artifacts/woofwatcher-mobile/components/motion/GameFeel.tsx \
  artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx \
  artifacts/woofwatcher-mobile/components/DayTrailScene.tsx \
  artifacts/woofwatcher-mobile/app/'(tabs)'/_layout.tsx \
  artifacts/woofwatcher-mobile/app/'(tabs)'/index.tsx \
  artifacts/woofwatcher-mobile/app/'(tabs)'/log.tsx \
  artifacts/woofwatcher-mobile/app/'(tabs)'/calendar.tsx \
  artifacts/woofwatcher-mobile/app/'(tabs)'/health.tsx \
  artifacts/woofwatcher-mobile/app/'(tabs)'/more.tsx \
  artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx \
  artifacts/woofwatcher-mobile/components/health/HealthSectionRouter.tsx \
  artifacts/woofwatcher-mobile/components/more/StoryProgressScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/CareTeamSuppliesScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/DogProfileScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/AvatarStudioScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/WoofGuideScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/SettingsScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/PrivacyDataScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/LegalScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/HowWoofWatcherWorksScreen.tsx \
  artifacts/woofwatcher-mobile/components/more/MoreSectionRouter.tsx \
  artifacts/woofwatcher-mobile/app/calendar-month.tsx \
  docs/release/GAME_FEEL_CALLSITE_INVENTORY.md \
  artifacts/woofwatcher-mobile/lib/gameFeel.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
```

Before the commit, stage every additional discovered final owner from the parseable inventory rather than relying on the known list:

```bash
inventory_paths="$(mktemp)"
sed -n 's/^- Owner: `\([^`]*\)` — .*/\1/p' \
  docs/release/GAME_FEEL_CALLSITE_INVENTORY.md > "$inventory_paths"
test -s "$inventory_paths"
while IFS= read -r owner_path; do
  test -f "$owner_path"
  git add -- "$owner_path"
done < "$inventory_paths"
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/gameFeel.test.ts
git commit -m "refactor(motion): unify entrances and touch response"
```

`gameFeel.test.ts` parses the same inventory, requires all ten known owner paths plus every discovered canonical owner, and compares `git diff --cached --name-only` against the owner set plus the explicitly listed shared/tests/docs files. Any reconciled owner omitted from staging or any bridge staged by mistake fails before commit.

---

### Task 10: Add Structured Motion QA and Release Evidence Gates

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionQa.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionEvidence.schema.json`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixNativeMemoryEvidence.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionQa.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixMotionMetricExtraction.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/ios-export-pass.xml`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/android-frames-pass.csv`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/android-js-pass.csv`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/visual-events-pass.csv`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/ios-image-allocations-pass.csv`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/android-bitmap-allocations-pass.csv`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/video-frame-review-pass.json`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/lifecycle-operator-ios-pass.json`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/lifecycle-operator-android-pass.json`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/reduce-motion-ios-pass.json`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/reduce-motion-android-pass.json`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler/runtime-owner-response-pass.json`
- Create: `artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-v1.json`
- Create: `artifacts/woofwatcher-mobile/scripts/extract-phoenix-motion-metrics.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/profiler/phoenix-frame-timeline.sql`
- Create: `artifacts/woofwatcher-mobile/scripts/profiler/phoenix-js-tasks.sql`
- Create: `artifacts/woofwatcher-mobile/scripts/profiler/phoenix-bitmap-allocations.sql`
- Create: `artifacts/woofwatcher-mobile/scripts/profiler/phoenix-perfetto.pbtxt`
- Create: `artifacts/woofwatcher-mobile/scripts/extract-phoenix-video-frames.mjs`
- Create: `artifacts/woofwatcher-mobile/scripts/run-phoenix-android-lifecycle.mjs`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixLifecycleOperatorRecord.schema.json`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixVideoFrameReview.schema.json`
- Create: `artifacts/woofwatcher-mobile/lib/phoenixRuntimeOwnerResponse.schema.json`
- Modify: `artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts`
- Create: `artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-evidence.mjs`
- Create: `docs/release/PHOENIX_MOTION_QA.md`
- Create: `docs/release/phoenix-motion-evidence.example.json`
- Modify: `artifacts/woofwatcher-mobile/app/care-twin-qa.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseQa.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts`

**Interfaces:**
- Produces: `PhoenixMotionEvidence`, `PhoenixRawArtifact`, `PhoenixExtractedMetrics`, `evaluatePhoenixMotionEvidence`, reproducible profiler extraction, and focused `phoenix-motion` QA surface.

- [ ] **Step 1: Write failing evidence-gate tests**

```ts
const passingEvidence = await extractFixtureEvidence({
  iosXml: fixture("ios-export-pass.xml"),
  iosNativeMemory: fixture("ios-image-allocations-pass.csv"),
  androidFrames: fixture("android-frames-pass.csv"),
  androidJs: fixture("android-js-pass.csv"),
  androidNativeMemory: fixture("android-bitmap-allocations-pass.csv"),
  visualEvents: fixture("visual-events-pass.csv"),
  videoFrameReview: fixture("video-frame-review-pass.json"),
  iosLifecycle: fixture("lifecycle-operator-ios-pass.json"),
  androidLifecycle: fixture("lifecycle-operator-android-pass.json"),
  iosReduceMotion: fixture("reduce-motion-ios-pass.json"),
  androidReduceMotion: fixture("reduce-motion-android-pass.json"),
  runtimeOwnerResponse: fixture("runtime-owner-response-pass.json"),
  runs: 3,
});

test("blocks evidence that misses any native threshold", () => {
  const result = evaluatePhoenixMotionEvidence({
    ...passingEvidence,
    ios: { ...passingEvidence.ios, metrics: { ...passingEvidence.ios.metrics, medianFps: 58.9 } },
  });
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /iOS median FPS/);
});

test("rejects a hand-edited summary that does not match raw-derived metrics", async () => {
  const edited = { ...passingEvidence, ios: { ...passingEvidence.ios,
    metrics: { ...passingEvidence.ios.metrics, medianFps: 60 } } };
  assert.equal((await verifyAgainstRawArtifacts(edited, fixtureRoot)).status, "blocked");
});

test("requires three runs, lifecycle, reduced motion, and owner approval", () => {
  const result = evaluatePhoenixMotionEvidence({ ...passingEvidence,
    approvals: { ...passingEvidence.approvals, ownerAcceptance: null } });
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /owner approval/i);
});

test("fails closed on unknown keys at every nesting level", () => {
  assert.throws(() => parsePhoenixMotionEvidence({ ...passingEvidence, surprise: true }), /unknown key surprise/);
  assert.throws(() => parsePhoenixMotionEvidence({ ...passingEvidence,
    ios: { ...passingEvidence.ios, metrics: { ...passingEvidence.ios.metrics, surprise: 1 } } }), /unknown key surprise/);
});

test("requires the checked-in fixture hash and native/video oracles", () => {
  assert.equal(evaluatePhoenixMotionEvidence({ ...passingEvidence,
    fixture: { ...passingEvidence.fixture, sha256: "0".repeat(64) } }).status, "blocked");
  assert.equal(evaluatePhoenixMotionEvidence({ ...passingEvidence,
    ios: { ...passingEvidence.ios, runs: replaceRun(passingEvidence.ios.runs, 1, { nativeMemoryExport: null }) } }).status, "blocked");
});

test("binds distinct native build IDs, Reduce Motion raw chains, and downloaded owner bytes", async () => {
  assert.notEqual(passingEvidence.build.ios.cfBundleVersion,
    String(passingEvidence.build.android.versionCode));
  assert.equal(passingEvidence.reduceMotion.ios.changedFramesAfterSettle, 0);
  assert.equal(passingEvidence.reduceMotion.android.changedFramesAfterSettle, 0);
  assert.equal((await verifyRuntimeOwnerResponse(passingEvidence, fixtureRoot)).status, "ready");
  assert.equal(evaluatePhoenixMotionEvidence({ ...passingEvidence, build: {
    ...passingEvidence.build,
    ios: { ...passingEvidence.build.ios, cfBundleVersion: "wrong" },
  }}).status, "blocked");
  assert.equal(evaluatePhoenixMotionEvidence({ ...passingEvidence, reduceMotion: {
    ...passingEvidence.reduceMotion, ios: { ...passingEvidence.reduceMotion.ios, settingProof: null },
  }}).status, "blocked");
});
```

The fixture exports contain independently authored timestamps and durations for three runs. The production extractor derives all numeric fields; tests never seed the expected summary through the evaluator. Fixtures carry `evidencePurpose: "test-fixture"`, so the release verifier always rejects them as release proof.

- [ ] **Step 2: Run the test and confirm failure**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionQa.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionMetricExtraction.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the exact evidence schema**

```ts
export interface PhoenixPlatformTrace {
  platform: "ios" | "android";
  hardware: string;
  osVersion: string;
  build: PhoenixRuntimeBuildIdentity;
  fixture: PhoenixFixtureIdentity;
  profiler: "Xcode Instruments Animation Hitches/Time Profiler/Allocations" | "Perfetto System Trace + heapprofd";
  thermalState: string;
  runs: readonly [PhoenixTraceRun, PhoenixTraceRun, PhoenixTraceRun];
  metrics: PhoenixExtractedMetrics;
}

export interface PhoenixRawArtifact {
  provider: "github-draft-release";
  repository: "ApolloDNR/WoofWatcher";
  releaseTag: string;
  releaseTargetCommit: string;
  assetId: number;
  assetName: string;
  downloadUrl: string;
  sha256: string;
  bytes: number;
  mediaType: string;
}

export interface PhoenixTraceRun {
  run: 1 | 2 | 3;
  rawTrace: PhoenixRawArtifact;
  profilerExport: PhoenixRawArtifact;
  nativeMemoryTrace: PhoenixRawArtifact;
  nativeMemoryExport: PhoenixRawArtifact;
  video: PhoenixRawArtifact;
  extractedVideoFrames: PhoenixRawArtifact;
  signedFrameReview: PhoenixRawArtifact;
  lifecycleOperatorRecord: PhoenixRawArtifact;
  extractedMetrics: PhoenixRawArtifact;
  extractor: {
    scriptSha256: string;
    querySha256: readonly string[];
    command: string;
    inputSha256: readonly string[];
    hostOs: string;
    xcodeVersion: string | null;
    traceProcessorVersion: string | null;
  };
}

export interface PhoenixExtractedMetrics {
  medianFps: number;
  percentFramesOver20Ms: number;
  maxFrameMs: number;
  maxJsTaskMs: number;
  nativeDecodedPhoenixTexturePeakBytes: number;
  nativeDecodedPhoenixTextureBytesAfterEviction: number;
  nativeTextureReleaseLatencyMs: number;
  reduceMotionChangedFramesAfterSettle: number;
  offscreenFrameCallbacks: number;
  resumeDisplacementPx: number;
  maxCollapseAlignmentErrorPx: number;
  maxTouchResponseMs: number;
  blankFrames: number;
  maxVisibleAtlasLayers: number;
  maxSilhouetteRootSeparationPx: number;
  maxComplementaryOpacityError: number;
  maxShadowLayers: number;
  motionClockIds: readonly string[];
}

export interface PhoenixRuntimeBuildIdentity {
  artCandidateCommit: string;
  artCandidateTree: string;
  runtimeCommit: string;
  runtimeTree: string;
  easProject: {
    projectId: string;
    fullName: string;
    owner: string;
    slug: "woofwatcher";
    appConfigSha256: string;
    linkCommit: string;
  };
  ios: {
    easBuildId: string;
    bundleIdentifier: "com.pegasusdreamscapes.woofwatcher";
    cfBundleVersion: string;
    cfBundleShortVersionString: string;
    installedArtifactSha256: string;
  };
  android: {
    easBuildId: string;
    applicationId: "com.pegasusdreamscapes.woofwatcher";
    versionCode: number;
    versionName: string;
    installedArtifactSha256: string;
  };
  unchangedArtProof: {
    paths: readonly string[];
    artCandidateBlobSha256: readonly string[];
    runtimeBlobSha256: readonly string[];
    aggregateSha256: string;
  };
}

export interface PhoenixFixtureIdentity {
  id: "phoenix-motion-v1";
  path: "artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-v1.json";
  sha256: string;
  bytes: number;
  storageAggregateSha256: string;
  storageEntrySha256: readonly [
    { key: "woofwatcher.v2.state"; sha256: string; bytes: number },
    { key: "woofwatcher.petAvatarConfig.v1"; sha256: string; bytes: number },
    { key: "woofwatcher.homeWelcomeDismissed.v1"; sha256: string; bytes: 4 },
  ];
}

export interface PhoenixOwnerDeviceEvidence {
  platform: "ios" | "android";
  owner: string;
  hardware: string;
  osVersion: string;
  build: PhoenixRuntimeBuildIdentity;
  capture: PhoenixRawArtifact;
}

export interface PhoenixApprovalEvidence {
  assetApprovalWrapper: PhoenixRawArtifact;
  assetOwnerResponse: PhoenixRawArtifact;
  ownerAcceptance: null | { response: PhoenixRawArtifact; parsedResponse: PhoenixRuntimeOwnerResponse };
}

export interface PhoenixRuntimeOwnerResponse {
  schemaVersion: 1;
  status: "approved";
  owner: string;
  acceptedAt: string;
  ownerResponseRef: string;
  statement: "I approve this exact WoofWatcher Slice 4 release candidate on the identified iOS and Android builds for navigation, Phoenix art, gait, interactions, reaction transitions, Reduce Motion, and device quality.";
  artCandidateCommit: string;
  artCandidateTree: string;
  runtimeCommit: string;
  runtimeTree: string;
  easProject: PhoenixRuntimeBuildIdentity["easProject"];
  fixtureSha256: string;
  fixtureStorageAggregateSha256: string;
  ios: PhoenixRuntimeBuildIdentity["ios"];
  android: PhoenixRuntimeBuildIdentity["android"];
  acceptance: readonly ["navigation", "phoenix-art", "gait", "interactions", "reaction-transitions", "reduce-motion", "device-quality"];
}

export interface PhoenixReduceMotionEvidence {
  platform: "ios" | "android";
  build: PhoenixRuntimeBuildIdentity;
  osSettingEnabled: true;
  runtimeReportedEnabled: true;
  settingProof: PhoenixRawArtifact;
  runtimeProbe: PhoenixRawArtifact;
  settledVideo: PhoenixRawArtifact;
  extractedVideoFrames: PhoenixRawArtifact;
  signedFrameReview: PhoenixRawArtifact;
  settledWindow: { startNs: string; endNs: string; minimumDurationMs: 3000 };
  changedFramesAfterSettle: 0;
}

export interface PhoenixVideoFrameReview {
  schemaVersion: 1;
  videoSha256: string;
  extractedFrameManifestSha256: string;
  stream: { timeBase: string; fpsNumerator: number; fpsDenominator: number; frameCount: number };
  ranges: readonly { marker: string; firstFrame: number; lastFrame: number; reviewedFrames: readonly number[] }[];
  reviewer: string;
  reviewedAt: string;
  signatureRef: string;
  findings: {
    blank: readonly number[];
    doubleSilhouette: readonly number[];
    rootJump: readonly number[];
    secondShadow: readonly number[];
  };
}

export interface PhoenixMotionEvidence {
  schemaVersion: 1;
  evidencePurpose: "release-candidate" | "test-fixture" | "schema-example";
  createdAt: string;
  fixture: PhoenixFixtureIdentity;
  build: PhoenixRuntimeBuildIdentity;
  ownerDevices: readonly [PhoenixOwnerDeviceEvidence, ...PhoenixOwnerDeviceEvidence[]];
  approvals: PhoenixApprovalEvidence;
  reduceMotion: { ios: PhoenixReduceMotionEvidence; android: PhoenixReduceMotionEvidence };
  ios: PhoenixPlatformTrace;
  android: PhoenixPlatformTrace;
}
```

Publish `phoenixMotionEvidence.schema.json` with `additionalProperties:false` for every object, exact tuple sizes, positive byte counts, URL/hash/commit patterns, and release-only purpose. Publish the separate closed `phoenixRuntimeOwnerResponse.schema.json`; it accepts exactly the `PhoenixRuntimeOwnerResponse` above. `parsePhoenixMotionEvidence` applies the same fail-closed key sets at runtime. Gate all numeric/spec requirements and require durable raw trace/export/native-memory/video/frame-review/lifecycle-operator/metric references. Status is ready only when both platforms, all six runs, at least one actual owner device, matching asset-candidate/owner-response artifacts, exact runtime tree, platform-specific EAS/native identifiers, installed artifact hashes, unchanged-art proof, one motion clock, layer counts, two fully linked Reduce Motion records, and real owner acceptance are present. Metrics are projections from raw extraction; the verifier recomputes them and rejects disagreement.

Every iOS trace/capture must bind to `build.ios` and every Android trace/capture to `build.android`; both also bind `build.easProject` byte-for-byte to Task 0's committed UUID/full name/owner/slug/config hash/link commit. Mismatched EAS project, build ID, bundle/application ID, version, or installed binary hash blocks. The verifier obtains platform values from signed native exports and EAS metadata and refuses evidence from another project even when a build UUID is syntactically valid.

For each platform, Reduce Motion evidence is a separate raw chain: an OS Settings capture proving the setting was enabled before launch; runtime `AccessibilityInfo.isReduceMotionEnabled === true` probe with native timestamp/build binding; at least three settled seconds of video; every decoded video-frame hash; and a signed complete frame review. The extractor recomputes `changedFramesAfterSettle` from the frame manifest plus probe channels and requires zero. The value in `PhoenixExtractedMetrics` must equal this independently linked result; standalone `reduce-motion-*.mp4` files or hand-entered zeroes are rejected.

For runtime acceptance, the verifier downloads `ownerAcceptance.response`, validates its bytes/hash/size, rejects unknown keys, parses them through `phoenixRuntimeOwnerResponse.schema.json`, and deep-compares **every** parsed build/art/fixture/owner/time/ref/statement/ordered-acceptance field against evidence and downloaded binary metadata. `parsedResponse` must byte-for-byte project the downloaded object; repository code cannot author/default the owner or statement.

For each marked measurement window, compute FPS as rendered frame count divided by elapsed seconds, over-20-ms percentage from frame durations, and maxima directly from frame/JS rows. Platform `medianFps` is the median of its three run FPS values. Every individual run must have fewer than 1% of frames over 20 ms and no frame/JS task over 50 ms; using a good median to hide a bad run is forbidden. Texture peak, alignment, touch, lifecycle, layer, and clock gates use the worst of the three runs.

Require native decoded Phoenix allocation at or below 20 MiB while active and zero Phoenix-attributed decoded allocations after offscreen/background eviction completes; require release within 1000 ms of the lifecycle marker. Manifest arithmetic is preflight only. Require zero video-reviewed blank/double-silhouette/second-shadow/root-jump frames; one visible atlas in steady state; exactly two only while `phase === "crossfading"`; at most 1 px root separation; complementary opacity-sum error at most 0.01; exactly one shadow/root/accessory stack; and one Phoenix motion clock ID. Probe events may correlate windows but cannot supply decoded bytes, blank-frame, layer, root, or shadow verdicts by themselves.

- [ ] **Step 4: Implement the profiler extraction boundary**

`extract-phoenix-motion-metrics.mjs` has platform-specific inputs and one canonical JSON output. On macOS it invokes `xcrun xctrace export --toc`, finds Animation Hitches, Time Profiler/JavaScript-thread, and Allocations tables by required columns, and exports stable XML/CSV. The iOS native-memory extractor uses actual `CGImage`/ImageIO/IOSurface allocation lifetime rows inside Phoenix load/evict signpost windows, matches allocation sizes to the candidate page dimensions, and computes active peak, post-eviction live bytes, and release latency. On Android, run `trace_processor_shell` with the frame, JS, and `phoenix-bitmap-allocations.sql` queries over the checked-in Perfetto+heapprofd config; the memory result comes from actual `android.graphics.Bitmap`/SkBitmap allocation/free lifetimes in the Phoenix windows. Missing allocation/free rows, unsymbolized required stacks, or ambiguous page-size attribution blocks evidence rather than falling back to manifest/app bytes.

The extractor joins probe CSV only for markers, controller writes, actual native lifecycle, collapse/touch timing, complementary opacity, and clock IDs. Lifecycle rows are accepted only when the closed signed operator record, external video frames, and native `AppState`/platform signposts agree on handshake/order/deadlines; an in-app `set-app-state` row is a hard failure. `extract-phoenix-video-frames.mjs` uses `ffprobe` to freeze stream time base/frame count, then `ffmpeg -vsync 0 -start_number 0` to extract every PNG and emit an ordered SHA-256 manifest. A separately signed `PhoenixVideoFrameReview` names the exact video hash, extracted-frame-manifest hash, all transition/lifecycle/Reduce Motion ranges and every reviewed frame number, reviewer identity/time/signature reference, and four exact finding arrays (`blank`, `double-silhouette`, `root-jump`, `second-shadow`). The validator requires full frame coverage of every range and empty finding arrays; missing frames/reviewer/signature block. It calculates per-run results, three-run median, worst values, and the independently linked Reduce Motion changed-frame result; no CLI flag accepts a claimed fps/latency/count.

Test exact extraction from every fixture, changed input hash failure, missing/duplicate frame or native allocation/free rows, empty windows, non-monotonic timestamps, retained bitmap after eviction, incomplete video-frame coverage, unsigned review, a deliberate blank finding, and a 51 ms frame/JS task. Hash extractors, SQL/config, ffprobe/ffmpeg versions, and every input into each result.

- [ ] **Step 5: Implement the evidence verifier and example**

The script reads the evidence JSON plus `--artifact-dir`, validates durable references, hashes local attachments, expands trace/export archives into a temporary directory without modifying the originals, reruns extraction, calls threshold logic, prints blockers, and exits 1 unless ready. With required release flag `--verify-raw-export`, it also regenerates iOS XML via `xcrun xctrace` and Android CSV via `trace_processor_shell` and byte/row-compares the normalized exports. This release command runs on Task 0's named macOS operator host, which must have both toolchains; a host lacking either may run fixture/unit checks but cannot mark evidence ready. The example contains a complete clearly labeled non-release sample with `evidencePurpose: "schema-example"`; the verifier rejects that purpose as release evidence.

- [ ] **Step 6: Add the focused QA cockpit surface**

Add `qaSurface=phoenix-motion`. The mounted rig consumes only the checked-in fixture below and emits begin/end markers, controller tick/channel writes, actual layer mount/unmount inventory, page readiness/errors, logical page IDs, lifecycle changes, collapse coordinates, and touch-down/visible timestamps. It never emits an authoritative decoded-byte/blank/root/shadow result. Show artifact hashes and native-oracle status separately. Never label app probe, source metadata, manifest arithmetic, or browser capture as native proof.

Commit this exact deterministic typed fixture source and hash both its source bytes and materialized storage bytes in every run:

```json
{
  "schemaVersion": 1,
  "fixtureId": "phoenix-motion-v1",
  "locale": "en-US",
  "timezone": "America/Los_Angeles",
  "clock": "2026-08-05T09:00:00-07:00",
  "sceneSeed": 20260805,
  "dogName": "Phoenix",
  "routine": { "id": "qa-water", "label": "Morning water", "type": "water", "time": "09:30", "owner": "Alex", "note": "Fixture routine" },
  "avatarUpdatedAt": "2026-08-05T16:00:00.000Z",
  "homeWelcomeDismissed": true,
  "home": { "initialScrollY": 0, "initialCollapseProgress": 0, "firstCollapsePending": true },
  "schedule": [
    { "atMs": 0, "event": "marker-start-idle" },
    { "atMs": 2000, "event": "request-semantic-walk" },
    { "atMs": 6000, "event": "request-reaction", "reactionId": "qa-reaction-001", "action": "ear-perk" },
    { "atMs": 8000, "event": "set-home-scroll", "scrollY": 128 },
    { "atMs": 10000, "event": "select-tab", "tab": "log" },
    { "atMs": 11000, "event": "select-tab", "tab": "home" },
    { "atMs": 12500, "event": "request-external-lifecycle", "handshakeId": "qa-lifecycle-001", "backgroundByMs": 12750, "reactivateNotBeforeMs": 13750, "reactivateByMs": 14000 },
    { "atMs": 15000, "event": "marker-end" }
  ]
}
```

`parsePhoenixMotionFixture` validates those exact keys/types and calls the same Task 0 `materializePhoenixFixtureStorage`; there is no abstract `storage` object and no QA-only alternate store. It produces exactly the real keys `woofwatcher.v2.state`, `woofwatcher.petAvatarConfig.v1`, and `woofwatcher.homeWelcomeDismissed.v1` with the same canonical byte rules. The care envelope contains a complete version-1 doc, the literal six-field routine shown above in `doc.routines`, `entries:[]`, and `serverVersion:0`; the avatar value is the complete `createDefaultAvatarConfig("Phoenix","2026-08-05T16:00:00.000Z")`, including actual template `shepherd`, collar/bandana `forest-bandana`, and room/fx slots. Tests parse each materialized string with the production normalizers, assert Home sees Phoenix/routine/avatar/welcome values, compare exact per-key/aggregate hashes, change each source field to prove hash sensitivity, and run `seedPhoenixFixture` against an in-memory AsyncStorage adapter to prove `clear → multiSet → get/read-back` order and exact bytes.

The QA loader freezes local clock/timezone, runs that tested reset/seed/read-back sequence before the warm-up and each measured run, and drives every ordinary scheduled marker automatically. `request-external-lifecycle` is deliberately a handshake, not an in-app attempt to background itself: the loader emits native/probe cue plus haptic, waits for real `AppState` background/active events carrying native monotonic timestamps, and rejects mocked/programmatic state changes. Only the Task 10/11 documented external lifecycle action is allowed; other operator taps alter the schedule and invalidate the run.

- [ ] **Step 7: Write exact native capture and durable-storage protocols**

Document the fixed 15-second fixture: idle → roam/walk → reaction → first-run Home collapse → tab switch → external real-OS background/resume. Specify Release build, one warm-up, three identical measured runs, explicit begin/end/handshake/native-AppState markers, Instruments/Perfetto setup/export commands, Reduce Motion three-second settled capture, and screen recording for blanking/double silhouette/shadow/reset defects.

For physical iPhone 13, use the explicitly evidenced named-operator protocol `ios-physical-home-v1`: at the `qa-lifecycle-001` on-device cue/haptic, the operator performs the real iOS Home gesture by 12,750 ms, leaves WoofWatcher visibly backgrounded through at least 13,750 ms, then taps the WoofWatcher icon from the real SpringBoard by 14,000 ms. The app records only actual native `AppState` transitions/signposts; continuous external screen recording shows the gesture, SpringBoard, and reactivation. The operator authors a closed per-run record named `lifecycle-operator-ios-run-1.json`, `lifecycle-operator-ios-run-2.json`, or `lifecycle-operator-ios-run-3.json` with `{schemaVersion:1,protocol:"ios-physical-home-v1",handshakeId,operator,deviceUdidHash,cueNativeNs,homeGestureNativeNs,springboardVisibleNativeNs,reactivationPressedNativeNs,appActiveNativeNs,videoSha256,probeSha256,signatureRef}`. The validator joins those timestamps to video frames/native signposts, requires ordering/deadlines and a real SpringBoard interval, and rejects simulator/test mocks or a programmatic `AppState` event. This manual physical-device protocol is the sole iOS lifecycle oracle for this plan.

For Pixel 7a, `run-phoenix-android-lifecycle.mjs` requires nonempty `ANDROID_SERIAL`, waits for the same logcat handshake, runs `adb -s "$ANDROID_SERIAL" shell input keyevent KEYCODE_HOME`, verifies the launcher is resumed, and runs `adb -s "$ANDROID_SERIAL" shell monkey -p com.pegasusdreamscapes.woofwatcher -c android.intent.category.LAUNCHER 1` inside the declared window. Preserve command stdout/stderr, monotonic host/device clock correlation, and `dumpsys activity` before/after. Each closed per-run record named `lifecycle-operator-android-run-1.json`, `lifecycle-operator-android-run-2.json`, or `lifecycle-operator-android-run-3.json` has exactly `{schemaVersion:1,protocol:"android-adb-home-v1",handshakeId,operator,deviceSerialHash,cueDeviceNs,homeCommandHostNs,launcherVisibleDeviceNs,reactivationCommandHostNs,appActiveDeviceNs,clockCorrelationSha256,commandLogSha256,dumpsysBeforeSha256,dumpsysHomeSha256,dumpsysAfterSha256,videoSha256,probeSha256,signatureRef}`. The closed lifecycle schema selects the exact field set by protocol, and the validator requires the ADB command log, dumpsys hashes, video, native signposts, correlated deadlines, and application ID to agree. In-app mocks, `AppState` test injection, terminate/relaunch without a background interval, or missing operator/native record cannot satisfy lifecycle evidence.

The durable location is a GitHub draft release in `ApolloDNR/WoofWatcher` named by `phoenix-motion-evidence-${buildSha.slice(0, 12)}` and targeted at the clean build SHA. Upload raw `.trace.zip`, `.perfetto-trace`, exported XML/CSV, native allocation exports, probe CSV, videos/frame manifests/signed reviews, screenshots, extractor JSON, the earlier art-owner-response export, and the separate final runtime-owner-acceptance export. Repository evidence stores every URL/hash/size; large native artifacts are never committed or left only on an operator laptop. If upload access is unavailable, native proof is incomplete and merge remains blocked.

- [ ] **Step 8: Run QA tests and typecheck**

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionQa.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionMetricExtraction.test.ts \
  artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit the proof gate before collecting proof**

```bash
git add artifacts/woofwatcher-mobile/lib/phoenixMotionQa.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionEvidence.schema.json \
  artifacts/woofwatcher-mobile/lib/phoenixNativeMemoryEvidence.ts \
  artifacts/woofwatcher-mobile/lib/phoenixVideoFrameReview.schema.json \
  artifacts/woofwatcher-mobile/lib/phoenixMotionQa.test.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionMetricExtraction.test.ts \
  artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-profiler \
  artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-v1.json \
  artifacts/woofwatcher-mobile/scripts/extract-phoenix-motion-metrics.mjs \
  artifacts/woofwatcher-mobile/scripts/profiler/phoenix-frame-timeline.sql \
  artifacts/woofwatcher-mobile/scripts/profiler/phoenix-js-tasks.sql \
  artifacts/woofwatcher-mobile/scripts/profiler/phoenix-bitmap-allocations.sql \
  artifacts/woofwatcher-mobile/scripts/profiler/phoenix-perfetto.pbtxt \
  artifacts/woofwatcher-mobile/scripts/extract-phoenix-video-frames.mjs \
  artifacts/woofwatcher-mobile/scripts/run-phoenix-android-lifecycle.mjs \
  artifacts/woofwatcher-mobile/lib/phoenixLifecycleOperatorRecord.schema.json \
  artifacts/woofwatcher-mobile/lib/phoenixRuntimeOwnerResponse.schema.json \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.ts \
  artifacts/woofwatcher-mobile/lib/phoenixMotionFixture.test.ts \
  artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-evidence.mjs \
  artifacts/woofwatcher-mobile/app/care-twin-qa.tsx \
  artifacts/woofwatcher-mobile/lib/mobileReleaseQa.ts \
  artifacts/woofwatcher-mobile/lib/mobileReleaseQa.test.ts \
  docs/release/PHOENIX_MOTION_QA.md \
  docs/release/phoenix-motion-evidence.example.json
git commit -m "test(motion): add native Phoenix evidence gate"
```

---

### Task 11: Run Full Verification, Native Traces, and Owner Acceptance

**Files:**
- Create after measured runs: `docs/release/phoenix-motion-evidence/slice-4-release.json`
- Modify only with real results: `docs/release/PHOENIX_MOTION_QA.md`
- Create outside git, then upload durably: six raw native traces, six profiler exports, six native image/bitmap allocation exports, six probe CSVs, six lifecycle-operator records, six videos, six extracted-frame hash manifests, six signed frame-review manifests; two Reduce Motion setting proofs/runtime probes/videos/frame manifests/signed reviews; platform native-build metadata exports; screenshots; extractor JSON; and the externally authored owner-response exports.

**Interfaces:**
- Consumes: all Slice 4 implementation and physical-device trace artifacts.
- Produces: merge-ready evidence file accepted by `verify-phoenix-motion-evidence.mjs`.

- [ ] **Step 1: Run the complete local automated gate on Node 24/pnpm 10.24.0**

```bash
pnpm --filter @workspace/woofwatcher-mobile run verify:phoenix-motion-assets
pnpm --filter @workspace/woofwatcher-mobile run typecheck
pnpm run test:focused
pnpm --filter @workspace/woofwatcher-mobile run smoke:web
pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime
pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview
```

Expected: every command PASS.

- [ ] **Step 2: Inspect the exported Home at required layouts**

Verify 390×844 phone and 1365×700 desktop, scroll beginning over Phoenix, no smoothing or crop jump, and ≤1 px sampled Home-collapse alignment. Repeat with Reduce Motion and confirm zero translated entrances/perpetual effects. Treat this as supplemental evidence only.

- [ ] **Step 3: Freeze a clean implementation candidate, then build that exact SHA**

Use the repository's installable `preview` profile, which produces native Release-mode internal builds without store submission:

```bash
git status --short
pnpm --filter @workspace/woofwatcher-mobile run verify:phoenix-motion-assets
node artifacts/woofwatcher-mobile/scripts/verify-eas-tooling.mjs --expected-version 21.6.0
pnpm --filter @workspace/woofwatcher-mobile exec eas --version
git rev-parse HEAD
git rev-parse HEAD^{tree}
pnpm --filter @workspace/woofwatcher-mobile exec eas build \
  --profile preview --platform ios --non-interactive --json
pnpm --filter @workspace/woofwatcher-mobile exec eas build \
  --profile preview --platform android --non-interactive --json
```

Expected: status is empty and the local CLI, committed app config, read-only doctor, and both build responses all report Task 0's same project UUID/full name. Install those exact artifacts. Record the linked project identity/config hash/link commit, art/runtime trees, both build IDs, native identifiers/versions/installed hashes, and unchanged-art blobs. Any project mismatch blocks before capture; unavailable credentials/membership never trigger project creation or relinking.

- [ ] **Step 4: Capture iPhone 13 / iOS 18.6 traces**

On the named external macOS operator machine, use stable thermal state and one warm-up, reset/load/read-back the hashed fixture, then capture three fixture-driven runs with Xcode Instruments Animation Hitches, Time Profiler, and Allocations/ImageIO lifetime data plus continuous external/native video. The only manual step is the exact `ios-physical-home-v1` handshake in Task 10; author/sign `lifecycle-operator-ios-run-N.json` from captured native/video timestamps. For run 1 execute:

```bash
node artifacts/woofwatcher-mobile/scripts/extract-phoenix-motion-metrics.mjs \
  --platform ios --trace ios-run-1.trace --export-dir ios-run-1-export \
  --native-memory ios-run-1-image-allocations.csv \
  --lifecycle-record lifecycle-operator-ios-run-1.json \
  --probe ios-run-1-probe.csv --fixture artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-v1.json \
  --out ios-run-1-metrics.json
node artifacts/woofwatcher-mobile/scripts/extract-phoenix-video-frames.mjs \
  --video ios-run-1.mp4 --markers ios-run-1-probe.csv \
  --frames-dir ios-run-1-frames --manifest ios-run-1-frames.json
# After the named reviewer authors/signs ios-run-1-frame-review.json:
node artifacts/woofwatcher-mobile/scripts/extract-phoenix-video-frames.mjs \
  --video ios-run-1.mp4 --markers ios-run-1-probe.csv \
  --manifest ios-run-1-frames.json --verify-review ios-run-1-frame-review.json
ditto -c -k --keepParent ios-run-1.trace ios-run-1.trace.zip
ditto -c -k --keepParent ios-run-1-export ios-run-1-export.zip
```

Repeat with run numbers 2 and 3. The script exports actual allocation/free lifetimes and fails if Phoenix page-sized decoded allocations remain after both tab/offscreen and real background eviction markers. It also fails unless lifecycle operator/video/native timestamps match `ios-physical-home-v1`. The named reviewer signs each complete frame review only after inspecting every extracted frame in the marked transition/lifecycle ranges. Preserve all raw/exported/video/frame/review/operator files unchanged after hashing.

- [ ] **Step 5: Capture Pixel 7a / Android 15 traces**

Repeat the same sequence in Perfetto/System Trace with the same data fixture and probe window. Set `ANDROID_SERIAL` to the recorded physical Pixel 7a serial and start `node artifacts/woofwatcher-mobile/scripts/run-phoenix-android-lifecycle.mjs --serial "$ANDROID_SERIAL" --handshake qa-lifecycle-001 --out lifecycle-operator-android-run-1.json` before the run; it waits for the native cue, sends external Home/reactivation commands, captures `dumpsys`/clock correlation, and emits the signed-record input without synthesizing app state. Preserve each raw `.perfetto-trace`, then run:

```bash
trace_processor_shell android-run-1.perfetto-trace \
  -q artifacts/woofwatcher-mobile/scripts/profiler/phoenix-frame-timeline.sql > android-run-1-frames.csv
trace_processor_shell android-run-1.perfetto-trace \
  -q artifacts/woofwatcher-mobile/scripts/profiler/phoenix-js-tasks.sql > android-run-1-js.csv
trace_processor_shell android-run-1.perfetto-trace \
  -q artifacts/woofwatcher-mobile/scripts/profiler/phoenix-bitmap-allocations.sql > android-run-1-bitmap-allocations.csv
node artifacts/woofwatcher-mobile/scripts/extract-phoenix-motion-metrics.mjs \
  --platform android --frames android-run-1-frames.csv --js android-run-1-js.csv \
  --native-memory android-run-1-bitmap-allocations.csv \
  --lifecycle-record lifecycle-operator-android-run-1.json \
  --probe android-run-1-probe.csv --fixture artifacts/woofwatcher-mobile/lib/fixtures/phoenix-motion-v1.json \
  --out android-run-1-metrics.json
node artifacts/woofwatcher-mobile/scripts/extract-phoenix-video-frames.mjs \
  --video android-run-1.mp4 --markers android-run-1-probe.csv \
  --frames-dir android-run-1-frames-png --manifest android-run-1-video-frames.json
# After the named reviewer authors/signs android-run-1-frame-review.json:
node artifacts/woofwatcher-mobile/scripts/extract-phoenix-video-frames.mjs \
  --video android-run-1.mp4 --markers android-run-1-probe.csv \
  --manifest android-run-1-video-frames.json --verify-review android-run-1-frame-review.json
```

Capture with `phoenix-perfetto.pbtxt` so heapprofd allocation/free stacks exist, then repeat with run numbers 2 and 3. Open the exact Release build, not Expo development mode. A probe-reported byte count, mocked AppState row, or mounted-layer count cannot replace native allocation export, signed lifecycle record, or signed video review.

- [ ] **Step 6: Capture Reduce Motion and owner release-candidate device evidence**

On each baseline, enable the real OS Reduce Motion setting before launch, capture the Settings proof, launch the exact bound binary, capture the runtime accessibility probe, then record at least three settled seconds and extract/hash every frame. The named reviewer signs `reduce-motion-{ios,android}-frame-review.json` covering the entire settled range; extraction requires zero sprite/roam/bob/shimmer/parallax/heart/translated-entrance changes. Upload setting proof, probe, video, frame manifest, signed review, and derived metric as the typed `PhoenixReduceMotionEvidence` chain. Run the same visual/reaction/transition/Reduce Motion checklist on each current owner device. Record device/OS/build and any frame, crop, smoothing, or touch defect; package captures/checklist as `owner-device-captures.zip`. Preserve the actual owner response/export separately; repository code may hash/validate but cannot author identity or acceptance.

- [ ] **Step 7: Stop and fix any failed metric**

If any threshold, alignment, texture, lifecycle, Reduce Motion, double-silhouette, second-shadow, blanking, or owner-quality gate fails, do not write ready evidence. Add a failing regression test for the defect, implement the smallest correction in the owning task’s files, rerun all local gates, rebuild Release binaries, and repeat all three native runs on both baselines.

- [ ] **Step 8: Upload raw proof to the durable draft release**

Derive `build_sha` from the exact built commit and `release_tag="phoenix-motion-evidence-${build_sha:0:12}"`. With the repository owner's authorization for external writes, run:

```bash
gh release create "$release_tag" --repo ApolloDNR/WoofWatcher \
  --target "$build_sha" --draft --title "Phoenix motion evidence ${build_sha:0:12}" \
  --notes-file docs/release/PHOENIX_MOTION_QA.md
gh release upload "$release_tag" --repo ApolloDNR/WoofWatcher \
  ios-run-1.trace.zip ios-run-1-export.zip ios-run-1-image-allocations.csv ios-run-1-probe.csv lifecycle-operator-ios-run-1.json ios-run-1.mp4 ios-run-1-frames.json ios-run-1-frame-review.json ios-run-1-metrics.json \
  ios-run-2.trace.zip ios-run-2-export.zip ios-run-2-image-allocations.csv ios-run-2-probe.csv lifecycle-operator-ios-run-2.json ios-run-2.mp4 ios-run-2-frames.json ios-run-2-frame-review.json ios-run-2-metrics.json \
  ios-run-3.trace.zip ios-run-3-export.zip ios-run-3-image-allocations.csv ios-run-3-probe.csv lifecycle-operator-ios-run-3.json ios-run-3.mp4 ios-run-3-frames.json ios-run-3-frame-review.json ios-run-3-metrics.json \
  android-run-1.perfetto-trace android-run-1-frames.csv android-run-1-js.csv android-run-1-bitmap-allocations.csv android-run-1-probe.csv lifecycle-operator-android-run-1.json android-run-1.mp4 android-run-1-video-frames.json android-run-1-frame-review.json android-run-1-metrics.json \
  android-run-2.perfetto-trace android-run-2-frames.csv android-run-2-js.csv android-run-2-bitmap-allocations.csv android-run-2-probe.csv lifecycle-operator-android-run-2.json android-run-2.mp4 android-run-2-video-frames.json android-run-2-frame-review.json android-run-2-metrics.json \
  android-run-3.perfetto-trace android-run-3-frames.csv android-run-3-js.csv android-run-3-bitmap-allocations.csv android-run-3-probe.csv lifecycle-operator-android-run-3.json android-run-3.mp4 android-run-3-video-frames.json android-run-3-frame-review.json android-run-3-metrics.json \
  ios-native-build-info.json android-native-build-info.txt \
  reduce-motion-ios-settings.mp4 reduce-motion-ios-probe.json reduce-motion-ios.mp4 reduce-motion-ios-frames.json reduce-motion-ios-frame-review.json reduce-motion-ios-metrics.json \
  reduce-motion-android-settings.mp4 reduce-motion-android-probe.json reduce-motion-android.mp4 reduce-motion-android-frames.json reduce-motion-android-frame-review.json reduce-motion-android-metrics.json \
  collapse-ios.png collapse-android.png owner-device-captures.zip art-owner-response.json \
  artifacts/woofwatcher-mobile/assets/avatar/phoenix/production/approval.json
```

Hash and size every local file before upload; query the draft release after upload and record each returned asset URL. If upload or URL verification fails, evidence is not durable and status stays blocked.

- [ ] **Step 9: Record real technical evidence and independently verify the expected owner blocker**

Write `slice-4-release.json` with actual numeric results and SHA-256/byte-size references to trace/video attachments, then run:

```bash
evidence_dir="$(mktemp -d)"
gh release download "$release_tag" --repo ApolloDNR/WoofWatcher --dir "$evidence_dir"
node --experimental-strip-types artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-evidence.mjs \
  docs/release/phoenix-motion-evidence/slice-4-release.json \
  --artifact-dir "$evidence_dir" --verify-raw-export
```

Run this on the named Task 0 macOS operator host with `xcrun xctrace` and `trace_processor_shell` available. Expected: every technical/art/build/hash/metric gate passes and the command exits 1 with exactly `owner acceptance missing`; it must report no other blocker.

- [ ] **Step 10: Obtain explicit owner acceptance**

The actual owner reviews the exact runtime release candidate's navigation, Phoenix asset quality, gait, interactions, reaction transitions, Reduce Motion, and real device captures. This is a new response, not Task 3's art approval. Send the closed `phoenixRuntimeOwnerResponse.schema.json` plus the exact build/fixture identity to the owner; the owner authors `runtime-owner-acceptance.json` outside Git with the literal statement and ordered acceptance tuple in `PhoenixRuntimeOwnerResponse`. Validate locally without filling/defaulting any field, upload once without `--clobber`, query the asset, download fresh, hash/size it, and bind only those downloaded parsed bytes into evidence:

```bash
node artifacts/woofwatcher-mobile/scripts/verify-phoenix-motion-evidence.mjs \
  --validate-runtime-owner-response runtime-owner-acceptance.json \
  --expected-evidence docs/release/phoenix-motion-evidence/slice-4-release.json
test "$(gh release view "$release_tag" --repo ApolloDNR/WoofWatcher --json assets \
  --jq '[.assets[].name] | index("runtime-owner-acceptance.json") == null')" = true
gh release upload "$release_tag" --repo ApolloDNR/WoofWatcher runtime-owner-acceptance.json
gh release view "$release_tag" --repo ApolloDNR/WoofWatcher --json tagName,targetCommitish,assets,url \
  > runtime-release-after-owner.json
runtime_owner_dir="$(mktemp -d)"
gh release download "$release_tag" --repo ApolloDNR/WoofWatcher \
  --pattern runtime-owner-acceptance.json --dir "$runtime_owner_dir"
sha256sum "$runtime_owner_dir/runtime-owner-acceptance.json"
wc -c "$runtime_owner_dir/runtime-owner-acceptance.json"
```

Set `approvals.ownerAcceptance.response` from the queried asset URL/hash/size and `parsedResponse` only by parsing the fresh downloaded bytes. The verifier deep-compares owner/ref/time/literal statement, art/runtime commit/tree, fixture source/storage aggregate hashes, both platform EAS IDs, iOS bundle/versions/artifact hash, Android application/version/artifact hash, and the exact ordered seven acceptance items. Download the updated draft release and rerun Step 9; expected output is now `Phoenix motion evidence: READY`. No local script supplies a default owner, approval text, native ID, or acceptance item.

- [ ] **Step 11: Run final repository checks**

```bash
pnpm run test:focused
pnpm run typecheck
git diff --check
git status --short
```

Expected: tests/typecheck/diff PASS; status lists only the intended evidence/doc changes.

- [ ] **Step 12: Commit measured evidence manifest**

```bash
git add docs/release/phoenix-motion-evidence/slice-4-release.json \
  docs/release/PHOENIX_MOTION_QA.md
git commit -m "docs(motion): record Slice 4 native acceptance"
```

---

## Final Definition of Done

- All eleven action strips are independent, approved, normalized, density-correct, hash-locked, and pass the full asset verifier.
- Walk is 12 meaningful poses at 12 fps; every loop and one-shot satisfies its seam/padding/landmark contract.
- `SpriteSheetPlayer` contains no clock and every call site receives a frame from the Phoenix controller or the isolated template clock.
- LivingPhoenixRoom contains no JS visual timers/intervals, secondary gait/bob clock, frame-zero key reset, or duplicate root/shadow/accessory stack.
- Route focus, scene visibility, backgrounding, and Reduce Motion all stop perpetual work and resume deterministically.
- Primary screens have one entrance layer using 0/40/80 ms slots and ≤260 ms completion; touch feedback is visible within 50 ms.
- While active, at most two decoded action slots remain ≤20 MiB at 3×: semantic dwell/walk stay warm, a reaction replaces only the non-current slot, and the pair is restored before roam; no third action texture mounts. Offscreen/background scenes mount no action/fallback pages and native allocation evidence proves their decoded bytes release. Pages remain ≤4096 px.
- Automated, rendered, iOS, Android, accessibility, performance, and owner gates all pass on the same recorded Release build SHA.

## Self-Review Checklist

- Spec coverage: Task 0 freezes post-Slice ownership, slot, seeds, annotation schema, candidate-build policy, and operator availability; Tasks 1–3 cover the complete asset pipeline and genuine approval; Tasks 4–7 cover independent contact math, deconflicted controller types, generic template compatibility, and unified rendering; Tasks 8–9 cover independently driven lifecycle, Reduce Motion, and final-component interaction vocabulary; Tasks 10–11 cover durable raw native proof, reproducible extraction, performance, and real owner acceptance.
- Type consistency: `CareTwinSpriteAction`, `PhoenixActionDefinition`, `PhoenixReactionPlaybackSpec`, `ExternalSpriteAtlas`, `PhoenixMotionSample`, `PhoenixActionRequest`, `PhoenixReactionId`, `PhoenixPhasePolicy`, `PhoenixTextureError`, `PhoenixControllerMachineState`, `PhoenixDriverCompletion`, `PhoenixFrameDriverSnapshot`, `PhoenixMotionController`, `PhoenixFixtureStorageBytes`, `PhoenixRuntimeOwnerResponse`, `PhoenixReduceMotionEvidence`, and `PhoenixMotionEvidence` each have one declared owner and matching consumers; the checked examples use the declared nested field paths, exact millisecond phase math, supported pinned-tool flags, and valid persisted avatar/storage IDs.
- Sequencing: Task 5 commits only pure reducer/driver code; Task 6 then commits the generic stateless renderer and a type-safe compatibility wrapper; only Task 7 imports that renderer into the UI controller/texture pair. The clean art tree precedes EAS builds, later metadata references it, external art approval hashes separate response bytes, the runtime candidate separately proves unchanged art, proof gates precede evidence collection, and final runtime owner acceptance is last.
- Scope: no SDK/router migration, care-domain rewrite, provider work, production deployment, or app-store submission is included.
- Completeness: all eleven action policies, N-slot canvas/lock/chroma/palette/role records, reducer events/error/fallback/phase branches, active-only two-slot residency and eviction epochs, post-Slice owners/bridges, deterministic fixture, fail-closed evidence keys, native memory/video oracles, approval identities, and external blockers are literal; no open marker, anonymous approver, self-hash, arbitrary Phoenix dimension, or unresolved implementation choice remains.
