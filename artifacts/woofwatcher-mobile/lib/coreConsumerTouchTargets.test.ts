import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function read(...parts: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...parts), "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function boundedObjectBody(source: string, styleName: string): string {
  const marker = new RegExp(`${escapeRegExp(styleName)}:\\s*\\{`, "g");
  const match = marker.exec(source);
  assert.ok(match, `missing style object: ${styleName}`);
  const open = source.indexOf("{", match.index);
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  assert.fail(`unterminated style object: ${styleName}`);
}

function interactiveOpeningTags(source: string): string[] {
  const tags: string[] = [];
  for (const match of source.matchAll(/<(?:Pressable|PressScale)\b/g)) {
    const start = match.index;
    let braceDepth = 0;
    let quote: '"' | "'" | "`" | null = null;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === quote) {
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
      } else if (char === "{") {
        braceDepth += 1;
      } else if (char === "}") {
        braceDepth -= 1;
      } else if (char === ">" && braceDepth === 0) {
        tags.push(source.slice(start, index + 1));
        break;
      }
    }
  }
  return tags;
}

function expectInteractiveBinding(source: string, styleName: string): void {
  const styleReference = new RegExp(`(?:s|styles)\\.${escapeRegExp(styleName)}\\b`);
  assert.ok(
    interactiveOpeningTags(source).some((tag) => styleReference.test(tag)),
    `${styleName} must be bound to a shipping Pressable or PressScale`,
  );
}

function expectMinimumHeight(source: string, styleName: string): void {
  assert.match(
    boundedObjectBody(source, styleName),
    /\bminHeight:\s*MIN_MOBILE_TOUCH_TARGET\b/,
    `${styleName} must own a 48-point minimum frame`,
  );
  expectInteractiveBinding(source, styleName);
}

function expectMinimumSquare(source: string, styleName: string): void {
  const style = boundedObjectBody(source, styleName);
  assert.match(
    style,
    /\b(?:width|minWidth):\s*MIN_MOBILE_TOUCH_TARGET\b/,
    `${styleName} must own a 48-point minimum width`,
  );
  assert.match(
    style,
    /\b(?:height|minHeight):\s*MIN_MOBILE_TOUCH_TARGET\b/,
    `${styleName} must own a 48-point minimum height`,
  );
  expectInteractiveBinding(source, styleName);
}

test("touch-target assertions stay inside one style and require an interactive binding", () => {
  const neighboringStyleOnly = `
    const s = StyleSheet.create({
      tooSmall: { minHeight: 32 },
      nextStyle: { minHeight: MIN_MOBILE_TOUCH_TARGET },
    });
    <Pressable style={s.tooSmall} />;
  `;
  const unboundStyle = `
    const s = StyleSheet.create({
      target: { minHeight: MIN_MOBILE_TOUCH_TARGET },
    });
    <View style={s.target} />;
  `;

  assert.throws(() => expectMinimumHeight(neighboringStyleOnly, "tooSmall"));
  assert.throws(() => expectMinimumHeight(unboundStyle, "target"));
});

test("reset, error recovery, and web-dialog actions own 48-point frames", () => {
  const shield = read("components", "LocalDataResetAppShield.tsx");
  const fallback = read("components", "ErrorFallback.tsx");
  const dialog = read("components", "WebDialogHost.tsx");

  expectMinimumHeight(shield, "secondaryButton");
  expectMinimumSquare(fallback, "topButton");
  expectMinimumHeight(dialog, "button");
});

test("shared auth and board actions use the mobile touch-target contract", () => {
  const auth = read("components", "auth-ui.tsx");
  const board = read("components", "board", "BoardPrimitives.tsx");

  expectMinimumHeight(auth, "proofButton");
  expectMinimumSquare(board, "modalCloseButton");
  expectMinimumHeight(board, "segmentChip");
  expectMinimumHeight(board, "actionButton");
  expectMinimumHeight(board, "meterPressable");
  expectMinimumHeight(board, "careRow");
});

test("shared BoardActionButton labels wrap and grow at accessibility text sizes", () => {
  const board = read("components", "board", "BoardPrimitives.tsx");
  const component = board.slice(
    board.indexOf("export function BoardActionButton"),
    board.indexOf("export function BoardPill"),
  );
  const buttonStyle = boundedObjectBody(board, "actionButton");
  const textStyle = boundedObjectBody(board, "actionButtonText");

  assert.doesNotMatch(component, /numberOfLines=\{?1\}?/);
  assert.match(buttonStyle, /\bpaddingVertical:\s*\d+/);
  assert.match(textStyle, /\bflexShrink:\s*1/);
  assert.match(textStyle, /\btextAlign:\s*"center"/);
});

test("Diet's compact section actions own independent 48-point frames", () => {
  const diet = read("components", "health", "DietScreen.tsx");

  expectMinimumSquare(diet, "sectionActionTarget");
  assert.match(diet, /accessibilityLabel="Edit diet profile"[\s\S]{0,360}s\.sectionActionTarget/);
  assert.match(
    diet,
    /accessibilityLabel=\{`\$\{dietOpen \? "Hide" : "Show"\} diet profile details`\}[\s\S]{0,360}s\.sectionActionTarget/,
  );
});

test("Trends weekly-signal disclosure owns the shared 48-point frame", () => {
  const trends = read("components", "health", "TrendsScreen.tsx");

  expectMinimumHeight(trends, "summaryToggle");
});

test("Privacy and WoofGuide owner actions keep 48-point frames", () => {
  const privacy = read("components", "more", "PrivacyDataScreen.tsx");

  expectMinimumSquare(privacy, "heroCloseButton");
  expectMinimumHeight(privacy, "profileEditBtn");
  expectMinimumHeight(privacy, "supportProofBtn");
  expectMinimumHeight(privacy, "supportShareBtn");
});

test("Avatar Studio's compact editors remain real 48-point controls", () => {
  const avatar = read("components", "more", "AvatarStudioScreen.tsx");
  const ownerSpritePanel = read(
    "components",
    "owner",
    "AvatarSpriteProductionPanel.tsx",
  );

  expectMinimumHeight(avatar, "tab");
  expectMinimumHeight(avatar, "referenceRemoveButton");
  expectMinimumHeight(avatar, "secondaryBtn");
  expectMinimumHeight(avatar, "primaryBtn");
  expectMinimumSquare(avatar, "swatch");
  expectMinimumHeight(avatar, "optionPill");
  expectMinimumHeight(ownerSpritePanel, "qaButton");
  expectMinimumHeight(avatar, "moodChip");
});

test("Setup's compact choices and sheet actions own 48-point frames", () => {
  const setup = read("app", "setup.tsx");

  expectMinimumHeight(setup, "twinToggle");
  expectMinimumHeight(setup, "typePill");
  expectMinimumHeight(setup, "laterBtn");
  expectMinimumHeight(setup, "proofBtn");
  expectMinimumHeight(setup, "sheetSecondaryBtn");
});
