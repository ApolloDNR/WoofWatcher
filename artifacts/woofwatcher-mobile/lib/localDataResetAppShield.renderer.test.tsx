import "./test-support/reactDomLifecycleHost.test.ts";

import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { LocalDataResetAppShield } from "@/components/LocalDataResetAppShield";
import {
  getControlledCalls,
  resetControlledGenericFailure,
} from "./test-support/controlledLocalDataResetContexts.test.ts";
import { document, type MiniElement } from "./test-support/reactDomLifecycleHost.test.ts";

test("the rendered shield exposes generic coordinator failure accessibly and Return is explicit", async () => {
  resetControlledGenericFailure();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container as never);

  try {
    await act(async () => {
      root.render(
        <LocalDataResetAppShield>
          <div aria-label="personal-app-frame">personal</div>
        </LocalDataResetAppShield>,
      );
    });

    assert.ok(find(container, "Local data deletion needs attention"));
    assert.ok(
      find(container, "Deletion coordinator. Failed owner ID: reset"),
    );
    assert.equal(find(container, "All data deleted"), null);
    assert.equal(find(container, "personal-app-frame"), null);
    assert.deepEqual(getControlledCalls(), { clearResult: 0, release: 0 });

    const returnButton = find(
      container,
      "Return without claiming deletion succeeded",
    );
    assert.ok(returnButton);
    await act(async () => {
      returnButton.click();
    });

    assert.deepEqual(getControlledCalls(), { clearResult: 1, release: 1 });
    assert.ok(find(container, "personal-app-frame"));
    assert.equal(find(container, "Local data deletion needs attention"), null);
  } finally {
    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  }
});

function find(container: MiniElement, accessibilityLabel: string): MiniElement | null {
  return container.querySelector(`[aria-label="${accessibilityLabel}"]`);
}
