import { test } from "node:test";
import assert from "node:assert/strict";

async function loadLogSearch() {
  const domain = await import("../src/index.ts") as {
    deriveCareLogSearch?: (input: {
      entries: readonly unknown[];
      query?: string;
      type?: string | null;
      limit?: number;
    }) => {
      entries: Array<{ id?: string }>;
      total: number;
      query: string;
      type: string | null;
      hasActiveFilters: boolean;
      summary: string;
      emptyMessage: string;
    };
  };
  assert.equal(typeof domain.deriveCareLogSearch, "function", "deriveCareLogSearch should be exported");
  return domain.deriveCareLogSearch;
}

test("searches care logs across title, note, caregiver, details, and sticky notes", async () => {
  const deriveCareLogSearch = await loadLogSearch();
  const result = deriveCareLogSearch({
    query: "slicker",
    type: "grooming",
    entries: [
      {
        id: "meal",
        type: "meal",
        title: "Breakfast",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T07:00:00-07:00",
        note: "Used the slicker word in a meal note but this should be type-filtered out.",
      },
      {
        id: "brush",
        type: "grooming",
        title: "Evening brush",
        caregiver: "Emma",
        occurredAt: "2026-06-11T18:00:00-07:00",
        details: {
          groomingProducts: "Slicker brush",
          stickyNotes: [{ id: "s1", text: "Left coat soft.", caregiver: "Emma", createdAt: "2026-06-11T18:10:00-07:00" }],
        },
      },
    ],
  });

  assert.equal(result.total, 1);
  assert.equal(result.entries[0].id, "brush");
  assert.equal(result.type, "grooming");
  assert.equal(result.query, "slicker");
  assert.equal(result.hasActiveFilters, true);
  assert.match(result.summary, /1 matching log/);
});

test("normalizes type filters and sorts newest matching logs first", async () => {
  const deriveCareLogSearch = await loadLogSearch();
  const result = deriveCareLogSearch({
    type: "meds",
    query: "apoquel emma",
    entries: [
      {
        id: "old",
        type: "medication",
        title: "Apoquel",
        caregiver: "Emma",
        occurredAt: "2026-06-10T08:00:00-07:00",
      },
      {
        id: "new",
        type: "medicine",
        title: "Apoquel",
        caregiver: "Emma",
        occurredAt: "2026-06-11T08:00:00-07:00",
        details: { dose: "1 tablet" },
      },
      {
        id: "walk",
        type: "walk",
        title: "Apoquel pickup walk",
        caregiver: "Emma",
        occurredAt: "2026-06-11T09:00:00-07:00",
      },
    ],
  });

  assert.deepEqual(result.entries.map((entry) => entry.id), ["new", "old"]);
  assert.equal(result.type, "medication");
});

test("returns empty-state copy when active filters have no matches", async () => {
  const deriveCareLogSearch = await loadLogSearch();
  const result = deriveCareLogSearch({
    query: "purple dinosaur",
    type: "walk",
    entries: [
      {
        id: "walk",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T08:00:00-07:00",
      },
    ],
  });

  assert.equal(result.total, 0);
  assert.equal(result.hasActiveFilters, true);
  assert.match(result.summary, /No matching logs/);
  assert.match(result.emptyMessage, /No logs match/);
  assert.match(result.emptyMessage, /clear search/i);
});
