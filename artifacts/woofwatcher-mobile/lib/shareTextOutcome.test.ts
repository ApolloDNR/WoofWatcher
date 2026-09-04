import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyNativeShareAction,
  classifyWebShareError,
  presentShareResultDialog,
} from "./shareTextOutcome.ts";

test("classifies native share results without overstating Android completion", () => {
  assert.equal(classifyNativeShareAction("sharedAction", "ios"), "shared");
  assert.equal(
    classifyNativeShareAction("sharedAction", "android"),
    "unconfirmed",
  );
  assert.equal(
    classifyNativeShareAction("dismissedAction", "ios"),
    "dismissed",
  );
  assert.equal(
    classifyNativeShareAction("dismissedAction", "android"),
    "dismissed",
  );
  assert.equal(classifyNativeShareAction("unexpected", "ios"), "failed");
  assert.equal(classifyNativeShareAction(undefined, "android"), "failed");
});

test("classifies an aborted web share without claiming why it stopped", () => {
  assert.equal(classifyWebShareError({ name: "AbortError" }), "not-completed");
  assert.equal(
    classifyWebShareError(new Error("provider unavailable")),
    "failed",
  );
  assert.equal(classifyWebShareError(null), "failed");
});

test("suppresses helper result dialogs when the owning flow presents one unified result", () => {
  const presented: string[] = [];
  const notify = (title: string, message: string) => {
    presented.push(`${title}: ${message}`);
  };

  presentShareResultDialog(
    {},
    notify,
    "Copied to clipboard",
    "Ready to paste.",
  );
  presentShareResultDialog(
    { presentResultDialogs: false },
    notify,
    "Sharing unavailable",
    "Could not open.",
  );

  assert.deepEqual(presented, ["Copied to clipboard: Ready to paste."]);
});
