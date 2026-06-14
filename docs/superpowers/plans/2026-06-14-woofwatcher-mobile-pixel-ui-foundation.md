# WoofWatcher Mobile Pixel UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first board-accurate mobile UI foundation for WoofWatcher so the Expo app visibly matches Apollo's pixel reference boards while preserving real care workflows.

**Architecture:** Add a small board primitive layer on top of the existing Expo app rather than rebuilding screens. Use static readiness tests to protect the locked palette, reusable primitives, Home usage, and navy bottom navigation. Apply the first implementation to Home and the tab shell because they define the template for every later screen.

**Tech Stack:** Expo Router, React Native, TypeScript, existing `PixelIcon` assets, existing care-domain state derivations, Node test runner for static readiness checks.

---

## File Structure

- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
  - Adds a failing static test that proves the locked pixel UI foundation exists and is wired into Home/navigation.
- Modify: `artifacts/woofwatcher-mobile/constants/colors.ts`
  - Adds exact board palette tokens and compact board radii while preserving current light/dark exports.
- Modify: `artifacts/woofwatcher-mobile/hooks/useColors.ts`
  - Keeps light board theme but returns the new board token object.
- Create: `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`
  - Provides `BoardCard`, `BoardSectionHeader`, `StatusMeter`, `QuickActionTile`, `PixelSpeechBubble`, and `CareRow`.
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/_layout.tsx`
  - Converts the bottom navigation to the navy pixel shell shown in the reference boards.
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
  - Uses board primitives for Phoenix Home, status meters, quick actions, care rows, speech bubble, and compact reference-board layout.
- Modify: `docs/design/UI_IMPLEMENTATION_NOTES.md`, `docs/AUTONOMOUS_BUILD_QUEUE.md`, `docs/DECISION_LOG.md`
  - Records the shipped implementation slice after verification.

## Task 1: Failing Readiness Test

**Files:**
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

- [x] **Step 1: Add the failing test**

Add a test that reads the token file, primitive file, Home screen, and tab layout:

```ts
test("locks the mobile pixel UI foundation to Apollo's reference boards", () => {
  const colors = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "constants", "colors.ts"),
    "utf8",
  );
  const primitivesPath = join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "components",
    "board",
    "BoardPrimitives.tsx",
  );
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const tabs = readAppFile(join("(tabs)", "_layout.tsx"));

  assert.match(colors, /#081424/);
  assert.match(colors, /#0D182A/);
  assert.match(colors, /#FFF9EF/);
  assert.match(colors, /#A8CBE8/);
  assert.match(colors, /pixelUi/);
  assert.ok(existsSync(primitivesPath), "board primitives should exist");

  const primitives = readFileSync(primitivesPath, "utf8");
  for (const exportedName of [
    "BoardCard",
    "BoardSectionHeader",
    "StatusMeter",
    "QuickActionTile",
    "PixelSpeechBubble",
    "CareRow",
  ]) {
    assert.match(primitives, new RegExp(`export function ${exportedName}`));
  }

  assert.match(home, /BoardCard/);
  assert.match(home, /StatusMeter/);
  assert.match(home, /QuickActionTile/);
  assert.match(home, /PixelSpeechBubble/);
  assert.match(tabs, /colors\.brandNavy/);
  assert.match(tabs, /tabBarActiveBackgroundColor/);
});
```

- [x] **Step 2: Run the focused tests to verify red**

Run: `pnpm run test:focused`

Expected: FAIL because `components/board/BoardPrimitives.tsx` does not exist and Home/tab layout do not yet use the primitives.

## Task 2: Board Tokens And Primitives

**Files:**
- Modify: `artifacts/woofwatcher-mobile/constants/colors.ts`
- Modify: `artifacts/woofwatcher-mobile/hooks/useColors.ts`
- Create: `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`

- [x] **Step 1: Add board palette tokens**

Update `colors.ts` so the light theme includes the locked reference colors: `#081424`, `#0D182A`, `#C85A2A`, `#4D8A56`, `#FFF9EF`, `#F7F2E8`, `#A8CBE8`, and `#E6DED2`. Add a `pixelUi` token object with compact card, panel, scene, and pill radii.

- [x] **Step 2: Return board tokens from `useColors`**

Keep the light theme forced for board assets, but include `pixelUi` so components can use the shared values.

- [x] **Step 3: Create reusable primitives**

Create `BoardPrimitives.tsx` with exported `BoardCard`, `BoardSectionHeader`, `StatusMeter`, `QuickActionTile`, `PixelSpeechBubble`, and `CareRow`. Components must use existing `useColors`, `PixelIcon`, and React Native primitives.

- [x] **Step 4: Run the focused tests**

Run: `pnpm run test:focused`

Expected: Still FAIL because Home/tab layout do not yet use the primitives.

## Task 3: Board-Accurate Tab Shell And Home

**Files:**
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`

- [x] **Step 1: Update bottom navigation**

Make the tab bar deep navy with cream active states, sage/copper active accents, compact labels, and a central paw action that matches the reference board.

- [x] **Step 2: Update Home imports**

Import board primitives:

```ts
import {
  BoardCard,
  BoardSectionHeader,
  CareRow,
  PixelSpeechBubble,
  QuickActionTile,
  StatusMeter,
} from "@/components/board/BoardPrimitives";
```

- [x] **Step 3: Update Home layout**

Use the primitives for:

- Hero overlay speech bubble.
- Presence/Next Up card.
- Phoenix Status segmented meters.
- Quick Log action tiles.
- Health/Bile/Alone watch cards.
- Today at a glance rows.

- [x] **Step 4: Run focused tests**

Run: `pnpm run test:focused`

Expected: PASS for the new pixel UI foundation test and the existing route/safety tests.

## Task 4: Verification And Docs

**Files:**
- Modify: `docs/design/UI_IMPLEMENTATION_NOTES.md`
- Modify: `docs/AUTONOMOUS_BUILD_QUEUE.md`
- Modify: `docs/DECISION_LOG.md`

- [ ] **Step 1: Run TypeScript check**

Run: `pnpm --filter @workspace/woofwatcher-mobile run typecheck`

Expected: PASS.

Execution note: local typecheck could not run in this checkout because `pnpm`, `npm`, Corepack, workspace `node_modules`, bundled TypeScript, `tsx`, and `esbuild` were unavailable. The 196-test zero-dependency focused suite passed with the bundled Node runtime.

- [x] **Step 2: Update docs**

Record that the mobile shell/Home foundation now implements the locked reference boards in real code, with remaining screens queued for follow-up.

- [ ] **Step 3: Commit**

Run:

```bash
git add artifacts/woofwatcher-mobile docs
git commit -m "feat: add mobile pixel ui foundation"
```

Expected: Clean commit with tests passing.

## Self-Review

Spec coverage:

- Reference-board colors are protected by tests.
- Reusable primitives are required by tests.
- Home and bottom navigation are upgraded first, matching the mobile-first priority.
- No fake providers, AI, payments, cloud sync, or medical claims are introduced.
- Remaining screens stay queued instead of being partially restyled without verification.

Placeholder scan:

- No placeholder implementation steps remain.
- The plan uses exact file paths and exact verification commands.

Type consistency:

- Primitive export names match the readiness test exactly.
- Route file names match the existing Expo Router structure.
