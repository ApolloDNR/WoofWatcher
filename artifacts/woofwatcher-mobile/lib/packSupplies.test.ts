import assert from "node:assert/strict";
import test from "node:test";

import {
  addItem,
  cycleStatus,
  DEFAULT_SUPPLIES,
  isDefaultUntouched,
  parseSupplies,
  removeItem,
  renameItem,
  serializeSupplies,
  type SupplyItem,
} from "./packSupplies.ts";

/** Deep-frozen copy of the defaults so mutation bugs throw instead of hiding. */
function frozenDefaults(): readonly SupplyItem[] {
  return Object.freeze(DEFAULT_SUPPLIES.map((item) => Object.freeze({ ...item }))) as readonly SupplyItem[];
}

test("defaults are the mockup checklist with untouched user-set state", () => {
  const essentials = DEFAULT_SUPPLIES.filter((item) => item.group === "essentials");
  const travel = DEFAULT_SUPPLIES.filter((item) => item.group === "travel");

  // Exact mockup rows, in mockup order.
  assert.deepEqual(
    essentials.map((item) => item.name),
    ["Food", "Treats", "Medications", "Poop Bags", "Toys"],
  );
  assert.deepEqual(
    travel.map((item) => item.name),
    ["Harness", "Leash", "Portable Bowl"],
  );

  // Honest defaults: essentials assume a stocked shelf, travel gear starts
  // unpacked, and nothing carries a timestamp the owner never created.
  for (const item of essentials) assert.equal(item.status, "plenty");
  for (const item of travel) assert.equal(item.status, "unpacked");
  for (const item of DEFAULT_SUPPLIES) assert.equal(item.updatedAt, null);

  // Stable readable ids, unique across the whole list.
  assert.equal(essentials[3].id, "essentials-poop-bags");
  assert.equal(travel[2].id, "travel-portable-bowl");
  assert.equal(new Set(DEFAULT_SUPPLIES.map((item) => item.id)).size, DEFAULT_SUPPLIES.length);
});

test("essentials cycle plenty -> low -> out -> plenty", () => {
  const food = DEFAULT_SUPPLIES.find((item) => item.id === "essentials-food")!;
  assert.equal(food.status, "plenty");
  const low = cycleStatus(food);
  assert.equal(low, "low");
  const out = cycleStatus({ ...food, status: low });
  assert.equal(out, "out");
  assert.equal(cycleStatus({ ...food, status: out }), "plenty");
});

test("travel cycles unpacked -> packed -> unpacked", () => {
  const leash = DEFAULT_SUPPLIES.find((item) => item.id === "travel-leash")!;
  assert.equal(leash.status, "unpacked");
  const packed = cycleStatus(leash);
  assert.equal(packed, "packed");
  assert.equal(cycleStatus({ ...leash, status: packed }), "unpacked");
});

test("a status foreign to the group resets to the calm baseline instead of crashing", () => {
  // Can only happen to a hand-corrupted object; parseSupplies rejects it.
  assert.equal(cycleStatus({ group: "essentials", status: "packed" }), "plenty");
  assert.equal(cycleStatus({ group: "travel", status: "low" }), "unpacked");
});

test("addItem appends a trimmed item with calm defaults and never mutates input", () => {
  const items = frozenDefaults();
  const next = addItem(items, "  Water Bottle  ", "travel");
  assert.ok(next);
  assert.equal(next.length, items.length + 1);
  const added = next[next.length - 1];
  assert.deepEqual(added, {
    id: "travel-water-bottle",
    name: "Water Bottle",
    group: "travel",
    status: "unpacked",
    updatedAt: null,
  });
  // New essentials start at plenty, also untouched.
  const withBalm = addItem(items, "Paw Balm", "essentials")!;
  assert.equal(withBalm[withBalm.length - 1].status, "plenty");
  assert.equal(withBalm[withBalm.length - 1].updatedAt, null);
  // Input list untouched (frozen would also have thrown on mutation).
  assert.deepEqual(items, frozenDefaults());
});

test("addItem rejects empty names and case-insensitive duplicates within a group", () => {
  const items = frozenDefaults();
  assert.equal(addItem(items, "", "essentials"), null);
  assert.equal(addItem(items, "   ", "travel"), null);
  assert.equal(addItem(items, "food", "essentials"), null);
  assert.equal(addItem(items, "  POOP BAGS ", "essentials"), null);
  // The same name in the OTHER group is legitimate (food at home vs packed food).
  const crossGroup = addItem(items, "Food", "travel");
  assert.ok(crossGroup);
  assert.equal(crossGroup[crossGroup.length - 1].group, "travel");
  // Ids stay unique even when slugs collide across groups + removals.
  assert.equal(crossGroup[crossGroup.length - 1].id, "travel-food");
  const twice = addItem(removeItem(crossGroup, "travel-food"), "Food!", "travel")!;
  assert.equal(twice[twice.length - 1].id, "travel-food");
});

test("addItem suffixes the id when the slug is already taken", () => {
  const items = frozenDefaults();
  // "Poop  Bags" in travel slugs to travel-poop-bags (no clash) while
  // "Food?" in essentials slugs straight into the existing essentials-food.
  const clash = addItem(removeItem(items, "essentials-food"), "Food", "essentials")!;
  const reclash = addItem(clash, "Food?", "essentials");
  // "Food?" trims/slugs to the same id but duplicates by name? No: "Food?"
  // is a different name, so it must land with a -2 suffix.
  assert.ok(reclash);
  assert.equal(reclash[reclash.length - 1].id, "essentials-food-2");
  assert.equal(reclash[reclash.length - 1].name, "Food?");
});

