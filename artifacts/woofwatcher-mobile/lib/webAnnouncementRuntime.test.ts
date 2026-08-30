import assert from "node:assert/strict";
import { test } from "node:test";

import {
  document,
  type MiniElement,
} from "./test-support/reactDomLifecycleHost.test.ts";
import {
  announceOnWeb,
  clearWebAnnouncements,
  createWebAnnouncementRuntime,
  type WebAnnouncementRegion,
} from "./webAnnouncementRuntime.ts";

interface ScheduledAnnouncement {
  cancelled: boolean;
  run(): void;
}

function createControlledRuntime() {
  const scheduled: ScheduledAnnouncement[] = [];
  const regions: MiniElement[] = [];
  const runtime = createWebAnnouncementRuntime({
    isAvailable: () => true,
    createRegion: () => {
      const region = document.createElement("div");
      regions.push(region);
      return region;
    },
    isAttached: (region) =>
      (region as MiniElement).parentNode === document.body,
    attach: (region) => {
      document.body.appendChild(region as MiniElement);
    },
    detach: (region) => {
      const element = region as MiniElement;
      if (element.parentNode === document.body) {
        document.body.removeChild(element);
      }
    },
    schedule: (callback) => {
      const task: ScheduledAnnouncement = {
        cancelled: false,
        run: callback,
      };
      scheduled.push(task);
      return task;
    },
    cancel: (handle) => {
      (handle as ScheduledAnnouncement).cancelled = true;
    },
  });
  return { regions, runtime, scheduled };
}

test("announcement clear removes the live region and invalidates a callback that escaped cancellation", () => {
  const { regions, runtime, scheduled } = createControlledRuntime();

  runtime.announce("First update");
  const firstRegion = regions[0]!;
  const firstCallback = scheduled[0]!;
  assert.equal(firstRegion.parentNode, document.body);
  assert.equal(firstRegion.textContent, "");

  runtime.clear();
  assert.equal(firstCallback.cancelled, true);
  assert.equal(firstRegion.parentNode, null);
  assert.equal(firstRegion.textContent, "");

  firstCallback.run();
  assert.equal(firstRegion.parentNode, null);
  assert.equal(firstRegion.textContent, "");
});

test("a stale announcement cannot rewrite or replace a newer generation", () => {
  const { regions, runtime, scheduled } = createControlledRuntime();

  runtime.announce("Stale update");
  const staleCallback = scheduled[0]!;
  runtime.clear();
  runtime.announce("Current update");
  const currentRegion = regions[1]!;
  const currentCallback = scheduled[1]!;

  staleCallback.run();
  assert.equal(currentRegion.textContent, "");
  currentCallback.run();
  assert.equal(currentRegion.textContent, "Current update");

  runtime.clear();
});

test("the browser adapter creates an ARIA status node and clear prevents its delayed rewrite", async () => {
  announceOnWeb("Delayed browser update");
  const region = document.body.querySelector('[role="status"]');
  assert.ok(region);
  assert.equal(region.getAttribute("aria-live"), "polite");

  clearWebAnnouncements();
  assert.equal(document.body.querySelector('[role="status"]'), null);
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(region.textContent, "");
  assert.equal(region.parentNode, null);
});

test("clear reports cancellation and detach failures after invalidating the generation", () => {
  let scheduledCallback: (() => void) | null = null;
  const region: WebAnnouncementRegion = { textContent: "" };
  const runtime = createWebAnnouncementRuntime({
    isAvailable: () => true,
    createRegion: () => region,
    isAttached: () => true,
    attach: () => {},
    detach: () => {
      throw new Error("detach failed");
    },
    schedule: (callback) => {
      scheduledCallback = callback;
      return "timer";
    },
    cancel: () => {
      throw new Error("cancel failed");
    },
  });

  runtime.announce("Must stay gone");
  assert.throws(
    () => runtime.clear(),
    (error: unknown) =>
      error instanceof AggregateError && error.errors.length === 2,
  );
  scheduledCallback?.();
  assert.equal(region.textContent, "");
});
