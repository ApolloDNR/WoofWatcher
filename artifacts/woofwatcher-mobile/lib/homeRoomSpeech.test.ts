import assert from "node:assert/strict";
import { test } from "node:test";

import { getHomeRoomSpeech } from "./homeRoomSpeech.ts";

test("keeps upbeat Phoenix room speech aligned with the local time of day", () => {
  assert.equal(
    getHomeRoomSpeech("happy", 8),
    "Good morning!\nWhat's next?\nI'm ready!",
  );
  assert.equal(
    getHomeRoomSpeech("calm", 14),
    "Good afternoon!\nWhat's next?\nI'm ready!",
  );
  assert.equal(
    getHomeRoomSpeech("excited", 21),
    "Good evening!\nWhat's next?\nI'm ready!",
  );
});

test("does not invent an upcoming walk when Home has no walk-specific speech", () => {
  assert.doesNotMatch(getHomeRoomSpeech("calm", 14), /walk/i);
});

test("keeps concern speech care-aware instead of replacing it with a greeting", () => {
  assert.equal(
    getHomeRoomSpeech("anxious", 8),
    "Stay close today.\nA calm plan helps.",
  );
  assert.equal(
    getHomeRoomSpeech("unwell", 21),
    "Tummy feels off.\nLet's watch gently.",
  );
});

test("normalizes invalid hours without producing misleading copy", () => {
  assert.equal(
    getHomeRoomSpeech("happy", Number.NaN),
    "Hello!\nWhat's next?\nI'm ready!",
  );
});
