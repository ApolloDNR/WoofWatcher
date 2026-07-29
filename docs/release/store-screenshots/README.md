# Store Screenshot Pack

Generated from the real production web export, seeded only through the app's
own Fast Log flow - every number, meter, and trail waypoint on screen is real.
The capture clock is shifted to 10 AM local so the living rooms, the park, and
the Story Day Trail all render their daylight art. Captions are set in the
app's own Fraunces brand serif.

- `ios-6.7/` - 1290x2796 PNG, Apple 6.7" requirement (also accepted for 6.9"
  listings). Upload order: 01 Today (Phoenix out on a walk in the park), 02
  Fast Log, 03 Plan, 04 Story (the living Day Trail with real waypoints),
  05 Pack, 06 Health.
- `play-phone/` - 1080x2340 PNG for Google Play phone listings.
- `play-feature-graphic.png` - 1024x500 Google Play feature graphic.

Regenerate (one command, no extra dependencies - panels are composed in the
browser, so the pack uses the real brand fonts):

```
pnpm --filter @workspace/woofwatcher-mobile run smoke:web
node docs/release/tools/store-pack.mjs
```

Outputs land in `$STORE_PACK_TMP` (default `/tmp/store-pack`) under
`ios-6.7/`, `play-phone/`, and `play-feature-graphic.png`; review each panel,
then copy them over this directory.
