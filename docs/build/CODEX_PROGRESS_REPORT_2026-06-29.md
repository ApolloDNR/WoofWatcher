# Codex Progress Report - 2026-06-29

## Avatar Studio Sprite-First Pixel Stage

Completed a focused Avatar Studio polish slice to make the care twin read more
like a game sprite and less like a softened portrait card.

What changed:

- Live PixelLab template packs now stay animated for every Avatar Studio mood
  preview. Hungry, anxious, sleepy, home-alone, and not-feeling-well states use
  the idle sprite loop instead of falling back to still art.
- The Avatar Studio hero now renders a dedicated
  `avatar-studio-pixel-sprite-viewport` when a live pack exists.
- The hidden still dog layer behind the sprite was removed for live previews.
- The hero sprite stage uses a 256px frame to match the registered sprite-strip
  slot size.
- The live preview badge now reads `PIXELLAB SPRITE`.
- The saved hero copy names the live PixelLab sprite rig without claiming live
  AI scanning.

Verification:

- Red test: mobile readiness failed on the missing sprite viewport.
- Green focused tests: Avatar Studio/mobile readiness, avatar preview model, and
  Avatar Studio tests passed 109/109.
- Full focused behavior suite passed 459/459.
- Root TypeScript passed.
- Mobile TypeScript passed.
- PixelLab asset verification passed: `ok=149 missing=0 invalid=0`.
- Expo web export passed to `.expo-smoke` with 219 assets / 223 files.
- Preview route smoke passed for `/`, `/portrait`,
  `/log?type=meal&detail=1&intent=smoke`, `/health?tab=health`, and `/more`.

Known limits:

- Native iOS/Android device QA is still required for sprite crop, gait cadence,
  safe area, and tap feel.
- Full emotion-specific sprite strips for every breed template are not complete;
  the current launch-safe behavior keeps live templates animated with idle/walk
  loops plus mood HUD/readout context.
- Provider-backed sync, storage, WoofGuide AI, payments, push, app-store
  accounts, legal/privacy/support review, and Apollo launch sign-off remain
  required before public launch.

## Home Care Twin Avatar Runtime

Completed the follow-up runtime slice that connects Avatar Studio choices back
to the main Phoenix Home room.

What changed:

- Added `avatarRoomRuntime.ts` to derive Home room sprites and accessory layers
  from the saved Avatar Studio config.
- Shepherd/Phoenix keeps the approved Option B action sprite pack while gaining
  fitted Avatar Studio overlays and underlays such as bandana, sparkles, and
  room layers.
- Non-Shepherd launch templates now use their live PixelLab template idle/walk
  sprite packs in Home instead of borrowing the Phoenix action family.
- `LivingPhoenixRoom` accepts `avatarConfig`, renders runtime underlay/overlay
  layers, and exposes distinct runtime test IDs for template sprite players.
- Phoenix Home passes the saved avatar config into the living room; Avatar
  Studio passes the draft config into its preview so customization feedback
  stays connected.

Verification:

- Mobile readiness passed 94/94 after adding Home/runtime guards.
- Full local behavior/readiness suite passed 461/461.
- Root TypeScript passed.
- Mobile TypeScript passed.
- PixelLab asset verification passed: `ok=149 missing=0 invalid=0`.
- Expo web export passed to `.expo-smoke` with 223 files.
- Preview route smoke passed for `/`, `/portrait`,
  `/log?type=meal&detail=1&intent=smoke`, `/health?tab=health`, and `/more`.
- `git diff --check` passed with expected Windows CRLF warnings only.

Known limits:

- Native iOS/Android device QA is still required for crop, gait, tap feel, and
  safe-area review.
- Accessory/emote overlays are production-ready for Shepherd/Phoenix first; the
  remaining launch templates still need full overlay/emote production packs.
- The current runtime is local-first and asset-backed. It does not claim live
  AI avatar generation, cloud sync, provider storage, or store approval.

## Home Live Twin HUD

