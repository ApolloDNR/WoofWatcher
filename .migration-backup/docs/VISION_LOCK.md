# WoofWatcher Vision Lock

Last updated: 2026-06-05

Source: ChatGPT shared conversation `UI Design Help`, imported from `https://chatgpt.com/share/6a22da8e-d4d8-83e8-aa8d-0a93da247de9`.

Status: product direction imported and visual direction approved by Apollo on 2026-06-05. Code and Figma mutation still wait for review of `docs/superpowers/specs/2026-06-05-woofwatcher-visual-lock-design.md`.

## Product Thesis

WoofWatcher is not a generic pet tracker. It is Phoenix's living care twin: a playful, visual, low-friction dog-care companion that turns small daily logs into useful household, health, diet, routine, and training context.

Core promise:

> Tap what happened. WoofWatcher remembers the rest.

The app should ask for less than it gives back. A human should be able to log the normal moments in seconds, then get back summaries, patterns, household awareness, health-safe watch prompts, and Phoenix avatar reactions.

## Visual Lock

Approved direction: `Premium Playful Storybook Utility`.

Use the Apollo-provided UI concept references as the base visual lane, with these corrections:

- Use `WoofWatcher`, not `Woof Watcher`.
- Use a warm ivory product surface, deep navy shell, forest success/action states, soft sage panels, copper warmth, and stone dividers.
- Make Phoenix's illustrated avatar the emotional center of the first screen.
- Keep the experience playful and visual, but mature enough for records, health watch, Care Passes, and household coordination.
- Replace `Dashboard` with `Phoenix`.
- Replace daily handoff language with `Household Pulse`.
- Rename assistant surfaces to `WoofGuide`.
- Add `Plans` as a first-class route for scheduled walks, meals, bedtime snack, training, vet visits, and alone-time windows.

The visual design spec is saved at `docs/superpowers/specs/2026-06-05-woofwatcher-visual-lock-design.md`.

## Corrected System Language

- `Log`: what happened.
- `Plan`: what is intended.
- `Routine`: recurring expected care.
- `Household Pulse`: what Phoenix's humans need to know right now.
- `Care Pass`: export/share package for vets, sitters, trainers, boarding, travel, emergencies, or another household.
- `Report`: monthly or date-range summary.

Use `Phoenix's Humans` in the product UI. Use `Household Members` in settings, legal, and privacy surfaces. Use `Care Team` for vets, trainers, sitters, walkers, and outside helpers.

Daily shared coordination should not be called handoff. Handoff stays as an implementation concept, but the user-facing daily model is Household Pulse. Formal external sharing is Care Pass.

## Core Object Model

```text
Household
  Pets
    Phoenix
      Humans
      Plans
      Routines
      Logs
      Diet
      Health
      Records
      Insights
      Household Pulse
      Care Passes
      Phoenix Memory
```

## Main Navigation

Lock future app navigation to five user-facing areas:

- `Phoenix`: living home screen, avatar, current mood, today status, next best action.
- `Log`: fast capture with one-tap events and optional details.
- `Plans`: scheduled walks, meals, routines, alone time, vet visits, and training sessions.
- `Health`: Bile Watch, vomit, appetite, poop/pee, weight, medication, symptoms, and safe follow-ups.
- `More`: Humans, diet profile, records, vaccines, documents, reports, Care Pass, WoofGuide, settings.

## No-Overwhelm Logging

Logging has three layers:

1. One-tap by default: Meal, Treat, Walk, Potty, Poop, Pee, Play, Zoomies, Training Win, Anxious, Happy, Sleepy, Vomit, Medication, Alone Time, Vet, Note.
2. Smart quick detail only when useful: appetite, portion eaten, walk duration, calm/reactive walk, vomit type, energy after, training skill, win or rough spot.
3. Deep detail behind `Add details`, never required.

Unknown is acceptable. The app should summarize and nudge, not shame or micromanage.

