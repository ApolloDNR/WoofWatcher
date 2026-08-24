import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
);

function readMobile(...parts: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...parts), "utf8");
}

type UndoSurface = {
  label: string;
  source: string;
  handler: string;
  nextHandler: string;
  mountedRef: string;
  gate: string;
  busy: string;
};

const surfaces: UndoSurface[] = [
  {
    label: "Home quick-log feedback",
    source: readMobile("app", "(tabs)", "index.tsx"),
    handler: "const undoQuickFeedback = async () =>",
    nextHandler: "const openQuickFeedbackDetails =",
    mountedRef: "homeScreenMountedRef",
    gate: "quickFeedbackUndoGate",
    busy: "quickFeedbackUndoBusy",
  },
  {
    label: "Calendar routine feedback",
    source: readMobile("app", "(tabs)", "calendar.tsx"),
    handler: "const undoRoutineFeedback = async () =>",
    nextHandler: "const openRoutineFeedbackDetails =",
    mountedRef: "calendarScreenMountedRef",
    gate: "routineFeedbackUndoGate",
    busy: "routineFeedbackUndoBusy",
  },
  {
    label: "Adventure quest feedback",
    source: readMobile("components", "more", "AdventureScreen.tsx"),
    handler: "const undoQuestFeedback = async () =>",
    nextHandler: "const openQuestFeedbackDetails =",
    mountedRef: "adventureScreenMountedRef",
    gate: "questFeedbackUndoGate",
    busy: "questFeedbackUndoBusy",
  },
  {
    label: "Log quick-log feedback",
    source: readMobile("app", "(tabs)", "log.tsx"),
    handler: "const undoLastQuickLog = async () =>",
    nextHandler: "const openLastQuickLogDetails =",
    mountedRef: "logScreenMountedRef",
    gate: "lastQuickLogUndoGate",
    busy: "lastQuickLogUndoBusy",
  },
];

test("all four Undo surfaces synchronously reject duplicate deletes and keep outcomes mounted-safe", () => {
  for (const surface of surfaces) {
    const handlerStart = surface.source.indexOf(surface.handler);
    const handlerEnd = surface.source.indexOf(surface.nextHandler, handlerStart);
    assert.ok(handlerStart >= 0, `${surface.label}: Undo handler must exist`);
    assert.ok(handlerEnd > handlerStart, `${surface.label}: Undo handler boundary must exist`);
    const handler = surface.source.slice(handlerStart, handlerEnd);

    assert.match(
      surface.source,
      /import \{ createExclusiveAsyncAction \} from "@\/lib\/exclusiveAsyncAction";/,
      `${surface.label}: must use the shared synchronous admission gate`,
    );
    assert.match(
      surface.source,
      new RegExp(`${surface.gate}Ref\\.current = createExclusiveAsyncAction\\(\\)`),
      `${surface.label}: must own one stable gate`,
    );
    assert.match(
      handler,
      new RegExp(`${surface.gate}\\.run\\(async \\(\\) =>`),
      `${surface.label}: the delete must run inside the gate`,
    );
    assert.match(
      handler,
      new RegExp(`set${surface.busy[0]!.toUpperCase()}${surface.busy.slice(1)}\\(true\\)`),
      `${surface.label}: must expose pending state`,
    );
    assert.match(
      handler,
      new RegExp(`if \\(!${surface.mountedRef}\\.current\\) return`),
      `${surface.label}: late delete outcomes must not update an unmounted screen`,
    );
    assert.match(
      handler,
      /notifyDialog\(\s*"Undo not completed"/,
      `${surface.label}: failed deletion must not be presented as success or version protection`,
    );
    assert.match(
      handler,
      new RegExp(`if \\(${surface.mountedRef}\\.current\\) \\{?[\\s\\S]*set${surface.busy[0]!.toUpperCase()}${surface.busy.slice(1)}\\(false\\)`),
      `${surface.label}: pending state must settle only while mounted`,
    );

    const disabledCount = surface.source.match(
      new RegExp(`disabled=\\{${surface.busy}\\}`, "g"),
    )?.length ?? 0;
    const accessibilityCount = surface.source.match(
      new RegExp(`accessibilityState=\\{\\{ disabled: ${surface.busy} \\}\\}`, "g"),
    )?.length ?? 0;
    assert.ok(
      disabledCount >= 2,
      `${surface.label}: Undo and Add details must both disable while deletion settles`,
    );
    assert.ok(
      accessibilityCount >= 2,
      `${surface.label}: both disabled actions must expose the state to assistive technology`,
    );
  }
});

test("all paired Add details actions synchronously refuse navigation while Undo is pending", () => {
  for (const surface of surfaces) {
    const detailsStart = surface.source.indexOf(surface.nextHandler);
    assert.ok(detailsStart >= 0, `${surface.label}: paired action handler must exist`);
    const detailsWindow = surface.source.slice(detailsStart, detailsStart + 500);
    assert.match(
      detailsWindow,
      new RegExp(`if \\(${surface.gate}\\.isBusy\\(\\)\\) return`),
      `${surface.label}: paired navigation must honor the synchronous gate before React rerenders`,
    );
  }
});
