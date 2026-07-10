# Dogless Room Assets

PixelLab room backgrounds go here.

Phoenix must not be baked into these images. The app's layered runtime only works cleanly when the room and Phoenix are separate layers.

Target files:

- `phoenix-room-day-option-b.png` - active dogless day room layer for Avatar Studio, Adventure, auth, and day decks; now carries the storybook day room (center-cropped 1200x1200 render of `phoenix-room-storybook-day.png`).
- `phoenix-room-day.png` - legacy PixelLab dogless room layer retained for fallback/history.
- `phoenix-room-night.png` - active dogless night deck layer; now carries the storybook night room (1200x900 render of `phoenix-room-storybook-night.png`). The PixelLab-era candidate remains in `phoenix-room-night-pixellab-source.png`.
- `phoenix-room-bedtime.png` - bedtime room layer; now a storybook-family night scene (moonlit window, blanket-ready dog bed). PixelLab-era source retained in `phoenix-room-bedtime-pixellab-source.png`.
- `phoenix-room-health-watch.png` - Health Watch stage layer; now a storybook-family rest nook (daylight window, water bowl, green dog bed lower right for the sleeping sprite). PixelLab-era source retained in `phoenix-room-health-watch-pixellab-source.png`.
- `phoenix-room-home-alone.png` - home-alone room layer; now a storybook-family scene (front door, toys on the rug). PixelLab-era source retained in `phoenix-room-home-alone-pixellab-source.png`.

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

`phoenix-room-day.png` is the nearest-neighbor 800x600 production version retained as the legacy day-room layer.
`pixellab-option-b-room-raw-0f8ea307.png` is the raw 400x400 PixelLab source for the original Option B day room.
`phoenix-room-day-option-b.png` is the 1200x1200 runtime layer used by `careTwinAssets.ts`, Avatar Studio, Adventure, and auth; since the storybook restyle it is rendered from `phoenix-room-storybook-day.png`.

The 2026-06-19 PixelLab room pass accepted clean dogless night, bedtime,
health-watch, and home-alone outputs and rejected attempts that drifted into
isometric perspective, baked in dogs, included watermark-like marks, or added
visible text. Do not wire PixelLab room output until the center stage is dogless
and clear enough for the animated Phoenix sprite layer.
