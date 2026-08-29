import {
  deriveCareDayStatus,
  deriveCareHandoff,
  deriveHealthWatch,
  normalizeCareEventType,
  selectSharedCareEvidence,
} from "../../../lib/care-domain/src/index.ts";
import type { CareState } from "../context/CareContext";
import { localDateKey, todayLocalDateKey } from "./localCalendar.ts";

/**
 * Builds the payload boundary for a future live WoofGuide provider.
 * Private, future, and malformed entries are removed here—not merely by the
 * screen—so a later caller cannot accidentally transmit them.
 */
export function buildWoofGuideAssistantContext(
  state: CareState,
  now: number = Date.now(),
) {
  const entries = selectSharedCareEvidence(state.entries, now);
  const today = todayLocalDateKey(new Date(now));
  const todayEntries = entries.filter((entry) => {
    const occurredAt = new Date(entry.occurredAt);
    return Number.isFinite(occurredAt.getTime()) && localDateKey(occurredAt) === today;
  });
  const normalizedType = (entry: CareState["entries"][number]) =>
    normalizeCareEventType(entry.type, entry.details);
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const meals = sortedEntries.filter((entry) => normalizedType(entry) === "meal");
  const walks = sortedEntries.filter((entry) => normalizedType(entry) === "walk");
  const dayStatus = deriveCareDayStatus(entries, state.routines, now);
  const healthWatch = deriveHealthWatch({
    entries,
    routines: state.routines,
    now,
  });
  const handoffSummary = deriveCareHandoff({
    entries,
    routines: state.routines,
    caregivers: state.caregivers,
    now,
  });

  return {
    profile: {
      name: state.profile.name,
      breed: state.profile.breed,
      background: state.profile.background,
      careFocus: state.profile.careFocus,
      weight: state.profile.weight,
      vetBoundary: state.profile.vetBoundary,
    },
    summary: {
      totalEntries: entries.length,
      todayEntries: todayEntries.length,
      meals: dayStatus.counts.meals.done,
      walks: dayStatus.counts.walks.done,
      vomitIncidents: healthWatch.counts.vomit30,
    },
    healthWatch: {
      status: healthWatch.status,
      label: healthWatch.status === "good" ? "No concerns" : healthWatch.summary,
      summary: healthWatch.summary,
      signals: healthWatch.signals.slice(0, 4),
      redFlags: healthWatch.redFlags,
      counts: healthWatch.counts,
      vetBoundary: healthWatch.vetBoundary,
    },
    todayPlan: {
      dateLabel: today,
      completedCount: todayEntries.length,
      totalCount: state.routines.length,
      nextItems: handoffSummary.next
        ? [{
            label: handoffSummary.next.label,
            time: handoffSummary.next.time,
            owner: handoffSummary.next.owner,
            note: handoffSummary.next.note,
          }]
        : [],
    },
    handoff: {
      nextRoutine: handoffSummary.next
        ? {
            label: handoffSummary.next.label,
            time: handoffSummary.next.time,
            owner: handoffSummary.next.owner,
          }
        : null,
      lastMeal: meals[0] ?? null,
      lastWalk: walks[0] ?? null,
      followUps: entries
        .filter((entry) => entry.severity === "watch" || entry.severity === "urgent")
        .slice(0, 3),
      caregiverLoad: handoffSummary.caregiverLoad,
      sections: handoffSummary.sections,
      message: handoffSummary.message,
    },
    latest: sortedEntries.slice(0, 5),
    dietProfile: state.dietProfile,
  };
}