test("renameItem trims, keeps status history, and rejects bad names", () => {
  const items = frozenDefaults();
  const renamed = renameItem(items, "essentials-toys", "  Chew Toys ");
  assert.ok(renamed);
  const toy = renamed.find((item) => item.id === "essentials-toys")!;
  assert.equal(toy.name, "Chew Toys");
  assert.equal(toy.status, "plenty");
  // updatedAt stamps status answers only; a spelling fix is not one.
  assert.equal(toy.updatedAt, null);
  // Unknown id, empty name, or a name owned by a sibling all reject.
  assert.equal(renameItem(items, "essentials-missing", "Anything"), null);
  assert.equal(renameItem(items, "essentials-toys", "   "), null);
  assert.equal(renameItem(items, "essentials-toys", "treats"), null);
  // Re-casing itself is allowed (excluded from its own duplicate check),
  // and the same name in the other group does not block the rename.
  assert.ok(renameItem(items, "essentials-toys", "TOYS"));
  assert.ok(renameItem(items, "travel-leash", "Toys"));
  // Input untouched.
  assert.deepEqual(items, frozenDefaults());
});

test("removeItem returns a new array without the id", () => {
  const items = frozenDefaults();
  const next = removeItem(items, "travel-harness");
  assert.equal(next.length, items.length - 1);
  assert.ok(!next.some((item) => item.id === "travel-harness"));
  assert.notEqual(next, items);
  assert.deepEqual(items, frozenDefaults());
  // Removing an unknown id is a harmless no-op copy.
  assert.deepEqual(removeItem(items, "essentials-missing"), [...items]);
});

test("serialize/parse round-trips user-set statuses and timestamps exactly", () => {
  const stamped = DEFAULT_SUPPLIES.map((item) =>
    item.id === "essentials-food"
      ? { ...item, status: "low" as const, updatedAt: "2026-07-11T08:30:00.000Z" }
      : item.id === "travel-leash"
        ? { ...item, status: "packed" as const, updatedAt: "2026-07-12T07:15:00.000Z" }
        : { ...item },
  );
  const withCustom = addItem(stamped, "Water Bottle", "travel")!;
  assert.deepEqual(parseSupplies(serializeSupplies(withCustom)), withCustom);
  // A deliberately emptied list survives the trip too - empty is a real
  // user state, not a malformed one.
  assert.deepEqual(parseSupplies(serializeSupplies([])), []);
});

test("parseSupplies falls back to defaults on malformed input and never throws", () => {
  const fallbackCases: (string | null | undefined)[] = [
    null,
    undefined,
    "",
    "   ",
    "not json {",
    "42",
    '"a string"',
    "[]", // bare array: not the versioned payload shape
    "{}",
    JSON.stringify({ version: 2, items: [] }), // unknown version
    JSON.stringify({ version: 1, items: "nope" }),
    JSON.stringify({ version: 1, items: [{ id: "x" }] }), // missing fields
    JSON.stringify({
      version: 1,
      items: [{ id: "a", name: "Food", group: "pantry", status: "plenty", updatedAt: null }],
    }), // unknown group
    JSON.stringify({
      version: 1,
      items: [{ id: "a", name: "Food", group: "travel", status: "plenty", updatedAt: null }],
    }), // essentials status on a travel item
    JSON.stringify({
      version: 1,
      items: [{ id: "a", name: "Food", group: "essentials", status: "plenty", updatedAt: "yesterday-ish" }],
    }), // unparseable timestamp
    JSON.stringify({
      version: 1,
      items: [
        { id: "a", name: "Food", group: "essentials", status: "plenty", updatedAt: null },
        { id: "a", name: "Treats", group: "essentials", status: "plenty", updatedAt: null },
      ],
    }), // duplicate ids
    JSON.stringify({
      version: 1,
      items: [
        { id: "a", name: "Food", group: "essentials", status: "plenty", updatedAt: null },
        { id: "b", name: " food ", group: "essentials", status: "low", updatedAt: null },
      ],
    }), // duplicate names within a group (case/space-insensitive)
  ];
  for (const raw of fallbackCases) {
    const parsed = parseSupplies(raw);
    assert.deepEqual(parsed, [...DEFAULT_SUPPLIES], `expected defaults for ${String(raw)}`);
  }
  // The fallback is a fresh copy each time - callers may mutate it freely
  // without poisoning DEFAULT_SUPPLIES for the next parse.
  const first = parseSupplies(null);
  first[0].status = "out";
  assert.equal(parseSupplies(null)[0].status, "plenty");
  assert.equal(DEFAULT_SUPPLIES[0].status, "plenty");
});

test("isDefaultUntouched flags the starter list and nothing else", () => {
  assert.equal(isDefaultUntouched(DEFAULT_SUPPLIES), true);
  assert.equal(isDefaultUntouched(parseSupplies(null)), true);
  // Round-tripping the untouched defaults keeps them untouched.
  assert.equal(isDefaultUntouched(parseSupplies(serializeSupplies(DEFAULT_SUPPLIES))), true);

  // Any real user action flips it: a cycled status with its timestamp...
  const touched = DEFAULT_SUPPLIES.map((item) =>
    item.id === "essentials-food"
      ? { ...item, status: cycleStatus(item), updatedAt: "2026-07-12T09:00:00.000Z" }
      : item,
  );
  assert.equal(isDefaultUntouched(touched), false);
  // ...an added item, a removal, or a rename.
  assert.equal(isDefaultUntouched(addItem(DEFAULT_SUPPLIES, "Towel", "travel")!), false);
  assert.equal(isDefaultUntouched(removeItem(DEFAULT_SUPPLIES, "essentials-toys")), false);
  assert.equal(isDefaultUntouched(renameItem(DEFAULT_SUPPLIES, "travel-leash", "Long Leash")!), false);
  assert.equal(isDefaultUntouched([]), false);
});
