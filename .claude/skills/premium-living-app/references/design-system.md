# Design System Enforcement

The system lives in `constants/colors.ts` (light/dark semantic tokens +
`pixelUi` geometry) and is consumed through `hooks/useColors.ts`. The app's
premium feel comes from *enforcement*, not from the tokens existing - the
audits found a strong system weakened everywhere screens bypassed it.

## Color discipline

- Style through `useColors()` tokens. Never hardcode a hex for UI chrome,
  text, or surfaces. The exceptions that are genuinely fine: pixel-art
  asset data (sprite palettes, scene art), translucent white overlays on
  navy stage cards, and web device-frame chrome.
- **The white-on-primary trap** (found ~23 times, all fixed): buttons with
  `backgroundColor: colors.primary` or `colors.forest` must use
  `colors.primaryForeground` for text/icons/spinners. In light mode those
  surfaces are deep forest (white passes); in dark mode they flip to light
  sage `#5E9A6C` and white drops to ~2.3:1 - a WCAG AA failure. The token
  flips with the theme; white does not.
- White on `colors.copper`/`rose`/`destructive`/`blueSignal` is fine -
  those stay saturated in both themes.
- Content on `BoardCard tone="navy"` is light in BOTH themes (the stage is
  a fixed dark world) - cream text there is correct, not a dark-mode bug.
- Dark-mode verification for web renders: export with
  `EXPO_PUBLIC_WEB_COLOR_SCHEME=auto` and render with
  `colorScheme: "dark"` in Playwright. The default web build intentionally
  locks to the light reference board.

## Geometry and type

- Radii come from `colors.pixelUi.radius` (card 20, panel 24, scene 18,
  chip 12, pill 999). `BoardCard` already applies them - use it.
- Type is three families, loaded in `app/_layout.tsx`: Fraunces 700 for
  route titles and the wordmark, Fredoka 600/700 for card headlines and
  friendly labels, Inter (400-800) for body/UI. Pixel style is accent, not
  body copy.
- The Care Sense meter motif (7 chunky pips) is the brand's signature
  graphic. Reuse it (`MeterPip`, mini-pip rows) rather than inventing new
  progress visuals.

## Shared primitives (adopt, don't fork)

`components/board/BoardPrimitives.tsx`:
- `BoardCard` (tones: card/soft/navy; `enter={i}` staggered entrance)
- `BoardActionButton` (minHeight 44, springy press, correct foreground)
- `BoardSegmentTabs` (gliding active pill - measured chips, shared spring)
- `BoardRouteHeader`, `BoardSectionHeader`, `CareRow`, `StatusMeter`,
  `BoardPill` - all carry the press/haptic contract already.

When a screen needs a "new" component, check whether a primitive plus a
prop gets there first. A primitive upgrade landed the segment-pill glide on
every screen at once; that leverage is the point of the system.

## The painted-stage architecture

Scenes (Home room, Story Day Trail, Adventure hero, Health resting scene)
are hand-painted pixel art used as an `ImageBackground`/`Image` stage, with
live layers on top: sprites (`SpriteSheetPlayer` + `CARE_TWIN_SPRITE_MANIFEST`
tracks), data-driven markers, and `DayPhaseWash` (the shared time-of-day
tint + night starfield). Never draw scenery with Views/rects next to
painted art - it reads as programmer art. If new scenery is needed, it is
an art-pipeline request to the owner, not code.

RN-web gotcha: an absolute-fill `Image` needs explicit `width/height:
"100%"` or it renders at natural size (a giant zoomed corner).

## Empty states

Honest and structural: say what will appear, show its shape (placeholder
tiles at the real grid's size/radius, dashed borders, faded `PixelIcon`s),
offer the one action that fills it. Never imagery that could be mistaken
for data. Size placeholders to their *container's* padded width, not the
screen grid math (a card's interior is narrower - the first cut clipped).
