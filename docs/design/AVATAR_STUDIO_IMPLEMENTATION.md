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

Default preview assets now use the PixelLab Phoenix v2 approved pack in `assets/avatar/phoenix/approved/`, the live layered room renderer, the first Avatar Studio template preview pack, the full first-pass production-scale template base pack in `assets/avatar/templates/`, and the Phoenix/Shepherd emote still pack in `assets/avatar/phoenix/approved/emotes/`. The main Avatar Studio hero now uses `LivingPhoenixRoom` with `presentation="studio"` so it keeps one living care twin without the Home-specific HUD. Template base stills and emotes support the ID card, template picker, mood grid, and future sprite-family previews. The older pixel-derived Phoenix pack in `assets/avatar/pixel/` remains fallback/reference only. The PixelLab Candidate D rotations are archived as directional movement exploration only.

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

The full first-pass production-scale template base still set is live at:

- `artifacts/woofwatcher-mobile/assets/avatar/templates/shepherd/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/retriever/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/husky/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/bully/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/doodle/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/terrier/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/hound/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/dachshund/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/spaniel/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/toy/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/slender/base.png`
- `artifacts/woofwatcher-mobile/assets/avatar/templates/mixed/base.png`

The app registers base stills in `avatarTemplateAssets.ts`, uses them for the Avatar Studio ID card, template picker, and fallback/reference previews, and keeps the live room as the primary hero experience.

## Phoenix Emote Pack

The first production emote pack is live for the Phoenix/Shepherd identity:

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

Each state is a transparent 170x170 PNG under:

```text
artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/emotes/
```

The app registers the pack in `artifacts/woofwatcher-mobile/lib/avatarEmoteAssets.ts`. The `/portrait` Mood set now uses those real image assets instead of tinting the same head crop; the live room remains the main hero surface while the selected mood feeds the Studio copy and future animation handoff.

## Accessory Inventory Pack

The first accessory pack is live as transparent 85x85 PixelLab inventory art under:

```text
artifacts/woofwatcher-mobile/assets/avatar/accessories/
```

The live pack includes:

- forest bandana
- navy collar
- copper collar
- heart tag
- trail bandana
- birthday hat
- sleepy mask
- training vest
- cozy bed
- heart sparkles

The app registers the pack in `artifacts/woofwatcher-mobile/lib/avatarAccessoryAssets.ts`. The `/portrait` Customize tab now renders the real accessory art instead of color-dot placeholders and treats taps as slot toggles so the customization flow feels like a real game inventory.

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
   - Tapping a mood previews the actual Phoenix emote in the mood grid and prepares the state contract for future hero animation switching.

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

The v2 family now includes the seated main avatar, sleep/rest avatar, anxious/home-alone avatar, proud/happy avatar, WoofGuide side avatar, badge/logo head crop, full registered Phoenix sprite manifest, first-pass dogless room variants, the 12-template preview thumbnail pack, the full 12-template production base still pack, and a 10-state Phoenix/Shepherd emote still pack. Final illustrated room variants, accessory layers, and non-Phoenix template-specific emotes/sprites are still needed before the scan/customization story will feel App Store ready.

The v2 accessory inventory now includes the first 10 transparent PixelLab accessory icons. True overlay-aligned costume/accessory layers are still needed before accessories can sit perfectly on every avatar body type during live animation.

The 2026-06-18 subscription seed pass also produced two additional PixelLab animation strips from Candidate D for reference and future movement testing:

- `assets/avatar/phoenix/pixellab-idle-south-strip.png`
- `assets/avatar/phoenix/pixellab-walk-south-strip.png`

These are verified production seed strips, but they are not promoted above the current approved seated Phoenix Home sprite family until Apollo approves their phone-size proportions and anchor.

## Asset Naming

Template assets should eventually follow:

- `assets/avatar/templates/{templateId}/base.png`
- `assets/avatar/templates/{templateId}/preview.png`
- `assets/avatar/templates/{templateId}/emotes/{state}.png`
- `assets/avatar/templates/{templateId}/sprites/{action}-strip.png`

Accessory assets should eventually follow:

- `assets/avatar/accessories/{id}.png` for current 85x85 inventory icons.
- `assets/avatar/accessories/overlays/{templateOrBodyClass}/{id}.png` for future 170x170 bottom-center overlay layers.

Room assets should eventually follow:

- `assets/avatar/rooms/{roomId}.png`

## Current Limitations

- The Studio uses the PixelLab Phoenix v2 approved pack, a cleaned live layered room preview, PixelLab template preview thumbnails, all 12 PixelLab template base stills, the Phoenix/Shepherd emote pack, and crisp web pixel rendering for current previews.
- The Customize tab uses the 10-item PixelLab accessory inventory icon pack.
- First-pass non-Phoenix breed template thumbnails and all 12 template base stills are present, but their emote/sprite packs are not complete yet.
- The dogless day room, first-pass dogless variants, and full registered Phoenix sprite manifest are live; final illustrated room variants still need approval/replacement.
- Live image analysis is not wired yet.
- True layered room sprite switching is live for registered sprite actions through `careTwinAssets.ts`.
- Runtime accessory overlays are not fit-tested across all body classes yet; current accessories are inventory/loadout art, not per-frame costume layers.
- Expo web export and Chrome visual smoke now pass in this worktree. Native iOS/Android device QA is still required before public launch.

## Quality Gate

Before public launch, Avatar Studio needs:

- final Phoenix seed frame. Status: v2 seed exists.
- at least one polished full template pack. Status: Phoenix/Shepherd now has base/emote stills, registered sprite actions, and accessory inventory icons; true overlay layers and non-Phoenix emote/sprite packs still needed.
- dogless room background. Status: day room and first-pass variants exist; final illustrated variants still needed.
- transparent sprite/emote assets. Status: Phoenix v2 still states, 10 Avatar Studio emotes, and full registered sprite manifest exist.
- no duplicate Phoenix rendering
- mobile safe-area QA
- real screenshots from the preview or device
- owner-reviewed scan language
