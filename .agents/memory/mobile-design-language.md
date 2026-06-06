---
name: WoofWatcher mobile design language
description: The premium look the WoofWatcher Expo app standardized on — reuse these tokens/components so new screens stay consistent.
---

# WoofWatcher mobile premium design language

New mobile screens should match the home (`app/(tabs)/index.tsx`) and Portrait Studio
(`app/portrait.tsx`). Reuse, don't reinvent.

- Display/heading font: `Fredoka_700Bold` (DISPLAY) and `Fredoka_600SemiBold`
  (DISPLAY_SEMI); body text uses the Inter weights. Loaded in `app/_layout.tsx`.
- Colors via `useColors()` (`hooks/useColors.ts`): warm ivory bg, forest `primary`,
  `sage`, `copper`, `amber`. Cards = `colors.card`, rounded 22–28, soft shadow
  (shadowColor `colors.primary`).
- Illustrated tile icons: `PulseIcon` + `PULSE_COLORS` from `components/PulseIcon.tsx`.
- The living mascot is `components/AnimatedAvatar.tsx` (Reanimated): breathing/bob/tilt
  idle, mood cross-fade across 5 transparent cutouts in `assets/phoenix/cutout/`,
  floating emotes, tap→bounce+bark+haptic, speech bubble. Needs the 5 mood cutouts, so
  it can't be swapped for an arbitrary user photo — keep the photo portrait separate.
- Layout: ScrollView, `paddingHorizontal: 20`, top inset `(web ? 24 : insets.top)+8`,
  bottom padding ~130 (floating blurred tab bar). Mount fade+slide entrance, light haptics.
- Charts: use `react-native-svg` (already installed) for lightweight on-brand sparklines;
  do NOT add chart libraries.

## useColors cast gotcha
`hooks/useColors.ts` casts the colors object to `Record<string, palette>` to pick a
dark palette. It must be `as unknown as Record<...>` because the object also has
`radius: number`, which otherwise fails the TS2352 overlap check.
