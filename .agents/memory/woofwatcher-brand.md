---
name: WoofWatcher mobile brand
description: The "Premium Playful" brand identity for the WoofWatcher MOBILE app and the logo's non-obvious SVG construction
---

# WoofWatcher mobile brand

Palette: navy `#1B3A5B`, copper `#BB602D`, forest primary `#2E5846`, ivory/cream bg.
Wordmark uses the Fraunces serif ("Woof" navy + "Watcher" copper). Tokens live in
`constants/colors.ts`; the logo lives in `components/brand/WoofWatcherLogo.tsx`.

**Logo construction (non-obvious):** the husky head was traced from the source PNG with
`potrace`, which tight-crops the viewBox to the head outline only. The copper heart sits
*below the chin*, so the mark's SVG viewBox is deliberately extended taller than the trace
(height ~632 vs trace's ~476) to give the heart its own space under the head. If you re-trace
the dog, you must re-extend the viewBox and re-place the heart, or the heart clips away.

**Why:** an earlier version placed the heart inside the tight trace viewBox and it was clipped
off-screen.

**How to apply:** scope is MOBILE-ONLY (`artifacts/woofwatcher-mobile`). Never touch the web
artifact (`artifacts/woofwatcher`). App icon + splash are generated from the mark into
`assets/images/{app-icon,splash-icon}.png` and wired in `app.json` (light UI, cream splash bg).
