# WoofWatcher Dog Care OS Design

## Purpose

WoofWatcher should become a mobile-first dog care operating system: a warm,
shared, intelligent care app where every screen helps caregivers understand what
the dog needs now, what already happened, what needs attention, and what should
happen next.

The product should feel alive and polished, but the polish must serve care. No
button, card, motion, empty state, or assistant response should be decorative
only. Every element should connect to logging, planning, handoff, records,
insights, assistant help, or caregiver coordination.

## Product Position

WoofWatcher is not a generic pet tracker. It is a shared care command center for
families and caregivers managing a real dog with real needs, routines, quirks,
health signals, and emotional context.

The first production target is the mobile app. The web app can remain useful as
a dashboard/admin surface, but it should not compete with the mobile app as the
primary product experience until the mobile experience is stable.

## Current Repo Assessment

The repository now contains a real app foundation:

- `artifacts/woofwatcher-mobile`: Expo mobile app with auth, care context,
  screens, haptics, avatar flow, calendar, records, AI helper, and shared care.
- `artifacts/api-server`: Express API with Clerk auth, household provisioning,
  care state, care entries, Gemini assistant/avatar routes, and rate limiting.
- `lib/db`: Drizzle schema for users, households, members, care state, and care
  entries.
- `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`: OpenAPI contract,
  generated hooks, and validation.
- `artifacts/woofwatcher`: current web artifact, still mostly wrapping the old
  vanilla app.
- `artifacts/mockup-sandbox` and `attached_assets`: design/reference material.

The main gaps are not just visual. The product needs stronger repo structure,
local setup docs, shared domain types, offline sync guarantees, production
security defaults, and a clearer split between mobile, web, API, and packages.

## Recommended Architecture

The repo should move toward this shape:

```text
apps/
  mobile/        Expo app. Primary user product.
  web/           Care team dashboard/admin/reporting surface.
  api/           Express API.
packages/
  care-domain/   Canonical event types, care status, insight rules, copy tokens.
  db/            Drizzle schema and migrations.
  api-spec/      OpenAPI contract.
  api-client/    Generated API client/hooks.
  api-zod/       Generated request/response schemas.
docs/
  product/
  architecture/
  operations/
```

This can be done gradually. The first implementation slice should not rename the
entire repo unless the app is already runnable and tested. Start by adding the
shared `care-domain` package and a root handoff README, then migrate consumers.

## Core Interaction Model

The mobile app should revolve around five connected surfaces:

1. Today Command
   - Answers: what does the dog need now?
   - Shows next care action, care completion, current mood/energy, recent risk
     signals, and caregiver responsibility.
   - Every card opens an action: log, edit routine, ask assistant, view pattern,
     hand off, or share.

2. Quick Log
   - One tap for common actions.
   - Rich composer for meals, water, potty, symptoms, medication, walks, play,
     training, weight, grooming, anxiety, alone time, and notes.
   - Every saved item shows whether it is local, pending sync, synced, or failed.

3. Handoff
   - Summarizes the day for the next caregiver.
   - Groups by done, watch, needs attention, and next.
   - Can generate a care pass for sitters, vets, trainers, or family members.

4. Health Watch
   - Tracks appetite, stool, vomiting/bile, water, weight, energy, medication,
     and recurring symptoms.
   - Converts logs into patterns without pretending to diagnose.
   - Shows red-flag guidance and encourages veterinary review when appropriate.

5. WoofGuide
   - AI assistant grounded in the dog's actual profile, logs, routines, diet,
     records, and recent handoff.
   - Assistant answers should create useful next actions: log this, make
     reminder, add vet note, export report, update diet note, or ask follow-up.

## No Dead Ends Rule

Every interactive element must do at least one of these:

- Log care.
- Explain status.
- Open a related detail screen.
- Create or edit a routine/reminder.
- Generate a handoff or report.
- Ask WoofGuide with current context.
- Share a scoped care pass.
- Fix an empty state by guiding setup.

