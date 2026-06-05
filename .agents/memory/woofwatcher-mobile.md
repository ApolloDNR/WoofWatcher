---
name: WoofWatcher mobile app structure
description: How the Expo mobile home screen, mood engine, and painted dog art fit together, plus Expo-web gotchas.
---

# WoofWatcher mobile (artifacts/woofwatcher-mobile)

- Expo Router tabs. Data layer is `context/CareContext.tsx` (AsyncStorage key
  `woofwatcher.v1.state`): profile / caregivers / routines / entries / dietProfile.
  `addEntry` appends an entry and persists — quick-logging is just `addEntry`.
- The dog hero is **AI-generated painterly art** (decision: user rejected the
  CSS/SVG dog as looking bad). One PNG per mood in `assets/phoenix/phoenix-{happy,
  excited,calm,anxious,unwell}.png`, generated via Replit's built-in `generateImage`
  (media-generation skill), 3:4. Expo requires **static `require()`** — map mood→image
  in a literal object, never dynamic-require by string.
- Mood/energy/counts are **data-derived** in `lib/phoenixStatus.ts` from today's
  entries + routines (mood precedence unwell>anxious>excited>happy>calm). Seed data
  has a same-day vomit entry, so the default first impression is the "Off day/unwell"
  state — that is correct behaviour, not a bug.
- When picking the "next routine", select the **earliest by clock time**
  (`routineDateMs`), not the first array match — routines are not guaranteed sorted.

## Expo-web gotchas (preview runs on web)
- `Animated` with `useNativeDriver: true` logs a noisy warning on web ("native
  animated module is missing"). Gate it: `useNativeDriver: Platform.OS !== "web"`.
- Web safe-area insets are hard-coded in screens (top ~67, bottom nav ~84/130);
  use `Platform.OS === "web"` branches rather than trusting `useSafeAreaInsets()`.
- Pre-existing TS error in `hooks/useColors.ts` (radius vs index signature cast) is
  scaffold noise — out of scope, not from feature work.

## Previewing the RN home screen on the canvas
- The `mockup-sandbox` is React-web only (no react-native / react-native-web /
  svg / expo deps) — it **cannot render** the Expo home screen. Don't try to
  extract RN into it or hand-code a web approximation.
- Instead, build variant screens as **real Expo routes** (`app/variant-*.tsx`,
  registered in `_layout.tsx` with `headerShown:false`) and embed each route URL
  (`$EXPO_DOMAIN/variant-x`) as a live canvas iframe. Real RN, exact fidelity.
- Heading font: only Inter 400/500/600/700 are loaded in `_layout.tsx`. The
  original home referenced `Inter_800ExtraBold` (silently falls back) — use
  `Inter_700Bold` for headings.
- When refining/duplicating the home screen, preserve the **full 10-item**
  `QUICK_LOG` (incl. `vomit`/`alone`) — dropping items quietly removes one-tap
  logging (caught in review).
- **Canvas iframe gotcha:** do NOT set `artifactKind:"mobile"` on a canvas iframe
  that points at a custom Expo route. The canvas then renders the registered
  mobile *artifact* at its root (the tabs home) and ignores your explicit `url`,
  so every such frame shows the same default screen. Use a plain iframe with just
  `url` + `componentName` (no `artifactKind`, no `componentPath`) to embed a
  specific route.
