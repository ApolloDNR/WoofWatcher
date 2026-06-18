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
- `ear-perk-strip.png`: 6 frames, 7 fps, one-shot cue.
- `walk-loop-strip.png`: 10 frames, 10 fps, loop.
- `eat-loop-strip.png`: 8 frames, 7 fps, loop.
- `drink-loop-strip.png`: 8 frames, 7 fps, loop.
- `sleep-loop-strip.png`: 8 frames, 5 fps, loop. Status: live.
- `comfort-loop-strip.png`: 8 frames, 6 fps, loop.
- `celebrate-hop-strip.png`: 8 frames, 9 fps, one-shot reward.
- `health-watch-strip.png`: 8 frames, 5 fps, loop.

After adding assets, register them in:

`artifacts/woofwatcher-mobile/lib/careTwinAssets.ts`

The current live sprite strips are registered alongside
`assets/avatar/rooms/phoenix-room-day.png`.

Do not register additional Phoenix sprite actions until a matching dogless room
layer and normalized strip both exist. That rule prevents duplicate Phoenix
rendering on Home.
