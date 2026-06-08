# Apollo Vision Synthesis

Source: Apollo-provided ChatGPT shared thread `https://chatgpt.com/share/6a2650b3-82f8-83e8-be54-55d68cea34a4`, fetched on 2026-06-08, plus the current repository state.

## Product Definition

WoofWatcher is a premium, mobile-first household dog-care operating system. It helps dog owners, families, roommates, sitters, walkers, trainers, and vets coordinate care around one real dog with real routines, health signals, records, behaviors, documents, and daily needs.

It is not a generic pet tracker, not a cute toy, and not just a logbook. It is a shared care command center for a dog's life.

## Core Model

- Routines define what should happen.
- Logs record what actually happened.
- Matching logs should satisfy or update routines when they correspond.
- Dog Profile is the living source of truth.
- Household Sync keeps everyone updated.
- WoofGuide summarizes, explains patterns, drafts notes, suggests owner-reviewed actions, and prepares handoffs inside medical safety boundaries.

## Product Loop

The full product loop is:

Dog profile -> routines -> quick logs -> health patterns -> reminders -> caregiver handoff -> vet/sitter report -> WoofGuide.

The owner should be able to create a profile, invite caregivers, log core care, see trends, get non-diagnostic red-flag organization, create sitter Care Passes, export vet notes, ask WoofGuide what changed, and never lose track of what happened.

## Premium Feel

The app should feel like Apple Health for dogs plus a warm family care command center plus a premium dog journal. It should be beautiful, calm, emotionally trustworthy, mobile-first, animated, warm, and useful every day.

The visual target is warm ivory, forest, copper, and navy, with a dog avatar or portrait, clear Today Command, quick log buttons, care status, mood/energy, next routine, and visible sync state.

## Dog-First Scope

Keep architecture flexible enough for other species later, but do not dilute the first premium release by trying to serve every pet equally. WoofWatcher should become the best dog-care OS first.

## Must Not Build

- Veterinary diagnosis.
- Emergency certainty.
- Fake health claims.
- Decorative screens with no workflow value.
- Generic pet clutter.
- Placeholder workflows.
- Web parity before mobile excellence.

## Immediate Apollo Priority

Prioritize the routines/logs relationship first. Meal logging must support expected portion, served amount, eaten amount, skipped/partial completion, notes, and household visibility.
