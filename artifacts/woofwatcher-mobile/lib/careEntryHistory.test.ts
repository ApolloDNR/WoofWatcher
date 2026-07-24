import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertCareEntryHistoryRowsInHousehold,
  loadCompleteCareEntrySnapshot,
  type CareEntryHistoryPageRequest,
} from "./careSync.ts";

type HistoryEntry = {
  id: string;
  occurredAt: string;
  revision: number;
};

const HISTORY_GENERATION = 17;
const OCCURRED_AT = "2026-07-23T12:00:00.000Z";
const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOUSEHOLD_ID =
  "22222222-2222-4222-8222-222222222222";
const SNAPSHOT_OPTIONS = { householdId: HOUSEHOLD_ID };

function historyId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function historyRows(count: number): HistoryEntry[] {
  return Array.from({ length: count }, (_, offset) => ({
    id: historyId(count - offset),
    occurredAt: OCCURRED_AT,
    revision: 1,
  }));
}

function pagedFetcher(
  rows: readonly HistoryEntry[],
  calls: CareEntryHistoryPageRequest[],
) {
  return async (request: CareEntryHistoryPageRequest) => {
    calls.push({ ...request });
    const start = request.beforeId
      ? rows.findIndex((entry) => entry.id === request.beforeId) + 1
      : 0;
    return {
      entries: rows.slice(start, start + request.limit),
      historyGeneration: HISTORY_GENERATION,
      householdId: HOUSEHOLD_ID,
    };
  };
}

test("complete history loads 251 rows with a 250 page without exposing a partial result", async () => {
  assert.equal(
    typeof loadCompleteCareEntrySnapshot,
    "function",
    "complete history needs a private accumulator before CareContext can replace its cache",
  );
  const rows = historyRows(251);
  const calls: CareEntryHistoryPageRequest[] = [];

  const snapshot = await loadCompleteCareEntrySnapshot(
    pagedFetcher(rows, calls),
    250,
    SNAPSHOT_OPTIONS,
  );

  assert.equal(snapshot.historyGeneration, HISTORY_GENERATION);
  assert.deepEqual(snapshot.entries, rows);
  assert.deepEqual(calls, [
    { limit: 250, householdId: HOUSEHOLD_ID },
    {
      limit: 250,
      householdId: HOUSEHOLD_ID,
      beforeOccurredAt: OCCURRED_AT,
      beforeId: historyId(2),
      expectedGeneration: HISTORY_GENERATION,
    },
  ]);
});

test("complete history loads 501 rows at the default 500 page size", async () => {
  const rows = historyRows(501);
  const calls: CareEntryHistoryPageRequest[] = [];

  const snapshot = await loadCompleteCareEntrySnapshot(
    pagedFetcher(rows, calls),
    500,
    SNAPSHOT_OPTIONS,
  );

  assert.deepEqual(snapshot.entries, rows);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.limit, 500);
  assert.equal(calls[1]?.expectedGeneration, HISTORY_GENERATION);
});

test("an exact page multiple requires a final empty-tail request", async () => {
  const rows = historyRows(500);
  const calls: CareEntryHistoryPageRequest[] = [];

  const snapshot = await loadCompleteCareEntrySnapshot(
    pagedFetcher(rows, calls),
    500,
    SNAPSHOT_OPTIONS,
  );

  assert.deepEqual(snapshot.entries, rows);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.beforeId, historyId(1));
});

test("complete history rejects invalid page sizes before fetching", async () => {
  for (const pageSize of [0, -1, 1.5, 501, Number.NaN]) {
    let calls = 0;
    await assert.rejects(
      loadCompleteCareEntrySnapshot(async () => {
        calls += 1;
        return { entries: [], historyGeneration: HISTORY_GENERATION };
      }, pageSize, SNAPSHOT_OPTIONS),
      /page size/i,
    );
    assert.equal(calls, 0);
  }
});

test("complete history rejects every malformed page without returning partial rows", async () => {
  const first = historyRows(2);
  const malformedPages: Array<{ label: string; page: unknown }> = [
    {
      label: "missing envelope",
      page: undefined,
    },
    {
      label: "missing entries",
      page: { historyGeneration: HISTORY_GENERATION },
    },
    {
      label: "missing generation",
      page: { entries: [] },
    },
    {
      label: "non-array entries",
      page: { entries: {}, historyGeneration: HISTORY_GENERATION },
    },
    {
      label: "malformed row",
      page: {
        entries: [{ id: "not-a-uuid", occurredAt: OCCURRED_AT }],
        historyGeneration: HISTORY_GENERATION,
      },
    },
    {
      label: "malformed timestamp",
      page: {
        entries: [{ id: historyId(1), occurredAt: "2026-07-23" }],
        historyGeneration: HISTORY_GENERATION,
      },
    },
    {
      label: "invalid calendar timestamp",
      page: {
        entries: [
          {
            id: historyId(1),
            occurredAt: "2026-02-30T12:00:00.000Z",
            revision: 1,
          },
        ],
        historyGeneration: HISTORY_GENERATION,
      },
    },
    {
      label: "timestamp missing timezone",
      page: {
        entries: [
          {
            id: historyId(1),
            occurredAt: "2026-07-23T12:00:00.000",
            revision: 1,
          },
        ],
        historyGeneration: HISTORY_GENERATION,
      },
    },
    {
      label: "timestamp exceeds cursor millisecond precision",
      page: {
        entries: [
          {
            id: historyId(1),
            occurredAt: "2026-07-23T12:00:00.0004Z",
            revision: 1,
          },
        ],
        historyGeneration: HISTORY_GENERATION,
      },
    },
    ...[
      undefined,
      0,
      1.5,
      2_147_483_648,
    ].map((revision) => ({
      label: `invalid revision ${String(revision)}`,
      page: {
        entries: [
          {
            id: historyId(1),
            occurredAt: OCCURRED_AT,
            ...(revision === undefined ? {} : { revision }),
          },
        ],
        historyGeneration: HISTORY_GENERATION,
      },
    })),
    {
      label: "unsafe generation",
      page: {
        entries: [],
        historyGeneration: Number.MAX_SAFE_INTEGER + 1,
      },
    },
    {
      label: "negative generation",
      page: { entries: [], historyGeneration: -1 },
    },
    {
      label: "fractional generation",
      page: { entries: [], historyGeneration: 1.5 },
    },
    {
      label: "string generation",
      page: { entries: [], historyGeneration: "17" },
    },
    {
      label: "nan generation",
      page: { entries: [], historyGeneration: Number.NaN },
    },
    {
      label: "oversized page",
      page: {
        entries: historyRows(3),
        historyGeneration: HISTORY_GENERATION,
      },
    },
    {
      label: "out-of-order page",
      page: {
        entries: [...first].reverse(),
        historyGeneration: HISTORY_GENERATION,
      },
    },
    {
      label: "duplicate ids",
      page: {
        entries: [first[0], first[0]],
        historyGeneration: HISTORY_GENERATION,
      },
    },
  ];

  for (const { label, page } of malformedPages) {
    const previous = historyRows(1);
    let visible = previous;
    await assert.rejects(
      (async () => {
        const loaded = await loadCompleteCareEntrySnapshot(
          async () => page as never,
          2,
          SNAPSHOT_OPTIONS,
        );
        visible = loaded.entries;
      })(),
      undefined,
      label,
    );
    assert.equal(visible, previous, `${label} replaced the previous snapshot`);
  }
});

