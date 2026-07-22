---
name: WoofWatcher on-fill text contrast
description: Rule for text/icon colors on theme-colored fills; dark theme primary is LIGHT green so white fails
---

Rule: Never hardcode `"#fff"`/`"#FFFFFF"` for text or icons sitting on theme fills (primary, forest, sage, copper, amber, rose, betaShipTone, forest gradients). Use `colors.primaryForeground` (light: cream #F9F4E4, dark: navy #081424).

**Why:** The dark theme's primary/forest/sage/amber are LIGHT colors (e.g. primary #5E9A6C, amber #D8A852), so white text drops to ~2:1 contrast. A full sweep replaced whites across the tab screens plus setup, fastlog, premium, privacy, adventure, +not-found.

**How to apply:** Any new button/pill/badge with a theme-color background gets `colors.primaryForeground` for its label/icon. Prefer inline `color: colors.primaryForeground` at the usage site; keep StyleSheet statics color-free so they can't silently go stale.

Intentional exceptions (white is correct — these surfaces are dark navy in BOTH themes): the Home-tab feedback toast (brandNavy), adventure.tsx hero overlays (rgba(8,26,42,…) over the stage image), privacy.tsx hero gradient/midnight buttons, records.tsx Dog ID BoardCard tone="navy", and `destructiveForeground`.
