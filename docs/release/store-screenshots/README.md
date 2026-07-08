# Store Screenshot Pack

Generated from the real production web export (EXPO_PUBLIC_BUILD_PROFILE=production),
seeded only through the app's own quick-log flows - every number on screen is real.

- `ios-6.7/` - 1290x2796 PNG, Apple 6.7" requirement (also accepted for 6.9" listings).
  Upload order: 01 Today, 02 Fast Log, 03 Plan, 04 Story, 05 Pack, 06 Health.
- `play-phone/` - 1080x2340 PNG for Google Play phone listings.
- `play-feature-graphic.png` - 1024x500 Google Play feature graphic.

Regenerate: rebuild the production export, serve it (`pnpm --filter
@workspace/woofwatcher-mobile run preview:smoke`), then run the session
scratchpad scripts `store-shots.mjs` and `store-panels.mjs` (kept in
`docs/release/tools/` copies).
