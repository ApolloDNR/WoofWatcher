# Phoenix Care Twin Sprite Assets

Put final transparent Phoenix sprite strips in this folder.

Each strip must use:

- Transparent PNG.
- 256px frame slots.
- Bottom-center anchor.
- Same Phoenix silhouette, palette, bandana, and proportions.
- No scenery, labels, poster layout, or baked background.

Required files:

- `idle-breathe-strip.png`: 8 frames, 6 fps, loop. Status: live.
- `tail-wag-strip.png`: 8 frames, 8 fps, loop. Status: live.
- `ear-perk-strip.png`: 6 frames, 7 fps, one-shot cue. Status: live.
- `walk-loop-strip.png`: 10 frames, 10 fps, loop. Status: live from v2 standing walk source.
- `eat-loop-strip.png`: 8 frames, 7 fps, loop. Status: live.
- `drink-loop-strip.png`: 8 frames, 7 fps, loop. Status: live.
- `sleep-loop-strip.png`: 8 frames, 5 fps, loop. Status: live.
- `comfort-loop-strip.png`: 8 frames, 6 fps, loop. Status: live.
- `celebrate-hop-strip.png`: 8 frames, 9 fps, one-shot reward. Status: live.
- `health-watch-strip.png`: 8 frames, 5 fps, loop. Status: live.
- `pixellab-idle-south-strip.png`: 8 frames, PixelLab template `idle`, south-facing seed strip from character `f0c6169b-88c0-4428-9089-31c0565c4129`. Status: local production seed, not promoted over the approved seated Home sprite yet.
- `pixellab-walk-south-strip.png`: 8 frames, PixelLab template `walk-8-frames`, south-facing seed strip from character `f0c6169b-88c0-4428-9089-31c0565c4129`. Status: local production seed, not promoted over the current walk runtime until size/anchor are approved in-device.

After adding assets, register them in:

`artifacts/woofwatcher-mobile/lib/careTwinAssets.ts`

The current live sprite strips are registered alongside dogless room variants in
`assets/avatar/rooms/`.

Do not register additional Phoenix sprite actions until a matching dogless room
layer and normalized strip both exist. That rule prevents duplicate Phoenix
rendering on Home.
