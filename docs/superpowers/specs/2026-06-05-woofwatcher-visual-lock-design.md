# WoofWatcher Visual Lock Design

Date: 2026-06-05

Status: approved by Apollo for design lock. Implementation and Figma mutation still wait for this spec review.

Sources:

- ChatGPT shared conversation `UI Design Help`: `https://chatgpt.com/share/6a22da8e-d4d8-83e8-aa8d-0a93da247de9`
- Apollo-provided iCloud UI concept references:
  - `https://share.icloud.com/photos/0e3hHbqzZvTjYHIAHcdXKg52A`
  - `https://share.icloud.com/photos/09biOKLeYoK69luLjjJSqTC0Q`
- Existing WoofWatcher v1 app and docs in `projects/woofwatcher`.

## Decision

Adopt the second shared UI concept as the visual base and improve it into WoofWatcher's official visual direction:

> Premium Playful Storybook Utility.

The app should feel warm, illustrated, delightful, and dog-first, while still behaving like a serious care operating surface for routines, health watch, records, household coordination, and reports.

This replaces the older dark command-dashboard feel as the target for the next design pass. The proven v1 local-first engine stays intact.

## Product Fit

The design supports the locked product thesis:

> Phoenix is the interface.

The first screen should not feel like a generic dashboard. It should feel like checking on Phoenix's living care twin. The user sees Phoenix, her mood, the next best action, Household Pulse, and simple care controls.

The UI should avoid two failure modes:

- Too cute: childish pet-store styling that makes health/records/care sharing feel unserious.
- Too operational: dense dashboard sprawl that makes daily care feel like micromanagement.

## Visual System

Use a warm light surface with deep navy structure and forest/copper signals:

- Ivory app background: `#F7F5F1`
- Soft sage panels: `#D6E0D2`
- Forest success/action: `#2E5B46`
- Deep navy shell: `#0F1F33`
- Copper warmth/accent: `#B8643D`
- Stone dividers/surfaces: `#E5E2DC`
- Text primary: deep navy or near-charcoal.
- Text secondary: muted slate/olive.

Use Inter/system UI for functional copy. Marketing or wordmark treatments can use a restrained serif if already established in the concept board, but product controls and app content remain readable and modern.

Cards may be soft and slightly rounded, but app controls should remain stable, compact, and scan-friendly. Avoid nested cards and visual clutter.

## Illustration Direction

Phoenix is an illustrated shepherd avatar in a soft outdoor/home scene. The avatar should show state without becoming a medical authority.

Initial scene states:

- Morning yard / ready.
- Bored / needs enrichment.
- Walk planned / excited.
- Home alone.
- Training win / proud.
- Tummy watch / low-energy.
- Care complete / calm.

Avatar comments can be funny, but health guidance comes from WoofGuide.

## Navigation

Use five mobile-first tabs:

- `Phoenix`
- `Log`
- `Plans`
- `Health`
- `More`

On desktop, this becomes a left rail. The rail should use icons plus labels, with the selected item in forest green. Do not use `Dashboard` as the main product label.

## Core Screens

### Phoenix Home

Purpose: the signature screen.

Elements:

- Greeting and Phoenix readiness line.
- Large Phoenix illustrated scene.
- Mood card with mood, energy, and evidence.
- Next best action card.
- Today's care overview: meals, walks, potty, training, meds, health.
- Household Pulse timeline.
- Health Watch compact strip.
- WoofGuide compact card.
- Quick actions for Meal, Walk, Potty, Training, Medication, Symptoms, Social, Weight, Photo, and Note.

Use `Household Pulse`, not everyday `Handoff Timeline`.

### Log

Purpose: three-second capture.

Elements:

- One-tap grid by event.
- Recent log strip.
- Optional smart detail drawer after selection.
- Natural-language Talk-to-log entry point for later WoofGuide phase.

Default log buttons:

- Meal
- Treat
- Walk
- Potty
- Poop
- Pee
- Play
- Zoomies
- Training Win
- Anxious
- Happy
- Sleepy
- Vomit
- Medication
- Alone Time
- Vet
- Note

### Plans

Purpose: intended care and routine coordination.

