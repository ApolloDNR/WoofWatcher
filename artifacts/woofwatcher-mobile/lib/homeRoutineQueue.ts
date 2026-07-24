export interface HomeRoutineQueueItem {
  id: string;
  status: "done" | "pending" | "overdue" | "due" | "upcoming";
  minutesFromNow: number;
}

/**
 * Today labels only the next real future care as NEXT. Completed routines,
 * unresolved meal outcomes (already represented in Now), expired clock rows,
 * and device-snoozed items stay out of this queue.
 */
export function selectHomeRoutineQueue<T extends HomeRoutineQueueItem>(
  items: readonly T[],
  snoozedUntil: Readonly<Record<string, number>>,
  now: number,
): T[] {
  return items
    .filter(
      (item) =>
        item.status !== "done" &&
        item.status !== "pending" &&
        Number.isFinite(item.minutesFromNow) &&
        item.minutesFromNow >= 0 &&
        (snoozedUntil[item.id] ?? 0) <= now,
    )
    .sort((a, b) => a.minutesFromNow - b.minutesFromNow);
}
