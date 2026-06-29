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
