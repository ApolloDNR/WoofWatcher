import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SUPPLIES, type SupplyItem } from "./packSupplies.ts";
import {
  activateTravelBag,
  completeTravelBag,
  defaultTravelBag,
  parseTravelBag,
  redoTravelBag,
  renameTravelBag,
  reopenTravelBag,
  resetTravelItems,
  serializeTravelBag,
  type TravelBagSession,
} from "./travelBag.ts";

const NOW = "2026-07-21T12:00:00.000Z";
const LATER = "2026-07-21T18:30:00.000Z";

test("default bag is packing with no timestamps", () => {
  const bag = defaultTravelBag();
  assert.equal(bag.phase, "packing");
  assert.equal(bag.label, "Travel bag");
  assert.equal(bag.activatedAt, null);
  assert.equal(bag.completedAt, null);
});

test("activate is refused when nothing is packed (no empty-bag activation)", () => {
  assert.equal(activateTravelBag(defaultTravelBag(), 0, NOW), null);
  assert.equal(activateTravelBag(defaultTravelBag(), -1, NOW), null);
});

test("activate with packed items moves to active and stamps activatedAt", () => {
  const bag = activateTravelBag(defaultTravelBag(), 2, NOW);
  assert.ok(bag);
  assert.equal(bag.phase, "active");
  assert.equal(bag.activatedAt, NOW);
  assert.equal(bag.completedAt, null);
});

test("complete stamps completedAt and keeps the activation stamp", () => {
  const active = activateTravelBag(defaultTravelBag(), 3, NOW)!;
  const done = completeTravelBag(active, LATER);
  assert.equal(done.phase, "complete");
  assert.equal(done.activatedAt, NOW);
  assert.equal(done.completedAt, LATER);
});

test("reopen sends an active bag back to packing and clears activation", () => {
  const active = activateTravelBag(defaultTravelBag(), 1, NOW)!;
  const back = reopenTravelBag(active);
  assert.equal(back.phase, "packing");
  assert.equal(back.activatedAt, null);
  assert.equal(back.completedAt, null);
});

test("redo returns to packing, clears timestamps, and keeps the label", () => {
  const named = renameTravelBag(defaultTravelBag(), "Weekend trip");
  const done = completeTravelBag(activateTravelBag(named, 2, NOW)!, LATER);
  const next = redoTravelBag(done);
  assert.equal(next.phase, "packing");
  assert.equal(next.activatedAt, null);
  assert.equal(next.completedAt, null);
  assert.equal(next.label, "Weekend trip");
});

test("rename trims; an empty name is a no-op that keeps the label", () => {
  const named = renameTravelBag(defaultTravelBag(), "  Vet visit  ");
  assert.equal(named.label, "Vet visit");
  assert.equal(renameTravelBag(named, "   ").label, "Vet visit");
});

test("resetTravelItems unpacks only travel gear and nulls its timestamps", () => {
  const packed: SupplyItem[] = DEFAULT_SUPPLIES.map((item) =>
    item.group === "travel"
      ? { ...item, status: "packed", updatedAt: NOW }
      : { ...item, status: "low", updatedAt: NOW },
  );
  const reset = resetTravelItems(packed);
  for (const item of reset) {
    if (item.group === "travel") {
      assert.equal(item.status, "unpacked");
      assert.equal(item.updatedAt, null);
    } else {
      // Essentials are untouched by a travel-bag redo.
      assert.equal(item.status, "low");
      assert.equal(item.updatedAt, NOW);
    }
  }
});

test("serialize round-trips through parse exactly", () => {
  const bag: TravelBagSession = completeTravelBag(
    activateTravelBag(renameTravelBag(defaultTravelBag(), "Beach"), 2, NOW)!,
    LATER,
  );
  assert.deepEqual(parseTravelBag(serializeTravelBag(bag)), bag);
});

test("parse never throws and falls back to a packing default on garbage", () => {
  for (const bad of [null, undefined, "", "   ", "{not json", "[]", "{}", JSON.stringify({ version: 2, phase: "active" })]) {
    const bag = parseTravelBag(bad as string | null | undefined);
    assert.equal(bag.phase, "packing");
    assert.equal(bag.activatedAt, null);
  }
});

test("parse rejects an unknown phase or bad timestamp back to default", () => {
  assert.equal(parseTravelBag(JSON.stringify({ version: 1, phase: "shipping" })).phase, "packing");
  assert.equal(
    parseTravelBag(JSON.stringify({ version: 1, phase: "active", activatedAt: "not-a-date" })).phase,
    "packing",
  );
});

test("an existing user with no stored bag defaults to packing, never auto-active", () => {
  // Migration honesty: a previously-packed checklist must NOT jump to active
  // without an owner tap.
  assert.equal(parseTravelBag(null).phase, "packing");
});
