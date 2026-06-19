import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe } from "@workspace/api-client-react";
import {
  appendCareAuditEvent,
  appendStickyNote,
  buildCareLogDeletionAuditEntry,
  getCareAuditTrail,
  deriveCareIntelligence,
  deriveCareLogSearch,
  deriveDietProgress,
  deriveMedicationAdherence,
  getStickyNotes,
  normalizeCareEventType,
  type CareAuditEvent,
  type CareEventType,
  type StickyNoteColor,
} from "@workspace/care-domain";
import { useCare, Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { getTabbedRouteBottomPadding } from "@/lib/mobileLayout";
import { relativeTime, dayKey, dayLabel } from "@/lib/time";
import { BoardCard, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type Severity = "normal" | "watch" | "alert";

interface Choice {
  id: string;
  label: string;
  suffix?: string;
  mood?: string;
  severity?: Severity;
}

interface ChoiceGroup {
  key: string;
  label: string;
  options: Choice[];
}

interface LogType {
  type: CareEventType;
  label: string;
  icon: PulseIconName;
  baseTitle: string;
  groups?: ChoiceGroup[];
  stepper?: { label: string; unit: string; values: number[] };
  numeric?: { label: string; placeholder: string; unit: "diet" | "weight"; optional?: boolean };
  noteField?: { placeholder: string };
}

const LOG_TYPES: LogType[] = [
  {
    type: "meal",
    label: "Meal",
    icon: "bowl",
    baseTitle: "Meal",
    groups: [
      {
        key: "portion",
        label: "Portion",
        options: [
          { id: "full", label: "Full bowl", suffix: "full bowl" },
          { id: "half", label: "Half", suffix: "half portion" },
          { id: "light", label: "Light", suffix: "light portion" },
          { id: "snack", label: "Snack", suffix: "snack" },
        ],
      },
      {
        key: "mealCompletion",
        label: "Meal outcome",
        options: [
          { id: "served", label: "Served", suffix: "outcome pending" },
          { id: "complete", label: "Ate all", suffix: "ate all" },
          { id: "most", label: "Ate most", suffix: "ate most" },
          { id: "partial", label: "Ate some", suffix: "partial", severity: "watch" },
          { id: "grazing", label: "Still grazing", suffix: "still grazing", severity: "watch" },
          { id: "skipped", label: "Refused", suffix: "refused", severity: "watch" },
        ],
      },
    ],
    numeric: { label: "Served amount", placeholder: "0.75", unit: "diet", optional: true },
    noteField: { placeholder: "Sticky note: appetite, anxiety, toppers, what changed..." },
  },
  {
    type: "water",
    label: "Water",
    icon: "drop",
    baseTitle: "Water",
    groups: [
      {
        key: "amount",
        label: "Amount",
        options: [
          { id: "sip", label: "A sip", suffix: "a sip" },
          { id: "bowl", label: "Full bowl", suffix: "full bowl" },
          { id: "refill", label: "Refill", suffix: "refill" },
        ],
      },
    ],
  },
  { type: "treat", label: "Treat", icon: "bone", baseTitle: "Treat" },
  {
    type: "walk",
    label: "Walk",
    icon: "paw",
    baseTitle: "Walk",
    stepper: { label: "Duration", unit: "min", values: [10, 15, 20, 30, 45, 60] },
  },
  {
    type: "potty",
    label: "Potty",
    icon: "drop",
    baseTitle: "Potty",
    groups: [
      {
        key: "kind",
        label: "Kind",
        options: [
          { id: "pee", label: "Pee", suffix: "pee" },
          { id: "poop", label: "Poop", suffix: "poop" },
          { id: "both", label: "Both", suffix: "pee & poop" },
        ],
      },
      {
        key: "condition",
        label: "Condition",
        options: [
          { id: "normal", label: "Normal", severity: "normal" },
          { id: "soft", label: "Soft", severity: "watch" },
          { id: "off", label: "Off", severity: "alert" },
        ],
      },
      {
        key: "stoolColor",
        label: "Stool color",
        options: [
          { id: "not-logged", label: "Not logged" },
          { id: "brown", label: "Brown" },
          { id: "yellow", label: "Yellow", suffix: "yellow stool", severity: "watch" },
          { id: "red-black", label: "Red/black", suffix: "red/black stool", severity: "alert" },
        ],
      },
      {
        key: "pottyContext",
        label: "Context",
        options: [
          { id: "routine", label: "Routine" },
          { id: "accident", label: "Accident", suffix: "accident", severity: "watch" },
          { id: "urgent", label: "Urgent", suffix: "urgent", severity: "watch" },
          { id: "straining", label: "Straining", suffix: "straining", severity: "alert" },
        ],
      },
    ],
    noteField: { placeholder: "Sticky note: stool detail, color, accident, urgency, or anything unusual..." },
  },
  {
    type: "play",
    label: "Play",
    icon: "candy",
    baseTitle: "Play",
    stepper: { label: "Duration", unit: "min", values: [5, 10, 15, 20, 30] },
  },
  {
    type: "training",
    label: "Training",
    icon: "star",
    baseTitle: "Training",
    stepper: { label: "Duration", unit: "min", values: [5, 8, 10, 12, 15, 20] },
    groups: [
      {
        key: "trainingOutcome",
        label: "Outcome",
        options: [
          { id: "win", label: "Win", suffix: "win" },
          { id: "practice", label: "Practice", suffix: "practice" },
          { id: "struggle", label: "Struggle", suffix: "struggle", severity: "watch" },
        ],
      },
    ],
    noteField: { placeholder: "Sticky note: cue, trigger, reward, trainer notes, or what changed..." },
  },
  {
    type: "mood",
    label: "Mood",
    icon: "heart",
    baseTitle: "Mood",
    groups: [
      {
        key: "mood",
        label: "How are they feeling?",
        options: [
          { id: "happy", label: "Happy", suffix: "happy", mood: "happy" },
          { id: "excited", label: "Excited", suffix: "excited", mood: "excited" },
          { id: "calm", label: "Calm", suffix: "calm", mood: "calm" },
          { id: "anxious", label: "Anxious", suffix: "anxious", mood: "anxious", severity: "watch" },
          { id: "unwell", label: "Unwell", suffix: "unwell", mood: "unwell", severity: "alert" },
        ],
      },
    ],
  },
  {
    type: "alone",
    label: "Alone",
    icon: "house",
    baseTitle: "Alone time",
    stepper: { label: "Duration", unit: "min", values: [10, 20, 30, 45, 60, 90] },
    groups: [
      {
        key: "aloneOutcome",
        label: "Return state",
        options: [
          { id: "settled", label: "Settled", suffix: "settled", mood: "calm" },
          { id: "calm", label: "Calm", suffix: "calm", mood: "calm" },
          { id: "anxious", label: "Anxious", suffix: "anxious", mood: "anxious", severity: "watch" },
          { id: "distressed", label: "Distressed", suffix: "distressed", mood: "anxious", severity: "alert" },
        ],
      },
    ],
    noteField: { placeholder: "Sticky note: barking, pacing, damage, recovery, or what helped..." },
  },
  {
    type: "medication",
    label: "Meds",
    icon: "pill",
    baseTitle: "Medication",
    groups: [
      {
        key: "medicationOutcome",
        label: "Status",
        options: [
          { id: "taken", label: "Taken", suffix: "taken" },
          { id: "skipped", label: "Skipped", suffix: "skipped", severity: "watch" },
        ],
      },
    ],
    noteField: { placeholder: "Sticky note: side effects, refill note, or anything unusual..." },
  },
  { type: "weight", label: "Weight", icon: "scale", baseTitle: "Weight", numeric: { label: "Weight", placeholder: "0.0", unit: "weight" } },
  {
    type: "symptom",
    label: "Symptom",
    icon: "vomit",
    baseTitle: "Symptom",
    groups: [
      {
        key: "what",
        label: "What happened?",
        options: [
          { id: "vomit", label: "Vomit", suffix: "vomit" },
          { id: "diarrhea", label: "Diarrhea", suffix: "diarrhea" },
          { id: "itching", label: "Itching", suffix: "itching" },
          { id: "limping", label: "Limping", suffix: "limping" },
          { id: "other", label: "Other", suffix: "symptom" },
        ],
      },
      {
        key: "severity",
        label: "Severity",
        options: [
          { id: "watch", label: "Watch", severity: "watch" },
          { id: "alert", label: "Alert", severity: "alert" },
        ],
      },
    ],
  },
  {
    type: "grooming",
    label: "Grooming",
    icon: "star",
    baseTitle: "Grooming",
    stepper: { label: "Duration", unit: "min", values: [5, 10, 15, 20, 30, 45] },
    groups: [
      {
        key: "kind",
        label: "Type",
        options: [
          { id: "brush", label: "Brush", suffix: "brushing" },
          { id: "bath", label: "Bath", suffix: "bath" },
          { id: "nails", label: "Nails", suffix: "nail trim" },
          { id: "teeth", label: "Teeth", suffix: "teeth" },
        ],
      },
    ],
    noteField: { placeholder: "Sticky note: coat, paws, ears, products, groomer notes, or what changed..." },
  },
  { type: "note", label: "Note", icon: "star", baseTitle: "Note", noteField: { placeholder: "What's on your mind?" } },
];

const TYPE_BY_ID: Record<string, LogType> = LOG_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.type]: t }),
  {} as Record<string, LogType>,
);

type LauncherTab = "favorites" | "all" | "health";

interface LauncherAction {
  label: string;
  type: CareEventType;
  icon: PixelIconName;
  tab: LauncherTab | "household";
  preset?: Record<string, string>;
}

const LAUNCHER_TABS: { key: LauncherTab; label: string }[] = [
  { key: "favorites", label: "Favorites" },
  { key: "all", label: "All" },
  { key: "health", label: "Health" },
];

const LAUNCHER_ACTIONS: LauncherAction[] = [
  { label: "Meal", type: "meal", icon: "meal", tab: "favorites" },
  { label: "Walk", type: "walk", icon: "walk", tab: "favorites" },
  { label: "Pee", type: "potty", icon: "pee", tab: "favorites", preset: { kind: "pee", condition: "normal" } },
  { label: "Poo", type: "potty", icon: "poo", tab: "favorites", preset: { kind: "poop", condition: "normal" } },
  { label: "Training", type: "training", icon: "training", tab: "favorites" },
  { label: "Treat", type: "treat", icon: "treat", tab: "favorites" },
  { label: "Play", type: "play", icon: "play", tab: "favorites" },
  { label: "Vomit", type: "symptom", icon: "vomit", tab: "health", preset: { what: "vomit", severity: "watch" } },
  { label: "Medication", type: "medication", icon: "medication", tab: "health" },
  { label: "Alone Time", type: "alone", icon: "clock", tab: "household" },
  { label: "Anxious", type: "mood", icon: "anxious", tab: "health", preset: { mood: "anxious" } },
  { label: "Note", type: "note", icon: "note", tab: "household" },
  { label: "Water", type: "water", icon: "bile", tab: "all" },
  { label: "Weight", type: "weight", icon: "health", tab: "health" },
  { label: "Grooming", type: "grooming", icon: "happy", tab: "all" },
];

