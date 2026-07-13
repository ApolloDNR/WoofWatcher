import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bucketAverages,
  bucketCounts,
  bucketIndexOf,
  bucketSums,
  buildTrendWindow,
  polylineLength,
  TREND_WINDOWS,
} from "./trendsChart.ts";

// Fixed local reference instant: Thursday, May 8 2025, 10:30 local time.
// Everything in trendsChart uses local calendar getters, so these assertions
// hold regardless of the test runner's timezone.
const NOW = new Date(2025, 4, 8, 10, 30, 0).getTime();

test("exposes the four segmented windows in order", () => {
  assert.deepEqual(
    TREND_WINDOWS.map((w) => w.key),
    ["day", "week", "month", "year"],
  );
});

test("week window is 7 trailing calendar days with the mock's date range", () => {
  const win = buildTrendWindow("week", NOW);
  assert.equal(win.buckets.length, 7);
  // Trailing window ends at the start of tomorrow, covering all of "today".
  assert.equal(win.rangeLabel, "May 2 – May 8");
  assert.equal(win.buckets[0].start, win.start);
  assert.equal(win.buckets[win.buckets.length - 1].end, win.end);
  assert.equal(win.buckets[6].label, "Thu");
  assert.equal(win.buckets[0].label, "Fri");
  // Contiguous, no gaps between buckets.
  for (let i = 1; i < win.buckets.length; i += 1) {
    assert.equal(win.buckets[i].start, win.buckets[i - 1].end);
  }
});

test("day window is six 4-hour buckets across today", () => {
  const win = buildTrendWindow("day", NOW);
  assert.equal(win.buckets.length, 6);
  assert.deepEqual(
    win.buckets.map((b) => b.label),
    ["12a", "4a", "8a", "12p", "4p", "8p"],
  );
  assert.equal(win.end - win.start, 24 * 3_600_000);
  assert.match(win.rangeLabel, /May 8/);
});

test("month window is 30 daily buckets with a thinned label stride", () => {
  const win = buildTrendWindow("month", NOW);
  assert.equal(win.buckets.length, 30);
  assert.equal(win.labelStride, 5);
  assert.equal(win.buckets[win.buckets.length - 1].label, "8"); // day-of-month for May 8
  assert.equal(win.rangeLabel, "Apr 9 – May 8");
});

test("year window is 12 trailing monthly buckets", () => {
  const win = buildTrendWindow("year", NOW);
  assert.equal(win.buckets.length, 12);
  assert.equal(win.buckets[11].label, "May");
  assert.equal(win.buckets[0].label, "Jun");
  assert.equal(win.rangeLabel, "Jun 2024 – May 2025");
  for (let i = 1; i < win.buckets.length; i += 1) {
    assert.equal(win.buckets[i].start, win.buckets[i - 1].end);
  }
});

test("bucketIndexOf finds the containing bucket and rejects out-of-range", () => {
  const win = buildTrendWindow("week", NOW);
  const midDay2 = win.buckets[2].start + 3_600_000;
  assert.equal(bucketIndexOf(win.buckets, midDay2), 2);
  assert.equal(bucketIndexOf(win.buckets, win.start - 1), -1);
  assert.equal(bucketIndexOf(win.buckets, win.end), -1); // end is exclusive
});

test("bucketAverages returns per-bucket means and null for empty buckets", () => {
  const win = buildTrendWindow("week", NOW);
  const b0 = win.buckets[0].start + 1000;
  const b3 = win.buckets[3].start + 1000;
  const averages = bucketAverages(
    [
      { at: b0, value: 4 },
      { at: b0, value: 2 },
      { at: b3, value: 5 },
      { at: win.start - 999999, value: 99 }, // outside window -> ignored
    ],
    win.buckets,
  );
  assert.equal(averages[0], 3); // (4 + 2) / 2
  assert.equal(averages[3], 5);
  assert.equal(averages[1], null);
  assert.equal(averages.length, 7);
});

test("bucketSums and bucketCounts aggregate honestly with zero defaults", () => {
  const win = buildTrendWindow("week", NOW);
  const b1 = win.buckets[1].start + 1000;
  const b1b = win.buckets[1].start + 2000;
  const sums = bucketSums(
    [
      { at: b1, value: 30 },
      { at: b1b, value: 15 },
    ],
    win.buckets,
  );
  assert.equal(sums[1], 45);
  assert.equal(sums[0], 0);

  const counts = bucketCounts([b1, b1b], win.buckets);
  assert.equal(counts[1], 2);
  assert.equal(counts[2], 0);
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    2,
  );
});

test("polylineLength sums euclidean segments", () => {
  assert.equal(polylineLength([]), 0);
  assert.equal(polylineLength([{ x: 5, y: 5 }]), 0);
  assert.equal(
    polylineLength([
      { x: 0, y: 0 },
      { x: 3, y: 4 }, // 5
      { x: 3, y: 4 }, // 0
      { x: 6, y: 8 }, // 5
    ]),
    10,
  );
});
