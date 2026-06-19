# Dogless Room Assets

PixelLab room backgrounds go here.

Phoenix must not be baked into these images. The app's layered runtime only works cleanly when the room and Phoenix are separate layers.

Target files:

- `phoenix-room-day.png` - live PixelLab dogless room layer.
- `phoenix-room-night.png` - PixelLab final-candidate room layer, normalized from `phoenix-room-night-pixellab-source.png`.
- `phoenix-room-bedtime.png` - PixelLab final-candidate room layer, normalized from `phoenix-room-bedtime-pixellab-source.png`.
- `phoenix-room-health-watch.png` - PixelLab final-candidate room layer, normalized from `phoenix-room-health-watch-pixellab-source.png`.
- `phoenix-room-home-alone.png` - PixelLab final-candidate room layer, cropped and normalized from `phoenix-room-home-alone-pixellab-source.png`.

Rules:

- Match the approved neo-retro pixel room style.
- No UI text inside the art.
- No Phoenix or other dog in the background.
- Keep composition readable on mobile.
- Register approved room layers in `artifacts/woofwatcher-mobile/lib/careTwinAssets.ts`.

Current source/mask used for the live day room:

- `phoenix-room-day-inpaint-source-192.png`
- `phoenix-room-day-inpaint-mask-192.png`
- `phoenix-room-day-pixellab-400x300.png` - raw PixelLab room output.

`phoenix-room-day.png` is the nearest-neighbor 800x600 production version used by the verifier and app runtime.

The 2026-06-19 PixelLab room pass accepted clean dogless night, bedtime,
health-watch, and home-alone outputs and rejected attempts that drifted into
isometric perspective, baked in dogs, included watermark-like marks, or added
visible text. Do not wire PixelLab room output until the center stage is dogless
and clear enough for the animated Phoenix sprite layer.