Empty states must never be blank. They should show the next best action and a
short explanation of why it matters.

## Visual And Motion Direction

The desired visual direction is premium playful:

- Warm ivory background, forest/sage/copper/navy accents.
- Rounded but controlled cards, not random bubble UI.
- Friendly illustration and Phoenix avatar as the emotional anchor.
- Dense enough to be useful, calm enough to scan quickly.
- Motion is subtle and meaningful: card entrance, log confirmation, avatar mood,
  progress rings, handoff transitions, and assistant action creation.
- Haptics should reinforce completed logs, warnings, and successful handoffs.

Preferred tools:

- Figma for design system, screen maps, component inventory, and visual review.
- Expo Reanimated for native motion.
- Lottie or Rive for reusable expressive animations.
- Generated or commissioned Phoenix illustration set for avatar states.

## Data Model Direction

The current split is correct:

- `care_state`: shared household configuration, profile, routines, goals,
  records, diet, calendar, and preferences.
- `care_entries`: append-style event log so simultaneous caregivers do not
  clobber each other.

The next upgrade must add:

- A shared care event taxonomy.
- Offline outbox with durable retry.
- Sync status metadata.
- Conflict-safe care state updates.
- Role-aware permissions for owners, caregivers, sitters, trainers, and vets.
- Audit trail for destructive or high-importance changes.
- Future storage support for record documents and generated reports.

## AI Direction

WoofGuide should not be a generic chatbot. It should become a care copilot:

- Reads the dog's profile, diet, routines, recent logs, health watch, and
  caregiver handoff.
- Distinguishes advice, observation, pattern, and vet red flag.
- Produces actions the user can accept.
- Avoids diagnosis and keeps veterinary boundaries visible.
- Can summarize a month, prepare a vet note, explain why a nudge appeared, or
  convert natural language into structured log drafts.

## Implementation Phases

### Phase 1: Trustworthy Foundation

- Root README and environment docs.
- Shared care-domain package.
- Canonical care event types.
- Local reproducibility notes.
- API/mobile config guardrails.
- Production CORS default fix.

### Phase 2: Sync Safety

- Durable outbox.
- Pending/synced/failed log states.
- Retry actions.
- Conflict-aware care state updates.
- User-visible sync status.

### Phase 3: Today Command Upgrade

- Reframe the home screen around next best action.
- Make every pulse card interactive.
- Add status explanations and direct actions.
- Add richer handoff preview.
- Remove static/dead UI.

### Phase 4: Health Watch And Handoff

- Bile/vomit pattern tracking.
- Appetite, stool, water, energy, weight signals.
- Caregiver shift summary.
- Vet/sitter/trainer care pass.

### Phase 5: WoofGuide Actions

- Assistant action cards.
- Log draft creation.
- Reminder creation.
- Report/handoff generation.
- Safer medical red-flag handling.

### Phase 6: Premium Visual System

- Figma design system.
- Motion spec.
- Reusable components.
- Avatar state rules.
- Accessibility and responsive polish.

## First Implementation Slice

The first slice should build the foundation required for every later feature:

1. Add root project docs and env examples.
2. Add a `care-domain` package with canonical event types and status helpers.
3. Migrate mobile quick log and full log to use the shared taxonomy.
4. Add tests for care event normalization and status derivation.
5. Fix production CORS default behavior.
6. Add configuration validation so missing Clerk/API env is obvious.

This slice is intentionally not the full UI redesign. It makes the product
safe, understandable, and ready for the high-end experience without adding more
drift.

## Acceptance Criteria

- A new developer can open the repo and understand what to run.
- The mobile app has a single canonical event taxonomy.
- Web, mobile, API, assistant, and reports can share the same care vocabulary.
- Production CORS cannot silently allow every origin with credentials.
- Missing required env fails with a useful message.
- The first tests prove event normalization and care status behavior.
- The next plan can safely build out sync outbox and Today Command without
  guessing what the product is supposed to become.

