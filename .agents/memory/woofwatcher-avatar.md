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

## Locked default art style (Phoenix) — PIXEL / "Neo Retro Digital Pet"

Current locked direction = a FULL PIXEL-ART / retro tamagotchi look across the whole mobile app,
dog INCLUDED. Phoenix is a detailed **16-bit pixel-art** German Shepherd (black-and-tan) in a
signature OLIVE-GREEN cloth BANDANA (never a collar/tag), shown inside a cozy pixel home scene.
The whole UI is pixel chrome: chunky 3px navy borders, hard offset shadows, segmented EXP/stat
bars, pixel hearts, Press Start 2P labels + Pixelify Sans body. This matches the user's uploaded
boards: Option B "Neo Retro Digital Pet" + Option C "Avatar Studio" (`attached_assets/*1781225081158.*`).

**Why:** The user pivoted hard to pixel and was emphatic — "this pixel style, this gametachi, copy
this exactly… perfect UI… ready to go live." IMPORTANT NUANCE: an *earlier* generic/low-quality
blocky pixel dog WAS rejected — the bar is HIGH-FIDELITY detailed pixel art that mirrors their
boards, not crude 8-bit blobs. Quality is the dividing line, not pixel-vs-painted. (This supersedes
the prior "painted, never pixel" lock from earlier in the same session.)

**How to apply:** Keep the same dog + green bandana across every mood for character consistency;
vary only the expression. For pixel scenes prompt "detailed 16-bit pixel art, SNES JRPG style…
crisp blocky pixel edges, no anti-aliasing"; negative-prompt: blurry/smooth/painterly/realistic/3d,
text/letters/name-tag, collar. Render to a temp/public path and visually review before overwriting
bundled `assets/phoenix/phoenix-{mood}.png` (5 moods) + WoofGuide header
`assets/images/phoenix-avatar.png`. Image gen is text-only (no img2img) and rate-limited (429) —
pace calls one at a time with waits. Pixel design system lives in mockup-sandbox
`components/mockups/woofwatcher-pixel/` (PhoenixHome.tsx + pixel.css) before graduating to the app.

## Recreating the boards EXACTLY (the fidelity bar)

When the user says "recreate exactly what these images are," do NOT regenerate/interpret — REUSE the
board's own art. The boards are 1448×1086. Use ImageMagick (`magick … -crop WxH+X+Y +repage
-filter point -resize 200%`) to crop the actual scene art straight out of the board and serve it as
the app image (display with `image-rendering: pixelated`). The big DESKTOP card on each board is the
cleanest/highest-fidelity rendering of a screen's content; crop that.

**Why:** First two pixel attempts were rejected because they invented copy and rearranged elements.
A generated/interpreted scene is the thing that "sucks"; the cropped board art is unimpeachable.

**How to apply (Phoenix Home canonical content — match these, no additions/removals):** speech
bubble = "Morning! / Walk time soon? / I'm ready!" (baked into the cropped garden scene; don't render
a second bubble). STATUS rows in order: MOOD 😊 Happy · ENERGY (green seg bar) · HUNGER (copper seg
bar) · BILE RISK 💧 Low · BOND ❤ 92% (BILE RISK is core to this app — never drop it). NEXT UP =
"Walk with Emma" + green START WALK button. Bottom tabs (5): Home · Log · [center PAW circle] · Guide
· More (center is a PAW, not a +). Exact palette already in `pixel.css`: #0B1424 #C55A2A #6DA36F
#BFE3C4 #A9D4FF #F7F2E8. The 6 board phone screens: Phoenix Home, Quick Log, Alone Time/Health Watch,
Health Watch/Bile Watch, Care Pass, Avatar Studio.
