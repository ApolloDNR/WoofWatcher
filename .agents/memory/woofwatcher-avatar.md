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

## Locked default art style (Phoenix) — "PIXEL CHARM MEETS MODERN POLISH"

The board's OWN design principle is the lock: **clean modern app UI + pixel-art ONLY in the pet
scene and small content icons.** It is NOT a fully-pixelated tamagotchi chrome. The UI shell is
clean and smooth: rounded cards (~18px) with soft shadows + thin tan borders, **Baloo 2** rounded
sans for all body/values/nav labels (Happy, Low, 92%, Walk with Emma, Home/Log/Guide/More), and
**Silkscreen** pixel-caps ONLY for uppercase section labels + the header (PHOENIX HOME / MOOD /
ENERGY …). Navigation = a clean navy rounded bar with **smooth SVG line icons** (house/list/book/
hamburger) + a raised white circle holding a paw — NOT pixel bitmaps. Pixel art appears in exactly
two places: the hero pet SCENE and the little STATUS/Quick-Log content icons.
Phoenix himself = detailed **16-bit pixel-art** German Shepherd (black-and-tan) in an OLIVE-GREEN
cloth BANDANA (never a collar/tag), in a cozy INDOOR room scene.

**Why:** The user rejected a FULL-pixel build of Phoenix Home TWICE. Decisive reason: "the
navigation can be exactly like the images i attached, NOT pixelated," plus scene wrong (wanted
indoor, not garden) and "colors or fonts are off." Press Start 2P everywhere + hand-drawn bitmap
icons + chunky 3px hard-shadow borders = the rejected look. The boards read as a polished modern
app whose *charm* is the pixel pet, exactly per the board's own left-panel principle "Retro
Delight: pixel charm meets modern polish." (Supersedes the earlier "full pixel chrome" lock AND
the older "painted, never pixel" lock.) An earlier low-quality blocky dog was also rejected — the
bar is high-fidelity, not crude 8-bit.

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
-filter point -resize 300%`) to crop straight out of the board: (1) the **phone #1 indoor scene**
(German Shepherd in a cozy room — window, plants, side table, toy balls — with the "I'm ready! 🐾"
bubble already baked in) → serve as the hero image; (2) the board's **ICON LIBRARY PREVIEW** grid
(Home/Walk/Food/Potty/Training/Health/Bile/AloneTime/Guide/Studio) + the smiley/lightning from the
desktop STATUS panel → crop each ~36px box and serve as the small content icons. Display these with
`image-rendering: auto` (clean downscale), NOT pixelated. Assets live in mockup-sandbox
`public/images/` (`phoenix-indoor.png`) and `public/images/icons/*.png`.

**Why:** Pixel attempts were rejected for inventing copy/scene. Cropped board art is unimpeachable.
The INDOOR room scene + "I'm ready!" bubble come from phone #1 — the GARDEN desktop scene and the
"Morning!"/"Walk time soon?" bubbles are the WRONG ones (explicitly corrected).

**How to apply (Phoenix Home canonical content — match these, no additions/removals):** header
"PHOENIX HOME" (Silkscreen, centered, ← back + ⊡ expand). STATUS rows in order: MOOD smiley + mini
green bar … "Happy" (right) · ENERGY green seg bar · HUNGER copper seg bar · BILE RISK 💧 "Low" ·
BOND green bar + ❤ + "92%" (BILE RISK is core to this app — never drop it). NEXT UP = "Walk with
Emma" + "In 1h 35m · 8:30 AM" + copper START WALK button. Bottom nav (5, clean line icons): Home ·
Log · [center raised white circle w/ PAW] · Guide · More (center is a PAW, not a +). Palette in
`pixel.css`: bg #EFE7D6, card #FBF6EC, ink #15233C, copper #C55A2A, sage #6DA36F, bile #5AA0DC.
The board has 6 phone screens: Phoenix Home, Quick Log, Alone Time/Health Watch, Bile Watch, Care
Pass, Avatar Studio.
