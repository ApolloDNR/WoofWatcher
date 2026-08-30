import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const DOMAIN_BOUNDARIES = [
  "adventure.ts",
  "alone-time.ts",
  "care-intelligence.ts",
  "care-pass.ts",
  "care-trends.ts",
  "grooming-care.ts",
  "handoff.ts",
  "incident-watch.ts",
  "medication.ts",
  "mood-trend.ts",
  "potty-health.ts",
  "training-progress.ts",
  "walk-activity.ts",
  "water.ts",
  "weight-trend.ts",
] as const;

const MOBILE_BOUNDARIES = [
  "../../../artifacts/woofwatcher-mobile/lib/walkSession.ts",
  "../../../artifacts/woofwatcher-mobile/lib/aloneTimeSession.ts",
  "../../../artifacts/woofwatcher-mobile/lib/todayCommand.ts",
  "../../../artifacts/woofwatcher-mobile/components/more/AdventureScreen.tsx",
  "../../../artifacts/woofwatcher-mobile/app/(tabs)/log.tsx",
] as const;

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("every care-domain household visibility boundary delegates to the strict shared helper", () => {
  for (const file of DOMAIN_BOUNDARIES) {
    const contents = source(`../src/${file}`);
    if (file === "handoff.ts") {
      assert.match(
        contents,
        /const entries = selectSharedCareEvidence\(input\.entries \?\? \[\], now\)/,
        "handoff.ts must filter its raw exported-boundary input before any derivative",
      );
      continue;
    }
    assert.match(
      contents,
      /isHouseholdVisibleCareEvidence\s*\(/,
      file,
    );
  }
});

test("no care-domain or mobile household boundary retains fail-open boolean coercion", () => {
  const domainFiles = readdirSync(new URL("../src/", import.meta.url))
    .filter((file) => file.endsWith(".ts"));
  const sources = [
    ...domainFiles.map((file) => [`lib/care-domain/src/${file}`, source(`../src/${file}`)] as const),
    ...MOBILE_BOUNDARIES.map((file) => [file, source(file)] as const),
  ];

  for (const [file, contents] of sources) {
    assert.doesNotMatch(contents, /householdVisible\s*!==\s*false/, file);
    assert.doesNotMatch(contents, /householdVisible\s*===\s*false/, file);
  }
});

test("Today Command filters its raw exported-boundary input before every derivative", () => {
  const todayCommand = source(
    "../../../artifacts/woofwatcher-mobile/lib/todayCommand.ts",
  );
  assert.match(
    todayCommand,
    /const entries = selectSharedCareEvidence\(state\.entries \?\? \[\], now\)/,
  );
});

test("the shipping delete flow has no shared deletion-audit capability", () => {
  const log = source("../../../artifacts/woofwatcher-mobile/app/(tabs)/log.tsx");
  const careAudit = source("../src/care-audit.ts");
  const deleteFlow = log.slice(
    log.indexOf("const handleDelete = useCallback"),
    log.indexOf("const openEditEntry = useCallback"),
  );

  assert.match(deleteFlow, /runCareLogDeletionWithoutSharedAudit/);
  assert.doesNotMatch(log, /buildCareLogDeletionAuditEntry/);
  assert.doesNotMatch(deleteFlow, /\baddEntry\b|sharedAuditEntry/);
  assert.doesNotMatch(
    `${careAudit}\n${log}`,
    /CareLogDeletionAudit|buildCareLogDeletionAuditEntry|deletedEntrySnapshot/,
  );
});
