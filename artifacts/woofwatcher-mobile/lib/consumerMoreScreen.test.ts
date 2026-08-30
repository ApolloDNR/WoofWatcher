import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import test from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const CONSUMER_MORE_SCREEN = readFileSync(
  join(MOBILE_ROOT, "components", "more", "ConsumerMoreScreen.tsx"),
  "utf8",
);
const MOBILE_LAYOUT = readFileSync(
  join(MOBILE_ROOT, "lib", "mobileLayout.ts"),
  "utf8",
);

const LOCAL_IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;]*?\s+from\s+)?["']([^"']+)["']\s*;/g;

function resolveLocalModule(fromFile: string, request: string): string | null {
  const consumerRequest =
    request === "@/components/owner/AvatarSpriteProductionPanel"
      ? "@/components/owner/AvatarSpriteProductionPanelUnavailable"
      : request;
  const base = consumerRequest.startsWith("@/")
    ? join(MOBILE_ROOT, consumerRequest.slice(2))
    : consumerRequest.startsWith(".")
      ? join(dirname(fromFile), consumerRequest)
      : null;
  if (!base) return null;

  const candidates = extname(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectRuntimeGraph(entry: string): ReadonlyMap<string, string> {
  const graph = new Map<string, string>();
  const pending = [entry];

  while (pending.length > 0) {
    const file = normalize(pending.pop()!);
    if (graph.has(file)) continue;
    const source = readFileSync(file, "utf8");
    graph.set(file, source);

    for (const match of source.matchAll(LOCAL_IMPORT_PATTERN)) {
      if (match[1]) continue;
      const dependency = resolveLocalModule(file, match[2]);
      if (dependency) pending.push(dependency);
    }
  }

  return graph;
}

test("consumer More routes sections through its consumer-only router and renders a deferred searchable grouped directory", () => {
  assert.match(
    CONSUMER_MORE_SCREEN,
    /import React, \{ useDeferredValue, useMemo, useState \} from "react";/,
  );
  assert.match(
    CONSUMER_MORE_SCREEN,
    /import ConsumerMoreSectionRouter from "@\/components\/more\/ConsumerMoreSectionRouter";/,
  );
  assert.match(
    CONSUMER_MORE_SCREEN,
    /const deferredQuery = useDeferredValue\(query\);/,
  );
  assert.match(CONSUMER_MORE_SCREEN, /searchMoreDirectory\(deferredQuery\)/);
  assert.match(
    CONSUMER_MORE_SCREEN,
    /MORE_DIRECTORY_GROUPS\.map\(\(group\) =>/,
  );
  assert.match(CONSUMER_MORE_SCREEN, /<ConsumerMoreSectionRouter\b/);
  assert.match(
    CONSUMER_MORE_SCREEN,
    /renderRoot=\{\(\) => <ConsumerMoreRoot \/>\}/,
  );
});

test("consumer More keeps every interactive directory control at least 48 points tall", () => {
  assert.match(MOBILE_LAYOUT, /export const MIN_MOBILE_TOUCH_TARGET = 48;/);
  assert.match(
    CONSUMER_MORE_SCREEN,
    /searchField: \{[\s\S]*?minHeight: MIN_MOBILE_TOUCH_TARGET,[\s\S]*?\},/,
  );
  assert.match(
    CONSUMER_MORE_SCREEN,
    /clearButton: \{[\s\S]*?width: MIN_MOBILE_TOUCH_TARGET,[\s\S]*?minHeight: MIN_MOBILE_TOUCH_TARGET,[\s\S]*?\},/,
  );

  const destinationRowMinHeight = CONSUMER_MORE_SCREEN.match(
    /destinationRow: \{[\s\S]*?minHeight: (\d+),/,
  );
  assert.ok(
    destinationRowMinHeight,
    "destination rows must define a minimum height",
  );
  assert.ok(
    Number(destinationRowMinHeight[1]) >= 48,
    "destination rows must meet the 48-point mobile touch target",
  );
});

test("consumer More runtime graph excludes owner launch, QA, and support implementations", () => {
  const graph = collectRuntimeGraph(
    join(MOBILE_ROOT, "components", "more", "ConsumerMoreScreen.tsx"),
  );
  const graphPaths = [...graph.keys()].map((path) =>
    path.slice(MOBILE_ROOT.length + 1).replaceAll("\\", "/"),
  );
  const graphSource = [...graph.values()].join("\n");
  const forbiddenOwnerPaths = [
    "betaHandoffPacket",
    "components/more/MoreSectionRouter.tsx",
    "components/more/PrivacyDataScreen.tsx",
    "components/owner/CareTwinQaScreen.tsx",
    "launchReadiness",
    "mobileLaunchQa",
    "mobileQaSession",
    "releasePacket",
    "storeSubmissionPacket",
    "supportRunbook",
  ];
  const forbiddenOwnerMarkers = [
    "deriveLaunchProviderSetup",
    "deriveSupportRunbookPlan",
    "Device Review Matrix",
    "Launch Command Hub",
    "Launch Workflow QA",
    "Native QA Next Captures",
    "Open sprite QA cockpit",
    "Open QA Cockpit",
    "Provider Launch Setup",
    "Store Submission Packet",
    "avatar-sprite-production-review",
  ];

  for (const dependency of forbiddenOwnerPaths) {
    assert.ok(
      !graphPaths.some((path) => path.includes(dependency)),
      `consumer More runtime graph must not include owner path ${dependency}`,
    );
  }
  for (const command of forbiddenOwnerMarkers) {
    assert.ok(
      !graphSource.includes(command),
      `consumer More runtime graph must not expose owner command ${command}`,
    );
  }

  assert.ok(
    graphPaths.includes("components/more/ConsumerMoreSectionRouter.tsx"),
    "consumer More must route through the consumer-only section boundary",
  );
  assert.ok(
    graphPaths.includes("components/more/ConsumerPrivacyDataScreen.tsx"),
    "consumer More must use the consumer-only privacy surface",
  );
});
