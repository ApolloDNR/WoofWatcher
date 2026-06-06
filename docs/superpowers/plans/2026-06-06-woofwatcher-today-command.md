# WoofWatcher Today Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the mobile home screen from passive status cards into a Today Command surface with one clear next action, health context, and handoff context.

**Architecture:** Add a pure `todayCommand` view-model that derives the primary action, health watch message, and handoff summary from care state. Test it with Node 24 TypeScript stripping, then wire `app/(tabs)/index.tsx` to render the command and route users into existing screens.

**Tech Stack:** Expo React Native, Expo Router, `@workspace/care-domain`, Node 24 test runner.

---

### Task 1: Today Command View-Model

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/todayCommand.ts`
- Create: `artifacts/woofwatcher-mobile/lib/todayCommand.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- missed meal in the morning creates a `log-meal` primary action.
- vomit/watch event creates health watch urgency.
- next routine produces a routine action.
- recent failed sync creates a sync action.

- [ ] **Step 2: Implement view-model**

Export `deriveTodayCommand(state, now)` returning:

- `primaryAction`
- `health`
- `handoff`
- `sync`

### Task 2: Today Screen Wiring

**Files:**
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Import command model**
- [ ] **Step 2: Render a command card after the greeting**
- [ ] **Step 3: Route command actions to Log, Calendar, Records, or WoofGuide**
- [ ] **Step 4: Keep existing hero, pulse, quick log, and handoff sections intact**

### Task 3: Verification

- [ ] Run today command tests.
- [ ] Run care-domain tests.
- [ ] Run sync tests.
- [ ] Run placeholder/mojibake scans.
- [ ] Run `git diff --check`.
- [ ] Commit and push.
