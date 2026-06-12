---
name: WoofWatcher living avatar
description: How the WoofWatcher mobile companion avatar must behave and where its emotion images come from
---

# WoofWatcher living avatar

The dog avatar must stay **STILL** — no idle bob/breathe/tilt/sway/floating motion on the
dog itself. Emotion changes are shown by **cross-fading the whole scene image** (opacity only).
Only the ambient layer animates: drifting light motes + a time-of-day gradient tint. Tap is the
only dog reaction allowed (haptic + speech bubble + a single one-shot pop), never idle motion.

**Why:** The user explicitly and repeatedly rejected the earlier animated avatar (it
"floated"/bobbed). Re-introducing any idle dog motion is a regression that has caused rejected work.

**How to apply:** Avatar lives in `components/AnimatedAvatar.tsx`. Mood→image resolves through
`context/AvatarContext.tsx#getAvatarSource(mood)`: returns the user's generated per-mood image if
present, else bundled `assets/phoenix/phoenix-{mood}.png` (full scenes, backgrounds baked in).
A photo in the Avatar Studio (`app/portrait.tsx`) calls `POST /api/avatar-emotions`
(`artifacts/api-server/src/routes/avatar.ts`), which generates the full mood set in parallel and
returns partial results + per-mood errors. Generated images are written to FileSystem and the URIs
persisted in AsyncStorage; old files are deleted on re-save/revert. Use `getAvatarSource` for ANY
place that shows the dog so the custom avatar appears everywhere. Scope is MOBILE-ONLY; do not edit
the web artifact.

## Locked default art style (Phoenix)

Default Phoenix images = warm SEMI-REALISTIC PAINTED German Shepherd (black-and-tan) wearing a
signature OLIVE-GREEN cloth BANDANA (never a collar/tag), cozy softly-blurred indoor home scene,
children's-book painterly shading. NOT a pixel/8-bit sprite. This matches the user's repeatedly-
uploaded reference boards (Option B "Neo Retro Digital Pet" home + Option C "Avatar Studio").

**Why:** The user rejected a generic blocky pixel dog and course-corrected several times — "copy
exactly this art style… more like what I've been uploading." The pixel/retro feel belongs to the UI
chrome (HUD, chips), NOT to the dog likeness, which must stay painted and recognizable.

**How to apply:** When regenerating defaults, keep the same dog + green bandana across every mood for
character consistency; vary only the expression. Negative-prompt: text/letters/name-tag, collar,
pixelated/8-bit. Generate to a temp dir and visually review before overwriting bundled
`assets/phoenix/phoenix-{mood}.png` (5 moods) and the WoofGuide header `assets/images/phoenix-avatar.png`
(square head-and-shoulders crop). Image gen is text-only (no img2img) and rate-limited (429) — pace
calls one at a time with waits.
