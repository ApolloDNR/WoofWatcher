import { test } from "node:test";
import assert from "node:assert/strict";

import { appendStickyNote, getStickyNotes } from "../src/index.ts";

test("appends a sticky note while preserving existing log details", () => {
  const details = appendStickyNote(
    {
      portion: "half",
      stickyNotes: [
        {
          id: "note_1",
          text: "Left a few pieces.",
          caregiver: "Emma",
          createdAt: "2026-06-06T14:00:00.000Z",
          color: "sage",
        },
      ],
    },
    {
      id: "note_2",
      text: "  Ate the rest after a walk.  ",
      caregiver: "Apollo",
      createdAt: "2026-06-06T15:00:00.000Z",
      color: "sun",
    },
  );

  const notes = getStickyNotes(details);

  assert.equal(details.portion, "half");
  assert.equal(notes.length, 2);
  assert.deepEqual(notes[1], {
    id: "note_2",
    text: "Ate the rest after a walk.",
    caregiver: "Apollo",
    createdAt: "2026-06-06T15:00:00.000Z",
    color: "sun",
  });
});

test("ignores blank sticky notes", () => {
  const original = { portion: "full" };
  const details = appendStickyNote(original, {
    id: "note_blank",
    text: "   ",
    caregiver: "Apollo",
    createdAt: "2026-06-06T15:00:00.000Z",
  });

  assert.deepEqual(details, original);
});

test("sanitizes malformed sticky note detail data", () => {
  const notes = getStickyNotes({
    stickyNotes: [
      { id: "good", text: "Good note", caregiver: "Apollo", createdAt: "2026-06-06T15:00:00.000Z" },
      { id: "missing-text", caregiver: "Apollo", createdAt: "2026-06-06T15:00:00.000Z" },
      "not a note",
    ],
  });

  assert.deepEqual(notes, [
    {
      id: "good",
      text: "Good note",
      caregiver: "Apollo",
      createdAt: "2026-06-06T15:00:00.000Z",
      color: "sage",
    },
  ]);
});