## First-Class Product Objects

- `Diet Profile`: usual food, normal portion, schedule, toppers, supplements, bedtime snack routine, treats allowed, foods to avoid, allergies/sensitivities, appetite quirks, vet notes.
- `Meal Log`: meal type, food, portion offered, portion eaten, appetite, human, note.
- `Treat Log`: treat type, amount, reason, reaction, appetite impact.
- `Training Win`: skill, duration, mood before/after, difficulty, accomplishment, next focus.
- `Alone Time`: start/end, who left/returned, duration, calm/anxious/unknown outcome, accident/vomit/destructive/barking notes.
- `Care Pass`: diet snapshot, recent care, health watch, meds, vaccines, documents, behavior notes, anxiety triggers, training progress, what to watch, and non-diagnostic boundary.

## Intelligence Layers

Keep the dog personality and assistant separate:

- `Phoenix`: avatar/personality layer. She reacts, jokes, emotes, and narrates the day.
- `WoofWatcher Brain`: deterministic state engine that interprets logs, plans, routines, diet, health, and reminders.
- `WoofGuide`: assistant layer for memory, pattern explanation, summaries, Talk-to-log, and safe guidance.

Phoenix should never be the professional/medical advisor. WoofGuide can explain patterns with clear boundaries and suggest what might be useful to share with a veterinarian.

## Hidden Game-Changers

- `Tell WoofGuide about Phoenix`: natural-language onboarding that converts a story into editable Phoenix Memory cards.
- `Talk-to-log`: parse a natural update into suggested logs, then let the human review and save all.
- `Why is Phoenix saying this?`: every avatar mood/comment can reveal its evidence, such as last walk time or long food gap.
- Diet + Bile overlay on the calendar: meals, partial/refused meals, treat-heavy days, long food gaps, bedtime snack proof, and bile/vomit events.
- Meaningful avatar unlocks tied to care milestones, not shallow gamification.
- Nudge budget: max two playful nudges per day, quiet mode at night, health nudges override playful nudges, no shame language, no streak anxiety.
- Demo dog / private Phoenix split: public demos use safe demo data; Phoenix private mode stays protected.

## Avatar Mood Engine

The first avatar state engine should be deterministic and testable. Initial states:

- Long time since walk -> bored.
- Walk planned soon -> excited.
- Long meal gap -> hungry/watchful.
- Vomit logged -> not feeling great.
- Training win -> proud.
- Alone timer running -> home-alone scene.
- All care done -> calm/sleepy.

Avatar output should include mood, urgency, scene, suggested action, speech, and evidence.

## Safety Doctrine

Health language must stay careful:

- Use: pattern noticed, worth monitoring, consider sharing with your vet, not veterinary advice.
- Avoid: diagnosis, certainty, treatment instructions, or statements that Phoenix has a condition.

## Staged Build Order

Phase 1: Phoenix as the interface.

- Avatar State Engine.
- Phoenix Home redesign.
- Mood comments and next best action.
- Household Pulse.
- One-tap Log redesign.
- Diet Profile.
- Treat Log.
- Training Win Log.
- Alone Time.

Phase 2: WoofGuide memory.

- Tell WoofGuide about Phoenix.
- Phoenix Memory profile.
- Talk-to-log.
- Save-all suggested logs.
- Editable memory cards.
- WoofGuide safety boundary.

Phase 3: Care Pass and richer reports.

- Vet, Sitter, Trainer, Emergency, and Weekend Care Pass variants.
- Diet snapshot.
- Vaccine/document section.
- Timeline export.

Phase 4: avatar animation.

- Wagging tail, paw tap, sleepy blink, excited bounce, anxious ears, sick/low-energy state, outfit layer.

Phase 5: cloud/sync/push.

- Household accounts, invited humans, realtime sync, real push notifications, protected Vercel preview, live OpenAI, and public demo mode.
