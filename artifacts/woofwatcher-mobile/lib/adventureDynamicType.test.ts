import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const adventureSource = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "components",
    "more",
    "AdventureScreen.tsx",
  ),
  "utf8",
);

test("Adventure switches its painted hero to normal flow at large Dynamic Type", () => {
  assert.match(adventureSource, /useWindowDimensions/);
  assert.match(
    adventureSource,
    /const \{ fontScale \} = useWindowDimensions\(\)/,
  );
  assert.match(
    adventureSource,
    /const usesLargeTextHeroLayout = fontScale >= 1\.5/,
  );

  for (const styleName of ["heroSpeech", "heroCopy", "levelRow"]) {
    assert.match(
      adventureSource,
      new RegExp(
        `style=\\{\\[\\s*s\\.${styleName},\\s*usesLargeTextHeroLayout && s\\.${styleName}LargeText,?\\s*\\]\\}`,
      ),
      `${styleName} must opt into the large-text layout without changing the default layout`,
    );
  }

  assert.match(
    adventureSource,
    /heroSpeechLargeText:\s*\{[\s\S]*?position:\s*"relative"[\s\S]*?maxWidth:\s*"100%"[\s\S]*?width:\s*"100%"/,
  );
  assert.match(
    adventureSource,
    /heroCopyLargeText:\s*\{[\s\S]*?maxWidth:\s*"100%"[\s\S]*?width:\s*"100%"/,
  );
  assert.match(
    adventureSource,
    /levelRowLargeText:\s*\{[\s\S]*?position:\s*"relative"[\s\S]*?width:\s*"100%"[\s\S]*?flexWrap:\s*"wrap"/,
  );
});

test("Adventure subdues its decorative sprite behind the large-text flow", () => {
  assert.match(
    adventureSource,
    /style=\{\[\s*s\.heroSpriteStage,\s*usesLargeTextHeroLayout && s\.heroSpriteStageLargeText,?\s*\]\}/,
  );
  assert.match(
    adventureSource,
    /heroSpriteStageLargeText:\s*\{[\s\S]*?opacity:\s*0\.[0-4]/,
  );
  assert.match(adventureSource, /testID="adventure-mode-walk-sprite"/);
});
