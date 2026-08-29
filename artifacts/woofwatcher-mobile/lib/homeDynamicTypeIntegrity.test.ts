import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function readMobile(...segments: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...segments), "utf8");
}

test("consumer Home gives large Dynamic Type room without changing the normal hero", () => {
  const home = readMobile("app", "(tabs)", "index.tsx");

  assert.match(home, /const \{ fontScale \} = useWindowDimensions\(\)/);
  assert.match(
    home,
    /fontScale >= 1\.5 \? Math\.ceil\(72 \* \(fontScale - 1\)\) : 0/,
  );
  assert.match(
    home,
    /Math\.round\(heroStageWidth \/ homeFirstScreenLayout\.heroAspectRatio\) \+\s*largeTextHeroHeight/,
  );
});

test("compact large-text room repositions speech and hides only the reaction card", () => {
  const room = readMobile("components", "LivingPhoenixRoom.tsx");

  assert.match(room, /const \{ fontScale \} = useWindowDimensions\(\)/);
  assert.match(
    room,
    /const compactLargeText = compactChrome && fontScale >= 1\.5/,
  );
  assert.match(
    room,
    /compactLargeText \? styles\.speechBubbleCompactLargeText : null/,
  );
  assert.match(
    room,
    /speechBubbleCompactLargeText:\s*\{\s*top: 16,\s*left: 12,\s*maxWidth: "52%"/,
  );
  assert.match(room, /\{activeReaction && !compactLargeText \? \(/);

  // The card suppression is presentation-only: the reaction still owns the
  // sprite pose and the separate burst, while speech and tactile feedback stay.
  assert.match(
    room,
    /const activeSpriteAction =\s*activeReaction\?\.spriteAction/,
  );
  assert.match(
    room,
    /\{activeReaction \? \(\s*<Animated\.View\s*pointerEvents="none"\s*style=\{\[styles\.actionBurst/,
  );
  assert.match(room, /\{!isStudio \? \(\s*<View\s*style=\{\[/);
  assert.match(
    room,
    /Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/,
  );
});
