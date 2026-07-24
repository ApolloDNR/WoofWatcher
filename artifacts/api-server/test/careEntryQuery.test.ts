import assert from "node:assert/strict";
import { test } from "node:test";

import * as careEntryQuery from "../src/lib/care-entry-query.ts";

const {
  normalizeListCareEntriesQuery,
  normalizeListCareEntryHistoryQuery,
  normalizeCareEntryHouseholdScope,
  normalizeOptionalCareEntryHouseholdScope,
} = careEntryQuery;

const historyHouseholdId = "11111111-1111-4111-8111-111111111111";

test("care-entry list query preserves valid incremental pulls and limit clamps", () => {
  assert.equal(
    typeof normalizeListCareEntriesQuery,
    "function",
    "care-entry list routes need a shared query normalizer before provider sync relies on incremental pulls",
  );

  const query = normalizeListCareEntriesQuery({
    since: "2026-07-03T10:30:00.000Z",
    limit: "900",
  });

  assert.equal(query.ok, true);
  if (query.ok) {
    assert.equal(query.since?.toISOString(), "2026-07-03T10:30:00.000Z");
    assert.equal(query.limit, 500);
  }

  assert.deepEqual(normalizeListCareEntriesQuery({ limit: "-10" }), {
    ok: true,
    limit: 1,
  });
});

test("care-entry list query separates occurrence filters from server update cursors", () => {
  const query = normalizeListCareEntriesQuery({
    updatedSince: "2026-07-03T12:15:00.000Z",
    limit: "50",
  });

  assert.equal(query.ok, true);
  if (query.ok) {
    assert.equal(query.updatedSince?.toISOString(), "2026-07-03T12:15:00.000Z");
    assert.equal(query.limit, 50);
  }

  assert.deepEqual(
    normalizeListCareEntriesQuery({
      since: "2026-07-03T10:30:00.000Z",
      updatedSince: "2026-07-03T12:15:00.000Z",
    }),
    {
      ok: false,
      status: 400,
      error: "Use either since or updatedSince for care-entry sync, not both.",
    },
  );
});

test("care-entry list query rejects malformed incremental since values", () => {
  assert.deepEqual(normalizeListCareEntriesQuery({ since: "not-a-date" }), {
    ok: false,
    status: 400,
    error: "Invalid since query. Use an ISO date-time string.",
  });

  assert.deepEqual(normalizeListCareEntriesQuery({ since: "" }), {
    ok: false,
    status: 400,
    error: "Invalid since query. Use an ISO date-time string.",
  });

  assert.deepEqual(normalizeListCareEntriesQuery({ updatedSince: "not-a-date" }), {
    ok: false,
    status: 400,
    error: "Invalid updatedSince query. Use an ISO date-time string.",
  });
});