Elements:

- Today plan timeline.
- Scheduled walks.
- Meals and bedtime snack.
- Training sessions.
- Vet visits.
- Alone-time windows.
- Routine completion proof.

Plans are future intent. Logs are proof that something happened.

### Health

Purpose: calm watch surface.

Elements:

- Appetite, stool, vomiting, energy, weight, medication summary.
- Bile Watch with food gaps, bedtime snack proof, and yellow-bile context.
- Health observations.
- Weight trend.
- Vet-safe alert copy.

Use `No new alerts`, `Worth monitoring`, and `Consider sharing with your vet`. Avoid overconfident `All good` when evidence is incomplete.

### More

Purpose: secondary tools without overwhelming the daily flow.

Elements:

- Humans / Household Members.
- Care Team.
- Diet Profile.
- Records and vaccines.
- Documents.
- Reports / Insights.
- Care Pass.
- WoofGuide.
- Settings.

## Desktop Layout

Desktop should mirror the concept board:

- Brand/identity column or left rail.
- Deep navy navigation rail.
- Phoenix Home feature card.
- Care overview grid.
- Household Pulse panel.
- Health Watch panel.
- WoofGuide panel.

Desktop is for scanning and managing; mobile is for living daily care.

## Naming Corrections

Use:

- `WoofWatcher`, not `Woof Watcher`.
- `Phoenix`, not `Dashboard`.
- `Household Pulse`, not daily handoff.
- `Care Pass`, not generic export.
- `WoofGuide`, not Woof Assistant.
- `Phoenix's Humans` in warm product copy.
- `Household Members` in settings/privacy copy.
- `Care Team` for vets, trainers, sitters, walkers, and outside helpers.

## Interaction Rules

- Every daily action should be reachable in one or two taps.
- Detail is optional by default.
- Unknown is acceptable.
- The app summarizes more than it asks.
- Nudges are limited and never shame-based.
- Health state changes switch copy from playful to calm.
- Phoenix comments must include a `why` explanation when they are based on care evidence.

## Data Flow

The visual design expects the existing local-first care engine to expose:

- Pet profile and household humans.
- Logs by type.
- Plans and routines.
- Reminder proof.
- Diet profile.
- Training wins.
- Alone-time sessions.
- Health watch and Bile Watch summaries.
- Household Pulse summary.
- WoofGuide context.
- Avatar state output: mood, urgency, scene, speech, suggested action, evidence.

The first implementation slice should add missing data objects only where needed for Phoenix Home and Effortless Log.

## Error Handling And Boundaries

- If data is missing, show soft unknown states, not guilt or failure.
- If no OpenAI key is configured, WoofGuide stays deterministic/local and says so.
- If health evidence is incomplete, avoid confident health status.
- If a Care Pass is exported, include non-diagnostic veterinary boundary language.
- If public demo mode is built later, never expose Phoenix private data by default.

## Testing Requirements

Before implementation is called done:

- Unit-test Avatar State Engine mood and evidence rules.
- Unit-test Diet Profile, Treat Log, Training Win, and Alone Time normalization.
- Unit-test Household Pulse summary labels.
- Unit-test health copy boundaries for Bile Watch and vomit events.
- Run the existing Node test suite.
- Run syntax checks.
- Run rendered smoke for Phoenix, Log, Plans, Health, and More.
- Visually verify mobile and desktop layouts for no overlap, readable text, stable icon controls, and nonblank avatar scene.

## Implementation Slice

After Apollo reviews this spec, the next implementation plan should be:

1. Add Avatar State Engine.
2. Redesign Today/Home into Phoenix Home.
3. Rename everyday handoff UI to Household Pulse.
4. Add Effortless Log grid.
5. Add Diet Profile.
6. Add Treat Log.
7. Add Training Win.
8. Add Alone Time.
9. Align Figma frames to this visual lock.

## Self-Review Notes

- No placeholder requirements remain.
- The visual lock does not claim the app already implements the new screens.
- The spec preserves the v1 local-first engine and avoids a greenfield rewrite.
- The health boundary is explicit.
- The Figma/code implementation gate remains separate from design approval.
