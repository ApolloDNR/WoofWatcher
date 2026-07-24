import type { CareEventType } from "@workspace/care-domain";

export type QuickLogActionKey =
  | "meal"
  | "potty"
  | "walk"
  | "medication"
  | "water"
  | "note"
  | "alone";

export type QuickLogActionIcon =
  | "meal"
  | "pee"
  | "walk"
  | "medication"
  | "bile"
  | "note"
  | "clock";

export type QuickLogClaim =
  | "served-outcome-pending"
  | "potty-attempt"
  | "walk-session"
  | "dose-and-outcome-required"
  | "fresh-water-refill"
  | "note-required"
  | "alone-session";

export interface QuickLogAction {
  key: QuickLogActionKey;
  icon: QuickLogActionIcon;
  label: string;
  type: CareEventType;
  title: string;
  quickClaim: QuickLogClaim;
  longPress: "details";
  detailRequired: boolean;
}

export const QUICK_LOG_ACTIONS: readonly QuickLogAction[] = [
  {
    key: "meal",
    icon: "meal",
    label: "Meal",
    type: "meal",
    title: "Meal",
    quickClaim: "served-outcome-pending",
    longPress: "details",
    detailRequired: false,
  },
  {
    key: "potty",
    icon: "pee",
    label: "Potty",
    type: "potty",
    title: "Potty",
    quickClaim: "potty-attempt",
    longPress: "details",
    detailRequired: false,
  },
  {
    key: "walk",
    icon: "walk",
    label: "Walk",
    type: "walk",
    title: "Walk",
    quickClaim: "walk-session",
    longPress: "details",
    detailRequired: false,
  },
  {
    key: "medication",
    icon: "medication",
    label: "Meds",
    type: "medication",
    title: "Medication",
    quickClaim: "dose-and-outcome-required",
    longPress: "details",
    detailRequired: true,
  },
  {
    key: "water",
    icon: "bile",
    label: "Water",
    type: "water",
    title: "Fresh water",
    quickClaim: "fresh-water-refill",
    longPress: "details",
    detailRequired: false,
  },
  {
    key: "note",
    icon: "note",
    label: "Note",
    type: "note",
    title: "Care note",
    quickClaim: "note-required",
    longPress: "details",
    detailRequired: true,
  },
];

/** Secondary lifecycle action. It is intentionally not a seventh grid tile. */
export const QUICK_LOG_ALONE_ACTION: QuickLogAction = {
  key: "alone",
  icon: "clock",
  label: "Alone Time",
  type: "alone",
  title: "Alone time",
  quickClaim: "alone-session",
  longPress: "details",
  detailRequired: false,
};

export function quickLogActionByKey(key: string): QuickLogAction {
  const action = QUICK_LOG_ACTIONS.find((candidate) => candidate.key === key);
  if (!action) throw new Error(`Unknown quick-log action: ${key}`);
  return action;
}

export type QuickLogIntent =
  | { kind: "save"; action: QuickLogAction }
  | { kind: "details"; action: QuickLogAction }
  | { kind: "start-walk"; action: QuickLogAction }
  | { kind: "open-walk"; action: QuickLogAction }
  | { kind: "start-alone"; action: QuickLogAction }
  | { kind: "open-alone"; action: QuickLogAction };

export function resolveQuickLogIntent(
  action: QuickLogAction,
  options: { hasOpenWalk: boolean; hasOpenAlone?: boolean },
): QuickLogIntent {
  if (action.detailRequired) return { kind: "details", action };
  if (action.type === "alone") {
    return {
      kind: options.hasOpenAlone ? "open-alone" : "start-alone",
      action,
    };
  }
  if (action.type === "walk") {
    return {
      kind: options.hasOpenWalk ? "open-walk" : "start-walk",
      action,
    };
  }
  return { kind: "save", action };
}
