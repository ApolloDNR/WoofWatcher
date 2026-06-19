# Avatar Template Asset Pack

These are the first PixelLab launch assets for Avatar Studio's template picker and template-preview stage.

Preview pack generated: 2026-06-18
PixelLab source review object: `692b49bd-53dd-4256-a427-dc4dca21853d`
Tag: `woofwatcher-avatar-template-preview-2026-06-18`
Format: transparent PNG, 85x85px.

Template to PixelLab object map:

- `shepherd/preview.png`: `7afe5bc8-8452-4e60-acda-56025dad7cb2`
- `retriever/preview.png`: `31b0491c-637d-4a77-8a8d-8144cb4eebfb`
- `husky/preview.png`: `26cc4384-c269-40f6-8598-ec7af79c8c99`
- `bully/preview.png`: `8a1181e4-75ba-4c05-ad3a-4a402b484cfa`
- `doodle/preview.png`: `95639c70-1314-42c7-ae8c-3abe809892b6`
- `terrier/preview.png`: `6a525c1d-20ed-49e7-bd6e-8d218da207ef`
- `hound/preview.png`: `542a71da-8b6e-41fe-84c3-76ad6a7a0bb2`
- `dachshund/preview.png`: `5e63c845-6ae9-44b9-ba8f-3b41611f4565`
- `spaniel/preview.png`: `32e5dcfd-8b8e-4931-9e70-58637955e784`
- `toy/preview.png`: `0605ba11-08b7-483d-8a08-6ad68a5752f6`
- `slender/preview.png`: `3d5e306e-2cf1-4fd1-99b7-ecfb47f9c8b4`
- `mixed/preview.png`: `29dd78da-57d2-4609-953a-25b1c07ce71d`

Base pack generated: 2026-06-18
PixelLab source review object: `3e5f7877-7382-49de-b3fc-1f74c75631ec`
Tag: `woofwatcher-avatar-template-base-pack-2026-06-18`
Format: transparent PNG, 170x170px.

Template to PixelLab object map:

- `shepherd/base.png`: `4a979556-9f07-4660-b3bf-831fed6030c0`
- `retriever/base.png`: `472ae20c-5dc4-496a-b0e7-7cafe29d147c`
- `husky/base.png`: `f8fed25f-6a1f-46fa-8d5a-5ec17fadd0f7`
- `doodle/base.png`: `f5852e83-c2d1-4630-8e97-6a4cdb02260d`
- `bully/base.png`: `19c0de83-fd9a-4cea-a8c0-719cc6d05c48`
- `terrier/base.png`: `8f45fa96-9f37-44c3-bdf6-a9e8990aad52`
- `hound/base.png`: `611f9723-733d-4636-9c17-31cfc31a16bb`
- `toy/base.png`: `19c35278-7028-4064-882d-715a6b741652`
- `spaniel/base.png`: `b67cf12f-99f7-4038-8f52-e1c9aa3b6575`
- `dachshund/base.png`: `1aea4cf3-8e3e-485a-8ae3-eb5e501ee599`
- `slender/base.png`: `f6e41dfd-c01e-4f3a-904a-480425e8427f`
- `mixed/base.png`: `faf7a705-1eaa-4119-bdae-5156772c5453`

Shepherd accessory + emote overlay pack generated: 2026-06-18
Source basis: Phoenix approved still pack under `assets/avatar/phoenix/approved/`
Format: transparent PNG, 170x170px.

Live shepherd accessory overlays:

- `shepherd/accessories/forest-bandana.png`
- `shepherd/accessories/navy-collar.png`
- `shepherd/accessories/birthday-hat.png`
- `shepherd/accessories/sleepy-mask.png`
- `shepherd/accessories/training-vest.png`
- `shepherd/accessories/cozy-bed.png`
- `shepherd/accessories/heart-sparkles.png`

Live shepherd emote stills:

- `shepherd/emotes/happy.png`
- `shepherd/emotes/calm.png`
- `shepherd/emotes/excited.png`
- `shepherd/emotes/bored.png`
- `shepherd/emotes/hungry.png`
- `shepherd/emotes/anxious.png`
- `shepherd/emotes/sleepy.png`
- `shepherd/emotes/proud.png`
- `shepherd/emotes/home_alone.png`
- `shepherd/emotes/not_feeling_well.png`

Rules:

- Keep previews transparent and character-only.
- Do not bake accessories into template previews.
- Full template packs should later add `base.png`, emotes, and sprite strips under the same template folder.
- `base.png` is the production-scale character still for Avatar Studio preview. It is not a walk/eat/sleep sprite strip.
- Accessory overlays and emote stills should stay slot-compatible with the registered base pose for that template.
- Live-pack status and next-pack priority now belong in `artifacts/woofwatcher-mobile/lib/avatarTemplatePackManifest.ts`. Update that manifest before changing Avatar Studio readiness copy or verifier expectations.

Family-dog promotion generated: 2026-06-19
Source basis: the registered `base.png` family-dog templates plus the repo-native pack generator in `artifacts/woofwatcher-mobile/scripts/generate-template-partial-packs.ps1`.

Retriever, Husky, and Doodle now each include:

- `accessories/` with the full 10-slot launch overlay set
- `emotes/` with the full 10-state mood still set
- `sprites/` with `tail-wag-strip.png`, `ear-perk-strip.png`, `eat-loop-strip.png`, `sleep-loop-strip.png`, `comfort-loop-strip.png`, `celebrate-hop-strip.png`, and `health-watch-strip.png`
