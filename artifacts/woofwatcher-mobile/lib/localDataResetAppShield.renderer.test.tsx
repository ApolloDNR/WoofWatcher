import "./test-support/reactDomLifecycleHost.test.ts";

import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { LocalDataResetAppShield } from "@/components/LocalDataResetAppShield";
import {
  getControlledCalls,
  resetControlledFailure,
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
    assert.equal(find(container, "Local care content deleted"), null);
    assert.equal(find(container, "personal-app-frame"), null);
    assert.deepEqual(getControlledCalls(), {
      clearResult: 0,
      release: 0,
      runReset: 0,
    });

    const returnButton = find(
      container,
      "Return without claiming deletion succeeded",
    );
    assert.ok(returnButton);
    await act(async () => {
      returnButton.click();
    });

    assert.deepEqual(getControlledCalls(), {
      clearResult: 1,
      release: 1,
      runReset: 0,
    });
    assert.ok(find(container, "personal-app-frame"));
    assert.equal(find(container, "Local data deletion needs attention"), null);
  } finally {
    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  }
});

test("the rendered shield keeps nine failure rows scrollable while Retry and Return stay outside the scroller", async () => {
  resetControlledFailure([
    "auth-credentials",
    "avatar",
    "care",
    "device-preferences",
    "files",
    "query-cache",
    "walk-capture",
    "web-runtime",
    "work-drain",
  ]);
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

    assert.ok(container.querySelector("main"), "the shield must own a safe-area root");
    const failureScroller = container.querySelector("section");
    assert.ok(failureScroller, "failure details must be in a bounded scroller");
    for (const [label, id] of [
      ["Saved sign-in credentials", "auth-credentials"],
      ["Care twin & avatar", "avatar"],
      ["Care logs, routines & records", "care"],
      ["Device preferences", "device-preferences"],
      ["Files on this device", "files"],
      ["In-app account cache", "query-cache"],
      ["Active walk capture", "walk-capture"],
      ["Browser/runtime cache", "web-runtime"],
      ["Pending local changes", "work-drain"],
    ] as const) {
      assert.ok(
        find(failureScroller, `${label}. Failed owner ID: ${id}`),
        `${id} must remain available in the scrollable support detail`,
      );
    }
    assert.equal(
      failureScroller.querySelector("button"),
      null,
      "recovery actions must stay outside the shrinking failure body",
    );
    assert.equal(container.querySelectorAll("button").length, 2);

    const retryButton = find(container, "Retry deleting all local data");
    assert.ok(retryButton);
    await act(async () => {
      retryButton.click();
      await Promise.resolve();
    });
    assert.deepEqual(getControlledCalls(), {
      clearResult: 0,
      release: 0,
      runReset: 1,
    });
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
