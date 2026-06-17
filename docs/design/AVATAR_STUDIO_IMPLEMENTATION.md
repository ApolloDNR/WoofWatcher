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

- The Studio uses existing Phoenix mood art as the preview placeholder.
- Final template artwork is not present yet.
- Final dogless rooms and transparent sprite strips are not present yet.
- Live image analysis is not wired yet.
- True animated sprite switching waits on production-safe assets.

## Quality Gate

Before public launch, Avatar Studio needs:

- final Phoenix seed frame
- at least one polished template pack
- dogless room background
- transparent sprite/emote assets
- no duplicate Phoenix rendering
- mobile safe-area QA
- real screenshots from the preview or device
- owner-reviewed scan language
