import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMonthView,
  daysInMonth,
  dateKeyForYmd,
  dateKeyOf,
  entriesForDayKey,
  entryCountsByDay,
  formatMonthTitle,
  parseDateKey,
  shiftMonth,
  weekdayOfFirst,
} from "./monthCalendar.ts";

function localIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const value = new Date(0);
  value.setFullYear(year, month, day);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

test("weekdayOfFirst matches known Gregorian dates", () => {
  assert.equal(weekdayOfFirst(2025, 4), 4); // May 1 2025 is a Thursday
  assert.equal(weekdayOfFirst(2015, 1), 0); // Feb 1 2015 is a Sunday
  assert.equal(weekdayOfFirst(2021, 4), 6); // May 1 2021 is a Saturday
});

test("daysInMonth handles leap Februaries", () => {
  assert.equal(daysInMonth(2024, 1), 29);
  assert.equal(daysInMonth(2025, 1), 28);
  assert.equal(daysInMonth(2000, 1), 29);
  assert.equal(daysInMonth(1900, 1), 28);
});

test("buildMonthView produces the correct number of Sunday-first weeks", () => {
  // Feb 2015 starts Sunday with 28 days -> exactly 4 weeks.
  const feb = buildMonthView({ year: 2015, month: 1, todayKey: "", entries: [] });
  assert.equal(feb.weeks.length, 4);

  // May 2025 starts Thursday with 31 days (4 pad + 31 = 35) -> 5 weeks.
  const may = buildMonthView({ year: 2025, month: 4, todayKey: "", entries: [] });
  assert.equal(may.weeks.length, 5);

  // May 2021 starts Saturday with 31 days (6 pad + 31 = 37 -> 42) -> 6 weeks.
  const may21 = buildMonthView({ year: 2021, month: 4, todayKey: "", entries: [] });
  assert.equal(may21.weeks.length, 6);

  // Every week always has exactly 7 cells.
  for (const week of may.weeks) assert.equal(week.length, 7);
  assert.equal(may.title, "May 2025");
});

test("buildMonthView places days under the right weekday columns", () => {
  const may = buildMonthView({ year: 2025, month: 4, todayKey: "", entries: [] });

  // First row: 4 leading blanks (Sun..Wed), then Thu May 1.
  assert.deepEqual(
    may.weeks[0].map((cell) => cell.day),
    [null, null, null, null, 1, 2, 3],
  );
  assert.equal(may.weeks[0][0].inMonth, false);
  assert.equal(may.weeks[0][4].day, 1);

  // May 8 sits in the second week under Thursday (column index 4).
  assert.equal(may.weeks[1][4].day, 8);
  assert.equal(may.weeks[1][4].dateKey, dateKeyForYmd(2025, 4, 8));

  // Last real day is May 31 in the final week.
  const lastWeek = may.weeks[may.weeks.length - 1];
  assert.equal(lastWeek[lastWeek.length - 1].day, 31);
});

test("buildMonthView buckets real entries and flags today", () => {
  const entries = [
    { occurredAt: localIso(2025, 4, 8, 7, 45) },
    { occurredAt: localIso(2025, 4, 8, 21, 30) },
    { occurredAt: localIso(2025, 4, 20, 9, 15) },
    { occurredAt: "not-a-date" }, // ignored
  ];
  const view = buildMonthView({
    year: 2025,
    month: 4,
    todayKey: dateKeyForYmd(2025, 4, 8),
    entries,
  });

  const day8 = view.weeks[1][4];
  assert.equal(day8.day, 8);
  assert.equal(day8.hasEntries, true);
  assert.equal(day8.entryCount, 2);
  assert.equal(day8.isToday, true);

  const day20 = view.weeks[3][2]; // May 20 2025 is a Tuesday (column 2)
  assert.equal(day20.day, 20);
  assert.equal(day20.entryCount, 1);
  assert.equal(day20.isToday, false);

  const day9 = view.weeks[1][5];
  assert.equal(day9.day, 9);
  assert.equal(day9.hasEntries, false);
  assert.equal(day9.entryCount, 0);
});

test("entryCountsByDay and dateKeyOf agree on local day keys", () => {
  const counts = entryCountsByDay([
    { occurredAt: localIso(2025, 4, 8, 7, 45) },
    { occurredAt: localIso(2025, 4, 8, 23, 59) },
  ]);
  const key = dateKeyOf(new Date(localIso(2025, 4, 8, 12, 0)));
  assert.equal(key, "2025-05-08");
  assert.equal(counts.get(key), 2);
});

test("entriesForDayKey returns only that day, sorted ascending by time", () => {
  const entries = [
    { id: "late", occurredAt: localIso(2025, 4, 8, 21, 30) },
    { id: "other-day", occurredAt: localIso(2025, 4, 9, 8, 0) },
    { id: "early", occurredAt: localIso(2025, 4, 8, 7, 45) },
    { id: "mid", occurredAt: localIso(2025, 4, 8, 13, 20) },
  ];
  const timeline = entriesForDayKey(entries, "2025-05-08");
  assert.deepEqual(
    timeline.map((entry) => entry.id),
    ["early", "mid", "late"],
  );
});

test("shiftMonth rolls the year over in both directions", () => {
  assert.deepEqual(shiftMonth(2025, 11, 1), { year: 2026, month: 0 });
  assert.deepEqual(shiftMonth(2025, 0, -1), { year: 2024, month: 11 });
  assert.deepEqual(shiftMonth(2025, 4, 0), { year: 2025, month: 4 });
  assert.deepEqual(shiftMonth(2025, 5, -12), { year: 2024, month: 5 });
  assert.deepEqual(shiftMonth(2025, 1, 13), { year: 2026, month: 2 });
});

test("parseDateKey round-trips buildMonthView keys and formats titles", () => {
  assert.equal(dateKeyForYmd(2025, 4, 8), "2025-05-08");
  assert.deepEqual(parseDateKey("2025-05-08"), { year: 2025, month: 4, day: 8 });
  assert.equal(parseDateKey("2025-5-8"), null);
  assert.equal(parseDateKey("nonsense"), null);
  assert.equal(formatMonthTitle(2025, 4), "May 2025");
  assert.equal(formatMonthTitle(2026, 0), "January 2026");
});
