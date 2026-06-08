import {
  deriveHealthWatch,
  getRecordDueStatus,
  normalizeCareEventType,
  summarizeRecordVault,
} from "../../../lib/care-domain/src/index.ts";

export type WoofGuideActionUrgency = "normal" | "watch" | "alert";

export type WoofGuideActionRoute =
  | "/log"
  | "/calendar"
  | "/records"
  | "/more";

export type WoofGuideActionIcon =
  | "bowl"
  | "calendar"
  | "heart"
  | "paw"
  | "records"
  | "spark";

export interface WoofGuideActionEntry {
  id: string;
  type: string;
  title?: string;
  caregiver?: string;
  occurredAt: string;
  severity?: string | null;
  note?: string | null;
  details?: Record<string, unknown> | null;
}

export interface WoofGuideActionRoutine {
  id?: string;
  type: string;
  label: string;
  time: string;
  owner?: string;
  note?: string;
}

export interface WoofGuideActionRecord {
  id?: string;
  type: string;
  title: string;
  due?: string;
  note?: string;
}

export interface WoofGuideActionDiet {
  primaryFood?: string;
  normalPortion?: string;
  mealSchedule?: string;
  appetiteQuirks?: string;
  vetNotes?: string;
}

export interface WoofGuideActionState {
  profile?: {
    name?: string;
  };
  dietProfile?: WoofGuideActionDiet;
  entries: readonly WoofGuideActionEntry[];
  routines: readonly WoofGuideActionRoutine[];
  records?: readonly WoofGuideActionRecord[];
}

export interface WoofGuideActionCard {
  id: string;
  label: string;
  detail: string;
  urgency: WoofGuideActionUrgency;
  icon: WoofGuideActionIcon;
  route?: WoofGuideActionRoute;
  prompt?: string;
}

function isToday(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function dogName(state: WoofGuideActionState): string {
  return state.profile?.name?.trim() || "your dog";
}

function hasDietBaseline(diet?: WoofGuideActionDiet): boolean {
  return Boolean(diet?.primaryFood?.trim() && diet.normalPortion?.trim() && diet.mealSchedule?.trim());
}

export function deriveWoofGuideActions(
  state: WoofGuideActionState,
  now: number = Date.now(),
): WoofGuideActionCard[] {
  const name = dogName(state);
  const health = deriveHealthWatch({ entries: state.entries, routines: state.routines, now });
  const records = state.records ?? [];
  const recordVault = summarizeRecordVault(records);
  const recordAttention = records.filter((record) => {
    const status = getRecordDueStatus(record, now).status;
    return status === "expired" || status === "due_soon";
  });
  const todaysEntries = state.entries.filter((entry) => isToday(entry.occurredAt, now));
  const mealsToday = todaysEntries.filter((entry) => normalizeCareEventType(entry.type, entry.details) === "meal");
  const actions: WoofGuideActionCard[] = [];

  if (health.status !== "good") {
    actions.push({
      id: "vet-note",
      label: "Draft vet note",
      detail: health.summary,
      urgency: health.status === "alert" ? "alert" : "watch",
      icon: "heart",
      prompt: `Draft a concise vet note for ${name} using recent health logs, red flags, and the non-diagnostic boundary.`,
    });
  }

  if (recordVault.missingCritical.length > 0 || recordAttention.length > 0) {
    actions.push({
      id: "records-review",
      label: "Review records",
      detail: recordAttention.length
        ? `${recordAttention.length} record needs date attention.`
        : `Missing ${recordVault.missingCritical.join(", ").toLowerCase()}.`,
      urgency: recordAttention.some((record) => getRecordDueStatus(record, now).status === "expired") ? "alert" : "watch",
      icon: "records",
      route: "/records",
    });
  }

  if (!hasDietBaseline(state.dietProfile)) {
    actions.push({
      id: "diet-baseline",
      label: "Set diet baseline",
      detail: "Food, portion, and meal schedule are needed for better feeding guidance.",
      urgency: "watch",
      icon: "bowl",
      route: "/more",
    });
  } else if (mealsToday.length === 0) {
    actions.push({
      id: "log-meal",
      label: "Log first meal",
      detail: `${name} has no meal logged today.`,
      urgency: "normal",
      icon: "bowl",
      route: "/log",
    });
  }

  if (state.routines.length === 0) {
    actions.push({
      id: "routine-setup",
      label: "Create routine",
      detail: "Add a starter schedule so WoofGuide can watch what is due next.",
      urgency: "watch",
      icon: "calendar",
      route: "/calendar",
    });
  }

  actions.push({
    id: "care-pass",
    label: "Preview Care Pass",
    detail: "Review sitter, vet, trainer, or caregiver report sections before sharing.",
    urgency: "normal",
    icon: "spark",
    route: "/records",
  });

  return actions.slice(0, 4);
}
