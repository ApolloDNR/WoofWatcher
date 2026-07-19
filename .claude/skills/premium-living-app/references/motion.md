# Motion & Game Feel

One vocabulary, defined in `components/motion/GameFeel.tsx`:

- `SPRING.default` (22/260) - snappy UI response: cards, rows, sheets, the
  segment pill.
- `SPRING.pop` (17/420, mass .9) - playful overshoot: paw button, pips,
  celebrations, press-in.
- `SPRING.gentle` (26/170) - calm settles: meters, progress.
- `MOTION_MS` (tap 150 / element 260 / screen 340 / chart 600) for timings.
- Primitives: `PressScale` (squish 0.96 + haptic), `MeterPip` (staggered
  fill pop), `useBounce` (icon pop - the paw AND active tab icons),
  `ProgressFill`, `enterUp(i)` (staggered fade+rise entrance).

Do not write bespoke spring constants in screens. If a scene genuinely
needs a new voice (the room's slow breath), name it and put it beside
SPRING so the vocabulary stays one page.

## Non-negotiables

1. **Reduce Motion is law.** Every `withRepeat` loop, sprite clock,
   ambient interval, and parallax must check `useReducedMotion()` and
   settle to a meaningful static pose (frozen frame, anchor position,
   instant placement). GameFeel primitives are already gated; new motion
   must be too. This is an accessibility requirement Apple reviews for -
   and it was the single biggest gap the motion audit found.
2. **Layout animation runs on the UI thread.** RN `Animated` with
   `useNativeDriver: false` tweens layout on the JS thread - a drop-frame
   risk at sensitive moments. Use Reanimated shared values +
   `useAnimatedStyle` (which CAN animate height/maxHeight on the UI
   thread). Legacy opacity-only mount fades may remain.
3. **Motion presents real state.** An entrance, a fill, a reveal - all
   reflect something true that just happened. Never animate to fake work.

## Haptics (`lib/haptics.ts` - web-safe, error-swallowing)

- `hapticSelect` - segments, tabs, list rows, headers, toggles, waypoints.
- `hapticLight` - starting an action (quick-log tiles, primary buttons).
- `hapticSuccess` - a care moment saved, a milestone.
- Pair haptics with a visual response (bounce, press-scale) - navigation
  that buzzes but doesn't move feels broken, and vice versa.

## Patterns proven in this repo

- **Gliding segment pill**: measure chips `onLayout`, one absolute pill
  glides `withSpring(SPRING.default)`; active chip paints its own fill
  until first measurement so nothing flashes unstyled; instant under
  Reduce Motion.
- **Scroll parallax, gap-free**: `useAnimatedScrollHandler` → shared
  scrollY; effect engages only after the element's top passes the viewport
  top (`progress = clamp((scrollY - exitStart)/height)`), so the seam the
  translation opens is never on screen; exitStart measured from layout so
  content folding above keeps it accurate; zero transform at rest.
- **State-driven side effects**: never call network/persist functions from
  inside a setState updater (render-phase side effects double-fire under
  StrictMode, and deferred updaters silently skip captured variables).
  Compute from the eagerly-chained ref, set state functionally, then run
  the side effect.
- **Sprite playback**: `SpriteSheetPlayer` with tracks from
  `CARE_TWIN_SPRITE_MANIFEST` - a UI-thread frame clock; `playing={false}`
  or Reduce Motion holds a frame. Choose action by state (walk-loop when
  the day has stops, idle-breathe at rest, sleep-loop at night rest).

## Jank checklist before shipping motion

- No `setState` on a timer driving a large component unless quantized and
  justified (the room's ambient stepper is the deliberate exception).
- No unbounded loops without cleanup + Reduce Motion gate.
- Screenshot-verify the settled state AND (for anything that moves on
  interaction) capture a mid-flight frame to prove it actually animates -
  transforms can silently no-op.