Completed a small Home polish pass so the room itself visibly reflects the
care-twin runtime that Avatar Studio now controls.

What changed:

- The top-left room HUD now shows `PHOENIX TWIN` on Home and `STUDIO RIG` in
  Studio previews.
- The HUD detail line comes from the active Avatar Studio runtime and names the
  selected template plus fitted add-on count when accessories are active.
- The live chip has bounded width and clipped detail text so it remains stable
  on phone-sized screens.
- Mobile readiness now guards the runtime title/detail contract instead of the
  old static `PHOENIX ROOM` label.

Verification:

- Mobile readiness passed 94/94.
- Full local behavior/readiness suite passed 461/461.
- Root TypeScript passed.
- Mobile TypeScript passed.
- PixelLab asset verification passed: `ok=149 missing=0 invalid=0`.
- Expo web export passed to `.expo-smoke` with 223 files.
- Preview route smoke passed for `/`, `/portrait`,
  `/log?type=meal&detail=1&intent=smoke`, `/health?tab=health`, and `/more`.

## Home Care Twin Studio Long Press

Completed the next tactile care-twin interaction pass on Phoenix Home.

What changed:

- The main `LivingPhoenixRoom` dog press target now supports both tap and
  long-press behavior.
- A normal tap still plays the care-twin reaction and toast feedback.
- A long press opens Avatar Studio through the same `openAvatarStudio` route
  handler as the visible Studio button, so the main dog now behaves like an
  interactive game object instead of a static preview image.
- The Home room exposes an accessibility hint explaining both actions:
  tap for a care-twin reaction, long press to open Avatar Studio.
- Mobile readiness now guards the `onLongPress` prop, the shared Home route
  handler, and the Home-to-Studio interaction contract.

Verification:

- Mobile readiness passed 94/94.
- Full local behavior/readiness suite passed 461/461.
- Root TypeScript passed.
- Mobile TypeScript passed.
- PixelLab asset verification passed: `ok=149 missing=0 invalid=0`.
- Expo web export passed to `.expo-smoke` with 219 assets / 223 files after
  temporarily adding the bundled Node folder to `PATH` for the export script.
- Preview route smoke passed for `/`, `/portrait`,
  `/log?type=meal&detail=1&intent=smoke`, `/health?tab=health`, and `/more`.
- `git diff --check` passed with expected Windows CRLF warnings only.

Known limits:

- This improves app feel and discoverability, but native iOS/Android device QA
  is still required to approve long-press timing, haptics, sprite crop, and
  gait feel.
- The interaction remains local-first and asset-backed. It does not claim live
  AI avatar generation, cloud sync, provider storage, or store approval.

## Native QA Long-Press Coverage

Completed the follow-up release-QA hardening pass for the Home long-press
interaction.

What changed:

- `MOBILE_RELEASE_QA_SURFACES` now explicitly requires Phoenix Home device
  testers to verify the long-press Studio handoff on the main dog target.
- The Phoenix Home QA surface now names the long-press Studio handoff in its
  device prompt, verification steps, pass criteria, failure escalation, and
  required evidence.
- The Owner Preview Core Loop route checklist now asks testers to confirm
  Home's long-press-to-Studio path alongside status, next care, quick actions,
  and floating paw navigation.
- The focused QA route `/care-twin-qa?qaSurface=phoenix-home` remains routable
  for targeted native proof capture.

Verification:

- Red test: `mobileReleaseQa.test.ts` first failed because Phoenix Home QA did
  not mention the long-press Studio handoff.
- Green focused test: `mobileReleaseQa.test.ts` passed 10/10.
- Full local behavior/readiness suite passed 462/462.
- Root TypeScript passed.
- Mobile TypeScript passed.
- Expo web export passed to `.expo-smoke` with 219 assets / 223 files.
- Preview route smoke passed for `/care-twin-qa?qaSurface=phoenix-home`, `/`,
  and `/portrait`.

Known limits:

- This prepares the native QA flow; it does not replace actual iOS/Android
  long-press, haptics, crop, and gait proof.
