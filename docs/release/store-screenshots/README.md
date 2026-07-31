# Store Screenshot Pack

Generated from the real production web export. Routines are saved through the
production routine editor and care is logged through Fast Log, so Plan, Today,
Story, Fast Log, and Care Pass all come from one coherent local state. The
capture clock is shifted to 10 AM local so the living rooms, park, and Day Trail
render their daylight art. Captions use the app's Fraunces brand serif.

- `ios-6.9/` - 1290x2796 opaque PNGs. This is an Apple-accepted 6.9" portrait
  size. Upload order: 01 Today, 02 Fast Log, 03 Plan, 04 Story, 05 Pack,
  06 Care Pass.
- `play-phone/` - 1080x1920 opaque PNGs in the recommended 9:16 phone ratio.
- `play-feature-graphic.png` - 1024x500 opaque Google Play feature graphic.
- `play-icon-512.png` - exact 512x512 Google Play high-resolution icon.

The Health screen is intentionally absent from this v1 store set. Its precise
numeric score needs stronger in-product explanation before it is suitable as a
store promise.

Regenerate (one command, no extra dependencies - panels are composed in the
browser, so the pack uses the real brand fonts):

```
EXPO_PUBLIC_BUILD_PROFILE=production pnpm --filter @workspace/woofwatcher-mobile run smoke:web
node docs/release/tools/store-pack.mjs
```

Outputs land in `$STORE_PACK_TMP` (default `/tmp/store-pack`) under
`store-out/ios-6.9/`, `store-out/play-phone/`,
`store-out/play-feature-graphic.png`, and `store-out/play-icon-512.png`.
The generator fails if the capture makes a remote HTTP request. Review every
panel, copy approved files over this directory, then run:

```
node docs/release/tools/validate-store-materials.mjs
```

## Google Play alt text

Paste these in upload order:

1. Phoenix on Today with daylight room art, live care status, and Quick Log.
2. Fast Log showing completed meal, potty, fresh water, and walk entries.
3. Saved daily routines showing care that is done and what comes next.
4. Story timeline turning four real care logs into Phoenix's living day trail.
5. Supplies checklist for food, treats, medicine, walk gear, and travel items.
6. Sitter Care Pass preview summarizing Phoenix's local care record for handoff.

Feature graphic alt text: `Phoenix in her pixel room beside the WoofWatcher name and Real care. Pixel heart.`