const MOOD_LAUNCHER: { key: string; label: string; icon: PixelIconName; mood: string }[] = [
  { key: "great", label: "Great", icon: "mood_great", mood: "happy" },
  { key: "good", label: "Good", icon: "mood_good", mood: "calm" },
  { key: "okay", label: "Okay", icon: "mood_okay", mood: "calm" },
  { key: "meh", label: "Meh", icon: "mood_meh", mood: "anxious" },
  { key: "rough", label: "Rough", icon: "mood_rough", mood: "unwell" },
];

function launcherActionKey(action: Pick<LauncherAction, "label" | "type">): string {
  return `${action.type}:${action.label}`;
}

// Icon resolution covers the composer types plus legacy entry types.
const TYPE_ICON: Record<string, PulseIconName> = {
  ...LOG_TYPES.reduce((acc, t) => ({ ...acc, [t.type]: t.icon }), {} as Record<string, PulseIconName>),
  pee: "drop",
  poop: "drop",
  park: "paw",
  social: "heart",
  alone: "house",
  vomit: "vomit",
  health: "heart",
  vet: "heart",
  medication: "pill",
  meds: "pill",
};

const LOG_GUIDANCE: Record<string, string> = {
  meal: "Serve it now, then update the outcome when Phoenix finishes.",
  water: "Fresh water keeps hydration and Bile Watch context honest.",
  treat: "Treats stay connected to diet, training, and appetite patterns.",
  walk: "Capture route, duration, distance, and dog interactions in one pass.",
  potty: "Potty is the parent log; pee, poop, accidents, and stool notes live here.",
  play: "Play logs help separate energy from anxiety and boredom.",
  training: "Wins, rough spots, and next practice become trainer-ready handoff notes.",
  mood: "Mood checks make Phoenix's care twin respond to real daily patterns.",
  alone: "Track away time, return state, and what helped Phoenix settle.",
  medication: "Medication logs are household-visible by default and audit-friendly.",
  weight: "Weight logs update Phoenix's living profile.",
  symptom: "Health notes stay non-diagnostic and easy to share with your vet.",
  grooming: "Grooming logs remember coat, paws, ears, products, and next due.",
  note: "Sticky notes keep tiny care details from disappearing.",
};

function syncLabel(status: Entry["syncStatus"]): string | null {
  if (status === "pending") return "Pending sync";
  if (status === "local") return "Saved offline";
  if (status === "failed") return "Sync failed";
  return null;
}

const DETAIL_SKIP_KEYS = new Set([
  "auditAction",
  "auditSubjectId",
  "auditTrail",
  "deletedEntrySnapshot",
  "stickyNotes",
  "title",
  "durationMinutes",
  "amount",
  "food",
  "dogInteractions",
  "servingAmount",
  "servingUnit",
  "servedAmount",
  "servedUnit",
  "eatenAmount",
  "eatenUnit",
  "expectedPortion",
  "mealCompletion",
  "householdVisible",
  "routineId",
  "routineTime",
]);

const DETAIL_LABELS: Record<string, string> = {
  amount: "Amount",
  condition: "Condition",
  kind: "Kind",
  portion: "Portion",
  severity: "Severity",
  serving: "Serving",
  stoolColor: "Stool color",
  pottyContext: "Context",
  trainingOutcome: "Training outcome",
  trainingSkill: "Skill",
  nextPractice: "Next practice",
  aloneOutcome: "Return state",
  aloneTrigger: "Trigger",
  calmingSupport: "Calming support",
  recoveryMinutes: "Recovery",
  groomingCondition: "Coat/skin",
  groomingProducts: "Products/groomer",
  groomingNextDue: "Next due",
  routineLabel: "Routine",
  what: "Symptom",
};

function isDetailRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function humanizeKey(key: string): string {
  return DETAIL_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function detailValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

function entryTypeLabel(type: string): string {
  const config = TYPE_BY_ID[type as CareEventType];
  return config?.label ?? humanizeKey(type);
}

function buildEntryDetailRows(entry: Entry): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const details = isDetailRecord(entry.details) ? entry.details : {};
  const servingAmount = detailValue(details.servingAmount);
  const servingUnit = detailValue(details.servingUnit);
  const servedAmount = detailValue(details.servedAmount);
  const servedUnit = detailValue(details.servedUnit) ?? servingUnit;
  const eatenAmount = detailValue(details.eatenAmount);
  const eatenUnit = detailValue(details.eatenUnit) ?? servedUnit;
  const expectedPortion = detailValue(details.expectedPortion);
  const mealCompletion = detailValue(details.mealCompletion);
  const status = syncLabel(entry.syncStatus);

  if (entry.durationMinutes != null) rows.push({ label: "Duration", value: `${entry.durationMinutes} min` });
  if (entry.amount && !eatenAmount) rows.push({ label: "Amount", value: servingUnit ? `${entry.amount} ${servingUnit}` : entry.amount });
  if (!entry.amount && servingAmount) rows.push({ label: "Serving", value: servingUnit ? `${servingAmount} ${servingUnit}` : servingAmount });
  if (mealCompletion) rows.push({ label: "Completion", value: humanizeKey(mealCompletion) });
  if (expectedPortion) rows.push({ label: "Expected", value: expectedPortion });
  if (servedAmount) rows.push({ label: "Served", value: servedUnit ? `${servedAmount} ${servedUnit}` : servedAmount });
  if (eatenAmount) rows.push({ label: "Eaten", value: eatenUnit ? `${eatenAmount} ${eatenUnit}` : eatenAmount });
  if (typeof details.householdVisible === "boolean") {
    rows.push({ label: "Household", value: details.householdVisible ? "Visible" : "Private" });
  }
  if (entry.food) rows.push({ label: "Food", value: entry.food });
  if (entry.mood) rows.push({ label: "Mood", value: humanizeKey(entry.mood) });
  if (entry.severity) rows.push({ label: "Severity", value: humanizeKey(entry.severity) });
  if (entry.dogInteractions != null) rows.push({ label: "Dog interactions", value: String(entry.dogInteractions) });
  if (status) rows.push({ label: "Sync", value: status });

  Object.entries(details).forEach(([key, value]) => {
    if (DETAIL_SKIP_KEYS.has(key)) return;
    const text = detailValue(value);
    if (!text) return;
    rows.push({ label: humanizeKey(key), value: humanizeKey(text) });
  });

  return rows;
}

