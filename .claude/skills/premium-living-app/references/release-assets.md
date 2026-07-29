# Release Asset Pipeline

Marketing inherits the honesty law: every asset shows the real app with
data seeded through its own UI. Nothing mocked, nothing staged outside the
product.

## Store screenshot pack (one command)

```bash
pnpm --filter @workspace/woofwatcher-mobile run smoke:web
node docs/release/tools/store-pack.mjs
```

What it does (and why): captures at exact store sizes (430x932@3x =
1290x2796 Apple 6.7"; panels re-rendered at 1080x2340 for Play; feature
graphic 1024x500); seeds meal/potty/water/walk through the Fast Log tiles
- logging the walk LAST leaves the app in its real "On a walk now" state,
which gives the hero panel the park scene; clock-shifts to 10 AM via an
injected Date subclass so every scene renders daylight art; composes
caption panels IN THE BROWSER so they use the real Fraunces/Fredoka fonts
(sharp-based composition fell back to DejaVu). Review each panel, then
copy over `docs/release/store-screenshots/` and commit.

## Tour film

The tour script pattern (kept in the session scratchpad; recreate from
this spec if lost): serve the export → branded intro title card
(setContent HTML, viewport meta required, brand fonts loaded from the
export's own ttf assets) → Home hero burst (the living twin; include a
wheel-scroll to film the parallax) → Fast Log with taps ON CAMERA (the
recent list updating live is the product thesis) → Health → Story
(include a segment tap to film the pill glide) → outro card. JPEG frames
(quality ~88 - the bundled ffmpeg decodes only MJPEG from pipes), then:

```bash
cat frames/*.jpg | /opt/pw-browsers/ffmpeg-*/ffmpeg-linux -y -f image2pipe \
  -c:v mjpeg -framerate 12 -i pipe:0 -c:v libvpx -b:v 4M -crf 9 \
  -pix_fmt yuv420p -an tour.webm
```

The encoder is VP8/webm only - fine for web/social/landing embeds. The
actual App Store preview must be captured on a device/simulator by the
owner; the webm is the reference cut.

## Landing page

Built as a self-contained HTML artifact (strict CSP: every asset inlined
as data URIs - video, stills, fonts, icon). It IS the app's design system:
the same tokens as `constants/colors.ts` in both themes, Fraunces/Fredoka
from the app's own font files, the 7-pip Care Sense meter as the signature
motif (scroll-fill dividers), the tour video autoplaying in a phone frame,
real screens as the gallery. Honest copy only - no store claims before
submission ("iOS & Android in the works"), local-first and non-diagnostic
framing preserved. Republish the same file path to keep the same URL.

## PWA / web deploy notes

- `.replit` deploy = `smoke:web` build + static preview server; the mobile
  Expo web export IS the deployed web app.
- `scripts/smoke-web-export.js` post-processes the export: PWA head tags,
  manifest/icon, service-worker registration, and bakes the hashed entry
  bundle into `sw.js`'s precache (cache version = bundle hash). If the
  export pipeline changes, keep this injection path working - offline
  support and installability both live there.
- Store pack, tour, and landing all read from `.expo-smoke` - always
  rebuild it before filming so the footage includes the latest code.
