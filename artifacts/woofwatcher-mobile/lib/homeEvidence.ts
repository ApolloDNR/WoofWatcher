import {
  isHouseholdVisibleCareEvidence,
  selectSharedCareEvidence,
} from "@workspace/care-domain";

export interface HomeEntryVisibilityShape {
  details?: unknown;
}

export interface ObservableHomeEntryShape extends HomeEntryVisibilityShape {
  occurredAt?: string;
}

export interface HomeEvidenceCopyInput {
  todayLogCount: number;
  healthAlert: boolean;
  bileCount: number;
}

export interface HomeMoodEvidenceInput {
  mood?: unknown;
  normalizedType: string;
}

export interface HomeWatchCopy {
  status: string;
  detail: string;
}

export interface HomeEvidenceCopy {
  careLine: string;
  headline: string;
  summary: string;
  health: HomeWatchCopy;
  bile: HomeWatchCopy;
}

export function selectHomeVisibleEntries<T extends HomeEntryVisibilityShape>(
  entries: readonly T[],
): T[] {
  return entries.filter(isHouseholdVisibleCareEvidence);
}

/**
 * Establishes the one evidence boundary used by Home. Privacy is applied
 * before a timestamp is inspected, then malformed and future-dated records
 * are removed so they cannot influence today, latest, streak, or XP facts.
 */
export function selectObservableHomeEntries<T extends ObservableHomeEntryShape>(
  entries: readonly T[],
  now: number,
): T[] {
  return selectSharedCareEvidence(entries, now);
}

export function formatHomeCompletion(done: number, target: number): string {
  if (target <= 0) return done > 0 ? `${done} logged` : "No target";
  return `${done}/${target}`;
}

export function isHomeMoodEvidence({
  mood,
}: HomeMoodEvidenceInput): boolean {
  return typeof mood === "string" && mood.trim().length > 0;
}

function loggedMomentHeadline(todayLogCount: number): string {
  if (todayLogCount === 1) return "One care moment logged today.";
  if (todayLogCount === 2) return "Two care moments logged today.";
  return `${todayLogCount} care moments logged today.`;
}

export function deriveHomeEvidenceCopy({
  todayLogCount,
  healthAlert,
  bileCount,
}: HomeEvidenceCopyInput): HomeEvidenceCopy {
  if (todayLogCount <= 0) {
    return {
      careLine: "Awaiting today's first log",
      headline: "Ready for today's first log.",
      summary: "No care data logged today.",
      health: {
        status: "No data",
        detail: "No health evidence logged today",
      },
      bile: {
        status: "No data",
        detail: "No bile evidence logged today",
      },
    };
  }

  return {
    careLine:
      healthAlert || bileCount > 0
        ? "Needs a look today"
        : "No alerts logged today",
    headline: loggedMomentHeadline(todayLogCount),
    summary: "Readings use today's available care evidence.",
    health: healthAlert
      ? { status: "Needs Watch", detail: "Owner-marked health alert logged" }
      : {
          status: "No alerts logged",
          detail: `Based on ${todayLogCount} care ${todayLogCount === 1 ? "log" : "logs"} today`,
        },
    bile:
      bileCount > 0
        ? { status: "Watch", detail: `${bileCount} flagged today` }
        : {
            status: "None logged",
            detail: "No bile events logged today",
          },
  };
}
