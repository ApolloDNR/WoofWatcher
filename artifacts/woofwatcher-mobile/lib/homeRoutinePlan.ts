import {
  deriveRoutineBoard,
  isRoutineBoardScheduledItem,
  type RoutineBoardCorrectionItem,
  type RoutineBoardEntry,
  type RoutineBoardRoutine,
  type RoutineBoardScheduledItem,
} from "@workspace/care-domain";

export interface HomeRoutinePlanInput {
  routines: readonly RoutineBoardRoutine[];
  entries: readonly RoutineBoardEntry[];
  snoozedUntil: Readonly<Record<string, number>>;
  now?: number;
}

export interface HomeRoutinePlan {
  scheduledItems: RoutineBoardScheduledItem[];
  scheduledCount: number;
  correctionItems: RoutineBoardCorrectionItem[];
  correctionCount: number;
  correctionSummary: string | null;
  hasSavedRoutines: boolean;
}

export function deriveHomeRoutinePlan(input: HomeRoutinePlanInput): HomeRoutinePlan {
  const now = input.now ?? Date.now();
  const board = deriveRoutineBoard({
    routines: input.routines,
    entries: input.entries,
    now,
  });
  const scheduledItems = board.items
    .filter(isRoutineBoardScheduledItem)
    .filter((item) => item.status !== "done")
    .filter((item) => (input.snoozedUntil[item.id] ?? 0) <= now);
  const correctionItems = board.items.filter(
    (item): item is RoutineBoardCorrectionItem => item.status === "needs-correction",
  );
  const correctionCount = correctionItems.length;

  return {
    scheduledItems,
    scheduledCount: scheduledItems.length,
    correctionItems,
    correctionCount,
    correctionSummary: correctionCount
      ? `${correctionCount} routine${correctionCount === 1 ? "" : "s"} ${correctionCount === 1 ? "needs" : "need"} correction in Plans.`
      : null,
    hasSavedRoutines: input.routines.length > 0,
  };
}