test("second-page failure, generation mismatch, and nonadvancing cursor return no partial snapshot", async () => {
  const previous = historyRows(1);

  for (const failure of ["fetch", "generation", "cursor"] as const) {
    let visible = previous;
    let call = 0;
    await assert.rejects(
      (async () => {
        const loaded = await loadCompleteCareEntrySnapshot(async () => {
          call += 1;
          if (call === 1) {
            return {
              entries: historyRows(2),
              historyGeneration: HISTORY_GENERATION,
              householdId: HOUSEHOLD_ID,
            };
          }
          if (failure === "fetch") throw new Error("page rejected");
          if (failure === "generation") {
            return {
              entries: [],
              historyGeneration: HISTORY_GENERATION + 1,
              householdId: HOUSEHOLD_ID,
            };
          }
          return {
            entries: historyRows(2),
            historyGeneration: HISTORY_GENERATION,
            householdId: HOUSEHOLD_ID,
          };
        }, 2, SNAPSHOT_OPTIONS);
        visible = loaded.entries;
      })(),
    );
    assert.equal(visible, previous, `${failure} exposed a partial snapshot`);
  }
});

test("cross-page duplicate and unique nonadvancing rows are rejected", async () => {
  const first = historyRows(2);
  const invalidSecondPages = [
    [first[1]],
    [
      {
        id: historyId(3),
        occurredAt: OCCURRED_AT,
        revision: 1,
      },
    ],
    [
      {
        id: historyId(1),
        occurredAt: "2026-07-23T13:00:00.000Z",
        revision: 1,
      },
    ],
  ];

  for (const invalidSecond of invalidSecondPages) {
    let call = 0;
    await assert.rejects(
      loadCompleteCareEntrySnapshot(async () => {
        call += 1;
        return {
          entries: call === 1 ? first : invalidSecond,
          historyGeneration: HISTORY_GENERATION,
          householdId: HOUSEHOLD_ID,
        };
      }, 2, SNAPSHOT_OPTIONS),
      /duplicate|advance|order/i,
    );
  }
});

test("equal-timestamp history is ordered by canonical UUID descending", async () => {
  const rows = historyRows(3);
  const snapshot = await loadCompleteCareEntrySnapshot(async () => ({
    entries: rows,
    historyGeneration: HISTORY_GENERATION,
    householdId: HOUSEHOLD_ID,
  }), 4, SNAPSHOT_OPTIONS);

  assert.deepEqual(
    snapshot.entries.map((entry) => entry.id),
    [historyId(3), historyId(2), historyId(1)],
  );
});

test("equal generations cannot mix two household scopes into one snapshot", async () => {
  const previous = historyRows(1);
  let visible = previous;
  let call = 0;

  await assert.rejects(
    (async () => {
      const loaded = await loadCompleteCareEntrySnapshot(async () => {
        call += 1;
        return {
          entries: call === 1 ? [historyRows(2)[0]] : [historyRows(2)[1]],
          historyGeneration: HISTORY_GENERATION,
          householdId:
            call === 1 ? HOUSEHOLD_ID : OTHER_HOUSEHOLD_ID,
        };
      }, 1, SNAPSHOT_OPTIONS);
      visible = loaded.entries;
    })(),
    /household.*changed|scope/i,
  );

  assert.equal(call, 2);
  assert.equal(visible, previous);
});

test("a valid H1 envelope cannot smuggle an H2 care row before mapping", () => {
  assert.throws(
    () =>
      assertCareEntryHistoryRowsInHousehold(
        [
          {
            householdId: OTHER_HOUSEHOLD_ID,
            id: historyId(1),
          },
        ],
        HOUSEHOLD_ID,
      ),
    /different household/i,
  );
  assert.doesNotThrow(() =>
    assertCareEntryHistoryRowsInHousehold(
      [{ householdId: HOUSEHOLD_ID, id: historyId(1) }],
      HOUSEHOLD_ID,
    ),
  );
});
