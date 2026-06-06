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
