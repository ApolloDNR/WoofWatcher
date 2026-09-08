import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const home = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "components",
    "LivingPhoenixRoom.tsx",
  ),
  "utf8",
);

const log = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "app",
    "(tabs)",
    "log.tsx",
  ),
  "utf8",
);

function sourceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `expected ${startMarker}`);
  assert.notEqual(end, -1, `expected ${endMarker} after ${startMarker}`);
  return source.slice(start, end);
}

test("Home uses one larger, rug-centered Phoenix scale without weakening motion guards", () => {
  assert.match(home, /const IMMERSIVE_TWIN_SIZE = 136;/);
  assert.match(
    home,
    /function getImmersiveSpriteZone[\s\S]*?left: "32%",[\s\S]*?top: "34%",[\s\S]*?width: IMMERSIVE_TWIN_SIZE,[\s\S]*?height: IMMERSIVE_TWIN_SIZE/,
  );
  assert.match(home, /const ROAM_RIG_SIZE = IMMERSIVE_TWIN_SIZE;/);
  assert.match(
    home,
    /const ROAM_RIG_CENTER_OFFSET_X = \(ROAM_RIG_BASELINE - ROAM_RIG_SIZE\) \/ 2;/,
  );
  assert.match(
    home,
    /roamRig: \{[\s\S]*?left: ROAM_RIG_CENTER_OFFSET_X,[\s\S]*?top: ROAM_RIG_BASELINE - ROAM_RIG_SIZE/,
  );
  assert.match(
    home,
    /styles\.speechTail,[\s\S]*?compactChrome \? styles\.speechTailCompact : null/,
  );
  assert.match(home, /speechTailCompact: \{\s*left: "66%",\s*\}/);
  assert.match(
    home,
    /const continuousMotionEnabled = sceneActive && !lowMotion && !reduced;/,
    "focus, visibility, scroll-pause, and Reduce Motion must continue to own ambient loops",
  );
});

test("Log reveals the selected care type with measured, reduced-motion-safe scrolling", () => {
  assert.match(log, /import \{ useReducedMotion \} from "react-native-reanimated";/);
  assert.match(log, /const reducedMotion = useReducedMotion\(\);/);
  assert.match(log, /const careTypeRailRef = useRef<ScrollView>\(null\);/);
  assert.match(
    log,
    /const careTypeRailLayouts = useRef<Record<string, \{ x: number; width: number \}>>\(\{\}\);/,
  );
  assert.match(log, /const careTypeRailViewportWidth = useRef\(0\);/);
  assert.match(
    log,
    /InteractionManager\.runAfterInteractions\(\(\) => revealSelectedCareType\(selectedType\)\)/,
  );

  const careTypeRail = sourceBetween(
    log,
    "<ScrollView\n              ref={careTypeRailRef}",
    "{/* Contextual controls */}",
  );
  assert.match(careTypeRail, /ref=\{careTypeRailRef\}/);
  assert.match(careTypeRail, /onLayout=\{\(event\) => \{/);
  assert.match(careTypeRail, /careTypeRailLayouts\.current\[q\.type\] = \{ x, width \};/);
  assert.match(careTypeRail, /revealSelectedCareType\(q\.type\)/);
  assert.match(log, /careTypeRailRef\.current\?\.scrollTo\(\{[\s\S]*?animated: !reducedMotion/);
});

test("Log compacts only the calm local-storage state and exposes real choice controls", () => {
  const calmStatus = sourceBetween(
    log,
    "{!SYNC_PROVIDER_CONFIGURED && state.entries.length > 0 ? (",
    "{SYNC_PROVIDER_CONFIGURED && syncOutbox.total > 0 ? (",
  );
  const retryStatus = sourceBetween(
    log,
    "{SYNC_PROVIDER_CONFIGURED && syncOutbox.total > 0 ? (",
    "{/* Composer card */}",
  );
  assert.match(calmStatus, /s\.savedDeviceStatus/);
  assert.doesNotMatch(calmStatus, /s\.outboxCard/);
  assert.match(retryStatus, /s\.outboxCard/);
  assert.match(log, /savedDeviceStatus: \{[\s\S]*?minHeight: 52/);

  const typeChipStyle = sourceBetween(log, "  typeChip: {", "  typeChipIcon:");
  const segPillStyle = sourceBetween(log, "  segPill: {", "  segText:");
  assert.match(typeChipStyle, /minHeight: MIN_MOBILE_TOUCH_TARGET/);
  assert.match(segPillStyle, /minHeight: MIN_MOBILE_TOUCH_TARGET/);

  const radioControls = log.match(/accessibilityRole="radio"/g)?.length ?? 0;
  assert.ok(radioControls >= 3, "care type, contextual, and stepper choices must expose radio semantics");
  assert.match(log, /accessibilityState=\{\{ checked: active, selected: active \}\}/);
});