function buildEntryHandoffMessage(entry: Entry): string {
  const type = entryTypeLabel(normalizeCareEventType(entry.type, entry.details));
  const rows = buildEntryDetailRows(entry);
  const stickyNotes = getStickyNotes(entry.details);
  const auditTrail = getCareAuditTrail(entry.details);
  return [
    "WOOFWATCHER LOG HANDOFF",
    "",
    entry.title,
    `Type: ${type}`,
    `Caregiver: ${entry.caregiver || "Care team"}`,
    `When: ${new Date(entry.occurredAt).toLocaleString("en-US")}`,
    entry.note ? `Note: ${entry.note}` : null,
    rows.length ? "" : null,
    rows.length ? "Details" : null,
    ...rows.map((row) => `- ${row.label}: ${row.value}`),
    stickyNotes.length ? "" : null,
    stickyNotes.length ? "Sticky notes" : null,
    ...stickyNotes.map((note) => `- ${note.text} (${note.caregiver})`),
    auditTrail.length ? "" : null,
    auditTrail.length ? "Audit trail" : null,
    ...auditTrail.map((event) => `- ${event.summary}`),
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

function stickyNoteId(): string {
  return `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function auditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function auditActionLabel(action: CareAuditEvent["action"]): string {
  if (action === "sticky-note-added") return "Sticky note";
  if (action === "updated") return "Edited";
  if (action === "deleted") return "Deleted";
  return "Created";
}

function auditMeta(event: CareAuditEvent): string {
  const when = new Date(event.occurredAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${auditActionLabel(event.action)} - ${event.caregiver} - ${when}`;
}

function formatCareAmount(value: number | null, unit: string): string {
  if (value == null) return "--";
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
  const unitText = unit === "g" || unit === "oz" || rounded === 1 ? unit : `${unit}s`;
  return `${text} ${unitText}`;
}

function parseNonNegativeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function mealCompletionLabel(value: string): string {
  if (value === "served") return "outcome pending";
  if (value === "grazing") return "still grazing";
  if (value === "most") return "ate most";
  if (value === "skipped") return "skipped";
  if (value === "partial") return "partial";
  return "complete";
}

function mealOutcomeNeedsEatenAmount(value: string): boolean {
  return value === "partial";
}

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomScrollPadding = getTabbedRouteBottomPadding(insets.bottom, Platform.OS === "web");
  const { state, addEntry, deleteEntry, updateEntry, updateCareDoc, refresh, syncOutbox, isSyncing } = useCare();
  const me = useGetMe();
  const routeParams = useLocalSearchParams<{ type?: string | string[] }>();
  const routeSelectedType = useMemo(() => {
    const rawType = Array.isArray(routeParams.type) ? routeParams.type[0] : routeParams.type;
    const normalized = normalizeCareEventType(rawType);
    return TYPE_BY_ID[normalized] ? normalized : null;
  }, [routeParams.type]);
  const lastRouteSelectedType = useRef<string | null>(null);

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const caregiver =
    me.data?.user?.displayName?.trim() || state.caregivers[0]?.name || "You";

  const [selectedType, setSelectedType] = useState<string>(() => routeSelectedType ?? "meal");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [numeric, setNumeric] = useState("");
  const [expectedPortion, setExpectedPortion] = useState("");
  const [eatenAmount, setEatenAmount] = useState("");
  const [medicationDose, setMedicationDose] = useState("");
  const [walkRouteName, setWalkRouteName] = useState("");
  const [walkDistanceMiles, setWalkDistanceMiles] = useState("");
  const [walkDogInteractions, setWalkDogInteractions] = useState("");
  const [walkSocialOutcome, setWalkSocialOutcome] = useState("");
  const [trainingSkill, setTrainingSkill] = useState("");
  const [trainingNextPractice, setTrainingNextPractice] = useState("");
  const [aloneTrigger, setAloneTrigger] = useState("");
  const [calmingSupport, setCalmingSupport] = useState("");
  const [recoveryMinutes, setRecoveryMinutes] = useState("");
  const [groomingCondition, setGroomingCondition] = useState("");
  const [groomingProducts, setGroomingProducts] = useState("");
  const [groomingNextDue, setGroomingNextDue] = useState("");
  const [householdVisible, setHouseholdVisible] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [launcherTab, setLauncherTab] = useState<LauncherTab>("favorites");
  const [selectedLauncherKey, setSelectedLauncherKey] = useState<string | null>(() => launcherActionKey(LAUNCHER_ACTIONS[0]!));
  const pendingChoicePreset = useRef<Record<string, string> | null>(null);

  const config = TYPE_BY_ID[selectedType];
  const medicationAdherence = useMemo(
    () => deriveMedicationAdherence({ entries: state.entries, routines: state.routines, now }),
    [state.entries, state.routines, now],
  );
  const medicationDefault = useMemo(
    () =>
      medicationAdherence.items.find((item) => item.status === "missed" || item.status === "due") ??
      medicationAdherence.items.find((item) => item.status === "upcoming") ??
      null,
    [medicationAdherence.items],
  );

  useEffect(() => {
    if (routeSelectedType && routeSelectedType !== lastRouteSelectedType.current) {
      setSelectedType(routeSelectedType);
      setSelectedLauncherKey(null);
      lastRouteSelectedType.current = routeSelectedType;
    }
  }, [routeSelectedType]);

  // Reset contextual controls whenever the type changes.
  useEffect(() => {
    const init: Record<string, string> = {};
    config?.groups?.forEach((g) => {
      init[g.key] = g.options[0].id;
    });
    setChoices({ ...init, ...(pendingChoicePreset.current ?? {}) });
    pendingChoicePreset.current = null;
    setStepIndex(config?.stepper ? Math.min(2, config.stepper.values.length - 1) : 0);
    setNumeric(selectedType === "weight" ? String(state.profile.weight.current ?? "") : "");
    setExpectedPortion(selectedType === "meal" ? state.dietProfile.normalPortion : "");
    setEatenAmount("");
    setMedicationDose(
      selectedType === "medication" && medicationDefault?.dose && medicationDefault.dose !== "Dose not set"
        ? medicationDefault.dose
        : "",
    );
    setWalkRouteName("");
    setWalkDistanceMiles("");
    setWalkDogInteractions("");
    setWalkSocialOutcome("");
    setTrainingSkill("");
    setTrainingNextPractice("");
    setAloneTrigger("");
    setCalmingSupport("");
    setRecoveryMinutes("");
    setGroomingCondition("");
    setGroomingProducts("");
    setGroomingNextDue("");
    setHouseholdVisible(true);
    setNoteText("");
  }, [selectedType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      selectedType === "meal" &&
      (choices.mealCompletion === "skipped" ||
        choices.mealCompletion === "served" ||
        choices.mealCompletion === "grazing")
    ) {
      setEatenAmount("");
    }
  }, [selectedType, choices.mealCompletion]);

  // Post-log quick-note prompt
  const [promptId, setPromptId] = useState<string | null>(null);
  const [promptTitle, setPromptTitle] = useState("");
  const [promptNote, setPromptNote] = useState("");
  const [promptMode, setPromptMode] = useState<"post-log" | "sticky">("post-log");
  const promptRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Entry editor
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");

  const caregiverColor = (name: string) => {
    const palette = [colors.primary, colors.copper, colors.sage, colors.amber];
    const idx = state.caregivers.findIndex((c) => c.name === name);
    return palette[(idx >= 0 ? idx : 0) % palette.length];
  };

  const stickyColor = (color: StickyNoteColor) => {
    if (color === "sun") return colors.amber;
    if (color === "copper") return colors.copper;
    if (color === "sky") return colors.secondary;
    if (color === "rose") return colors.rose;
    return colors.sage;
  };

  const dietProgress = useMemo(
    () =>
      deriveDietProgress({
        dietProfile: state.dietProfile,
        entries: state.entries,
        now,
      }),
    [state.dietProfile, state.entries, now],
  );
  const careIntelligence = useMemo(
    () =>
      deriveCareIntelligence({
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
      }),
    [state.entries, state.routines, state.caregivers, now],
  );

  const detailEntry = useMemo(
    () => state.entries.find((entry) => entry.id === detailEntryId) ?? null,
    [state.entries, detailEntryId],
  );
  const detailRows = useMemo(
    () => (detailEntry ? buildEntryDetailRows(detailEntry) : []),
    [detailEntry],
  );
  const detailStickyNotes = useMemo(
    () => (detailEntry ? getStickyNotes(detailEntry.details) : []),
    [detailEntry],
  );
  const detailAuditTrail = useMemo(
    () => (detailEntry ? getCareAuditTrail(detailEntry.details) : []),
    [detailEntry],
  );
  const detailType = detailEntry ? normalizeCareEventType(detailEntry.type, detailEntry.details) : null;
  const detailIcon = detailType ? TYPE_ICON[detailType] ?? "paw" : "paw";
  const detailTypeText = detailType ? entryTypeLabel(detailType) : "";

  // Mount animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [fade, slide]);

  const buildEntry = useCallback((): Omit<Entry, "id"> | null => {
    if (!config) return null;
    const parts: string[] = [];
    let details: { [key: string]: unknown } = {};
    let mood: string | undefined;
    let severity: Severity | undefined;
    let dogInteractions: number | undefined;
    const occurredAt = new Date().toISOString();

    config.groups?.forEach((g) => {
      const opt = g.options.find((o) => o.id === choices[g.key]) ?? g.options[0];
      details[g.key] = opt.id;
      if (opt.suffix && !(config.type === "meal" && g.key === "mealCompletion")) {
        parts.push(opt.suffix);
      }
      if (opt.mood) mood = opt.mood;
      if (opt.severity && opt.severity !== "normal") severity = opt.severity;
    });

    let durationMinutes: number | undefined;
    if (config.stepper) durationMinutes = config.stepper.values[stepIndex];

    let amount: string | undefined;
    let numericValue: number | null = null;
    if (config.numeric) {
      const trimmed = numeric.trim();
      const n = parseNonNegativeNumber(trimmed);
      if (!trimmed && config.numeric.optional) {
        amount = undefined;
      } else if (n == null || (n <= 0 && config.type !== "meal")) {
        Alert.alert("Add a value", `Enter a ${config.numeric.label.toLowerCase()} to log.`);
        return null;
      } else {
        const unit = config.numeric.unit === "diet" ? dietProgress.unit : state.profile.weight.unit;
        numericValue = n;
        amount = String(n);
        details.servingAmount = n;
        details.servingUnit = unit;
        if (config.type !== "meal") parts.push(`${n} ${unit}`);
      }
    }

    if (config.type === "meal") {
      const unit = dietProgress.unit;
      const completion = choices.mealCompletion ?? "served";
      const expected = expectedPortion.trim() || state.dietProfile.normalPortion.trim();
      const eaten = parseNonNegativeNumber(eatenAmount);

      if (eatenAmount.trim() && eaten == null) {
        Alert.alert("Check eaten amount", "Enter a valid eaten amount, or leave it blank.");
        return null;
      }

      if (mealOutcomeNeedsEatenAmount(completion) && eaten == null) {
        Alert.alert("Add eaten amount", "For a partial meal, enter how much Phoenix actually ate.");
        return null;
      }

      details.mealCompletion = completion;
      details.mealLifecycle =
        completion === "served" || completion === "grazing"
          ? "outcome-pending"
          : "outcome-recorded";
      details.householdVisible = householdVisible;
      if (expected) details.expectedPortion = expected;

      if (numericValue != null) {
        details.servedAmount = numericValue;
        details.servedUnit = unit;
      }

      if (completion === "skipped") {
        details.servedAmount = numericValue ?? 0;
        details.servedUnit = unit;
        details.eatenAmount = 0;
        details.eatenUnit = unit;
        amount = "0";
        if (numericValue != null && numericValue > 0) parts.push(`served ${numericValue} ${unit}`);
        parts.push("skipped");
      } else if (completion === "served" || completion === "grazing") {
        amount = undefined;
        if (numericValue != null && numericValue > 0) parts.push(`served ${numericValue} ${unit}`);
        parts.push(mealCompletionLabel(completion));
      } else {
        const finalEaten = eaten ?? (completion === "complete" && numericValue != null ? numericValue : null);
        if (finalEaten != null) {
          details.eatenAmount = finalEaten;
          details.eatenUnit = unit;
          amount = String(finalEaten);
        }
        if (completion !== "complete") parts.push(mealCompletionLabel(completion));
        if (numericValue != null && numericValue > 0) parts.push(`served ${numericValue} ${unit}`);
        if (finalEaten != null && (completion === "partial" || finalEaten !== numericValue)) {
          parts.push(`ate ${finalEaten} ${unit}`);
        }
      }
    }

    if (config.type === "medication") {
      const outcome = choices.medicationOutcome ?? "taken";
      const defaultDose = medicationDefault?.dose && medicationDefault.dose !== "Dose not set" ? medicationDefault.dose : "";
      const dose = medicationDose.trim() || defaultDose;

      details.medicationOutcome = outcome;
      details.householdVisible = householdVisible;
      if (medicationDefault) {
        details.routineId = medicationDefault.id;
        details.routineLabel = medicationDefault.label;
        details.routineTime = medicationDefault.time;
        if (medicationDefault.label) parts.unshift(medicationDefault.label);
      }
      if (dose) {
        details.dose = dose;
        parts.splice(medicationDefault?.label ? 1 : 0, 0, dose);
      }
      if (outcome === "skipped") severity = "watch";
    }

    if (config.type === "walk") {
      const routeName = walkRouteName.trim();
      const socialOutcome = walkSocialOutcome.trim();
      const distance = parseNonNegativeNumber(walkDistanceMiles);
      const interactionCount = parseNonNegativeNumber(walkDogInteractions);

      if (walkDistanceMiles.trim() && distance == null) {
        Alert.alert("Check distance", "Enter a valid distance, or leave it blank.");
        return null;
      }

      if (walkDogInteractions.trim() && interactionCount == null) {
        Alert.alert("Check dog interactions", "Enter a valid dog interaction count, or leave it blank.");
        return null;
      }

      details.householdVisible = householdVisible;
      if (routeName) {
        details.routeName = routeName;
        parts.unshift(routeName);
      }
      if (distance != null) details.distanceMiles = distance;
      if (interactionCount != null) {
        dogInteractions = Math.round(interactionCount);
        details.dogInteractions = dogInteractions;
        if (dogInteractions > 0) {
          parts.push(`${dogInteractions} dog ${dogInteractions === 1 ? "interaction" : "interactions"}`);
        }
      }
      if (socialOutcome) details.socialOutcome = socialOutcome;
    }

    if (config.type === "training") {
      const skill = trainingSkill.trim();
      const nextPractice = trainingNextPractice.trim();
      const outcome = choices.trainingOutcome ?? "win";

      details.householdVisible = householdVisible;
      details.trainingOutcome = outcome;
      if (skill) {
        details.trainingSkill = skill;
        parts.unshift(skill);
      }
      if (nextPractice) details.nextPractice = nextPractice;
      if (outcome === "struggle") severity = "watch";
    }

    if (config.type === "alone") {
      const trigger = aloneTrigger.trim();
      const support = calmingSupport.trim();
      const recovery = parseNonNegativeNumber(recoveryMinutes);

      if (recoveryMinutes.trim() && recovery == null) {
        Alert.alert("Check recovery time", "Enter recovery minutes as a number, or leave it blank.");
        return null;
      }

      details.householdVisible = householdVisible;
      if (trigger) details.aloneTrigger = trigger;
      if (support) details.calmingSupport = support;
      if (recovery != null) details.recoveryMinutes = Math.round(recovery);
    }

    if (config.type === "grooming") {
      const condition = groomingCondition.trim();
      const products = groomingProducts.trim();
      const nextDue = groomingNextDue.trim();

      details.householdVisible = householdVisible;
      if (condition) {
        details.groomingCondition = condition;
        parts.push(condition);
      }
      if (products) details.groomingProducts = products;
      if (nextDue) details.groomingNextDue = nextDue;
      if (/(itch|red|sore|hot spot|mat|odor|ear|rash|pain|blood)/i.test(condition)) {
        severity = "watch";
      }
    }

    if (config.type === "potty") {
      details.householdVisible = householdVisible;
    }

    const note = config.noteField ? noteText.trim() || undefined : undefined;
    if (durationMinutes) parts.push(`${durationMinutes} ${config.stepper!.unit}`);
    if (note) {
      details = appendStickyNote(details, {
        id: stickyNoteId(),
        text: note,
        caregiver,
        createdAt: occurredAt,
        color: "sun",
      });
    }
    const title = parts.length ? `${config.baseTitle} - ${parts.join(", ")}` : config.baseTitle;
    const type = normalizeCareEventType(config.type, details);
    details = appendCareAuditEvent(details, {
      id: auditId(),
      action: "created",
      caregiver,
      occurredAt,
      summary: `${caregiver} created "${title}" in the shared care log.`,
    });

    return {
      type,
      title,
      caregiver,
      occurredAt,
      ...(note ? { note } : {}),
      ...(mood ? { mood } : {}),
      ...(severity ? { severity } : {}),
      ...(durationMinutes ? { durationMinutes } : {}),
      ...(amount != null ? { amount } : {}),
      ...(dogInteractions != null ? { dogInteractions } : {}),
      ...(Object.keys(details).length ? { details } : {}),
    };
  }, [
    config,
    choices,
    stepIndex,
    numeric,
    expectedPortion,
    eatenAmount,
    medicationDefault,
    medicationDose,
    walkRouteName,
    walkDistanceMiles,
    walkDogInteractions,
    walkSocialOutcome,
    trainingSkill,
    trainingNextPractice,
    aloneTrigger,
    calmingSupport,
    recoveryMinutes,
    groomingCondition,
    groomingProducts,
    groomingNextDue,
    householdVisible,
    dietProgress.unit,
    noteText,
    caregiver,
    state.dietProfile.normalPortion,
    state.profile.weight.unit,
  ]);

  const handleLog = useCallback(() => {
    const entry = buildEntry();
    if (!entry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = addEntry(entry);

    // Weight logs also update the living profile weight.
    if (entry.type === "weight" && entry.amount != null) {
      const w = parseFloat(entry.amount);
      if (!Number.isNaN(w)) {
        updateCareDoc((doc) => ({
          ...doc,
          profile: { ...doc.profile, weight: { ...doc.profile.weight, current: w } },
        }));
      }
    }

    setNumeric(entry.type === "weight" ? (entry.amount ?? "") : "");
    if (entry.type === "meal") {
      setExpectedPortion(state.dietProfile.normalPortion);
      setEatenAmount("");
      setHouseholdVisible(true);
    }
    if (entry.type === "alone") {
      setAloneTrigger("");
      setCalmingSupport("");
      setRecoveryMinutes("");
      setHouseholdVisible(true);
    }
    setNoteText("");

    // If a note was already captured inline, skip the prompt.
    if (config?.noteField) return;

    setPromptId(id);
    setPromptTitle(entry.title);
    setPromptNote("");
    setPromptMode("post-log");
    setTimeout(() => promptRef.current?.focus(), 250);
  }, [buildEntry, addEntry, updateCareDoc, config, state.dietProfile.normalPortion]);

  const saveQuickNote = useCallback(() => {
    const text = promptNote.trim();
    if (promptId && text) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const entry = state.entries.find((item) => item.id === promptId);
      const occurredAt = new Date().toISOString();
      const detailsWithNote = appendStickyNote(entry?.details ?? {}, {
        id: stickyNoteId(),
        text,
        caregiver,
        createdAt: occurredAt,
        color: promptMode === "post-log" ? "sun" : "sage",
      });
      const details = appendCareAuditEvent(detailsWithNote, {
        id: auditId(),
        action: "sticky-note-added",
        caregiver,
        occurredAt,
        summary: `${caregiver} added a sticky note to "${entry?.title ?? "this log"}".`,
        changes: ["stickyNotes"],
      });
      updateEntry(promptId, { note: entry?.note ?? text, details });
    }
    setPromptId(null);
    setPromptNote("");
  }, [promptId, promptNote, promptMode, state.entries, caregiver, updateEntry]);

  const handleDelete = useCallback(
    (id: string, title: string, onDeleted?: () => void) => {
      Alert.alert("Delete entry", `Remove "${title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const entry = state.entries.find((item) => item.id === id);
            const deleted = await deleteEntry(id);
            if (!deleted) {
              Alert.alert("Delete failed", "WoofWatcher kept the log because the household sync rejected the delete. Try again after refresh.");
              return;
            }
            if (entry) {
              addEntry(
                buildCareLogDeletionAuditEntry({
                  id: auditId(),
                  caregiver,
                  occurredAt: new Date().toISOString(),
                  entry,
                }),
              );
            }
            onDeleted?.();
          },
        },
      ]);
    },
    [addEntry, caregiver, deleteEntry, state.entries],
  );

  const openEditEntry = useCallback((e: Entry) => {
    setEditEntry(e);
    setEditTitle(e.title);
    setEditNote(e.note ?? "");
    Haptics.selectionAsync();
  }, []);

  const openStickyPrompt = useCallback((e: Entry) => {
    setPromptId(e.id);
    setPromptTitle(e.title);
    setPromptNote("");
    setPromptMode("sticky");
    Haptics.selectionAsync();
    setTimeout(() => promptRef.current?.focus(), 250);
  }, []);

  const saveEditEntry = useCallback(() => {
    if (!editEntry) return;
    const title = editTitle.trim() || editEntry.title;
    const note = editNote.trim() || undefined;
    const changes: string[] = [];
    if (title !== editEntry.title) changes.push("title");
    if ((note ?? "") !== (editEntry.note ?? "")) changes.push("note");

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (changes.length) {
      const details = appendCareAuditEvent(editEntry.details ?? {}, {
        id: auditId(),
        action: "updated",
        caregiver,
        occurredAt: new Date().toISOString(),
        summary: `${caregiver} updated ${changes.join(" and ")} on "${editEntry.title}".`,
        changes,
      });
      updateEntry(editEntry.id, {
        ...(title !== editEntry.title ? { title } : {}),
        ...((note ?? "") !== (editEntry.note ?? "") ? { note } : {}),
        details,
      });
    }
    setEditEntry(null);
  }, [caregiver, editEntry, editTitle, editNote, updateEntry]);

  const openEntryDetail = useCallback((e: Entry) => {
    setDetailEntryId(e.id);
    Haptics.selectionAsync();
  }, []);

  const shareEntryHandoff = useCallback((e: Entry) => {
    const message = buildEntryHandoffMessage(e);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({ message, title: `${e.title} handoff` }).catch(() =>
      Alert.alert("Entry handoff", message),
    );
  }, []);

  const logSearch = useMemo(
    () => deriveCareLogSearch({ entries: state.entries, query: searchText, type: filter }),
    [state.entries, searchText, filter],
  );
  const filtered = logSearch.entries;

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; entries: Entry[] }[] = [];
    const map: Record<string, Entry[]> = {};
    for (const e of filtered) {
      const k = dayKey(e.occurredAt);
      if (!map[k]) {
        map[k] = [];
        groups.push({ key: k, label: dayLabel(e.occurredAt, now), entries: map[k] });
      }
      map[k].push(e);
    }
    return groups;
  }, [filtered, now]);

  const presentTypes = useMemo(() => {
    const set = new Set(
      state.entries.map((e) => normalizeCareEventType(e.type, e.details)),
    );
    return LOG_TYPES.filter((q) => set.has(q.type));
  }, [state.entries]);

  // Today's snapshot: total count and per-type counts
  const todaySnapshot = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = state.entries.filter((e) => e.occurredAt.startsWith(today));
    const counts: Record<string, number> = {};
    for (const e of todayEntries) {
      const type = normalizeCareEventType(e.type, e.details);
      counts[type] = (counts[type] ?? 0) + 1;
    }
    // Top 5 types by count
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count, icon: TYPE_ICON[type] ?? ("paw" as PulseIconName) }));
    return { total: todayEntries.length, top };
  }, [state.entries]);
  const todaySignalCards = useMemo(
    () => [
      {
        label: "Care IQ",
        value: `${careIntelligence.score}%`,
        detail: careIntelligence.status === "needs-attention" ? "review loops" : "day rhythm",
        icon: "sparkles-outline" as const,
        tone:
          careIntelligence.status === "needs-attention"
            ? colors.amber
            : careIntelligence.status === "excellent"
              ? colors.sage
              : colors.primary,
      },
      {
        label: "Today",
        value: String(todaySnapshot.total),
        detail: "care logs",
        icon: "reader-outline" as const,
        tone: colors.copper,
      },
      {
        label: "Food",
        value: dietProgress.targetAmount == null ? "Set" : `${dietProgress.percent}%`,
        detail: dietProgress.targetAmount == null ? "portion" : "of daily target",
        icon: "restaurant-outline" as const,
        tone: colors.sage,
      },
      {
        label: "Sync",
        value: syncOutbox.total > 0 ? `${syncOutbox.total}` : "Ready",
        detail: syncOutbox.total > 0 ? "queued safely" : "protected",
        icon: syncOutbox.total > 0 ? ("cloud-offline-outline" as const) : ("cloud-done-outline" as const),
        tone: syncOutbox.status === "needs-retry" ? colors.amber : colors.primary,
      },
    ],
    [
      colors.amber,
      colors.copper,
      colors.primary,
      colors.sage,
      careIntelligence.score,
      careIntelligence.status,
      dietProgress.percent,
      dietProgress.targetAmount,
      syncOutbox.status,
      syncOutbox.total,
      todaySnapshot.total,
    ],
  );

  const numericUnit = config?.numeric?.unit === "diet" ? dietProgress.unit : state.profile.weight.unit;
  const selectedMealCompletion = choices.mealCompletion ?? "served";
  const selectedIcon = config?.icon ?? ("paw" as PulseIconName);
  const selectedTone = PULSE_COLORS[selectedIcon];
  const selectedLabel = config?.label ?? "Care";
  const selectedGuidance = LOG_GUIDANCE[selectedType] ?? "Log care once and it becomes part of the shared household record.";
  const selectedTrustLabel =
    selectedType === "symptom"
      ? "Vet-share ready"
      : selectedType === "meal"
        ? selectedMealCompletion === "served" || selectedMealCompletion === "grazing"
          ? "Outcome pending"
          : "Diet progress ready"
        : selectedType === "alone"
          ? "Alone Time Watch"
          : "Household record";
  const composerTrustItems = [
    {
      icon: "git-branch-outline" as const,
      label: selectedType === "meal" ? "Routine-aware" : "Pattern-aware",
      tone: colors.sage,
    },
    {
      icon: "bar-chart-outline" as const,
      label: `${careIntelligence.score}% Care IQ`,
      tone:
        careIntelligence.status === "needs-attention"
          ? colors.amber
          : careIntelligence.status === "excellent"
            ? colors.sage
            : colors.primary,
    },
    {
      icon: householdVisible ? ("people-outline" as const) : ("lock-closed-outline" as const),
      label: householdVisible ? "Household" : "Private",
      tone: householdVisible ? colors.primary : colors.mutedForeground,
    },
  ];
  const dietPercentWidth = `${Math.min(Math.max(dietProgress.percent, 0), 100)}%` as `${number}%`;
  const dietProgressText =
    dietProgress.targetAmount == null
      ? "Set a normal portion in Plans to unlock exact daily targets."
      : `${formatCareAmount(dietProgress.fedAmount, dietProgress.unit)} fed - ${formatCareAmount(
          dietProgress.remainingAmount,
          dietProgress.unit,
        )} remaining`;

  const launcherActions = useMemo(() => {
    if (launcherTab === "favorites") return LAUNCHER_ACTIONS.slice(0, 12);
    if (launcherTab === "health") {
      return LAUNCHER_ACTIONS.filter((action) => action.tab === "health");
    }
    return LAUNCHER_ACTIONS;
  }, [launcherTab]);

  const selectLauncherAction = (action: LauncherAction) => {
    Haptics.selectionAsync();
    pendingChoicePreset.current = action.preset ?? null;
    setSelectedLauncherKey(launcherActionKey(action));
    setSelectedType(action.type);
    if (selectedType === action.type && action.preset) {
      setChoices((prev) => ({ ...prev, ...action.preset }));
    }
  };

  const selectMoodLauncher = (mood: (typeof MOOD_LAUNCHER)[number]) => {
    Haptics.selectionAsync();
    pendingChoicePreset.current = { mood: mood.mood, moodTone: mood.key };
    setSelectedLauncherKey(null);
    setSelectedType("mood");
    if (selectedType === "mood") {
      setChoices((prev) => ({ ...prev, mood: mood.mood, moodTone: mood.key }));
    }
  };

  const H_PAD = 20;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={s.container}
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: bottomScrollPadding, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BoardRouteHeader
            title="Quick Log"
            back
            centered
            plain
            onBack={() => router.push("/")}
            actionIcon="notifications-outline"
            actionLabel="Open Health Watch"
            onAction={() => {
              Haptics.selectionAsync();
              router.push("/health");
            }}
          />

          <BoardCard style={s.launcherCard}>
            <View style={s.launcherTabs}>
              {LAUNCHER_TABS.map((tab) => {
                const active = launcherTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${tab.label} quick log actions`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setLauncherTab(tab.key);
                    }}
                    style={[
                      s.launcherTab,
                      {
                        backgroundColor: active ? colors.brandNavy : colors.background,
                        borderColor: active ? colors.brandNavy : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.launcherTabText,
                        {
                          color: active ? colors.ivory : colors.navy,
                          fontFamily: active ? "Inter_700Bold" : "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.launcherGrid}>
              {launcherActions.map((action) => {
                const active = selectedLauncherKey === launcherActionKey(action);
                return (
                  <Pressable
                    key={`${action.label}-${action.type}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Prepare ${action.label} log`}
                    accessibilityState={{ selected: active }}
                    onPress={() => selectLauncherAction(action)}
                    style={({ pressed }) => [
                      s.launcherTile,
                      {
                        backgroundColor: active ? colors.ivory : colors.background,
                        borderColor: active ? colors.copper : colors.border,
                        shadowColor: active ? colors.copper : colors.navy,
                        shadowOpacity: active ? 0.13 : 0,
                        shadowRadius: active ? 10 : 0,
                        shadowOffset: { width: 0, height: active ? 5 : 0 },
                        elevation: active ? 2 : 0,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.launcherIconHalo,
                        {
                          backgroundColor: active ? colors.copper + "12" : colors.card,
                          borderColor: active ? colors.copper + "55" : colors.border,
                        },
                      ]}
                    >
                      <PixelIcon name={action.icon} size={30} />
                    </View>
                    {active ? (
                      <View style={[s.launcherSelectedMark, { backgroundColor: colors.copper }]}>
                        <Ionicons name="checkmark" size={12} color={colors.ivory} />
                      </View>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[s.launcherTileText, { color: colors.navy, fontFamily: "Inter_700Bold" }]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[s.moodPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[s.moodQuestion, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                How is Phoenix feeling?
              </Text>
              <View style={s.moodRow}>
                {MOOD_LAUNCHER.map((mood) => {
                  const active = selectedType === "mood" && choices.moodTone === mood.key;
                  return (
                    <Pressable
                      key={mood.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Phoenix feels ${mood.label}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => selectMoodLauncher(mood)}
                      style={({ pressed }) => [
                        s.moodOption,
                        {
                          backgroundColor: active ? colors.amber + "16" : "transparent",
                          borderColor: active ? colors.amber + "66" : "transparent",
                          opacity: pressed ? 0.72 : 1,
                        },
                      ]}
                    >
                      <PixelIcon name={mood.icon} size={30} />
                      <Text style={[s.moodOptionText, { color: colors.navy, fontFamily: "Inter_600SemiBold" }]}>
                        {mood.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add details to the selected log"
              onPress={() => {
                Haptics.selectionAsync();
                scrollRef.current?.scrollTo({ y: 620, animated: true });
              }}
              style={({ pressed }) => [
                s.launcherCta,
                {
                      backgroundColor: colors.brandNavy,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
            >
              <Text style={[s.launcherCtaText, { fontFamily: "Inter_700Bold" }]}>
                Add Details (optional)
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.ivory} />
            </Pressable>
          </BoardCard>

          <View style={s.signalStrip}>
            {todaySignalCards.map((card) => (
              <View
                key={card.label}
                style={[s.signalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[s.signalIcon, { backgroundColor: card.tone + "18" }]}>
                  <Ionicons name={card.icon} size={16} color={card.tone} />
                </View>
                <Text style={[s.signalLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  {card.label}
                </Text>
                <Text style={[s.signalValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {card.value}
                </Text>
                <Text style={[s.signalDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {card.detail}
                </Text>
              </View>
            ))}
          </View>

          {syncOutbox.total > 0 ? (
            <View
              style={[
                s.outboxCard,
                {
                  backgroundColor: colors.card,
                  borderColor:
                    syncOutbox.status === "needs-retry"
                      ? colors.amber + "55"
                      : colors.primary + "33",
                  shadowColor:
                    syncOutbox.status === "needs-retry" ? colors.amber : colors.primary,
                },
              ]}
            >
              <View style={s.outboxTop}>
                <View
                  style={[
                    s.outboxIcon,
                    {
                      backgroundColor:
                        syncOutbox.status === "needs-retry"
                          ? colors.amber + "18"
                          : colors.primary + "14",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      syncOutbox.status === "needs-retry"
                        ? "cloud-offline-outline"
                        : "cloud-upload-outline"
                    }
                    size={18}
                    color={
                      syncOutbox.status === "needs-retry" ? colors.amber : colors.primary
                    }
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.outboxEyebrow, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    SYNC STATUS
                  </Text>
                  <Text style={[s.outboxTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {syncOutbox.status === "needs-retry" ? "Saved on this device" : "Syncing safely"}
                  </Text>
                  <Text style={[s.outboxMessage, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {syncOutbox.message} Phoenix's local record is safe on this device.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry sync outbox"
                  onPress={() => {
                    Haptics.selectionAsync();
                    refresh();
                  }}
                  disabled={isSyncing || syncOutbox.retryable === 0}
                  style={({ pressed }) => [
                    s.outboxButton,
                    {
                      backgroundColor:
                        syncOutbox.retryable > 0 ? colors.primary : colors.background,
                      opacity: pressed || isSyncing || syncOutbox.retryable === 0 ? 0.66 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.outboxButtonText,
                      {
                        color: syncOutbox.retryable > 0 ? "#FFFFFF" : colors.mutedForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {isSyncing ? "Syncing" : "Retry"}
                  </Text>
                </Pressable>
              </View>
              <View style={s.outboxMetrics}>
                <View style={[s.outboxMetric, { backgroundColor: colors.background }]}>
                  <Text style={[s.outboxMetricText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {syncOutbox.retryableCreateIds.length} creates
                  </Text>
                </View>
                <View style={[s.outboxMetric, { backgroundColor: colors.background }]}>
                  <Text style={[s.outboxMetricText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {syncOutbox.retryableUpdateIds.length} updates
                  </Text>
                </View>
                <View style={[s.outboxMetric, { backgroundColor: colors.background }]}>
                  <Text style={[s.outboxMetricText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {syncOutbox.pending} syncing
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Composer card */}
          <BoardCard style={s.composerHero}>
            <View style={[s.composerHeroBanner, { backgroundColor: colors.brandNavy, borderColor: colors.shellNavy }]}>
              <View style={[s.composerHeroIcon, { backgroundColor: selectedTone + "22", borderColor: selectedTone + "66" }]}>
                <PulseIcon name={selectedIcon} size={30} />
              </View>
              <View style={s.composerHeroText}>
                <Text style={[s.composerKicker, { color: colors.amber, fontFamily: DISPLAY_SEMI }]}>
                  Now logging
                </Text>
                <Text style={[s.composerTitle, { fontFamily: DISPLAY }]}>
                  {selectedLabel}
                </Text>
                <Text style={[s.composerHint, { fontFamily: "Inter_500Medium" }]}>
                  {selectedGuidance}
                </Text>
              </View>
              <View style={[s.composerBadge, { backgroundColor: "rgba(255,249,239,0.1)", borderColor: "rgba(255,249,239,0.18)" }]}>
                <Text style={[s.composerBadgeText, { fontFamily: "Inter_700Bold" }]}>
                  {selectedTrustLabel}
                </Text>
              </View>
            </View>

            <View style={s.composerTrustRail}>
              {composerTrustItems.map((item) => (
                <View
                  key={item.label}
                  style={[
                    s.composerTrustChip,
                    {
                      backgroundColor: colors.background,
                      borderColor: item.tone + "33",
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={14} color={item.tone} />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[s.composerTrustText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            <BoardSectionHeader title="Choose care type" action="Fast tap" style={s.composerSectionHeader} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.typeRow}
              style={{ marginHorizontal: -4 }}
            >
              {LOG_TYPES.map((q) => {
                const active = selectedType === q.type;
                const tint = PULSE_COLORS[q.icon];
                return (
                  <Pressable
                    key={q.type}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedLauncherKey(null);
                      setSelectedType(q.type);
                    }}
                    style={[
                      s.typeChip,
                      {
                        backgroundColor: active ? tint : colors.background,
                        borderColor: active ? colors.navy : colors.border,
                      },
                    ]}
                  >
                    <View style={[s.typeChipIcon, { backgroundColor: active ? "rgba(255,255,255,0.18)" : tint + "1A" }]}>
                      <PulseIcon name={q.icon} size={15} color={active ? "#FFFFFF" : undefined} />
                    </View>
                    <Text
                      style={[
                        s.typeChipLabel,
                        { color: active ? "#FFFFFF" : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
                      ]}
                    >
                      {q.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Contextual controls */}
            {config?.groups?.map((g) => (
              <View key={g.key} style={s.fieldBlock}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {g.label}
                </Text>
                <View style={s.segRow}>
                  {g.options.map((o) => {
                    const active = (choices[g.key] ?? g.options[0].id) === o.id;
                    const tone =
                      o.severity === "alert" ? colors.rose : o.severity === "watch" ? colors.amber : colors.primary;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setChoices((prev) => ({ ...prev, [g.key]: o.id }));
                        }}
                        style={[
                          s.segPill,
                          {
                            backgroundColor: active ? tone : colors.background,
                            borderColor: active ? tone : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.segText,
                            { color: active ? "#FFFFFF" : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
                          ]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {config?.stepper && (
              <View style={s.fieldBlock}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {config.stepper.label}
                </Text>
                <View style={s.segRow}>
                  {config.stepper.values.map((v, i) => {
                    const active = stepIndex === i;
                    return (
                      <Pressable
                        key={v}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setStepIndex(i);
                        }}
                        style={[
                          s.segPill,
                          { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            s.segText,
                            { color: active ? "#FFFFFF" : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
                          ]}
                        >
                          {v} {config.stepper!.unit}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {config?.numeric && (
              <View style={s.fieldBlock}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {config.numeric.label} ({numericUnit}{config.numeric.optional ? ", optional" : ""})
                </Text>
                <TextInput
                  placeholder={config.numeric.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={numeric}
                  onChangeText={setNumeric}
                  keyboardType="decimal-pad"
                  style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                />
              </View>
            )}

            {selectedType === "walk" && (
              <View style={s.mealFields}>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Route or place</Text>
                  <TextInput
                    placeholder="Neighborhood Loop, Dog park, River trail..."
                    placeholderTextColor={colors.mutedForeground}
                    value={walkRouteName}
                    onChangeText={setWalkRouteName}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View style={s.mealFieldRow}>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Distance mi</Text>
                    <TextInput
                      placeholder="1.2"
                      placeholderTextColor={colors.mutedForeground}
                      value={walkDistanceMiles}
                      onChangeText={setWalkDistanceMiles}
                      keyboardType="decimal-pad"
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Dog interactions</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      value={walkDogInteractions}
                      onChangeText={setWalkDogInteractions}
                      keyboardType="number-pad"
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                </View>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Social outcome</Text>
                  <TextInput
                    placeholder="Calm greeting, no dogs seen, barked near the gate..."
                    placeholderTextColor={colors.mutedForeground}
                    value={walkSocialOutcome}
                    onChangeText={setWalkSocialOutcome}
                    multiline
                    style={[s.input, s.inputMulti, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHouseholdVisible((prev) => !prev);
                  }}
                  style={[
                    s.visibilityToggle,
                    {
                      backgroundColor: householdVisible ? colors.sage + "14" : colors.background,
                      borderColor: householdVisible ? colors.sage + "55" : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={householdVisible ? "people-outline" : "lock-closed-outline"} size={16} color={householdVisible ? colors.sage : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.visibilityTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {householdVisible ? "Visible to household" : "Private log"}
                    </Text>
                    <Text style={[s.visibilitySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {householdVisible ? "Shared walk logs update route templates and handoffs." : "Private walks stay out of household route templates."}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {selectedType === "training" && (
              <View style={s.mealFields}>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Skill or cue</Text>
                  <TextInput
                    placeholder="Leash manners, recall, calm greeting..."
                    placeholderTextColor={colors.mutedForeground}
                    value={trainingSkill}
                    onChangeText={setTrainingSkill}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Next practice</Text>
                  <TextInput
                    placeholder="Practice calm passes, repeat place cue, shorten distance..."
                    placeholderTextColor={colors.mutedForeground}
                    value={trainingNextPractice}
                    onChangeText={setTrainingNextPractice}
                    multiline
                    style={[s.input, s.inputMulti, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHouseholdVisible((prev) => !prev);
                  }}
                  style={[
                    s.visibilityToggle,
                    {
                      backgroundColor: householdVisible ? colors.sage + "14" : colors.background,
                      borderColor: householdVisible ? colors.sage + "55" : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={householdVisible ? "people-outline" : "lock-closed-outline"} size={16} color={householdVisible ? colors.sage : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.visibilityTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {householdVisible ? "Visible to household" : "Private log"}
                    </Text>
                    <Text style={[s.visibilitySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {householdVisible ? "Shared training logs update Training Progress and trainer handoffs." : "Private training stays out of shared progress."}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {selectedType === "alone" && (
              <View style={s.mealFields}>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Trigger or context</Text>
                  <TextInput
                    placeholder="Leaving after breakfast, doorbell, both owners out..."
                    placeholderTextColor={colors.mutedForeground}
                    value={aloneTrigger}
                    onChangeText={setAloneTrigger}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View style={s.mealFieldRow}>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Recovery min</Text>
                    <TextInput
                      placeholder="15"
                      placeholderTextColor={colors.mutedForeground}
                      value={recoveryMinutes}
                      onChangeText={setRecoveryMinutes}
                      keyboardType="number-pad"
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Support</Text>
                    <TextInput
                      placeholder="Puzzle toy"
                      placeholderTextColor={colors.mutedForeground}
                      value={calmingSupport}
                      onChangeText={setCalmingSupport}
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHouseholdVisible((prev) => !prev);
                  }}
                  style={[
                    s.visibilityToggle,
                    {
                      backgroundColor: householdVisible ? colors.sage + "14" : colors.background,
                      borderColor: householdVisible ? colors.sage + "55" : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={householdVisible ? "people-outline" : "lock-closed-outline"} size={16} color={householdVisible ? colors.sage : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.visibilityTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {householdVisible ? "Visible to household" : "Private log"}
                    </Text>
                    <Text style={[s.visibilitySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {householdVisible ? "Shared alone logs update Alone Time patterns and handoffs." : "Private alone logs stay out of shared anxiety patterns."}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {selectedType === "grooming" && (
              <View style={s.mealFields}>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Coat or skin note</Text>
                  <TextInput
                    placeholder="Light shedding, mats behind ears, paws looked good..."
                    placeholderTextColor={colors.mutedForeground}
                    value={groomingCondition}
                    onChangeText={setGroomingCondition}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View style={s.mealFieldRow}>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Products</Text>
                    <TextInput
                      placeholder="Slicker brush"
                      placeholderTextColor={colors.mutedForeground}
                      value={groomingProducts}
                      onChangeText={setGroomingProducts}
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Next due</Text>
                    <TextInput
                      placeholder="2026-06-18"
                      placeholderTextColor={colors.mutedForeground}
                      value={groomingNextDue}
                      onChangeText={setGroomingNextDue}
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHouseholdVisible((prev) => !prev);
                  }}
                  style={[
                    s.visibilityToggle,
                    {
                      backgroundColor: householdVisible ? colors.sage + "14" : colors.background,
                      borderColor: householdVisible ? colors.sage + "55" : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={householdVisible ? "people-outline" : "lock-closed-outline"} size={16} color={householdVisible ? colors.sage : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.visibilityTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {householdVisible ? "Visible to household" : "Private log"}
                    </Text>
                    <Text style={[s.visibilitySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {householdVisible ? "Shared grooming logs update Grooming Care and handoffs." : "Private grooming stays out of shared grooming reports."}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {selectedType === "meal" && (
              <View style={s.mealFields}>
                <View style={s.mealFieldRow}>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      Expected portion
                    </Text>
                    <TextInput
                      placeholder={state.dietProfile.normalPortion || "1 cup"}
                      placeholderTextColor={colors.mutedForeground}
                      value={expectedPortion}
                      onChangeText={setExpectedPortion}
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      Eaten amount {mealOutcomeNeedsEatenAmount(selectedMealCompletion) ? "(required)" : "(optional)"}
                    </Text>
                    <TextInput
                      placeholder={
                        selectedMealCompletion === "skipped"
                          ? "0"
                          : selectedMealCompletion === "served" || selectedMealCompletion === "grazing"
                            ? "pending"
                            : "0.5"
                      }
                      placeholderTextColor={colors.mutedForeground}
                      value={eatenAmount}
                      onChangeText={setEatenAmount}
                      keyboardType="decimal-pad"
                      editable={
                        selectedMealCompletion !== "skipped" &&
                        selectedMealCompletion !== "served" &&
                        selectedMealCompletion !== "grazing"
                      }
                      style={[
                        s.input,
                        {
                          backgroundColor: colors.background,
                          color: colors.foreground,
                          borderColor: colors.border,
                          fontFamily: "Inter_500Medium",
                          opacity:
                            selectedMealCompletion === "skipped" ||
                            selectedMealCompletion === "served" ||
                            selectedMealCompletion === "grazing"
                              ? 0.62
                              : 1,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHouseholdVisible((prev) => !prev);
                  }}
                  style={[
                    s.visibilityToggle,
                    {
                      backgroundColor: householdVisible ? colors.sage + "14" : colors.background,
                      borderColor: householdVisible ? colors.sage + "55" : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={householdVisible ? "people-outline" : "lock-closed-outline"} size={16} color={householdVisible ? colors.sage : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.visibilityTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {householdVisible ? "Visible to household" : "Private log"}
                    </Text>
                    <Text style={[s.visibilitySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {householdVisible ? "Shared logs update the household routine board." : "Private notes stay out of shared routine status."}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {selectedType === "medication" && (
              <View style={s.mealFields}>
                {medicationDefault ? (
                  <View style={[s.medRoutinePanel, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "2E" }]}>
                    <View style={[s.medRoutineIcon, { backgroundColor: colors.primary + "14" }]}>
                      <Ionicons name="medical-outline" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.medRoutineLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Medication routine</Text>
                      <Text numberOfLines={1} style={[s.medRoutineTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                        {medicationDefault.label}
                      </Text>
                      <Text numberOfLines={1} style={[s.medRoutineMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {medicationDefault.time}{medicationDefault.owner ? ` - ${medicationDefault.owner}` : ""} - {medicationDefault.status}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Dose</Text>
                  <TextInput
                    placeholder={medicationDefault?.dose && medicationDefault.dose !== "Dose not set" ? medicationDefault.dose : "1 tablet"}
                    placeholderTextColor={colors.mutedForeground}
                    value={medicationDose}
                    onChangeText={setMedicationDose}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHouseholdVisible((prev) => !prev);
                  }}
                  style={[
                    s.visibilityToggle,
                    {
                      backgroundColor: householdVisible ? colors.sage + "14" : colors.background,
                      borderColor: householdVisible ? colors.sage + "55" : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={householdVisible ? "people-outline" : "lock-closed-outline"} size={16} color={householdVisible ? colors.sage : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.visibilityTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {householdVisible ? "Visible to household" : "Private log"}
                    </Text>
                    <Text style={[s.visibilitySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {householdVisible ? "Shared medication logs update the Medication Plan." : "Private medication notes stay out of shared adherence."}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {selectedType === "meal" && (
              <View style={[s.dietPanel, { backgroundColor: colors.sage + "12", borderColor: colors.sage + "33" }]}>
                <View style={s.dietPanelTop}>
                  <View>
                    <Text style={[s.dietTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Daily food progress</Text>
                    <Text style={[s.dietSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {dietProgress.summary}
                    </Text>
                  </View>
                  <View style={[s.dietBadge, { backgroundColor: colors.sage + "18" }]}>
                    <Text style={[s.dietBadgeText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      {dietProgress.targetAmount == null ? "--" : `${dietProgress.percent}%`}
                    </Text>
                  </View>
                </View>
                <View style={[s.dietTrack, { backgroundColor: colors.background }]}>
                  <View style={[s.dietFill, { backgroundColor: colors.sage, width: dietPercentWidth }]} />
                </View>
                <Text style={[s.dietHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {dietProgressText} Exact amount is optional; portion buttons still count toward the day.
                </Text>
              </View>
            )}

            {config?.noteField && (
              <View style={s.fieldBlock}>
                <TextInput
                  placeholder={config.noteField.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  style={[s.input, s.inputMulti, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                />
              </View>
            )}

            <Pressable
              onPress={handleLog}
              style={({ pressed }) => [s.logBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={[s.logBtnText, { fontFamily: "Inter_700Bold" }]}>Log {config?.label.toLowerCase()}</Text>
            </Pressable>
          </BoardCard>

          {/* Today at a glance */}
          {todaySnapshot.total > 0 && (
            <BoardCard style={s.logBoardCard}>
              <BoardSectionHeader title="Today at a glance" action={`${todaySnapshot.total} logged`} />
              <View style={[s.snapshotSummary, { backgroundColor: colors.background }]}>
                <View style={s.snapshotLeft}>
                  <Text style={[s.snapshotCount, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{todaySnapshot.total}</Text>
                  <Text style={[s.snapshotLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>logged today</Text>
                </View>
                <View style={s.snapshotIcons}>
                  {todaySnapshot.top.map((t) => {
                    const tint = PULSE_COLORS[t.icon];
                    return (
                      <View key={t.type} style={[s.snapshotChip, { backgroundColor: tint + "16" }]}>
                        <PulseIcon name={t.icon} size={13} />
                        <Text style={[s.snapshotChipCount, { color: tint, fontFamily: "Inter_700Bold" }]}>{t.count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </BoardCard>
          )}

          {/* Search and filters */}
          <BoardCard style={s.logBoardCard}>
            <BoardSectionHeader title="Find care logs" action={logSearch.hasActiveFilters ? "Filtered" : undefined} />
            <View style={[s.searchPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search notes, caregivers, routes, meds..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                style={[s.searchInput, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              />
              {searchText.trim() ? (
                <Pressable
                  accessibilityLabel="Clear log search"
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSearchText("");
                  }}
                  style={[s.searchClear, { backgroundColor: colors.card }]}
                >
                  <Ionicons name="close" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            {logSearch.hasActiveFilters ? (
              <Text style={[s.searchSummary, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                {logSearch.summary}
              </Text>
            ) : null}

            {/* Filter chips */}
            {presentTypes.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filterRow}
                style={s.filterScroll}
              >
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(null);
                }}
                style={[s.filterChip, { backgroundColor: filter === null ? colors.foreground : colors.card, borderColor: filter === null ? colors.foreground : colors.border }]}
              >
                <Text style={[s.filterText, { color: filter === null ? "#FFFFFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>All</Text>
              </Pressable>
                {presentTypes.map((q) => {
                  const active = filter === q.type;
                  const tint = PULSE_COLORS[q.icon];
                  return (
                    <Pressable
                      key={q.type}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setFilter(active ? null : q.type);
                      }}
                      style={[s.filterChip, { backgroundColor: active ? tint : colors.card, borderColor: active ? tint : colors.border }]}
                    >
                      <PulseIcon name={q.icon} size={14} color={active ? "#FFFFFF" : undefined} />
                      <Text style={[s.filterText, { color: active ? "#FFFFFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{q.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </BoardCard>

          {/* Timeline */}
          {grouped.length === 0 ? (
            <BoardCard style={s.logBoardCard}>
              <BoardSectionHeader title="No matching logs" />
              <View style={[s.emptyPanel, { backgroundColor: colors.background }]}>
                <Ionicons name="clipboard-outline" size={32} color={colors.mutedForeground} />
                <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {logSearch.emptyMessage}
                </Text>
              </View>
            </BoardCard>
          ) : (
            grouped.map((g) => (
              <BoardCard key={g.key} style={s.logBoardCard}>
                <BoardSectionHeader title={g.label} />
                <View style={s.dayEntries}>
                  {g.entries.map((e, i) => {
                    const normalizedType = normalizeCareEventType(e.type, e.details);
                    const icon = TYPE_ICON[normalizedType] ?? "paw";
                    const cg = caregiverColor(e.caregiver);
                    const sev = e.severity && e.severity !== "normal" ? e.severity : null;
                    const sevColor = sev === "alert" ? colors.rose : colors.amber;
                    const statusLabel = syncLabel(e.syncStatus);
                    const compactStatusLabel =
                      statusLabel === "Saved offline"
                        ? "Offline"
                        : statusLabel === "Pending sync"
                          ? "Queued"
                          : statusLabel;
                    const stickyNotes = getStickyNotes(e.details);
                    return (
                      <Pressable
                        key={e.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${e.title} log details`}
                        onPress={() => {
                          Haptics.selectionAsync();
                          openEntryDetail(e);
                        }}
                        style={({ pressed }) => [
                          s.entryRow,
                          { backgroundColor: pressed ? colors.background : "transparent" },
                          i < g.entries.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                        ]}
                      >
                        <View style={[s.entryAccent, { backgroundColor: PULSE_COLORS[icon] }]} />
                        <View style={[s.entryAvatar, { backgroundColor: cg + "18" }]}>
                          <Text style={[s.entryInitial, { color: cg, fontFamily: "Inter_700Bold" }]}>
                            {(e.caregiver || "?").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={[s.entryIconWrap, { backgroundColor: PULSE_COLORS[icon] + "14" }]}>
                          <PulseIcon name={icon} size={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.entryTitleLine}>
                            <Text numberOfLines={1} style={[s.entryTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                              {e.title}
                            </Text>
                            {sev && (
                              <View style={[s.sevBadge, { backgroundColor: sevColor + "18" }]}>
                                <Text style={[s.sevText, { color: sevColor, fontFamily: "Inter_700Bold" }]}>{sev}</Text>
                              </View>
                            )}
                          </View>
                          <View style={s.entryMetaLine}>
                            <Text style={[s.entryMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                              {e.caregiver} - {new Date(e.occurredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </Text>
                            {compactStatusLabel ? (
                              <View
                                style={[
                                  s.entryStatusChip,
                                  {
                                    backgroundColor:
                                      e.syncStatus === "failed"
                                        ? colors.rose + "14"
                                        : e.syncStatus === "synced"
                                          ? colors.sage + "14"
                                          : colors.amber + "14",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.entryStatusText,
                                    {
                                      color:
                                        e.syncStatus === "failed"
                                          ? colors.rose
                                          : e.syncStatus === "synced"
                                            ? colors.sage
                                            : colors.amber,
                                      fontFamily: "Inter_700Bold",
                                    },
                                  ]}
                                >
                                  {compactStatusLabel}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {e.syncStatus === "failed" && e.syncError ? (
                            <Text style={[s.entrySyncError, { color: colors.rose, fontFamily: "Inter_500Medium" }]}>
                              {e.syncError}
                            </Text>
                          ) : null}
                          {e.note && stickyNotes.length === 0 ? (
                            <Text numberOfLines={3} style={[s.entryNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                              {e.note}
                            </Text>
                          ) : null}
                          {stickyNotes.length > 0 ? (
                            <View style={s.stickyStack}>
                              {stickyNotes.map((note) => {
                                const tone = stickyColor(note.color);
                                return (
                                  <View key={note.id} style={[s.stickyNote, { backgroundColor: tone + "12", borderLeftColor: tone }]}>
                                    <Text style={[s.stickyNoteText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                                      {note.text}
                                    </Text>
                                    <Text style={[s.stickyNoteMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                                      {note.caregiver}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}
                        </View>
                        <View style={s.entryRight}>
                          <Text style={[s.entryRelTime, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                            {relativeTime(e.occurredAt, now)}
                          </Text>
                          <View style={[s.entryOpenPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <Text style={[s.entryOpenText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                              Open
                            </Text>
                            <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </BoardCard>
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* Entry detail modal */}
      <Modal visible={detailEntry !== null} transparent animationType="slide" onRequestClose={() => setDetailEntryId(null)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setDetailEntryId(null)}>
          <Pressable style={[s.detailSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.editHandle} />
            {detailEntry ? (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={s.detailHeader}>
                  <View style={[s.detailIcon, { backgroundColor: PULSE_COLORS[detailIcon] + "18" }]}>
                    <PulseIcon name={detailIcon} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.detailType, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{detailTypeText}</Text>
                    <Text style={[s.detailTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{detailEntry.title}</Text>
                    <Text style={[s.detailMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {detailEntry.caregiver || "Care team"} - {new Date(detailEntry.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>

                {detailEntry.syncStatus === "failed" && detailEntry.syncError ? (
                  <View style={[s.detailNotice, { backgroundColor: colors.rose + "12", borderColor: colors.rose + "44" }]}>
                    <Ionicons name="warning-outline" size={16} color={colors.rose} />
                    <Text style={[s.detailNoticeText, { color: colors.rose, fontFamily: "Inter_500Medium" }]}>{detailEntry.syncError}</Text>
                  </View>
                ) : null}

                <View style={s.detailGrid}>
                  {detailRows.length > 0 ? (
                    detailRows.map((row) => (
                      <View key={`${row.label}:${row.value}`} style={[s.detailField, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[s.detailFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{row.label}</Text>
                        <Text style={[s.detailFieldValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{row.value}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={[s.detailFieldWide, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[s.detailFieldValue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>No extra detail fields yet.</Text>
                    </View>
                  )}
                </View>

                {detailEntry.note ? (
                  <View style={[s.detailNote, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[s.detailSectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>Note</Text>
                    <Text style={[s.detailBodyText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{detailEntry.note}</Text>
                  </View>
                ) : null}

                <View style={s.detailSectionHeader}>
                  <Text style={[s.detailSectionTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Sticky notes</Text>
                  <Text style={[s.detailSectionCount, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{detailStickyNotes.length}</Text>
                </View>
                {detailStickyNotes.length > 0 ? (
                  <View style={s.stickyStack}>
                    {detailStickyNotes.map((note) => {
                      const tone = stickyColor(note.color);
                      return (
                        <View key={note.id} style={[s.stickyNote, { backgroundColor: tone + "12", borderLeftColor: tone }]}>
                          <Text style={[s.stickyNoteText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{note.text}</Text>
                          <Text style={[s.stickyNoteMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                            {note.caregiver} - {new Date(note.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={[s.detailFieldWide, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[s.detailFieldValue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>No sticky notes attached.</Text>
                  </View>
                )}

                <View style={s.detailSectionHeader}>
                  <Text style={[s.detailSectionTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Audit trail</Text>
                  <Text style={[s.detailSectionCount, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{detailAuditTrail.length}</Text>
                </View>
                {detailAuditTrail.length > 0 ? (
                  <View style={s.auditStack}>
                    {detailAuditTrail.map((event) => (
                      <View key={event.id} style={[s.auditRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <View style={[s.auditDot, { backgroundColor: event.action === "deleted" ? colors.rose : colors.copper }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.auditSummary, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{event.summary}</Text>
                          <Text style={[s.auditMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{auditMeta(event)}</Text>
                          {event.changes?.length ? (
                            <Text style={[s.auditChanges, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                              Changed: {event.changes.join(", ")}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={[s.detailFieldWide, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[s.detailFieldValue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Original log, no later changes recorded.
                    </Text>
                  </View>
                )}

                <View style={s.detailActions}>
                  <Pressable
                    onPress={() => shareEntryHandoff(detailEntry)}
                    style={({ pressed }) => [s.detailPrimaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="share-outline" size={17} color="#fff" />
                    <Text style={[s.detailPrimaryText, { fontFamily: "Inter_700Bold" }]}>Share handoff</Text>
                  </Pressable>
                  <View style={s.detailIconActions}>
                    <Pressable
                      onPress={() => {
                        setDetailEntryId(null);
                        openStickyPrompt(detailEntry);
                      }}
                      style={[s.detailIconBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Ionicons name="document-text-outline" size={17} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setDetailEntryId(null);
                        openEditEntry(detailEntry);
                      }}
                      style={[s.detailIconBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Ionicons name="pencil-outline" size={17} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(detailEntry.id, detailEntry.title, () => setDetailEntryId(null))}
                      style={[s.detailIconBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.rose} />
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Entry editor modal */}
      <Modal visible={editEntry !== null} transparent animationType="slide" onRequestClose={() => setEditEntry(null)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setEditEntry(null)}>
          <Pressable style={[s.editSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.editHandle} />
            <Text style={[s.editSheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Edit Entry</Text>
            <Text style={[s.editFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TITLE</Text>
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholderTextColor={colors.mutedForeground}
              style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
            />
            <Text style={[s.editFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NOTE (OPTIONAL)</Text>
            <TextInput
              value={editNote}
              onChangeText={setEditNote}
              placeholder="Add or update a note..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[s.input, s.inputMulti, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            />
            <Pressable
              onPress={saveEditEntry}
              style={({ pressed }) => [s.logBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 20 }]}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={[s.logBtnText, { fontFamily: "Inter_700Bold" }]}>Save changes</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Post-log quick-note prompt */}
      <Modal visible={promptId !== null} transparent animationType="fade" onRequestClose={() => setPromptId(null)}>
        <Pressable style={s.modalBackdrop} onPress={saveQuickNote}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalCenter}>
            <Pressable style={[s.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
              <View style={[s.modalIcon, { backgroundColor: colors.sage + "1A" }]}>
                <Ionicons name="checkmark" size={22} color={colors.sage} />
              </View>
              <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {promptMode === "post-log" ? `${promptTitle} logged` : "Add sticky note"}
              </Text>
              <Text style={[s.modalSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {promptMode === "post-log" ? "Add a quick sticky note? (optional)" : promptTitle}
              </Text>
              <TextInput
                ref={promptRef}
                placeholder="e.g. ate eagerly, left some kibble..."
                placeholderTextColor={colors.mutedForeground}
                value={promptNote}
                onChangeText={setPromptNote}
                multiline
                style={[s.input, s.inputMulti, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular", marginTop: 14 }]}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={saveQuickNote}
              />
              <View style={s.modalActions}>
                <Pressable
                  onPress={() => {
                    setPromptId(null);
                    setPromptNote("");
                  }}
                  style={({ pressed }) => [s.modalSkip, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[s.modalSkipText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Skip</Text>
                </Pressable>
                <Pressable
                  onPress={saveQuickNote}
                  style={({ pressed }) => [s.modalSave, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={[s.modalSaveText, { fontFamily: "Inter_700Bold" }]}>Save sticky</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  syncBtn: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },

  signalStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  signalCard: {
    flexGrow: 1,
    flexBasis: "47.5%",
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    justifyContent: "space-between",
  },
  signalIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  signalLabel: {
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  signalValue: {
    fontSize: 18,
    lineHeight: 21,
  },
  signalDetail: {
    fontSize: 10,
    lineHeight: 13,
  },

  outboxCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  outboxTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  outboxIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  outboxEyebrow: { fontSize: 10.5 },
  outboxTitle: { fontSize: 15.5, marginTop: 2 },
  outboxMessage: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  outboxButton: {
    minHeight: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  outboxButtonText: { fontSize: 12.5 },
  outboxMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  outboxMetric: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6 },
  outboxMetricText: { fontSize: 11.5 },

  launcherCard: {
    marginBottom: 12,
    gap: 13,
    padding: 13,
  },
  launcherTabs: {
    flexDirection: "row",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(8, 20, 36, 0.08)",
    padding: 3,
  },
  launcherTab: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  launcherTabText: { fontSize: 12 },
  launcherGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  launcherTile: {
    width: "31.5%",
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 8,
    position: "relative",
  },
  launcherIconHalo: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  launcherSelectedMark: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  launcherTileText: {
    fontSize: 11,
    textAlign: "center",
  },
  moodPanel: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 10,
  },
  moodQuestion: {
    fontSize: 12,
    marginBottom: 8,
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 5,
  },
  moodOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
  },
  moodOptionText: {
    fontSize: 10,
  },
  launcherCta: {
    minHeight: 48,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
  },
  launcherCtaText: {
    color: "#FFF9EF",
    fontSize: 14,
    flex: 1,
    textAlign: "center",
  },

  composerHero: {
    borderRadius: 8,
    padding: 12,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  composerHeroBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  composerHeroIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  composerHeroText: { flex: 1, minWidth: 0 },
  composerKicker: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0 },
  composerTitle: { color: "#FFF9EF", fontSize: 22, lineHeight: 25, marginTop: 1 },
  composerHint: { color: "rgba(255,249,239,0.72)", fontSize: 12, lineHeight: 17, marginTop: 3 },
  composerBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 118,
  },
  composerBadgeText: {
    color: "#FFF9EF",
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
  },
  composerTrustRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },
  composerTrustChip: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  composerTrustText: {
    fontSize: 10.5,
    minWidth: 0,
  },
  composerSectionHeader: { marginBottom: 8 },
  loggerTitle: { fontSize: 16, marginBottom: 12 },
  typeRow: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 6,
    paddingRight: 13,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeChipIcon: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  typeChipLabel: { fontSize: 13.5 },

  fieldBlock: { marginTop: 16 },
  fieldLabel: { fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0, marginBottom: 8 },
  segRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segPill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  segText: { fontSize: 13.5 },

  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  inputMulti: { minHeight: 64, textAlignVertical: "top" },
  mealFields: { marginTop: 2, gap: 12 },
  mealFieldRow: { flexDirection: "row", gap: 10 },
  mealField: { flex: 1, minWidth: 0 },
  visibilityToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  visibilityTitle: { fontSize: 13.5 },
  visibilitySub: { fontSize: 12, lineHeight: 16, marginTop: 2 },

  medRoutinePanel: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 8, padding: 13 },
  medRoutineIcon: { width: 34, height: 34, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  medRoutineLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5 },
  medRoutineTitle: { fontSize: 15.5, marginTop: 2 },
  medRoutineMeta: { fontSize: 12.5, marginTop: 2 },

  dietPanel: { marginTop: 14, borderRadius: 8, borderWidth: 1, padding: 14 },
  dietPanelTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  dietTitle: { fontSize: 15, letterSpacing: -0.1 },
  dietSub: { fontSize: 12.5, marginTop: 2 },
  dietBadge: { minWidth: 48, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  dietBadgeText: { fontSize: 12.5 },
  dietTrack: { height: 8, borderRadius: 99, overflow: "hidden", marginTop: 12 },
  dietFill: { height: "100%", borderRadius: 99 },
  dietHint: { fontSize: 12.5, lineHeight: 17, marginTop: 10 },

  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 8,
    marginTop: 18,
    shadowColor: "#2E5846",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  logBtnText: { color: "#fff", fontSize: 15.5 },

  logBoardCard: { marginTop: 12 },
  searchPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14.5, minHeight: 28, paddingVertical: 0 },
  searchClear: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  searchSummary: { fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 2 },

  filterScroll: { marginTop: 8 },
  filterRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13 },

  snapshotSummary: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  snapshotLeft: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  snapshotCount: { fontSize: 22, letterSpacing: -0.3 },
  snapshotLabel: { fontSize: 13 },
  snapshotIcons: { flexDirection: "row", gap: 6, flex: 1, justifyContent: "flex-end", flexWrap: "wrap" },
  snapshotChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  snapshotChipCount: { fontSize: 12 },

  dayEntries: { marginTop: -2 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginHorizontal: -6,
    borderRadius: 8,
  },
  entryAccent: { width: 3, height: 38, borderRadius: 2, marginRight: 2 },
  entryAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  entryInitial: { fontSize: 13 },
  entryIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  entryTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  entryTitle: { fontSize: 14.5, flexShrink: 1 },
  sevBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  sevText: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  entryMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  entryMeta: { fontSize: 12, marginTop: 2 },
  entryStatusChip: {
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  entryStatusText: {
    fontSize: 9.5,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  entrySyncError: { fontSize: 12, marginTop: 4 },
  entryNote: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  stickyStack: { gap: 6, marginTop: 8 },
  stickyNote: { borderLeftWidth: 3, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  stickyNoteText: { fontSize: 12.5, lineHeight: 17 },
  stickyNoteMeta: { fontSize: 11, marginTop: 4 },
  entryRight: { alignItems: "flex-end", gap: 4 },
  entryRelTime: { fontSize: 11.5 },
  entryOpenPill: {
    minHeight: 26,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 7,
  },
  entryOpenText: { fontSize: 10 },
  detailSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", padding: 22 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  detailIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  detailType: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  detailTitle: { fontSize: 21, marginTop: 2 },
  detailMeta: { fontSize: 12.5, marginTop: 3 },
  detailNotice: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 15, padding: 11, marginBottom: 12 },
  detailNoticeText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  detailField: { width: "48%", borderWidth: 1, borderRadius: 15, padding: 12 },
  detailFieldWide: { width: "100%", borderWidth: 1, borderRadius: 15, padding: 12 },
  detailFieldLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  detailFieldValue: { fontSize: 13.5, lineHeight: 18 },
  detailNote: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 12 },
  detailSectionLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  detailBodyText: { fontSize: 13.5, lineHeight: 19 },
  detailSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
  detailSectionTitle: { fontSize: 16 },
  detailSectionCount: { fontSize: 12 },
  auditStack: { gap: 8 },
  auditRow: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 15, padding: 12 },
  auditDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  auditSummary: { fontSize: 13, lineHeight: 18 },
  auditMeta: { fontSize: 11.5, marginTop: 3 },
  auditChanges: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  detailActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  detailPrimaryBtn: { flex: 1, height: 48, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  detailPrimaryText: { color: "#fff", fontSize: 14.5 },
  detailIconActions: { flexDirection: "row", gap: 7 },
  detailIconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  editSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  editHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", marginBottom: 16 },
  editSheetTitle: { fontSize: 20, marginBottom: 4, letterSpacing: -0.2 },
  editFieldLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: 7, marginTop: 14 },

  emptyPanel: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  emptyText: { fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,31,36,0.45)" },
  modalCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  modalCard: {
    borderRadius: 26,
    padding: 24,
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  modalIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  modalTitle: { fontSize: 19, letterSpacing: -0.2 },
  modalSub: { fontSize: 14, marginTop: 4 },
  modalActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  modalSkip: { flex: 1, height: 48, alignItems: "center", justifyContent: "center" },
  modalSkipText: { fontSize: 15 },
  modalSave: { flex: 2, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modalSaveText: { color: "#fff", fontSize: 15 },
});
