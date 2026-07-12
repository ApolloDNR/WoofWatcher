import assert from "node:assert/strict";
import { test } from "node:test";

import * as careEntryQuery from "../src/lib/care-entry-query.ts";

const { normalizeListCareEntriesQuery } = careEntryQuery;

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
