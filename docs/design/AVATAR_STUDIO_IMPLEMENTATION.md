# Avatar Studio Implementation

Date: 2026-06-17

## Product Goal

Avatar Studio turns WoofWatcher from a care tracker into a real-life digital pet care twin:

> Create your dog's pixel care twin. Real care changes how they feel in the app.

The launch path is intentionally hybrid:

1. Template-based avatar config first.
2. Scan-assisted suggestions second.
3. Custom AI-generated sprite packs later.

This keeps the app shippable while avoiding the unstable promise that one photo can perfectly generate a consistent animated dog.

## V1 System

Implemented in:

- `artifacts/woofwatcher-mobile/lib/avatarStudio.ts`
- `artifacts/woofwatcher-mobile/context/AvatarContext.tsx`
- `artifacts/woofwatcher-mobile/app/portrait.tsx`

V1 stores `PetAvatarConfig`:

- `templateId`
- `style`
- `coatPrimary`
- `coatSecondary`
- `faceMarkingId`
- `earTypeId`
- `muzzleTypeId`
- `eyeColor`
- `collarId`
- `tagId`
- `bandanaId`
- `accessorySlots`
- `emotePackId`
- `scanAssisted`

The config is saved locally through `AvatarContext` under `woofwatcher.petAvatarConfig.v1`.

Existing custom mood image sets remain supported under `woofwatcher.avatarSet.v1`.

Default preview assets now use the PixelLab Phoenix v2 approved pack in `assets/avatar/phoenix/approved/`, the live layered room renderer, the first Avatar Studio template preview pack, and the first production-scale template base pack in `assets/avatar/templates/`. The older pixel-derived Phoenix pack in `assets/avatar/pixel/` remains fallback/reference only. The PixelLab Candidate D rotations are archived as directional movement exploration only.

## Template Library

The current launch template set:

- Shepherd
- Retriever
- Husky / Spitz
- Bully
- Doodle
- Terrier
- Hound
- Dachshund
- Spaniel
- Toy Breed
- Slender
- Mixed Breed

Each template includes:

- body class
- default ear type
- default muzzle type
- recommended emote pack
- bottom-center animation anchor notes

Each launch template now has a first-pass PixelLab preview thumbnail at:

```text
artifacts/woofwatcher-mobile/assets/avatar/templates/{templateId}/preview.png
```

The app registers those previews in `artifacts/woofwatcher-mobile/lib/avatarTemplateAssets.ts` and renders them in the `/portrait` template picker.

The first production-scale template base stills are live at:

- `artifacts/woofwatcher-mobile/assets/avatar/templates/shepherd/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/husky/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/doodle/base.png`

The app registers base stills in `avatarTemplateAssets.ts`, uses them for the Avatar Studio hero preview when present, and falls back to the template thumbnail or live Phoenix room for templates that do not have base art yet.

## Accessory Slots

Accessories are modeled as equipment slots, not loose stickers:

- head
- face
- neck
- body
- room
- fx

This lets future sprite packs and premium unlocks stay consistent across templates.

## Avatar Studio Flow

The mobile `/portrait` route is now visually and semantically Avatar Studio:

1. Scan
   - Gallery / camera entry points.
   - Mock scan animation.
   - Truthful copy: upload photos help suggest a care twin.

2. Suggested Template
   - Current mock scan suggests the Shepherd template for Phoenix.
   - Detected traits list is owner-reviewed.

3. Customize
   - Template selection.
   - Coat colors.
   - Face markings.
   - Accessories by slot.

4. Emote Preview
   - Happy
   - Calm
   - Excited
   - Bored
   - Hungry
   - Anxious
   - Sleepy
   - Proud
   - Home Alone
   - Not Feeling Well

5. Save Avatar
   - Saves the editable avatar config.
   - Home and More read the saved template identity.

## AI Boundary

Do not claim live AI scan is complete in V1.

Approved copy:

- "Upload photos to help us suggest your dog's pixel care twin."
- "You always approve the match before it becomes the live avatar."
- "True AI scanning plugs in later."

Forbidden copy:

- "Perfectly scan your dog."
- "Instantly generate every animation."
- "AI creates a complete custom sprite pack now."

## Future AI Integration Points

V1.5 can replace `buildMockScanSuggestion` with a provider-backed analysis step that returns:

- template suggestion
- confidence level
- detected traits
- coat palette
- face/ear/muzzle suggestions
- owner-editable `PetAvatarConfig`

V2 can generate custom still pixel art from approved dog photos.

V3 can generate or commission full animation sprite strips, then register them in `careTwinAssets.ts`.

The first production avatar family should match the locked boards:

- `docs/design/reference/woofwatcher-pixel-reference-board-05-neo-retro-digital-pet.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-06-ecosystem-supporting-pages.png`

The v2 family now includes the seated main avatar, sleep/rest avatar, anxious/home-alone avatar, proud/happy avatar, WoofGuide side avatar, badge/logo head crop, full registered Phoenix sprite manifest, first-pass dogless room variants, the 12-template preview thumbnail pack, and a first four-template production base pack. Final illustrated room variants, the remaining template base art, accessory layers, and template-specific emotes/sprites are still needed before the scan/customization story will feel App Store ready.

## Asset Naming

Template assets should eventually follow:

- `assets/avatar/templates/{templateId}/base.png`
- `assets/avatar/templates/{templateId}/preview.png`
- `assets/avatar/templates/{templateId}/emotes/{state}.png`
- `assets/avatar/templates/{templateId}/sprites/{action}-strip.png`

Accessory assets should eventually follow:

- `assets/avatar/accessories/{slot}/{id}.png`

Room assets should eventually follow:

- `assets/avatar/rooms/{roomId}.png`

## Current Limitations

- The Studio uses the PixelLab Phoenix v2 approved pack, live layered room preview, PixelLab template preview thumbnails, and four PixelLab template base stills for current previews.
- First-pass non-Phoenix breed template thumbnails are present, the full 12-template base still pack is present, and every non-shepherd launch template now has file-backed overlay, mood, and preview-strip assets. Shepherd/Phoenix remains the benchmark live pack.
- The dogless day room, first-pass dogless variants, and full registered Phoenix sprite manifest are live; final illustrated room variants still need approval/replacement.
- Live image analysis is not wired yet.
- True layered room sprite switching is live for registered sprite actions through `careTwinAssets.ts`.

## Quality Gate

Before public launch, Avatar Studio needs:

- final Phoenix seed frame. Status: v2 seed exists.
- at least one polished full template pack. Status: the repo now has a full non-shepherd launch-pack set with overlays, moods, and preview strips, plus the benchmark Shepherd/Phoenix live pack; remaining work is native QA and final room illustration.
- dogless room background. Status: day room and first-pass variants exist; final illustrated variants still needed.
- transparent sprite/emote assets. Status: Phoenix v2 still states plus full registered sprite manifest exist.
- no duplicate Phoenix rendering
- mobile safe-area QA
- real screenshots from the preview or device
- owner-reviewed scan language
