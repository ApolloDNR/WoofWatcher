---
name: WoofWatcher mobile design language
description: Durable design decisions for the WoofWatcher Expo app so new screens stay consistent (not a file map — grep the code for specifics).
---

# WoofWatcher mobile premium design language

Decisions a future screen should honor (find exact tokens/components via `useColors()`,
`PulseIcon`, and `AnimatedAvatar` in the code):

- Two type registers: a rounded friendly display face for headings + Inter for body. Keep
  headings on the display face — don't mix in a third family.
- Warm ivory background, forest/sage/copper/amber accents. Cards are rounded (~22–28) with
  a soft shadow tinted by the primary color, not black.
- Charts use `react-native-svg` only — do NOT add a charting library for simple sparklines.
- The living mascot reacts to mood via 5 transparent cutouts; it is NOT a generic photo
  slot. Keep the user's uploaded photo portrait as a separate feature from the mascot.

## useColors cast gotcha
The colors object mixes palettes with a numeric `radius`, so selecting a dark palette
needs `as unknown as Record<...>` (a plain `as` fails TS2352's overlap check).
