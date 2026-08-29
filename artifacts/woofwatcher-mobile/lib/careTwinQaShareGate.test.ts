import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { createExclusiveAsyncAction } from "./exclusiveAsyncAction.ts";

const QA_ROUTE = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
  "components",
  "owner",
  "CareTwinQaScreen.tsx",
);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("one QA report-share gate rejects every competing activation before duplicate work or dialogs start", async () => {
  const pendingShare = deferred();
  const gate = createExclusiveAsyncAction();
  const started: string[] = [];
  let failureDialogs = 0;

  const first = gate.run(async () => {
    started.push("summary");
    await pendingShare.promise;
    failureDialogs += 1;
  });
  const competingResults = await Promise.all(
    ["target-checklist", "fix-brief", "store-packet"].map((name) =>
      gate.run(async () => {
        started.push(name);
        failureDialogs += 1;
      }),
    ),
  );

  assert.deepEqual(competingResults, [
    { status: "busy" },
    { status: "busy" },
    { status: "busy" },
  ]);
  assert.deepEqual(started, ["summary"]);
  assert.equal(failureDialogs, 0);

  pendingShare.resolve();
  assert.deepEqual(await first, { status: "complete", value: undefined });
  assert.equal(failureDialogs, 1);
});

test("the owner QA route sends all four report handlers through one mounted-safe gate and disables every share trigger", () => {
  const source = readFileSync(QA_ROUTE, "utf8");
  const gateSetup = sourceBetween(
    source,
    "const qaScreenMountedRef",
    "const [qaSessionLoaded",
  );
  const runner = sourceBetween(
    source,
    "const runQaReportShare",
    "const shareQaSummary",
  );
  const handlers = [
    ["const shareQaSummary", "const shareFocusedTargetChecklist"],
    ["const shareFocusedTargetChecklist", "const shareFocusedFixBrief"],
    ["const shareFocusedFixBrief", "const shareStoreSubmissionPacket"],
    ["const shareStoreSubmissionPacket", "return ("],
  ] as const;

  assert.equal(
    gateSetup.match(
      /qaReportShareGateRef\.current = createExclusiveAsyncAction\(\)/g,
    )?.length,
    1,
    "the four report actions must share one gate instance",
  );
  assert.match(
    gateSetup,
    /const \[qaReportShareBusy, setQaReportShareBusy\] = useState\(false\)/,
  );
  assert.match(runner, /qaReportShareGate\.run/);
  assert.match(runner, /if \(!qaScreenMountedRef\.current\) return/);
  assert.match(runner, /setQaReportShareBusy\(true\)/);
  assert.match(
    runner,
    /if \(qaScreenMountedRef\.current\) setQaReportShareBusy\(false\)/,
  );

  for (const [start, end] of handlers) {
    const handler = sourceBetween(source, start, end);
    assert.match(handler, /runQaReportShare\(async \(\) =>/);
    assert.equal(handler.match(/shareTextPayload\(/g)?.length, 1);
  }

  assert.equal(
    source.match(/onPress=\{shareQaSummary\}/g)?.length,
    2,
    "both direct summary triggers stay wired to the gated handler",
  );
  assert.match(
    source,
    /onPress=\{\s*nextBetaTarget\s*\?\s*\(\)\s*=>\s*router\.push\(buildQaReturnRoute\(nextBetaTarget\) as never\)\s*:\s*shareQaSummary\s*\}/,
  );
  for (const handler of [
    "shareFocusedTargetChecklist",
    "shareFocusedFixBrief",
    "shareQaSummary",
    "shareStoreSubmissionPacket",
  ]) {
    const directTriggers = source.match(
      new RegExp(
        `accessibilityState=\\{\\{ disabled: qaReportShareBusy \\}\\}[\\s\\S]{0,160}?disabled=\\{qaReportShareBusy\\}[\\s\\S]{0,260}?onPress=\\{${handler}\\}`,
        "g",
      ),
    );
    assert.ok(
      directTriggers?.length,
      `${handler} needs a disabled accessible trigger`,
    );
  }
  assert.match(
    source,
    /accessibilityState=\{\{ disabled: qaReportShareBusy \}\}[\s\S]{0,200}?disabled=\{qaReportShareBusy\}[\s\S]{0,800}?onPress=\{\s*nextBetaTarget\s*\?[\s\S]{0,240}?:\s*shareQaSummary\s*\}/,
  );
});
