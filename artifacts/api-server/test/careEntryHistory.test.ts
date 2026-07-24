import assert from "node:assert/strict";
import { test } from "node:test";

import * as careEntryHistory from "../src/lib/care-entry-history.ts";

const { readCoherentCareEntryHistoryPage } = careEntryHistory;

test("history page is labeled only when generation is stable before and after its rows", async () => {
  assert.equal(
    typeof readCoherentCareEntryHistoryPage,
    "function",
    "the history route needs an explicit pre/query/post coherence boundary",
  );
  const reads: string[] = [];
  const result = await readCoherentCareEntryHistoryPage({
    expectedGeneration: 7,
    readGeneration: async () => {
      reads.push("generation");
      return 7;
    },
    readRows: async () => {
      reads.push("rows");
      return [{ id: "row_1" }];
    },
  });

  assert.deepEqual(reads, ["generation", "rows", "generation"]);
  assert.deepEqual(result, {
    ok: true,
    historyGeneration: 7,
    entries: [{ id: "row_1" }],
  });

  const firstPage = await readCoherentCareEntryHistoryPage({
    readGeneration: async () => 9,
    readRows: async () => [],
  });
  assert.deepEqual(firstPage, {
    ok: true,
    historyGeneration: 9,
    entries: [],
  });
});

test("history page rejects expected, in-query, and post-query generation changes", async () => {
  const scenarios = [
    { expectedGeneration: 6, generations: [7, 7] },
    { expectedGeneration: 7, generations: [7, 8] },
  ];

  for (const scenario of scenarios) {
    const generations = [...scenario.generations];
    const result = await readCoherentCareEntryHistoryPage({
      expectedGeneration: scenario.expectedGeneration,
      readGeneration: async () => generations.shift(),
      readRows: async () => [{ id: "must-not-be-labeled-newer" }],
    });
    assert.deepEqual(result, {
      ok: false,
      status: 409,
      error: "Care history changed during pagination. Restart from the first page.",
      currentGeneration: scenario.generations[1],
    });
  }
});
