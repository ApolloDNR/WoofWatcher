import assert from "node:assert/strict";
import test from "node:test";
import {
  MORE_DIRECTORY_GROUPS,
  searchMoreDirectory,
} from "./moreDirectory.ts";

test("keeps the More directory grouped in canonical product order", () => {
  assert.deepEqual(MORE_DIRECTORY_GROUPS.map((group) => group.title), [
    "Dog",
    "People & Home",
    "Experiences",
    "App & Privacy",
  ]);
  assert.deepEqual(
    MORE_DIRECTORY_GROUPS.map((group) => group.items.map((item) => item.label)),
    [
      ["Dog Profile", "Avatar Studio"],
      ["Care Team", "Care Team & Supplies"],
      ["Story & Progress", "Adventure", "WoofGuide"],
      ["Settings", "Privacy & Data", "Legal", "Share Care Pass"],
    ],
  );
});

test("uses closed typed destinations and keeps Care Pass in Health", () => {
  const items = MORE_DIRECTORY_GROUPS.flatMap((group) => group.items);
  for (const item of items) {
    assert.equal("pathname" in item.destination, false, item.label);
  }
  assert.deepEqual(
    items.find((item) => item.label === "Share Care Pass")?.destination,
    { parent: "health", section: "care-pass" },
  );
  assert.deepEqual(
    items.filter((item) => item.label !== "Share Care Pass").map((item) => item.destination.parent),
    Array(items.length - 1).fill("more"),
  );
});

test("finds destinations from literal owner vocabulary and synonyms", () => {
  const cases = [
    ["vet report", ["Share Care Pass"]],
    ["delete data", ["Privacy & Data"]],
    ["caregiver", ["Care Team"]],
    ["supplies", ["Care Team & Supplies"]],
    ["  TRAVEL  ", ["Care Team & Supplies"]],
    ["story", ["Story & Progress"]],
    ["memories", ["Story & Progress"]],
    ["guide", ["WoofGuide"]],
    ["help", ["Settings"]],
    ["settings", ["Settings"]],
    ["export", ["Privacy & Data"]],
    ["privacy", ["Privacy & Data"]],
    ["legal", ["Legal"]],
    ["no matching destination", []],
  ] as const;
  for (const [query, labels] of cases) {
    assert.deepEqual(searchMoreDirectory(query).map((item) => item.label), labels, query);
  }
  assert.deepEqual(
    searchMoreDirectory("").map((item) => item.label),
    MORE_DIRECTORY_GROUPS.flatMap((group) => group.items.map((item) => item.label)),
  );
});
