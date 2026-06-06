export const CARE_EVENT_TYPES = [
  "meal",
  "treat",
  "water",
  "walk",
  "potty",
  "play",
  "training",
  "mood",
  "medication",
  "weight",
  "vomit",
  "symptom",
  "grooming",
  "alone",
  "note",
] as const;

export type CareEventType = (typeof CARE_EVENT_TYPES)[number];

export type CareEventIcon =
  | "bowl"
  | "bone"
  | "drop"
  | "paw"
  | "candy"
  | "star"
  | "heart"
  | "pill"
  | "scale"
  | "vomit"
  | "house";

export interface CareEventDefinition {
  type: CareEventType;
  label: string;
  shortLabel: string;
  icon: CareEventIcon;
  tone: "care" | "activity" | "health" | "social" | "note";
  healthWatch: boolean;
  quickLog: boolean;
}

export type CareEventDetails = Record<string, unknown> | null | undefined;

const CARE_EVENT_SET = new Set<string>(CARE_EVENT_TYPES);

export const CARE_EVENT_DEFINITIONS: Record<CareEventType, CareEventDefinition> = {
  meal: {
    type: "meal",
    label: "Meal",
    shortLabel: "Meal",
    icon: "bowl",
    tone: "care",
    healthWatch: true,
    quickLog: true,
  },
  treat: {
    type: "treat",
    label: "Treat",
    shortLabel: "Treat",
    icon: "bone",
    tone: "care",
    healthWatch: false,
    quickLog: true,
  },
  water: {
    type: "water",
    label: "Water",
    shortLabel: "Water",
    icon: "drop",
    tone: "health",
    healthWatch: true,
    quickLog: true,
  },
  walk: {
    type: "walk",
    label: "Walk",
    shortLabel: "Walk",
    icon: "paw",
    tone: "activity",
    healthWatch: false,
    quickLog: true,
  },
  potty: {
    type: "potty",
    label: "Potty",
    shortLabel: "Potty",
    icon: "drop",
    tone: "health",
    healthWatch: true,
    quickLog: true,
  },
  play: {
    type: "play",
    label: "Play",
    shortLabel: "Play",
    icon: "candy",
    tone: "activity",
    healthWatch: false,
    quickLog: true,
  },
  training: {
    type: "training",
    label: "Training",
    shortLabel: "Training",
    icon: "star",
    tone: "activity",
    healthWatch: false,
    quickLog: true,
  },
  mood: {
    type: "mood",
    label: "Mood",
    shortLabel: "Mood",
    icon: "heart",
    tone: "social",
    healthWatch: true,
    quickLog: true,
  },
  medication: {
    type: "medication",
    label: "Medication",
    shortLabel: "Meds",
    icon: "pill",
    tone: "health",
    healthWatch: true,
    quickLog: true,
  },
  weight: {
    type: "weight",
    label: "Weight",
    shortLabel: "Weight",
    icon: "scale",
    tone: "health",
    healthWatch: true,
    quickLog: false,
  },
  vomit: {
    type: "vomit",
    label: "Vomit",
    shortLabel: "Vomit",
    icon: "vomit",
    tone: "health",
    healthWatch: true,
    quickLog: true,
  },
  symptom: {
    type: "symptom",
    label: "Symptom",
    shortLabel: "Symptom",
    icon: "vomit",
    tone: "health",
    healthWatch: true,
    quickLog: false,
  },
  grooming: {
    type: "grooming",
    label: "Grooming",
    shortLabel: "Grooming",
    icon: "star",
    tone: "care",
    healthWatch: false,
    quickLog: false,
  },
  alone: {
    type: "alone",
    label: "Alone Time",
    shortLabel: "Alone",
    icon: "house",
    tone: "social",
    healthWatch: true,
    quickLog: true,
  },
  note: {
    type: "note",
    label: "Note",
    shortLabel: "Note",
    icon: "star",
    tone: "note",
    healthWatch: false,
    quickLog: false,
  },
};

const TYPE_ALIASES: Record<string, CareEventType> = {
  anxiety: "mood",
  anxious: "mood",
  medicine: "medication",
  medications: "medication",
  meds: "medication",
  pee: "potty",
  poop: "potty",
  throwup: "vomit",
  "throw-up": "vomit",
  vomiting: "vomit",
  zoomies: "mood",
};

const VOMIT_DETAIL_VALUES = new Set([
  "bile",
  "puke",
  "throw up",
  "throw-up",
  "throwup",
  "vomit",
  "vomiting",
  "yellow bile",
]);

function detailString(details: CareEventDetails, key: string): string {
  const value = details?.[key];
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeCareEventType(
  type: string | null | undefined,
  details?: CareEventDetails,
): CareEventType {
  const raw = (type ?? "").trim().toLowerCase();
  const compact = raw.replace(/\s+/g, "");

  if (raw === "symptom") {
    const what = detailString(details, "what");
    const kind = detailString(details, "kind");
    if (VOMIT_DETAIL_VALUES.has(what) || VOMIT_DETAIL_VALUES.has(kind)) {
      return "vomit";
    }
  }

  if (TYPE_ALIASES[raw]) return TYPE_ALIASES[raw];
  if (TYPE_ALIASES[compact]) return TYPE_ALIASES[compact];
  if (CARE_EVENT_SET.has(raw)) return raw as CareEventType;
  return "note";
}

export function getCareEventDefinition(
  type: string | null | undefined,
  details?: CareEventDetails,
): CareEventDefinition {
  return CARE_EVENT_DEFINITIONS[normalizeCareEventType(type, details)];
}

export function isHealthWatchEventType(
  type: string | null | undefined,
  details?: CareEventDetails,
): boolean {
  return getCareEventDefinition(type, details).healthWatch;
}
