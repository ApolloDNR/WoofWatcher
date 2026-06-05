---
name: WoofWatcher Mobile (Expo) conventions
description: Durable constraints for the Expo mobile app — fonts, expo-web safety, brand, data shapes, home screen
---

# WoofWatcher Mobile

## Fonts
- Only Inter 400/500/600/700 are loaded in `app/_layout.tsx`. Do NOT reference `Inter_800ExtraBold` (or any unloaded weight) — it silently fails to render. Add the weight to `useFonts` first if a heavier weight is genuinely needed.

## expo-web safety
- This Expo app is previewed on web. Gate `useNativeDriver` to native only: `useNativeDriver: Platform.OS !== "web"`. Web crashes/warns otherwise.
- Safe-area `insets.top` is unreliable on web; use a fixed web top inset (e.g. 24) and native insets otherwise.
- "shadow*" and `props.pointerEvents` deprecation warnings are pre-existing/harmless on expo-web.

## Brand
- Palette in `constants/colors.ts`: bg `#F7F5F1`, card `#FFF`, primary `#2E5846`, sage `#3F7D5C`, copper `#BB602D`, amber `#D29A3E`, rose/destructive `#C2603F`, border `#E5E2DC`, foreground `#1F2D27`, mutedForeground `#6F7B72`.
- Brand mark (paw + heart, two-tone green, transparent) lives at `assets/brand/mark.png`; pair it with a wordmark in Inter, don't rely on baked-in logo text.

## Home screen data
- Home is `app/(tabs)/index.tsx`. Status comes from `derivePhoenixStatus(state)` in `lib/phoenixStatus.ts` (mood/energy/counts are deterministic from today's `entries` + `routines`, not random).
- `state.entries[]` (CareContext) are the source for any activity/handoff timeline: each has `type,title,caregiver,occurredAt,...`; sort desc by `occurredAt`. Map `type` → PulseIcon via a local map with a `paw` fallback.
- Tab routes used by home shortcuts: `/plans`, `/log`, `/health`.

## Design history
- Throwaway design comparison routes `app/variant-a.tsx` / `app/variant-b.tsx` (+ Stack.Screens in `_layout.tsx`) were scratch for canvas iframes; they looked near-identical and confused the user. The real, branded premium home lives in `(tabs)/index.tsx`. If cleaning them up, also remove the canvas iframes pointing at `/variant-a` `/variant-b` to avoid 404s.
