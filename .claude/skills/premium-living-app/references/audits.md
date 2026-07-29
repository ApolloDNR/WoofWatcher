# Audit Procedures

Audits find the truth before (and after) building. Run them as background
subagents with tightly-scoped prompts; verify their findings yourself
before acting - auditors are fallible, and one confirmed finding beats
twenty plausible ones.

## The four audits

1. **Design-system consistency.** Hunt: hardcoded colors that duplicate
   tokens (classify real leaks vs legitimate art/overlay exceptions -
   especially anything white on `primary`/`forest`, which breaks dark
   mode), geometry drift vs `pixelUi.radius`, bespoke buttons vs the
   shared one, pressables with no pressed state, type-scale sprawl.
   Require file:line, quantities, and a ranked top-3 by perceived-quality
   lift.
2. **Motion quality.** Hunt: spring/duration constants outside GameFeel,
   legacy RN `Animated` on layout props, `withRepeat`/interval loops that
   ignore Reduce Motion, dead taps on high-frequency surfaces, missing
   entrance coverage, JS-thread jank risks, haptic gaps or overuse.
3. **Domain correctness** (`lib/care-domain`). Hunt: boundary/threshold
   errors, day-boundary and timezone bugs (UTC vs local), state machines
   reaching impossible states, sort/dedup double-counting, NaN
   propagation, input mutation. Require a concrete failing scenario
   (exact input → wrong output → expected) and note which existing test
   SHOULD have caught it. Findings become fixes + regression tests in
   TZ-isolated test files.
4. **Data integrity** (persistence/sync). The hunt list and laws live in
   `data-safety.md`. This is the highest-stakes audit - schedule it before
   any launch or sync enablement.

## Rules of engagement

- Scope the auditor to files + a "what counts as a finding" list; forbid
  speculative "consider adding validation" noise. CONFIRMED vs PLAUSIBLE
  labels; "clean" is a valid, valuable verdict per area.
- Independently re-trace every finding in the source before changing code.
- Fix in severity order; keep each fix its own verifiable slice; add the
  regression test the auditor said was missing.
- PLAUSIBLE findings that are semantics calls (e.g., when "overdue" flips
  for date-only due dates) go to the owner as product decisions - do not
  silently change behavior on a maybe.
- After fixing: rerun the full suite (audits love to break test pins) and
  record fixed/deferred items in the handoff doc so nothing evaporates.