test("care-entry history query accepts one canonical cursor pair and expected generation", () => {
  assert.equal(
    typeof normalizeListCareEntryHistoryQuery,
    "function",
    "complete history needs a dedicated strict query normalizer",
  );

  const query = normalizeListCareEntryHistoryQuery({
    householdId: historyHouseholdId,
    beforeOccurredAt: "2026-07-23T12:15:00.000Z",
    beforeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    expectedGeneration: "42",
    limit: "250",
  });

  assert.equal(query.ok, true);
  if (query.ok) {
    assert.equal(
      query.beforeOccurredAt?.toISOString(),
      "2026-07-23T12:15:00.000Z",
    );
    assert.equal(query.beforeId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(query.expectedGeneration, 42);
    assert.equal(query.limit, 250);
  }

  assert.deepEqual(normalizeListCareEntryHistoryQuery({
    householdId: historyHouseholdId,
  }), {
    ok: true,
    limit: 500,
    householdId: historyHouseholdId,
  });
});

test("care-entry history cursor fields and generation are all-or-nothing", () => {
  const invalid = [
    {},
    { beforeOccurredAt: "2026-07-23T12:15:00.000Z" },
    { beforeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    {
      beforeOccurredAt: "2026-07-23T12:15:00.000Z",
      beforeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    },
    { expectedGeneration: "42" },
  ];

  for (const query of invalid) {
    const result = normalizeListCareEntryHistoryQuery(query);
    assert.equal(result.ok, false, JSON.stringify(query));
    if (!result.ok) assert.equal(result.status, 400);
  }
});

test("care-entry history rejects repeats, malformed cursors, and incremental modes", () => {
  const canonical = {
    householdId: historyHouseholdId,
    beforeOccurredAt: "2026-07-23T12:15:00.000Z",
    beforeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    expectedGeneration: "42",
  };
  const invalid = [
    { ...canonical, beforeOccurredAt: ["2026-07-23T12:15:00.000Z"] },
    { ...canonical, beforeId: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] },
    { ...canonical, expectedGeneration: ["42"] },
    { ...canonical, beforeOccurredAt: "2026-07-23" },
    { ...canonical, beforeOccurredAt: "July 23, 2026" },
    { ...canonical, beforeOccurredAt: "2026-02-30T12:15:00.000Z" },
    { ...canonical, beforeOccurredAt: "2026-07-23T25:15:00.000Z" },
    { ...canonical, beforeOccurredAt: "2026-07-23T12:15:00.000" },
    { ...canonical, beforeOccurredAt: "2026-07-23T12:15:00.0004Z" },
    { ...canonical, beforeOccurredAt: "not-a-date" },
    { ...canonical, beforeId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
    { ...canonical, beforeId: "not-a-uuid" },
    { ...canonical, householdId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
    { ...canonical, householdId: "not-a-uuid" },
    { ...canonical, expectedGeneration: "-1" },
    { ...canonical, expectedGeneration: "1.5" },
    { ...canonical, expectedGeneration: "9007199254740992" },
    { ...canonical, since: "2026-07-23T00:00:00.000Z" },
    { ...canonical, updatedSince: "2026-07-23T00:00:00.000Z" },
    { since: "2026-07-23T00:00:00.000Z" },
    { updatedSince: "2026-07-23T00:00:00.000Z" },
  ];

  for (const query of invalid) {
    const result = normalizeListCareEntryHistoryQuery(query);
    assert.equal(result.ok, false, JSON.stringify(query));
    if (!result.ok) assert.equal(result.status, 400);
  }

  const offset = normalizeListCareEntryHistoryQuery({
    ...canonical,
    beforeOccurredAt: "2026-07-23T05:15:00.000-07:00",
  });
  assert.equal(offset.ok, true);
  if (offset.ok) {
    assert.equal(
      offset.beforeOccurredAt?.toISOString(),
      "2026-07-23T12:15:00.000Z",
    );
  }
});

test("optional care-entry mutation scope accepts one canonical household id", () => {
  assert.deepEqual(normalizeOptionalCareEntryHouseholdScope({}), {
    ok: true,
  });
  assert.deepEqual(
    normalizeOptionalCareEntryHouseholdScope({
      householdId: historyHouseholdId,
    }),
    {
      ok: true,
      householdId: historyHouseholdId,
    },
  );
  for (const householdId of [
    ["11111111-1111-4111-8111-111111111111"],
    "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    "not-a-uuid",
    "",
  ]) {
    assert.deepEqual(
      normalizeOptionalCareEntryHouseholdScope({ householdId }),
      {
        ok: false,
        status: 400,
        error: "Invalid care-entry household scope.",
      },
    );
  }
});

test("required care transaction scope rejects missing household identity", () => {
  assert.deepEqual(normalizeCareEntryHouseholdScope({}), {
    ok: false,
    status: 400,
    error: "A canonical care-entry household scope is required.",
  });
  assert.deepEqual(
    normalizeCareEntryHouseholdScope({
      householdId: historyHouseholdId,
    }),
    {
      ok: true,
      householdId: historyHouseholdId,
    },
  );
});
