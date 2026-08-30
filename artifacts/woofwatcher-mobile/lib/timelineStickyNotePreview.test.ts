import assert from "node:assert/strict";
import test from "node:test";

const previewModule = await import("./timelineStickyNotePreview.ts").catch(
  () => ({
    getTimelineStickyNotePreview: undefined,
  }),
);

test("timeline sticky-note previews keep only the newest bounded notes without reordering data", () => {
  const getPreview = previewModule.getTimelineStickyNotePreview;
  assert.equal(
    typeof getPreview,
    "function",
    "timeline rows need a bounded sticky-note preview selector",
  );
  if (typeof getPreview !== "function") return;

  const notes = [
    { id: "one", text: "Oldest" },
    { id: "two", text: "Second" },
    { id: "three", text: "Third" },
    { id: "four", text: "Newest" },
  ];

  const preview = getPreview(notes, 2);

  assert.deepEqual(
    preview,
    {
      visibleNotes: [
        { id: "three", text: "Third" },
        { id: "four", text: "Newest" },
      ],
      hiddenCount: 2,
    },
    "the timeline should mount only the two newest notes and report the hidden count",
  );
  assert.deepEqual(
    notes.map((note) => note.id),
    ["one", "two", "three", "four"],
    "building the preview must not mutate persisted note order",
  );
});

test("timeline sticky-note previews preserve a short collection in full", () => {
  const getPreview = previewModule.getTimelineStickyNotePreview;
  assert.equal(typeof getPreview, "function");
  if (typeof getPreview !== "function") return;

  assert.deepEqual(getPreview([{ id: "only" }], 2), {
    visibleNotes: [{ id: "only" }],
    hiddenCount: 0,
  });
});
