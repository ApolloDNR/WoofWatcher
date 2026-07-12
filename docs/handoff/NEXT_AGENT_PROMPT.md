# Paste-ready prompt for the next agent (Codex / ChatGPT / Claude)

Copy everything in the box below into your new coding assistant as the first
message. If the assistant has the repo checked out (e.g. Codex in your repo),
it will follow the file paths directly. If it does NOT have the repo (plain
ChatGPT), paste this plus the contents of `docs/handoff/HANDOFF_2026-07-12.md`
and `docs/design/APOLLO_MASTER_VISION_PROMPT.md`.

---

```
You are continuing WoofWatcher, a premium mobile-first dog-care app (Expo /
React Native) that plays like a living Tamagotchi: real care logging drives a
pixel-art dog, XP/levels, trends, records, and a shareable care record.
Tagline: "Real care. Pixel heart."

START BY READING, IN THIS ORDER:
1. docs/handoff/HANDOFF_2026-07-12.md   <- full state of the app, what's done,
   what's left, how to build and verify. This is your map.
2. docs/design/APOLLO_MASTER_VISION_PROMPT.md   <- the locked visual + product
   bible (Apollo's July-2026 storybook mockups). When anything conflicts with
   these boards, the boards win.
3. design-qa.md (latest entry) for the most recent QA pass.

CONTEXT YOU NEED:
- Canonical app: artifacts/woofwatcher-mobile (the web app in
  artifacts/woofwatcher is a secondary prototype — ignore for product work).
- Recent work is on branch claude/mockup-parity-polish: every screen was
  restyled to the boards, a shared motion kit was added
  (components/motion/GameFeel.tsx), and Home got a Care Sense meters card.
  693/693 focused tests pass, typecheck clean, verified on the Expo web export.
- pnpm workspace, pnpm@10.24.0. NODE 24 IS REQUIRED — the focused test suite
  asserts a Node-24 runtime; on Node 22 one test fails. Use Node 24.

NON-NEGOTIABLE RULES (do not trade these for visuals):
- Every number shown (XP, levels, streaks, meters, counts, supply statuses)
  must derive from REAL logged care. No fake counts, no dead buttons, no coins.
- Keep ONE meters surface on Home (the Care Sense card). Don't duplicate it.
- Care workflows are sacred: meal served->outcome lifecycle, potty flow,
  Health/Bile Watch NON-DIAGNOSTIC language, Records, Care Pass, privacy gates,
  and the test suite. Extend, never gut.
- All motion goes through components/motion/GameFeel.tsx (springs, PressScale,
  MeterPip, useBounce, ProgressFill). Crisp, consistent, reduced-motion aware.
  Motion presents real state; it never fakes progress.
- Don't claim provider features (cloud sync, push, payments, store submission)
  unless the setup actually exists.

HOW TO VERIFY EVERY CHANGE (the loop to run before you call anything done):
  pnpm install
  pnpm run typecheck                 # must be clean
  pnpm run test:focused              # must stay green (currently 693/693), Node 24
  cd artifacts/woofwatcher-mobile
  node scripts/smoke-web-export.js   # expo web export must succeed
  node scripts/serve-smoke-preview.js 4194   # then screenshot the changed
  # screens at 390x844 (scripts/qa-screenshots.mjs drives every route) and LOOK
  # at them against the boards before declaring success.
If you touch Home or the app chrome, update the guardrail contracts in
artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts intentionally (don't
just delete them).

PICK THE NEXT SLICE (highest value first — see HANDOFF §4 for detail):
1. Native iOS/Android device QA (everything so far is web-export-verified):
   safe areas, 60fps of the new Reanimated motion, haptics, touch targets.
2. Dark-mode audit of the new meter tones
   (EXPO_PUBLIC_WEB_COLOR_SCHEME=auto on the web export, or a device in dark).
3. Build the standalone board screens the app currently folds into other tabs,
   IF Apollo wants literal 1:1 with every mockup tile: a dedicated Trends
   screen (mood line / energy bars / sleep bars / weekly summary), a Calendar
   month-grid view, a Profile screen, and a Reminders (Upcoming/Past) screen.
   Reuse lib/care-domain derivations and the board primitives + GameFeel motion.

WORKFLOW: implement the smallest coherent slice toward the boards, run the full
verify loop above, screenshot-review against the mockups, then commit with a
clear message and push. Do not oversell — if a composition is off, iterate.
Ask me (Apollo) before any irreversible or provider-config change.
```

---

## How to actually move the code

The mockup-parity work is committed on branch `claude/mockup-parity-polish` but
was not pushed from the Cowork session (sandbox blocked GitHub write). To get it
live so your next tool builds on top of it, see
`docs/handoff/HANDOFF_2026-07-12.md` §5 — apply the git bundle **or** the patch
files, then `git push -u origin claude/mockup-parity-polish` and open a PR into
`main`. A coding agent running in your own environment (Codex) has your GitHub
auth and can do that push for you; just have it run `pnpm run test:focused` on
Node 24 first.
