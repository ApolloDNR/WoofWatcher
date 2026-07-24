import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
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
import { announce } from "@/lib/announce";
import { isClerkConfigured } from "@/lib/auth";
import { confirmThroughSteps, notifyDialog } from "@/lib/confirmDialog";
import { resolvePetName } from "@/lib/petIdentity";
import { describeCareEntryConflictVersion } from "@/lib/careSync";
import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { PixelIcon } from "@/components/PixelIcon";
import {
  getAccessibleLayoutMetrics,
  getCenteredModalBackdropPadding,
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
} from "@/lib/mobileLayout";
import {
  buildAloneTimeReturnPatch,
  findOpenAloneTimeSession,
  getAloneTimeReturnOptions,
  type AloneTimeReturnOutcome,
} from "@/lib/aloneTimeSession";
import {
  buildCareLogPhotoProofAttachmentPatch,
  buildCareLogTrustDefaults,
  buildCareLogTrustReviewPatch,
  getCareLogAttentionChips,
  getCareLogTrustReview,
  type CareLogReviewAction,
} from "@/lib/careLogTrust";
import {
  buildPottyLogDetailPatch,
  POTTY_CONTEXT_OPTIONS,
  POTTY_DETAIL_OUTCOMES,
  POTTY_LOCATION_OPTIONS,
  POTTY_PEE_DETAIL_OPTIONS,
  POTTY_STOOL_CONDITION_OPTIONS,
  type PottyContext,
  type PottyDetailOutcome,
  type PottyLocation,
  type PottyPeeDetail,
  type PottyStoolCondition,
} from "@/lib/pottyLogDetail";
import {
  buildMealOutcomeUpdatePatch,
  MEAL_OUTCOME_UPDATE_OPTIONS,
  type MealOutcomeUpdate,
} from "@/lib/mealOutcomeUpdate";
import { resolveQuickLogEntry } from "@/lib/quickLogRuntime";
import { formatRouteDistanceMiles, parseWalkRoute } from "@/lib/walkRoute";
import { buildWalkSessionFinishPatch, findOpenWalkSession } from "@/lib/walkSession";
import { dayKey, dayLabel } from "@/lib/time";
import { TrailMap } from "@/components/TrailMap";
import { useWalkRouteCaptureStatus } from "@/components/WalkRouteRecorder";
import { shareTextPayload } from "@/lib/shareText";
import { BoardActionButton, BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader, BoardSegmentTabs } from "@/components/board/BoardPrimitives";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const DETAIL_WORKFLOW_RAIL: Array<{
  label: string;
  detail: string;
  icon: IoniconName;
  tone: "quick" | "detail" | "edit";
}> = [
  { label: "Review", detail: "full record", icon: "reader-outline", tone: "quick" },
  { label: "Edit", detail: "correct later", icon: "pencil-outline", tone: "detail" },
  { label: "Sticky", detail: "add context", icon: "document-text-outline", tone: "edit" },
  { label: "Audit", detail: "trace changes", icon: "git-commit-outline", tone: "detail" },
];

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
  /** Skip preselecting the first option; an unselected group stays out of the saved log. */
  noDefault?: boolean;
  /** Block saving until the caregiver actively picks an option. */
  required?: boolean;
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
      {
        key: "energyLevel",
        label: "Energy level",
        options: [
          { id: "steady", label: "Steady", suffix: "steady energy" },
          { id: "low", label: "Low", suffix: "low energy", severity: "watch" },
          { id: "high", label: "High", suffix: "high energy" },
        ],
      },
    ],
    noteField: { placeholder: "Sticky note: energy, trigger, appetite, visitors, weather, or what changed..." },
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
    noteField: { placeholder: "Sticky note: what happened and what helped..." },
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
    type: "incident",
    label: "Incident",
    icon: "sad",
    baseTitle: "Incident",
    // Incidents are safety records: nothing is preselected, so a saved log
    // only contains facts a caregiver actively chose.
    groups: [
      {
        key: "incidentType",
        label: "What happened?",
        noDefault: true,
        required: true,
        options: [
          { id: "rough-greeting", label: "Rough greeting", suffix: "rough greeting", severity: "watch" },
          { id: "dog-conflict", label: "Dog conflict", suffix: "dog conflict", severity: "watch" },
          { id: "snap-or-bite", label: "Snap/bite", suffix: "snap or bite", severity: "alert" },
          { id: "escape", label: "Escape", suffix: "escape", severity: "alert" },
          { id: "injury", label: "Injury", suffix: "injury", severity: "alert" },
          { id: "other", label: "Other", suffix: "incident", severity: "watch" },
        ],
      },
      {
        key: "incidentSeverity",
        label: "Care level",
        noDefault: true,
        options: [
          { id: "watch", label: "Watch", severity: "watch" },
          { id: "review", label: "Review", severity: "alert" },
          { id: "urgent", label: "Urgent", severity: "alert" },
        ],
      },
      {
        key: "incidentOutcome",
        label: "Outcome",
        noDefault: true,
        options: [
          { id: "recovered", label: "Recovered", suffix: "recovered" },
          { id: "separated", label: "Separated", suffix: "separated", severity: "watch" },
          { id: "follow-up-needed", label: "Follow-up", suffix: "follow-up needed", severity: "alert" },
        ],
      },
    ],
    noteField: { placeholder: "Sticky note: timeline, response, injury check..." },
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

const ALONE_RETURN_OPTIONS = getAloneTimeReturnOptions();

const TRUST_ACTION_LABELS: Record<CareLogReviewAction, string> = {
  confirm: "Confirm",
  reject: "Reject",
  "request-photo": "Request photo",
  "mark-corrected": "Mark corrected",
};

const ENTRY_ATTENTION_CHIP_COPY: Record<string, string> = {
  "needs-review": "Needs review",
  "proof-needed": "Proof needed",
  "photo-requested": "Photo requested",
  "outcome-pending": "Outcome pending",
  "proof-attached": "Proof attached",
  rejected: "Rejected",
  corrected: "Corrected",
  estimated: "Estimated",
};

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

// Potty always reads as the green leaf pixel icon (matching the launcher
// tiles), never the blue drop, so it can't be mistaken for Water in the
// glance chips, filters, timeline, or detail sheet.
const POTTY_LEAF_TONE = "#7FA34C";

function isPottyType(type: string): boolean {
  return type === "potty" || type === "pee" || type === "poop";
}

function careTypeTone(type: string, icon: PulseIconName): string {
  return isPottyType(type) ? POTTY_LEAF_TONE : PULSE_COLORS[icon];
}

function CareTypeIcon({
  type,
  icon,
  size,
  color,
}: {
  type: string;
  icon: PulseIconName;
  size: number;
  color?: string;
}) {
  if (isPottyType(type)) {
    return <PixelIcon name="pee" size={size} />;
  }
  if (icon === "bowl") {
    // The SVG bowl reads as a flat featureless oval next to the pixel set;
    // meal is the most common log type, so it gets the same rich pixel
    // food-bowl sprite the rest of the app uses.
    return <PixelIcon name="meal" size={size} />;
  }
  return <PulseIcon name={icon} size={size} color={color} />;
}

// "{petName}" resolves to the dog's real display name at render time (via
// resolvePetName), so a renamed dog never reads "Phoenix" in guidance copy.
const LOG_GUIDANCE: Record<string, string> = {
  meal: "Serve it now, then update the outcome when {petName} finishes.",
  water: "Fresh water keeps hydration and Bile Watch context honest.",
  treat: "Treats stay connected to diet, training, and appetite patterns.",
  walk: "Capture route, duration, distance, and dog interactions in one pass.",
  potty: "Potty is the parent log; pee, poop, accidents, and stool notes live here.",
  play: "Play logs help separate energy from anxiety and boredom.",
  training: "Wins, rough spots, and next practice become trainer-ready handoff notes.",
  mood: "Mood checks make {petName}'s care twin respond to real daily patterns.",
  alone: "Track away time, return state, and what helped {petName} settle.",
  medication: "Medication logs are household-visible by default and audit-friendly.",
  weight: "Weight logs update {petName}'s living profile.",
  symptom: "Health notes stay non-diagnostic and easy to share with your vet.",
  incident: "Log factual behavior or safety incidents with trigger, exposure, injury check, and follow-up.",
  grooming: "Grooming logs remember coat, paws, ears, products, and next due.",
  note: "Sticky notes keep tiny care details from disappearing.",
};

// Care data is local-first: without a configured account provider (same gate
// as auth), device storage IS the success state, so sync/retry affordances and
// "offline" framing stay hidden instead of implying a cloud that isn't there.
const SYNC_PROVIDER_CONFIGURED = isClerkConfigured;

function syncLabel(status: Entry["syncStatus"]): string | null {
  if (status === "pending") return "Pending sync";
  if (status === "local") return SYNC_PROVIDER_CONFIGURED ? "Saved offline" : "Saved on this device";
  if (status === "failed") return "Sync failed";
  if (status === "conflict") return "Review conflict";
  return null;
}

const DETAIL_SKIP_KEYS = new Set([
  "adventureQuestId",
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
  "logInteraction",
  // Rendered as the walk detail's trail map, not as raw detail rows.
  "route",
  "routeDistanceM",
  "trustState",
  "confirmationRequired",
  "confirmationReason",
  "confirmedBy",
  "confirmedAt",
  "confirmationNote",
  "rejectedBy",
  "rejectedAt",
  "rejectionNote",
  "correctedBy",
  "correctedAt",
  "correctionNote",
  "photoProofStatus",
  "photoProofRequestedBy",
  "photoProofRequestedAt",
  "photoProofNote",
  "photoProofPolicy",
  "photoProofAttachmentUri",
  "photoProofAttachmentName",
  "photoProofAttachmentNote",
  "photoProofSource",
  "photoProofStorageStatus",
  "photoProofStorageNote",
  "photoProofAttachedBy",
  "photoProofAttachedAt",
]);

const DETAIL_LABELS: Record<string, string> = {
  adventureQuestTitle: "Quest",
  amount: "Amount",
  condition: "Condition",
  kind: "Kind",
  portion: "Portion",
  severity: "Severity",
  serving: "Serving",
  pottyOutcome: "Outcome",
  pottyWhere: "Where",
  peeDetail: "Pee detail",
  stoolColor: "Stool color",
  pottyContext: "Context",
  walkLifecycle: "Walk status",
  walkStartedAt: "Started",
  walkEndedAt: "Finished",
  startedBy: "Started by",
  endedBy: "Finished by",
  routeName: "Route",
  distanceMiles: "Distance",
  dogInteractions: "Dog interactions",
  socialOutcome: "Social notes",
  trainingOutcome: "Training outcome",
  trainingSkill: "Skill",
  nextPractice: "Next practice",
  energyLevel: "Energy",
  moodContext: "Care context",
  aloneOutcome: "Return state",
  aloneTrigger: "Trigger",
  calmingSupport: "Calming support",
  recoveryMinutes: "Recovery",
  groomingCondition: "Coat/skin",
  groomingProducts: "Products/groomer",
  groomingNextDue: "Next due",
  routineLabel: "Routine",
  what: "Symptom",
  incidentType: "Incident type",
  incidentSeverity: "Care level",
  incidentOutcome: "Outcome",
  incidentTrigger: "Trigger",
  incidentExposure: "Exposure",
  incidentInjury: "Injury check",
  incidentAction: "Action taken",
  incidentFollowUp: "Follow-up",
};

function isDetailRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function humanizeKey(key: string): string {
  return DETAIL_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

// Humanize only slug-like enum ids ("dog-conflict" -> "Dog Conflict").
// Free-text prose must render verbatim: title-casing a user's own words
// corrupts their record ("Neighbor's collie" -> "Neighbor'S Collie").
const SLUG_VALUE_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

function humanizeDetailValue(text: string): string {
  return SLUG_VALUE_PATTERN.test(text) ? humanizeKey(text) : text;
}

function detailValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

// Detail values like walkStartedAt arrive as ISO strings; render them as a
// readable local time instead of the raw timestamp.
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatDetailTimestamp(value: string): string | null {
  if (!ISO_TIMESTAMP_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
    const timestamp = formatDetailTimestamp(text);
    rows.push({ label: humanizeKey(key), value: timestamp ?? humanizeDetailValue(text) });
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

const NON_NEGATIVE_DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)$/u;

function parseNonNegativeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !NON_NEGATIVE_DECIMAL.test(trimmed)) return null;
  const parsed = Number(trimmed);
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

function formatAloneDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

type DetailMealOutcome = MealOutcomeUpdate;

const DETAIL_MEAL_OUTCOMES = MEAL_OUTCOME_UPDATE_OPTIONS;

type PottyDraftContext = PottyContext | "none";

interface PottyDetailDraft {
  outcome: PottyDetailOutcome;
  location: PottyLocation;
  peeDetail: PottyPeeDetail;
  stoolCondition: PottyStoolCondition;
  stoolColor: string;
  context: PottyDraftContext;
}

const POTTY_STOOL_COLOR_OPTIONS = [
  { id: "not-logged", label: "Not logged" },
  { id: "brown", label: "Brown" },
  { id: "yellow", label: "Yellow" },
  { id: "red-black", label: "Red/black" },
  { id: "green", label: "Green" },
  { id: "gray", label: "Gray" },
];

const POTTY_CONTEXT_DRAFT_OPTIONS: { id: PottyDraftContext; label: string }[] = [
  { id: "none", label: "No extra context" },
  ...POTTY_CONTEXT_OPTIONS,
];

function optionId<T extends string>(value: unknown, options: { id: T }[], fallback: T): T {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return options.some((option) => option.id === cleaned) ? (cleaned as T) : fallback;
}

function pottyOutcomeHasPee(outcome: PottyDetailOutcome): boolean {
  return outcome === "pee" || outcome === "both";
}

function pottyOutcomeHasStool(outcome: PottyDetailOutcome): boolean {
  return outcome === "poop" || outcome === "both";
}

function pottyDraftFromEntry(entry: Entry | null): PottyDetailDraft {
  const details = entry && isDetailRecord(entry.details) ? entry.details : {};
  return {
    outcome: optionId(details.pottyOutcome, POTTY_DETAIL_OUTCOMES, "tried-nothing"),
    location: optionId(details.pottyWhere, POTTY_LOCATION_OPTIONS, "outside"),
    peeDetail: optionId(details.peeDetail, POTTY_PEE_DETAIL_OPTIONS, "normal"),
    stoolCondition: optionId(details.condition, POTTY_STOOL_CONDITION_OPTIONS, "normal"),
    stoolColor: optionId(details.stoolColor, POTTY_STOOL_COLOR_OPTIONS, "not-logged"),
    context: optionId(details.pottyContext, POTTY_CONTEXT_DRAFT_OPTIONS, "none"),
  };
}

function isPendingMealEntry(entry: Entry): boolean {
  if (normalizeCareEventType(entry.type, entry.details) !== "meal") return false;
  const details = isDetailRecord(entry.details) ? entry.details : {};
  const completion = String(details.mealCompletion ?? "").toLowerCase();
  const lifecycle = String(details.mealLifecycle ?? "").toLowerCase();
  return completion === "served" || completion === "grazing" || lifecycle === "outcome-pending";
}

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale } = useWebQaFontScale(runtimeFontScale);
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const {
    state,
    addEntry,
    deleteEntry,
    updateEntry,
    resolveEntryConflict,
    updateCareDoc,
    refresh,
    syncOutbox,
    isSyncing,
    resolvingEntryConflictIds,
  } = useCare();
  const me = useGetMe();
  const routeParams = useLocalSearchParams<{
    type?: string | string[];
    detail?: string | string[];
    intent?: string | string[];
    entry?: string | string[];
    walk?: string | string[];
    alone?: string | string[];
  }>();
  const routeSelectedType = useMemo(() => {
    const rawType = Array.isArray(routeParams.type) ? routeParams.type[0] : routeParams.type;
    const normalized = normalizeCareEventType(rawType);
    return TYPE_BY_ID[normalized] ? normalized : null;
  }, [routeParams.type]);
  const routeDetailParam = Array.isArray(routeParams.detail) ? routeParams.detail[0] : routeParams.detail;
  const routeIntentParam = Array.isArray(routeParams.intent) ? routeParams.intent[0] : routeParams.intent;
  const routeWantsDetailSheet =
    routeDetailParam === "1" || routeDetailParam === "true" || routeDetailParam === "sheet";
  const routeDetailIntentKey =
    routeSelectedType && routeWantsDetailSheet
      ? `${routeSelectedType}:${routeIntentParam ?? routeDetailParam ?? "detail"}`
      : null;
  const routeEntryParam = Array.isArray(routeParams.entry) ? routeParams.entry[0] : routeParams.entry;
  const routeWalkParam = Array.isArray(routeParams.walk) ? routeParams.walk[0] : routeParams.walk;
  const routeAloneParam = Array.isArray(routeParams.alone) ? routeParams.alone[0] : routeParams.alone;
  const lastRouteSelectedType = useRef<string | null>(null);
  const lastRouteDetailIntentKey = useRef<string | null>(null);
  const lastRouteEntryParam = useRef<string | null>(null);
  const lastRouteWalkParam = useRef<string | null>(null);
  const lastRouteAloneParam = useRef<string | null>(null);
  const walkCardYRef = useRef(0);
  const aloneCardYRef = useRef(0);

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
    fontScale,
  });
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const centeredModalPadding = getCenteredModalBackdropPadding({
    platform: Platform.OS,
    topInset: insets.top,
    bottomInset: insets.bottom,
  });
  const keyboardOffset = getKeyboardAvoidingVerticalOffset({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const logLayout = useMemo(
    () =>
      getAccessibleLayoutMetrics({
        platform: Platform.OS,
        fontScale,
      }),
    [fontScale],
  );

  const caregiver =
    me.data?.user?.displayName?.trim() || state.caregivers[0]?.name || "You";
  const currentCaregiverRole = useMemo(
    () => state.caregivers.find((person) => person.name === caregiver)?.role ?? state.caregivers[0]?.role ?? null,
    [caregiver, state.caregivers],
  );

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
  const [walkFinishRouteName, setWalkFinishRouteName] = useState("");
  const [walkFinishDistanceMiles, setWalkFinishDistanceMiles] = useState("");
  const [walkFinishDogInteractions, setWalkFinishDogInteractions] = useState("");
  const [walkFinishSocialOutcome, setWalkFinishSocialOutcome] = useState("");
  const [walkFinishNote, setWalkFinishNote] = useState("");
  const [moodContext, setMoodContext] = useState("");
  const [trainingSkill, setTrainingSkill] = useState("");
  const [trainingNextPractice, setTrainingNextPractice] = useState("");
  const [aloneTrigger, setAloneTrigger] = useState("");
  const [calmingSupport, setCalmingSupport] = useState("");
  const [recoveryMinutes, setRecoveryMinutes] = useState("");
  const [returnRecoveryMinutes, setReturnRecoveryMinutes] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [groomingCondition, setGroomingCondition] = useState("");
  const [groomingProducts, setGroomingProducts] = useState("");
  const [groomingNextDue, setGroomingNextDue] = useState("");
  const [incidentTrigger, setIncidentTrigger] = useState("");
  const [incidentExposure, setIncidentExposure] = useState("");
  const [incidentInjury, setIncidentInjury] = useState("");
  const [incidentAction, setIncidentAction] = useState("");
  const [incidentFollowUp, setIncidentFollowUp] = useState("");
  const [householdVisible, setHouseholdVisible] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

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
    if (!routeSelectedType) return;
    if (routeSelectedType !== lastRouteSelectedType.current) {
      setSelectedType(routeSelectedType);
      lastRouteSelectedType.current = routeSelectedType;
    }
    if (!routeWantsDetailSheet || !routeDetailIntentKey || routeDetailIntentKey === lastRouteDetailIntentKey.current) {
      return;
    }
    // Detail intents land straight in the pre-focused composer - no
    // interstitial between "add details" and the real form. The composer
    // lives in the Log view, so make sure we're on it.
    setLogView("log");
    setTimeout(() => scrollToComposer(), 350);
    lastRouteDetailIntentKey.current = routeDetailIntentKey;
  }, [routeDetailIntentKey, routeSelectedType, routeWantsDetailSheet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset contextual controls whenever the type changes.
  useEffect(() => {
    const init: Record<string, string> = {};
    config?.groups?.forEach((g) => {
      if (g.noDefault) return;
      init[g.key] = g.options[0].id;
    });
    setChoices(init);
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
    setMoodContext("");
    setTrainingSkill("");
    setTrainingNextPractice("");
    setAloneTrigger("");
    setCalmingSupport("");
    setRecoveryMinutes("");
    setGroomingCondition("");
    setGroomingProducts("");
    setGroomingNextDue("");
    setIncidentTrigger("");
    setIncidentExposure("");
    setIncidentInjury("");
    setIncidentAction("");
    setIncidentFollowUp("");
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
  // Measured scroll target for the full composer card so "Add Details" and
  // the Quick Log fallback always land on the composer instead of a guess.
  const composerSectionY = useRef<number | null>(null);
  // Entry editor
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const firstConflictedEntry = syncOutbox.items.find(
    (item) => item.status === "conflict",
  );

  useEffect(() => {
    if (!routeEntryParam) {
      lastRouteEntryParam.current = null;
      return;
    }
    // CareContext replaces optimistic ids with server ids and preserves the
    // original id as details.clientKey. Keep the routed editor bound to the
    // current row across that asynchronous swap.
    const routedEntry = resolveQuickLogEntry(state.entries, {
      id: routeEntryParam,
    });
    if (!routedEntry) return;
    if (lastRouteEntryParam.current !== routeEntryParam) {
      lastRouteEntryParam.current = routeEntryParam;
      setDetailEntryId(routedEntry.id);
      return;
    }
    setDetailEntryId((current) => {
      // A refresh may replace the optimistic id while the sheet is open, but
      // it must not reopen a sheet the owner explicitly dismissed.
      if (!current) return current;
      const currentEntry = resolveQuickLogEntry(state.entries, { id: current });
      return currentEntry?.id === routedEntry.id ? routedEntry.id : current;
    });
  }, [routeEntryParam, state.entries]);


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
    () =>
      detailEntryId
        ? resolveQuickLogEntry(state.entries, { id: detailEntryId })
        : null,
    [state.entries, detailEntryId],
  );
  const detailConflictVersions = useMemo(() => {
    if (!detailEntry?.conflictServerSnapshot) return null;
    return {
      local: describeCareEntryConflictVersion(detailEntry),
      household: describeCareEntryConflictVersion(
        detailEntry.conflictServerSnapshot,
      ),
    };
  }, [detailEntry]);
  const conflictResolutionPending = detailEntry
    ? resolvingEntryConflictIds.includes(detailEntry.id)
    : false;
  const notifyConflictEditBlocked = useCallback((entry?: unknown) => {
    const syncStatus =
      entry && typeof entry === "object"
        ? (entry as { syncStatus?: unknown }).syncStatus
        : undefined;
    if (syncStatus === "conflict") {
      notifyDialog(
        "Resolve conflict first",
        "Resolve this conflict before editing this care log.",
      );
      return;
    }
    notifyDialog(
      "Care log changed",
      "Refresh the household care log, then try this edit again.",
    );
  }, []);
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
  const detailAuditSummary = useMemo(() => {
    if (!detailAuditTrail.length) return null;
    const latest = detailAuditTrail[detailAuditTrail.length - 1]!;
    const correctionCount = detailAuditTrail.filter((event) => event.action === "updated").length;
    const changeLabels = Array.from(
      new Set(detailAuditTrail.flatMap((event) => event.changes ?? [])),
    )
      .map(humanizeKey)
      .slice(0, 6);

    return {
      latest,
      changeLabels,
      title: correctionCount ? `${correctionCount} ${correctionCount === 1 ? "correction" : "corrections"}` : "Original history",
      meta: auditMeta(latest),
    };
  }, [detailAuditTrail]);
  const detailTrustReview = useMemo(
    () => (detailEntry ? getCareLogTrustReview(detailEntry, currentCaregiverRole) : null),
    [detailEntry, currentCaregiverRole],
  );
  const detailType = detailEntry ? normalizeCareEventType(detailEntry.type, detailEntry.details) : null;
  const detailIcon = detailType ? TYPE_ICON[detailType] ?? "paw" : "paw";
  const detailTypeText = detailType ? entryTypeLabel(detailType) : "";
  // Recorded walk route (if this walk captured one): shown as a real map.
  const detailRoute = useMemo(
    () => (detailType === "walk" ? parseWalkRoute(detailEntry?.details?.route) : null),
    [detailEntry, detailType],
  );
  const detailRouteDistanceM =
    detailRoute && typeof detailEntry?.details?.routeDistanceM === "number"
      ? detailEntry.details.routeDistanceM
      : null;
  const [pottyDetailDraft, setPottyDetailDraft] = useState<PottyDetailDraft>(() => pottyDraftFromEntry(null));

  useEffect(() => {
    if (detailType !== "potty") return;
    setPottyDetailDraft(pottyDraftFromEntry(detailEntry));
  }, [detailEntry, detailType]);

  // Mount animation
  const isWebRoutePreview = (Platform.OS as string) === "web";
  const fade = useRef(
    new Animated.Value(isWebRoutePreview || reducedMotion ? 1 : 0),
  ).current;
  const slide = useRef(
    new Animated.Value(isWebRoutePreview || reducedMotion ? 0 : 16),
  ).current;
  useEffect(() => {
    if (isWebRoutePreview || reducedMotion) {
      fade.setValue(1);
      slide.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: !isWebRoutePreview }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: !isWebRoutePreview }),
    ]).start();
  }, [fade, isWebRoutePreview, reducedMotion, slide]);

  // Two-phase mount keeps the detailed composer, search, and timeline from
  // blocking the route transition.
  const [belowFoldReady, setBelowFoldReady] = useState(false);
  // Log History is the stable landing surface. Quick Log owns fast capture;
  // Add Log keeps the full detail composer for edits, audits, and context.
  const [view, setLogView] = useState<"log" | "history">("history");
  const logViewSegments = useMemo(
    () => [
      { key: "history" as const, label: "History" },
      { key: "log" as const, label: "Add Log" },
    ],
    [],
  );
  useEffect(() => {
    let cancelled = false;
    const interaction = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setBelowFoldReady(true);
      });
    });
    return () => {
      cancelled = true;
      interaction.cancel();
    };
  }, []);

  const buildEntry = useCallback((): Omit<Entry, "id"> | null => {
    if (!config) return null;
    const parts: string[] = [];
    let details: { [key: string]: unknown } = {};
    let mood: string | undefined;
    let severity: Severity | undefined;
    let dogInteractions: number | undefined;
    const occurredAt = new Date().toISOString();

    for (const g of config.groups ?? []) {
      if (g.required && !g.options.some((o) => o.id === choices[g.key])) {
        notifyDialog(
          g.label,
          `Choose ${g.label.replace(/\?$/, "").toLowerCase()} before saving. WoofWatcher never guesses safety facts.`,
        );
        return null;
      }
    }

    config.groups?.forEach((g) => {
      const opt =
        g.options.find((o) => o.id === choices[g.key]) ??
        (g.noDefault ? undefined : g.options[0]);
      // Unselected optional facts stay out of the record entirely.
      if (!opt) return;
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
        notifyDialog("Add a value", `Enter a ${config.numeric.label.toLowerCase()} to log.`);
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
        notifyDialog("Check eaten amount", "Enter a valid eaten amount, or leave it blank.");
        return null;
      }

      if (mealOutcomeNeedsEatenAmount(completion) && eaten == null) {
        notifyDialog(
          "Add eaten amount",
          `For a partial meal, enter how much ${resolvePetName(state.profile.name)} actually ate.`,
        );
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
        notifyDialog("Check distance", "Enter a valid distance, or leave it blank.");
        return null;
      }

      if (walkDogInteractions.trim() && interactionCount == null) {
        notifyDialog("Check dog interactions", "Enter a valid dog interaction count, or leave it blank.");
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

    if (config.type === "mood") {
      const context = moodContext.trim();

      details.householdVisible = householdVisible;
      if (context) {
        details.moodContext = context;
        parts.push(context);
      }
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
        notifyDialog("Check recovery time", "Enter recovery minutes as a number, or leave it blank.");
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

    if (config.type === "incident") {
      const trigger = incidentTrigger.trim();
      const exposure = incidentExposure.trim();
      const injury = incidentInjury.trim();
      const action = incidentAction.trim();
      const followUp = incidentFollowUp.trim();
      const incidentSeverity = String(choices.incidentSeverity ?? "").toLowerCase();

      details.householdVisible = householdVisible;
      if (trigger) details.incidentTrigger = trigger;
      if (exposure) details.incidentExposure = exposure;
      if (injury) details.incidentInjury = injury;
      if (action) details.incidentAction = action;
      if (followUp) details.incidentFollowUp = followUp;
      if (incidentSeverity === "urgent" || incidentSeverity === "review") severity = "alert";
      if (/(bite|bit|blood|bleed|puncture|injur|wound|limp|vet|emergency|escaped|missing)/i.test(`${injury} ${followUp} ${noteText}`)) {
        severity = "alert";
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
    const type = normalizeCareEventType(config.type, details);
    details = {
      ...details,
      ...buildCareLogTrustDefaults({
        type,
        caregiverRole: currentCaregiverRole,
        interaction: "detail-sheet",
      }),
    };
    const title = parts.length ? `${config.baseTitle} - ${parts.join(", ")}` : config.baseTitle;
    const auditLogVisibility =
      details.householdVisible === false
        ? "private care log"
        : "shared care log";
    details = appendCareAuditEvent(details, {
      id: auditId(),
      action: "created",
      caregiver,
      occurredAt,
      summary: `${caregiver} created "${title}" in the ${auditLogVisibility}.`,
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
    moodContext,
    trainingSkill,
    trainingNextPractice,
    aloneTrigger,
    calmingSupport,
    recoveryMinutes,
    groomingCondition,
    groomingProducts,
    groomingNextDue,
    incidentTrigger,
    incidentExposure,
    incidentInjury,
    incidentAction,
    incidentFollowUp,
    householdVisible,
    dietProgress.unit,
    noteText,
    caregiver,
    currentCaregiverRole,
    state.dietProfile.normalPortion,
    state.profile.weight.unit,
    state.profile.name,
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
    if (entry.type === "mood") {
      setMoodContext("");
      setHouseholdVisible(true);
    }
    if (entry.type === "alone") {
      setAloneTrigger("");
      setCalmingSupport("");
      setRecoveryMinutes("");
      setHouseholdVisible(true);
    }
    if (entry.type === "incident") {
      setIncidentTrigger("");
      setIncidentExposure("");
      setIncidentInjury("");
      setIncidentAction("");
      setIncidentFollowUp("");
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
      if (
        !updateEntry(promptId, {
          note: entry?.note ?? text,
          details,
        })
      ) {
        notifyConflictEditBlocked(entry);
        return;
      }
    }
    setPromptId(null);
    setPromptNote("");
  }, [
    promptId,
    promptNote,
    promptMode,
    state.entries,
    caregiver,
    notifyConflictEditBlocked,
    updateEntry,
  ]);

  const handleDelete = useCallback(
    (id: string, title: string, onDeleted?: () => void) => {
      confirmThroughSteps(
        [
          {
            title: "Delete entry",
            message: `Remove "${title}"?`,
            confirmLabel: "Delete",
            destructive: true,
          },
        ],
        async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const entry = state.entries.find((item) => item.id === id);
          const deleted = await deleteEntry(id);
          if (!deleted) {
            notifyDialog("Delete failed", "WoofWatcher kept the log because the household sync rejected the delete. Try again after refresh.");
            return;
          }
          // Shared-household accountability only: the deletion audit note
          // says "from the shared care log", so it is truthful and useful
          // only when more than one caregiver exists. For a solo owner it
          // would leave a "Deleted log - ..." row in their own timeline and
          // read as if the delete failed - so a solo delete just deletes.
          if (entry && state.caregivers.length > 1) {
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
      );
    },
    [addEntry, caregiver, deleteEntry, state.caregivers.length, state.entries],
  );

  const confirmKeepLocalConflict = useCallback(
    (entry: Entry) => {
      confirmThroughSteps(
        [
          {
            title: "Replace household version?",
            message:
              "This will replace the latest shared household version with your saved version.",
            confirmLabel: "Keep my saved version",
            destructive: true,
          },
        ],
        async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const result = await resolveEntryConflict(
            entry.id,
            "keep-local",
          );
          if (
            result === "refresh-failed" ||
            result === "unavailable"
          ) {
            notifyDialog(
              "Conflict still needs review",
              "WoofWatcher kept both versions for review.",
            );
          }
        },
      );
    },
    [resolveEntryConflict],
  );

  const confirmUseHouseholdConflict = useCallback(
    (entry: Entry) => {
      confirmThroughSteps(
        [
          {
            title: "Discard your saved edit?",
            message:
              "WoofWatcher will refresh the household first. If refresh succeeds, this will discard your saved edit and use the newly loaded household version.",
            confirmLabel: "Use household version",
            destructive: true,
          },
        ],
        async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const result = await resolveEntryConflict(
            entry.id,
            "use-household",
          );
          if (
            result === "refresh-failed" ||
            result === "unavailable"
          ) {
            notifyDialog(
              "Couldn't refresh versions",
              "WoofWatcher kept both versions for review.",
            );
          }
        },
      );
    },
    [resolveEntryConflict],
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
      if (
        !updateEntry(editEntry.id, {
          ...(title !== editEntry.title ? { title } : {}),
          ...((note ?? "") !== (editEntry.note ?? "") ? { note } : {}),
          details,
        })
      ) {
        notifyConflictEditBlocked(editEntry);
        return;
      }
    }
    setEditEntry(null);
  }, [
    caregiver,
    editEntry,
    editTitle,
    editNote,
    notifyConflictEditBlocked,
    updateEntry,
  ]);

  const openEntryDetail = useCallback((e: Entry) => {
    setDetailEntryId(e.id);
    Haptics.selectionAsync();
  }, []);

  const updateMealOutcomeFromDetail = useCallback(
    (entry: Entry, outcome: DetailMealOutcome) => {
      const patch = buildMealOutcomeUpdatePatch(entry, {
        caregiver,
        now: new Date().toISOString(),
        outcome,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!updateEntry(entry.id, patch)) {
        notifyConflictEditBlocked(entry);
      }
    },
    [caregiver, notifyConflictEditBlocked, updateEntry],
  );

  const updatePottyDetailFromDetail = useCallback(
    (entry: Entry) => {
      const nowIso = new Date().toISOString();
      const includesPee = pottyOutcomeHasPee(pottyDetailDraft.outcome);
      const includesStool = pottyOutcomeHasStool(pottyDetailDraft.outcome);
      const patch = buildPottyLogDetailPatch(entry, {
        caregiver,
        now: nowIso,
        outcome: pottyDetailDraft.outcome,
        location: pottyDetailDraft.location,
        peeDetail: includesPee ? pottyDetailDraft.peeDetail : undefined,
        stoolCondition: includesStool ? pottyDetailDraft.stoolCondition : undefined,
        stoolColor: includesStool && pottyDetailDraft.stoolColor !== "not-logged" ? pottyDetailDraft.stoolColor : undefined,
        context: pottyDetailDraft.context === "none" ? undefined : pottyDetailDraft.context,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!updateEntry(entry.id, patch)) {
        notifyConflictEditBlocked(entry);
      }
    },
    [caregiver, notifyConflictEditBlocked, pottyDetailDraft, updateEntry],
  );
  const openAloneSession = useMemo(
    () => findOpenAloneTimeSession(state.entries),
    [state.entries],
  );
  const openAloneStartedAt = openAloneSession
    ? String(openAloneSession.details?.aloneStartedAt ?? openAloneSession.occurredAt)
    : "";
  const openAloneMinutes = useMemo(() => {
    if (!openAloneStartedAt) return 0;
    const startedAt = Date.parse(openAloneStartedAt);
    if (!Number.isFinite(startedAt)) return 0;
    return Math.max(0, Math.round((now - startedAt) / 60000));
  }, [now, openAloneStartedAt]);
  const openWalkSession = useMemo(
    () => findOpenWalkSession(state.entries),
    [state.entries],
  );
  const openWalkStartedAt = openWalkSession
    ? String(openWalkSession.details?.walkStartedAt ?? openWalkSession.occurredAt)
    : "";
  const openWalkMinutes = useMemo(() => {
    if (!openWalkStartedAt) return 0;
    const startedAt = Date.parse(openWalkStartedAt);
    if (!Number.isFinite(startedAt)) return 0;
    return Math.max(0, Math.round((now - startedAt) / 60000));
  }, [now, openWalkStartedAt]);
  // "Finish walk" deep-link (Adventure's CTA): land the user ON the finish
  // form, not in the read-only record sheet - that sheet says "In progress"
  // and offers no way to end the walk, a dead end for the quest loop.
  useEffect(() => {
    if (routeWalkParam !== "finish" || routeWalkParam === lastRouteWalkParam.current) return;
    if (!openWalkSession) return;
    lastRouteWalkParam.current = routeWalkParam;
    setDetailEntryId(null);
    // The WALK ACTIVE finish panel lives in the Log view.
    setLogView("log");
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, walkCardYRef.current - 84), animated: true });
      announce("Finish details are ready.");
    }, 380);
    return () => clearTimeout(timer);
  }, [routeWalkParam, openWalkSession]);

  // The secondary Alone Time action reopens the real return lifecycle, not a
  // generic duration composer or a read-only record sheet.
  useEffect(() => {
    if (routeAloneParam !== "active") {
      lastRouteAloneParam.current = null;
      return;
    }
    if (!openAloneSession) {
      lastRouteAloneParam.current = null;
      return;
    }
    if (routeAloneParam === lastRouteAloneParam.current) return;
    lastRouteAloneParam.current = routeAloneParam;
    setDetailEntryId(null);
    setLogView("log");
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, aloneCardYRef.current - 84),
        animated: true,
      });
      announce("Alone Time return check-in is ready.");
    }, 380);
    return () => clearTimeout(timer);
  }, [routeAloneParam, openAloneSession]);

  // Honest route-recorder state: only ever says "recording" while location
  // fixes are actually landing; otherwise it explains what would enable it.
  const walkRouteCapture = useWalkRouteCaptureStatus();
  const walkRouteStatusText =
    walkRouteCapture.status === "recording"
      ? "Recording this walk's route · saved with the log and may sync with your household"
      : walkRouteCapture.status === "starting"
        ? "Getting location for the route map…"
        : "Route recording available when location is permitted";

  const shareEntryHandoff = useCallback((e: Entry) => {
    const message = buildEntryHandoffMessage(e);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({ message, title: `${e.title} handoff` });
  }, []);

  const handleTrustReview = useCallback(
    (action: CareLogReviewAction) => {
      if (!detailEntry) return;
      const patch = buildCareLogTrustReviewPatch(detailEntry, {
        action,
        reviewer: caregiver,
        reviewerRole: currentCaregiverRole,
        now,
      });

      if (!patch) {
        notifyDialog("Adult review needed", "Only an adult owner or primary caregiver can review this log.");
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!updateEntry(detailEntry.id, patch)) {
        notifyConflictEditBlocked(detailEntry);
      }
    },
    [
      caregiver,
      currentCaregiverRole,
      detailEntry,
      notifyConflictEditBlocked,
      now,
      updateEntry,
    ],
  );

  const handleAttachProof = useCallback(async () => {
    if (!detailEntry) return;
    if (detailEntry.syncStatus === "conflict") {
      notifyConflictEditBlocked(detailEntry);
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.78,
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      const fileName =
        typeof (asset as { fileName?: unknown }).fileName === "string"
          ? (asset as { fileName: string }).fileName
          : "Medication proof photo";
      const patch = buildCareLogPhotoProofAttachmentPatch(detailEntry, {
        caregiver,
        uri: asset.uri,
        fileName,
        source: "library",
        now,
      });

      if (!patch) {
        notifyDialog("Proof not attached", "Choose a clear photo before saving proof to this log.");
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!updateEntry(detailEntry.id, patch)) {
        notifyConflictEditBlocked(detailEntry);
      }
    } catch {
      notifyDialog("Photo unavailable", "Attach proof later. Medication logs stay pending until an owner confirms them.");
    }
  }, [
    caregiver,
    detailEntry,
    notifyConflictEditBlocked,
    now,
    updateEntry,
  ]);

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
  const numericUnit = config?.numeric?.unit === "diet" ? dietProgress.unit : state.profile.weight.unit;
  const selectedMealCompletion = choices.mealCompletion ?? "served";
  const selectedIcon = config?.icon ?? ("paw" as PulseIconName);
  const selectedTone = careTypeTone(selectedType, selectedIcon);
  const selectedLabel = config?.label ?? "Care";
  const petDisplayName = resolvePetName(state.profile.name);
  const selectedGuidance = (
    LOG_GUIDANCE[selectedType] ?? "Log care once and it becomes part of the shared household record."
  ).replace(/\{petName\}/g, petDisplayName);
  // Safety-fact groups (incident "What happened?") gate the save button until
  // the caregiver actively answers - one tap can never log an unverified claim.
  const missingRequiredGroup =
    config?.groups?.find(
      (g) => g.required && !g.options.some((o) => o.id === choices[g.key]),
    ) ?? null;
  const parsedEatenAmount = parseNonNegativeNumber(eatenAmount);
  const mealEatenAmountError =
    selectedType === "meal" && eatenAmount.trim() && parsedEatenAmount == null
      ? "Enter the eaten amount as a number, such as 0.5."
      : selectedType === "meal" &&
          mealOutcomeNeedsEatenAmount(selectedMealCompletion) &&
          parsedEatenAmount == null
        ? `Enter how much ${petDisplayName} ate before saving this partial meal.`
        : null;
  const composerValidationMessage = missingRequiredGroup
    ? `Pick "${missingRequiredGroup.label}" above before saving.`
    : mealEatenAmountError;
  const composerSaveDisabled = composerValidationMessage != null;
  const selectedTrustLabel =
    selectedType === "symptom"
      ? "Vet-share ready"
      : selectedType === "meal"
        ? selectedMealCompletion === "served" || selectedMealCompletion === "grazing"
          ? "Outcome pending"
          : "Diet progress ready"
        : selectedType === "alone"
          ? "Alone Time Watch"
          : selectedType === "incident"
            ? "Owner review"
          : "Household record";
  const composerTrustItems = [
    {
      icon: "git-branch-outline" as const,
      // Short labels: "Routine-aware"/"Pattern-aware" ellipsized on 393px phones.
      label: selectedType === "meal" ? "Routines" : "Patterns",
      tone: colors.sage,
    },
    {
      icon: "bar-chart-outline" as const,
      // Zero-log day: no fabricated percentage in the composer rail either.
      label:
        careIntelligence.visibleLogCount === 0
          ? "-- Care IQ"
          : `${careIntelligence.score}% Care IQ`,
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

  const scrollToComposer = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max((composerSectionY.current ?? 620) - 12, 0),
      animated: true,
    });
  }, []);

  const handleReturnHome = useCallback(
    (outcome: AloneTimeReturnOutcome) => {
      if (!openAloneSession?.id) return;
      const recovery = returnRecoveryMinutes.trim() ? parseNonNegativeNumber(returnRecoveryMinutes) : null;
      if (returnRecoveryMinutes.trim() && recovery == null) {
        notifyDialog("Check recovery time", "Enter recovery minutes as a number, or leave it blank.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const patch = buildAloneTimeReturnPatch(openAloneSession, {
        caregiver,
        outcome,
        now,
        ...(recovery != null ? { recoveryMinutes: recovery } : {}),
        ...(returnNote.trim() ? { note: returnNote.trim() } : {}),
      });
      if (!updateEntry(openAloneSession.id, patch)) {
        notifyConflictEditBlocked(openAloneSession);
        return;
      }
      setReturnRecoveryMinutes("");
      setReturnNote("");
    },
    [
      caregiver,
      notifyConflictEditBlocked,
      now,
      openAloneSession,
      returnNote,
      returnRecoveryMinutes,
      updateEntry,
    ],
  );

  const handleFinishWalk = useCallback(() => {
    if (!openWalkSession?.id) return;
    const distance = walkFinishDistanceMiles.trim() ? parseNonNegativeNumber(walkFinishDistanceMiles) : null;
    const dogCount = walkFinishDogInteractions.trim() ? parseNonNegativeNumber(walkFinishDogInteractions) : null;

    if (walkFinishDistanceMiles.trim() && distance == null) {
      notifyDialog("Check distance", "Enter a valid distance, or leave it blank.");
      return;
    }

    if (walkFinishDogInteractions.trim() && dogCount == null) {
      notifyDialog("Check dog interactions", "Enter a valid dog interaction count, or leave it blank.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const patch = buildWalkSessionFinishPatch(openWalkSession, {
      caregiver,
      now,
      ...(walkFinishRouteName.trim() ? { routeName: walkFinishRouteName.trim() } : {}),
      ...(distance != null ? { distanceMiles: distance } : {}),
      ...(dogCount != null ? { dogInteractions: Math.round(dogCount) } : {}),
      ...(walkFinishSocialOutcome.trim() ? { socialOutcome: walkFinishSocialOutcome.trim() } : {}),
      ...(walkFinishNote.trim() ? { note: walkFinishNote.trim() } : {}),
    });

    if (
      !updateEntry(
        openWalkSession.id,
        patch as Partial<Omit<Entry, "id">>,
      )
    ) {
      notifyConflictEditBlocked(openWalkSession);
      return;
    }
    setWalkFinishRouteName("");
    setWalkFinishDistanceMiles("");
    setWalkFinishDogInteractions("");
    setWalkFinishSocialOutcome("");
    setWalkFinishNote("");
  }, [
    caregiver,
    notifyConflictEditBlocked,
    now,
    openWalkSession,
    updateEntry,
    walkFinishDistanceMiles,
    walkFinishDogInteractions,
    walkFinishNote,
    walkFinishRouteName,
    walkFinishSocialOutcome,
  ]);

  const H_PAD = 16;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={s.container}
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BoardRouteHeader
            title="Log History"
            back
            onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as never))}
            actionIcon="notifications-outline"
            actionLabel="Open Health Watch"
            onAction={() => {
              Haptics.selectionAsync();
              router.push("/health?tab=health" as never);
            }}
          />

          <BoardSegmentTabs
            segments={logViewSegments}
            active={view}
            onChange={setLogView}
            style={s.logViewTabs}
          />

          {view === "log" ? (
            <>
          <BoardCard style={s.detailedLogCard}>
            <View style={s.detailedLogIntro}>
              <View style={s.detailedLogDock}>
                <BoardSectionHeader
                  title="Add a detailed log"
                  accessory={
                    <BoardPill
                      label="History first"
                      icon="time-outline"
                      tone={colors.sage}
                    />
                  }
                />
                <Text
                  style={[
                    s.composerHint,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Fast capture now lives in one Quick Log. Use the detailed
                  composer for health context, notes, corrections, and care
                  records that need review.
                </Text>
                <View style={s.detailedLogActionRow}>
                  <BoardActionButton
                    label="Open Quick Log"
                    icon="flash-outline"
                    variant="primary"
                    accessibilityLabel="Open the shared Quick Log"
                    onPress={() => router.push("/fastlog" as never)}
                  />
                  <BoardActionButton
                    label="Continue with details"
                    icon="reader-outline"
                    variant="soft"
                    accessibilityLabel="Continue to the detailed care log composer"
                    onPress={scrollToComposer}
                  />
                </View>
              </View>

            {openWalkSession ? (
              <View
                onLayout={(event) => {
                  walkCardYRef.current = event.nativeEvent.layout.y;
                }}
                style={[s.aloneActivePanel, { backgroundColor: colors.card, borderColor: colors.sage + "55" }]}
              >
                <View style={s.aloneActiveTop}>
                  <View style={[s.aloneActiveIcon, { backgroundColor: colors.sageSoft, borderColor: colors.sage + "55" }]}>
                    <PixelIcon name="walk" size={34} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.aloneActiveKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      WALK ACTIVE
                    </Text>
                    <Text style={[s.aloneActiveTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                      {petDisplayName} is on a walk
                    </Text>
                    <Text style={[s.aloneActiveMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Started by {openWalkSession.caregiver || "household"} - {formatAloneDuration(openWalkMinutes)}
                    </Text>
                    <Text style={[s.walkRouteStatus, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {walkRouteStatusText}
                    </Text>
                  </View>
                </View>
                <Text style={[s.returnCheckTitle, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Finish details
                </Text>
                <View style={s.returnDetailRow}>
                  <TextInput
                    value={walkFinishRouteName}
                    onChangeText={setWalkFinishRouteName}
                    placeholder="Route or place"
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.returnInput, s.returnInputHalf, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                  <TextInput
                    value={walkFinishDistanceMiles}
                    onChangeText={setWalkFinishDistanceMiles}
                    placeholder="Miles"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    style={[s.returnInput, s.returnInputHalf, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View style={s.returnDetailRow}>
                  <TextInput
                    value={walkFinishDogInteractions}
                    onChangeText={setWalkFinishDogInteractions}
                    placeholder="Dogs met"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    style={[s.returnInput, s.returnInputHalf, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                  <TextInput
                    value={walkFinishSocialOutcome}
                    onChangeText={setWalkFinishSocialOutcome}
                    placeholder="Social outcome"
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.returnInput, s.returnInputHalf, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <TextInput
                  value={walkFinishNote}
                  onChangeText={setWalkFinishNote}
                  placeholder="Anything notable?"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.returnInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Finish walk session"
                  onPress={handleFinishWalk}
                  style={({ pressed }) => [
                    s.walkFinishButton,
                    {
                      backgroundColor: pressed ? colors.forestBright : colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Text style={[s.walkFinishText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                    Finish walk
                  </Text>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryForeground} />
                </Pressable>
              </View>
            ) : null}

            {openAloneSession ? (
              <View
                onLayout={(event) => {
                  aloneCardYRef.current = event.nativeEvent.layout.y;
                }}
                style={[s.aloneActivePanel, { backgroundColor: colors.card, borderColor: colors.amber + "55" }]}
              >
                <View style={s.aloneActiveTop}>
                  <View style={[s.aloneActiveIcon, { backgroundColor: colors.amberSoft, borderColor: colors.amber + "44" }]}>
                    <PixelIcon name="clock" size={34} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.aloneActiveKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      HOME ALONE ACTIVE
                    </Text>
                    <Text style={[s.aloneActiveTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                      {petDisplayName} is home alone
                    </Text>
                    <Text style={[s.aloneActiveMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Started by {openAloneSession.caregiver || "household"} - {formatAloneDuration(openAloneMinutes)}
                    </Text>
                  </View>
                </View>
                <Text style={[s.returnCheckTitle, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Return check-in
                </Text>
                <View style={s.returnOutcomeGrid}>
                  {ALONE_RETURN_OPTIONS.map((option) => (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityLabel={`I'm Home. ${petDisplayName} was ${option.label}`}
                      onPress={() => handleReturnHome(option.id)}
                      style={({ pressed }) => [
                        s.returnOutcomeButton,
                        {
                          backgroundColor: pressed ? colors.secondary : colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[s.returnOutcomeText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.returnDetailRow}>
                  <TextInput
                    value={returnRecoveryMinutes}
                    onChangeText={setReturnRecoveryMinutes}
                    placeholder="Recovery min"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    style={[s.returnInput, s.returnInputHalf, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                  <TextInput
                    value={returnNote}
                    onChangeText={setReturnNote}
                    placeholder="What helped?"
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.returnInput, s.returnInputHalf, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
              </View>
            ) : null}
            </View>
          </BoardCard>

          {!SYNC_PROVIDER_CONFIGURED && state.entries.length > 0 ? (
            // Local-first build: device storage is the success state, so the
            // care record card confirms that instead of promising sync.
            <View
              style={[
                s.outboxCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.sage + "33",
                  shadowColor: colors.sage,
                },
              ]}
            >
              <View style={s.outboxTop}>
                <View style={[s.outboxIcon, { backgroundColor: colors.sage + "18" }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.sage} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.outboxEyebrow, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    CARE RECORD
                  </Text>
                  <Text style={[s.outboxTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    Saved on this device
                  </Text>
                  <Text style={[s.outboxMessage, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    Nothing waiting. {petDisplayName}'s care record lives safely in this device's local storage.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {SYNC_PROVIDER_CONFIGURED && syncOutbox.total > 0 ? (
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
                  <Text style={[s.outboxEyebrow, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    SYNC STATUS
                  </Text>
                  <Text style={[s.outboxTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {syncOutbox.conflicted > 0
                      ? "Review conflict"
                      : syncOutbox.status === "needs-retry"
                        ? "Saved on this device"
                        : "Syncing safely"}
                  </Text>
                  <Text style={[s.outboxMessage, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {syncOutbox.message} {petDisplayName}'s local record is safe on this device.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    firstConflictedEntry
                      ? "Review care conflict"
                      : "Retry sync outbox"
                  }
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (firstConflictedEntry) {
                      setDetailEntryId(firstConflictedEntry.id);
                      return;
                    }
                    refresh();
                  }}
                  disabled={
                    isSyncing ||
                    (!firstConflictedEntry && syncOutbox.retryable === 0)
                  }
                  style={({ pressed }) => [
                    s.outboxButton,
                    {
                      backgroundColor:
                        firstConflictedEntry || syncOutbox.retryable > 0
                          ? colors.primary
                          : colors.background,
                      opacity:
                        pressed ||
                        isSyncing ||
                        (!firstConflictedEntry && syncOutbox.retryable === 0)
                          ? 0.66
                          : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.outboxButtonText,
                      {
                        color:
                          firstConflictedEntry || syncOutbox.retryable > 0
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {isSyncing
                      ? "Syncing"
                      : firstConflictedEntry
                        ? "Review"
                        : "Retry"}
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
                <View style={[s.outboxMetric, { backgroundColor: colors.background }]}>
                  <Text style={[s.outboxMetricText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {syncOutbox.conflicted} conflicts
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Composer card */}
          <View
            style={{ height: 0 }}
            onLayout={(event) => {
              composerSectionY.current = event.nativeEvent.layout.y + topPadding;
            }}
          />
            </>
          ) : null}
          {/* The composer (Log view) and the history sections (History view)
              are both below the fold and mount one frame after the tab switch
              (two-phase render), then split by the Log|History segment. */}
          {belowFoldReady && view === "log" ? (
            <>
          <BoardCard style={s.composerHero}>
            <View style={s.detailedLogDock}>
            <View style={[s.composerHeroBanner, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[s.composerHeroIcon, { backgroundColor: selectedTone + "22", borderColor: selectedTone + "66" }]}>
                <CareTypeIcon type={selectedType} icon={selectedIcon} size={30} />
              </View>
              <View style={s.composerHeroText}>
                <Text style={[s.composerKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Now logging
                </Text>
                <Text style={[s.composerTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {selectedLabel}
                </Text>
                <Text style={[s.composerHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {selectedGuidance}
                </Text>
              </View>
              <View style={[s.composerBadge, { backgroundColor: colors.sageSoft, borderColor: colors.sage + "33" }]}>
                <Text style={[s.composerBadgeText, { color: colors.forest, fontFamily: "Inter_700Bold" }]}>
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
            </View>

            <BoardSectionHeader
              title="Choose care type"
              accessory={<BoardPill label="Fast tap" icon="flash-outline" tone={colors.sage} />}
              style={s.composerSectionHeader}
            />
            <View style={s.typeGrid}>
              {LOG_TYPES.map((q) => {
                const active = selectedType === q.type;
                const tint = careTypeTone(q.type, q.icon);
                return (
                  <Pressable
                    key={q.type}
                    accessibilityRole="radio"
                    accessibilityLabel={q.label}
                    accessibilityHint={
                      active
                        ? `${q.label} is selected.`
                        : `Selects ${q.label} for this detailed log.`
                    }
                    accessibilityState={{ checked: active }}
                    aria-checked={active}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedType(q.type);
                    }}
                    style={[
                      s.typeChip,
                      {
                        width: logLayout.quickActionWidth,
                        minHeight: logLayout.controlMinHeight,
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={[s.typeChipIcon, { backgroundColor: active ? "rgba(255,255,255,0.18)" : tint + "1A" }]}>
                      <CareTypeIcon type={q.type} icon={q.icon} size={15} color={active ? colors.primaryForeground : undefined} />
                    </View>
                    <Text
                      numberOfLines={logLayout.actionLabelNumberOfLines}
                      style={[
                        s.typeChipLabel,
                        { color: active ? colors.primaryForeground : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
                      ]}
                    >
                      {q.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Contextual controls */}
            {config?.groups?.map((g) => (
              <View key={g.key} style={s.fieldBlock}>
                <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {g.label}
                </Text>
                <View style={s.segRow}>
                  {g.options.map((o) => {
                    const selectedOptionId = g.noDefault
                      ? choices[g.key] ?? null
                      : choices[g.key] ?? g.options[0].id;
                    const active = selectedOptionId === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        accessibilityRole="radio"
                        accessibilityLabel={o.label}
                        accessibilityHint={
                          active
                            ? `${o.label} is selected.`
                            : `Selects ${o.label} for ${g.label.toLowerCase()}.`
                        }
                        accessibilityState={{ checked: active }}
                        aria-checked={active}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setChoices((prev) => ({ ...prev, [g.key]: o.id }));
                        }}
                        style={[
                          s.segPill,
                          g.key === "mood" && logLayout.fontScale >= 2
                            ? {
                                width: logLayout.quickActionWidth,
                                minHeight: logLayout.controlMinHeight,
                              }
                            : null,
                          {
                            backgroundColor: active ? colors.primary : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={2}
                          style={[
                            s.segText,
                            { color: active ? colors.primaryForeground : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
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

            {selectedType === "mood" && (
              <View style={[s.moodDetailPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Care context</Text>
                  <TextInput
                    placeholder="After breakfast, visitor came over, slept poorly, great walk..."
                    placeholderTextColor={colors.mutedForeground}
                    value={moodContext}
                    onChangeText={setMoodContext}
                    multiline
                    style={[
                      s.input,
                      s.inputMulti,
                      {
                        backgroundColor: colors.card,
                        color: colors.foreground,
                        borderColor: colors.border,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  />
                </View>
                <Pressable
                  accessibilityRole="switch"
                  role="switch"
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
                  aria-checked={householdVisible}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHouseholdVisible((prev) => !prev);
                  }}
                  style={[
                    s.visibilityToggle,
                    {
                      backgroundColor: householdVisible ? colors.sage + "14" : colors.card,
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
                      {householdVisible ? `Shared mood logs update Mood Trend, Care Pass, and ${petDisplayName}'s care twin.` : "Private moods stay out of shared trend cards and reports."}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {config?.stepper && (
              <View style={s.fieldBlock}>
                <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
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
                          { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            s.segText,
                            { color: active ? colors.primaryForeground : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" },
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
                <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
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
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Route or place</Text>
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
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Distance mi</Text>
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
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Dog interactions</Text>
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
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Social outcome</Text>
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
                  accessibilityRole="switch"
                  role="switch"
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
                  aria-checked={householdVisible}
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
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Skill or cue</Text>
                  <TextInput
                    placeholder="Leash manners, recall, calm greeting..."
                    placeholderTextColor={colors.mutedForeground}
                    value={trainingSkill}
                    onChangeText={setTrainingSkill}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Next practice</Text>
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
                  accessibilityRole="switch"
                  role="switch"
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
                  aria-checked={householdVisible}
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
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Trigger or context</Text>
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
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Recovery min</Text>
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
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Support</Text>
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
                  accessibilityRole="switch"
                  role="switch"
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
                  aria-checked={householdVisible}
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

            {selectedType === "incident" && (
              <View style={s.mealFields}>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Trigger or context</Text>
                  <TextInput
                    placeholder="Dog at gate, crowded sidewalk..."
                    placeholderTextColor={colors.mutedForeground}
                    value={incidentTrigger}
                    onChangeText={setIncidentTrigger}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Who or what was involved?</Text>
                  <TextInput
                    placeholder="Off-leash dog, stranger..."
                    placeholderTextColor={colors.mutedForeground}
                    value={incidentExposure}
                    onChangeText={setIncidentExposure}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View style={s.mealFieldRow}>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Injury check</Text>
                    <TextInput
                      placeholder="None, scratch..."
                      placeholderTextColor={colors.mutedForeground}
                      value={incidentInjury}
                      onChangeText={setIncidentInjury}
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Action taken</Text>
                    <TextInput
                      placeholder="Separated..."
                      placeholderTextColor={colors.mutedForeground}
                      value={incidentAction}
                      onChangeText={setIncidentAction}
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                </View>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Follow-up</Text>
                  <TextInput
                    placeholder="Watch tonight, trainer note, vet call, avoid gate route..."
                    placeholderTextColor={colors.mutedForeground}
                    value={incidentFollowUp}
                    onChangeText={setIncidentFollowUp}
                    multiline
                    style={[s.input, s.inputMulti, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
                <Pressable
                  accessibilityRole="switch"
                  role="switch"
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
                  aria-checked={householdVisible}
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
                      {householdVisible ? "Shared incident logs update Incident Watch, Care Pass, and trainer handoffs." : "Private incidents stay out of shared incident reports."}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {selectedType === "grooming" && (
              <View style={s.mealFields}>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Coat or skin note</Text>
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
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Products</Text>
                    <TextInput
                      placeholder="Slicker brush"
                      placeholderTextColor={colors.mutedForeground}
                      value={groomingProducts}
                      onChangeText={setGroomingProducts}
                      style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                    />
                  </View>
                  <View style={s.mealField}>
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Next due</Text>
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
                  accessibilityRole="switch"
                  role="switch"
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
                  aria-checked={householdVisible}
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
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
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
                    <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
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
                  accessibilityRole="switch"
                  role="switch"
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
                  aria-checked={householdVisible}
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
                  <Text style={[s.fieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Dose</Text>
                  <TextInput
                    placeholder={medicationDefault?.dose && medicationDefault.dose !== "Dose not set" ? medicationDefault.dose : "1 tablet"}
                    placeholderTextColor={colors.mutedForeground}
                    value={medicationDose}
                    onChangeText={setMedicationDose}
                    style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <Pressable
                  accessibilityRole="switch"
                  role="switch"
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
                  aria-checked={householdVisible}
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

            {composerValidationMessage ? (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                role="alert"
                style={[s.requiredChoiceHint, { color: colors.amber, fontFamily: "Inter_600SemiBold" }]}
              >
                {composerValidationMessage}
              </Text>
            ) : null}
            <BoardActionButton
              label={`Log ${(config?.label ?? "care").toLowerCase()}`}
              icon="checkmark-circle"
              variant="primary"
              onPress={handleLog}
              disabled={composerSaveDisabled}
              accessibilityLabel={
                composerValidationMessage
                  ? `Log ${(config?.label ?? "care").toLowerCase()}. Disabled. ${composerValidationMessage}`
                  : `Log ${(config?.label ?? "care").toLowerCase()}`
              }
              style={s.logSaveAction}
            />
          </BoardCard>
            </>
          ) : belowFoldReady && view === "history" ? (
            <>

          {/* Today at a glance */}
          {todaySnapshot.total > 0 && (
            <BoardCard style={s.logBoardCard}>
              <BoardSectionHeader
                title="Today at a glance"
                accessory={<BoardPill label={`${todaySnapshot.total} logged`} icon="checkmark-circle-outline" tone={colors.sage} />}
              />
              <View style={[s.snapshotSummary, { backgroundColor: colors.background }]}>
                <View style={s.snapshotLeft}>
                  <Text style={[s.snapshotCount, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{todaySnapshot.total}</Text>
                  <Text style={[s.snapshotLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>logged today</Text>
                </View>
                <View style={s.snapshotIcons}>
                  {todaySnapshot.top.map((t) => {
                    const tint = careTypeTone(t.type, t.icon);
                    return (
                      <View key={t.type} style={[s.snapshotChip, { backgroundColor: tint + "16" }]}>
                        <CareTypeIcon type={t.type} icon={t.icon} size={13} />
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
            <BoardSectionHeader
              title="Find care logs"
              accessory={logSearch.hasActiveFilters ? <BoardPill label="Filtered" icon="funnel-outline" tone={colors.sage} /> : undefined}
            />
            <View style={[s.searchPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search notes, people, meds..."
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
                accessibilityRole="checkbox"
                accessibilityLabel="All log types"
                accessibilityHint={
                  filter === null
                    ? "All log types are shown."
                    : "Shows every log type."
                }
                accessibilityState={{ checked: filter === null }}
                aria-checked={filter === null}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(null);
                }}
                style={[s.filterChip, { backgroundColor: filter === null ? colors.primary : colors.card, borderColor: filter === null ? colors.primary : colors.border }]}
              >
                <Text style={[s.filterText, { color: filter === null ? colors.primaryForeground : colors.foreground, fontFamily: filter === null ? "Inter_700Bold" : "Inter_600SemiBold" }]}>All</Text>
              </Pressable>
                {presentTypes.map((q) => {
                  const active = filter === q.type;
                  return (
                    <Pressable
                      key={q.type}
                      accessibilityRole="checkbox"
                      accessibilityLabel={q.label}
                      accessibilityHint={
                        active
                          ? `Stops filtering by ${q.label}.`
                          : `Filters history to ${q.label}.`
                      }
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setFilter(active ? null : q.type);
                      }}
                      style={[s.filterChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    >
                      <CareTypeIcon type={q.type} icon={q.icon} size={14} color={active ? colors.primaryForeground : undefined} />
                      <Text style={[s.filterText, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: active ? "Inter_700Bold" : "Inter_600SemiBold" }]}>{q.label}</Text>
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
                    const sev = e.severity && e.severity !== "normal" ? e.severity : null;
                    const sevColor = sev === "alert" ? colors.rose : colors.amber;
                    const statusLabel = syncLabel(e.syncStatus);
                    const compactStatusLabel =
                      statusLabel === "Saved offline"
                        ? "Offline"
                        : statusLabel === "Saved on this device"
                          ? "On device"
                          : statusLabel === "Pending sync"
                            ? "Queued"
                            : statusLabel;
                    // Without a sync provider, local storage is the success
                    // state; render it calm instead of as a warning.
                    const statusSettled =
                      e.syncStatus === "synced" ||
                      (!SYNC_PROVIDER_CONFIGURED && e.syncStatus === "local");
                    const stickyNotes = getStickyNotes(e.details);
                    const entryAttentionChips = getCareLogAttentionChips(e);
                    const pendingMeal = isPendingMealEntry(e);
                    const entryTime = new Date(e.occurredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
                          pendingMeal
                            ? [s.entryRowPending, { backgroundColor: colors.amberSoft, borderColor: colors.amber + "33", opacity: pressed ? 0.85 : 1 }]
                            : { backgroundColor: pressed ? colors.background : "transparent" },
                          !pendingMeal && i < g.entries.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                        ]}
                      >
                        <View style={s.entryTimeCol}>
                          <Text numberOfLines={1} style={[s.entryTime, { color: pendingMeal ? colors.amber : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                            {entryTime}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={s.entryTitleLine}>
                            <Text numberOfLines={1} style={[s.entryTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                              {e.title}
                            </Text>
                            {sev && (
                              <View style={[s.sevBadge, { backgroundColor: sevColor + "18" }]}>
                                <Text style={[s.sevText, { color: sevColor, fontFamily: "Inter_700Bold" }]}>{sev}</Text>
                              </View>
                            )}
                          </View>
                          <View style={s.entryMetaLine}>
                            <Text numberOfLines={1} style={[s.entryMeta, { color: pendingMeal ? colors.amber : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                              {e.caregiver}
                            </Text>
                            {compactStatusLabel ? (
                              <View
                                style={[
                                  s.entryStatusChip,
                                  {
                                    backgroundColor:
                                      e.syncStatus === "failed"
                                        ? colors.rose + "14"
                                        : statusSettled
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
                                          : statusSettled
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
                            {entryAttentionChips.map((chip) => {
                              const chipColor =
                                chip.tone === "rose"
                                  ? colors.rose
                                  : chip.tone === "copper"
                                    ? colors.copper
                                    : chip.tone === "sage"
                                      ? colors.sage
                                      : colors.amber;
                              return (
                                <View key={chip.id} style={[s.entryAttentionChip, { backgroundColor: chipColor + "14" }]}>
                                  <Text style={[s.entryAttentionText, { color: chipColor, fontFamily: "Inter_700Bold" }]}>
                                    {ENTRY_ATTENTION_CHIP_COPY[chip.id] ?? chip.label}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                          {(e.syncStatus === "failed" ||
                            e.syncStatus === "conflict") &&
                          e.syncError ? (
                            <Text style={[s.entrySyncError, { color: e.syncStatus === "conflict" ? colors.amber : colors.rose, fontFamily: "Inter_500Medium" }]}>
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
                        <View style={[s.entryIconChip, { backgroundColor: pendingMeal ? colors.amber + "26" : careTypeTone(normalizedType, icon) + "16" }]}>
                          <CareTypeIcon type={normalizedType} icon={icon} size={18} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </BoardCard>
            ))
          )}
            </>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Entry detail modal */}
      <Modal
        visible={detailEntry !== null}
        transparent
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={() => setDetailEntryId(null)}
      >
        <Pressable accessible={false} style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setDetailEntryId(null)}>
          <Pressable accessible={false} accessibilityViewIsModal style={[s.detailSheet, { backgroundColor: colors.background, paddingBottom: modalSheetBottomPadding }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.editHandle} />
            {detailEntry ? (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={s.detailHeader}>
                  <View style={[s.detailIcon, { backgroundColor: careTypeTone(detailType ?? "", detailIcon) + "18" }]}>
                    <CareTypeIcon type={detailType ?? ""} icon={detailIcon} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.detailType, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>{detailTypeText}</Text>
                    <Text style={[s.detailTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{detailEntry.title}</Text>
                    <Text style={[s.detailMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {detailEntry.caregiver || "Care team"} - {new Date(detailEntry.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>

                <View style={s.detailCommandRail}>
                  {DETAIL_WORKFLOW_RAIL.map((item) => {
                    const toneColor = item.tone === "quick" ? colors.sage : item.tone === "detail" ? colors.copper : colors.blueSignal;
                    const detail =
                      item.label === "Audit" && detailAuditTrail.length > 0
                        ? `${detailAuditTrail.length} event${detailAuditTrail.length === 1 ? "" : "s"}`
                        : item.detail;
                    return (
                      <View
                        key={item.label}
                        style={[
                          s.detailCommandCard,
                          {
                            backgroundColor: toneColor + "0F",
                            borderColor: toneColor + "33",
                          },
                        ]}
                      >
                        <Ionicons name={item.icon} size={15} color={toneColor} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={[s.detailCommandLabel, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                            {item.label}
                          </Text>
                          <Text numberOfLines={1} style={[s.detailCommandDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                            {detail}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {(detailEntry.syncStatus === "failed" ||
                  detailEntry.syncStatus === "conflict") &&
                detailEntry.syncError ? (
                  <View style={[s.detailNotice, { backgroundColor: (detailEntry.syncStatus === "conflict" ? colors.amber : colors.rose) + "12", borderColor: (detailEntry.syncStatus === "conflict" ? colors.amber : colors.rose) + "44" }]}>
                    <Ionicons name="warning-outline" size={16} color={detailEntry.syncStatus === "conflict" ? colors.amber : colors.rose} />
                    <Text style={[s.detailNoticeText, { color: detailEntry.syncStatus === "conflict" ? colors.amber : colors.rose, fontFamily: "Inter_500Medium" }]}>{detailEntry.syncError}</Text>
                  </View>
                ) : null}

                {detailEntry.syncStatus === "conflict" &&
                detailEntry.conflictServerSnapshot &&
                detailConflictVersions ? (
                  <View
                    style={[
                      s.conflictResolutionPanel,
                      {
                        backgroundColor: colors.amber + "0D",
                        borderColor: colors.amber + "38",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.conflictResolutionTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Choose the household record
                    </Text>
                    <Text
                      style={[
                        s.conflictResolutionCopy,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      Keep my saved version overwrites the current household
                      record. Use household version refreshes first, then
                      accepts the newly loaded shared record without sending
                      a PATCH. Resolve this conflict before making other edits.
                    </Text>
                    <View style={s.conflictVersionStack}>
                      <View
                        accessible
                        accessibilityLabel={`My saved version. ${detailConflictVersions.local.type}: ${detailConflictVersions.local.title}. ${detailConflictVersions.local.note}. ${detailConflictVersions.local.mood}.`}
                        style={[
                          s.conflictVersionCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.primary + "40",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.conflictVersionEyebrow,
                            {
                              color: colors.primary,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          My saved version
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            s.conflictVersionTitle,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {detailConflictVersions.local.title}
                        </Text>
                        <Text
                          style={[
                            s.conflictVersionMeta,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {detailConflictVersions.local.type} ·{" "}
                          {detailConflictVersions.local.mood}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={[
                            s.conflictVersionNote,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {detailConflictVersions.local.note}
                        </Text>
                      </View>
                      <View
                        accessible
                        accessibilityLabel={`Household version. ${detailConflictVersions.household.type}: ${detailConflictVersions.household.title}. ${detailConflictVersions.household.note}. ${detailConflictVersions.household.mood}.`}
                        style={[
                          s.conflictVersionCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.amber + "40",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.conflictVersionEyebrow,
                            {
                              color: colors.amber,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          Household version from last refresh
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            s.conflictVersionTitle,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {detailConflictVersions.household.title}
                        </Text>
                        <Text
                          style={[
                            s.conflictVersionMeta,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {detailConflictVersions.household.type} ·{" "}
                          {detailConflictVersions.household.mood}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={[
                            s.conflictVersionNote,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {detailConflictVersions.household.note}
                        </Text>
                      </View>
                    </View>
                    <View style={s.conflictResolutionActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Keep my saved version"
                        disabled={
                          isSyncing || conflictResolutionPending
                        }
                        onPress={() => confirmKeepLocalConflict(detailEntry)}
                        style={({ pressed }) => [
                          s.conflictResolutionButton,
                          {
                            backgroundColor: colors.primary,
                            opacity:
                              isSyncing || conflictResolutionPending
                                ? 0.5
                                : pressed
                                  ? 0.82
                                  : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.conflictResolutionButtonText,
                            {
                              color: colors.primaryForeground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          Keep my saved version
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Use household version"
                        disabled={
                          isSyncing || conflictResolutionPending
                        }
                        onPress={() =>
                          confirmUseHouseholdConflict(detailEntry)
                        }
                        style={({ pressed }) => [
                          s.conflictResolutionButton,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderWidth: 1,
                            opacity:
                              isSyncing || conflictResolutionPending
                                ? 0.5
                                : pressed
                                  ? 0.72
                                  : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.conflictResolutionButtonText,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          Use household version
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {detailEntry.syncStatus === "conflict" &&
                !detailConflictVersions ? (
                  <View
                    style={[
                      s.conflictResolutionPanel,
                      {
                        backgroundColor: colors.amber + "0D",
                        borderColor: colors.amber + "38",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.conflictResolutionTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Household version unavailable
                    </Text>
                    <Text
                      style={[
                        s.conflictResolutionCopy,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      Refresh to load a valid household version before
                      choosing. Your saved conflict remains protected and
                      will not retry automatically.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Refresh conflict versions"
                      disabled={isSyncing}
                      onPress={() => {
                        void refresh();
                      }}
                      style={({ pressed }) => [
                        s.conflictResolutionButton,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          borderWidth: 1,
                          opacity: isSyncing
                            ? 0.5
                            : pressed
                              ? 0.72
                              : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.conflictResolutionButtonText,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {isSyncing ? "Refreshing…" : "Refresh versions"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {detailTrustReview?.visible ? (
                  <View
                    style={[
                      s.trustReviewPanel,
                      {
                        backgroundColor:
                          detailTrustReview.state === "rejected"
                            ? colors.rose + "10"
                            : detailTrustReview.state === "corrected"
                              ? colors.copper + "10"
                              : colors.sage + "10",
                        borderColor:
                          detailTrustReview.state === "rejected"
                            ? colors.rose + "40"
                            : detailTrustReview.state === "corrected"
                              ? colors.copper + "40"
                              : colors.sage + "40",
                      },
                    ]}
                  >
                    <View style={s.trustReviewHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.detailSectionLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                          Trust review
                        </Text>
                        <Text style={[s.trustReviewTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                          {detailTrustReview.statusLabel}
                        </Text>
                      </View>
                      <View style={[s.trustBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.trustBadgeText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                          {detailTrustReview.reasonLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={[s.trustReviewHelp, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {detailTrustReview.helperText}
                    </Text>
                    {detailTrustReview.proofStatus ? (
                      <View style={[s.trustProofRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="camera-outline" size={15} color={colors.sage} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.trustProofText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                            Proof status: {humanizeKey(detailTrustReview.proofStatus)}
                          </Text>
                          {detailTrustReview.proofAttachmentName ? (
                            <Text numberOfLines={1} style={[s.trustProofMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                              {detailTrustReview.proofAttachmentName}
                            </Text>
                          ) : null}
                          {detailTrustReview.proofStorageStatus === "local-only" ? (
                            <Text style={[s.trustProofMeta, { color: colors.amber, fontFamily: "Inter_600SemiBold" }]}>
                              Local-only proof saved. Cloud storage is not enabled yet.
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                    {detailTrustReview.proofStatus && detailTrustReview.proofStatus !== "attached" ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Attach proof photo to care log"
                        onPress={handleAttachProof}
                        style={({ pressed }) => [
                          s.trustProofAttachButton,
                          {
                            backgroundColor: pressed ? colors.secondary : colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Ionicons name="image-outline" size={15} color={colors.sage} />
                        <Text style={[s.trustProofAttachText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                          Attach proof photo
                        </Text>
                      </Pressable>
                    ) : null}
                    {detailTrustReview.canReview ? (
                      <View style={s.trustActionGrid}>
                        {detailTrustReview.actions.map((action) => {
                          const actionLabel = TRUST_ACTION_LABELS[action.id];
                          const isDanger = action.id === "reject";
                          const isPrimary = action.id === "confirm";
                          const actionColor = isDanger ? colors.rose : isPrimary ? colors.sage : colors.primary;
                          const iconName =
                            action.id === "confirm"
                              ? "checkmark-circle-outline"
                              : action.id === "reject"
                                ? "close-circle-outline"
                                : action.id === "request-photo"
                                  ? "camera-outline"
                                  : "create-outline";
                          return (
                            <Pressable
                              key={action.id}
                              accessibilityRole="button"
                              accessibilityLabel={`${actionLabel} care log`}
                              onPress={() => handleTrustReview(action.id)}
                              style={({ pressed }) => [
                                s.trustActionButton,
                                {
                                  backgroundColor: pressed ? actionColor + "1F" : colors.card,
                                  borderColor: actionColor + "44",
                                },
                              ]}
                            >
                              <Ionicons name={iconName} size={15} color={actionColor} />
                              <Text style={[s.trustActionText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                                {actionLabel}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={[s.trustLockedRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="lock-closed-outline" size={15} color={colors.mutedForeground} />
                        <Text style={[s.trustLockedText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                          Adult owner review required.
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {isPendingMealEntry(detailEntry) ? (
                  <View style={[s.mealOutcomePanel, { backgroundColor: colors.sage + "10", borderColor: colors.sage + "3D" }]}>
                    <View style={s.mealOutcomeHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.detailSectionLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                          Update outcome
                        </Text>
                        <Text style={[s.mealOutcomeHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          Close this open meal loop when {petDisplayName} finishes or refuses.
                        </Text>
                      </View>
                    </View>
                    <View style={s.mealOutcomeActions}>
                      {DETAIL_MEAL_OUTCOMES.map((outcome) => {
                        // Real state only: the chip fills forest when the log
                        // already records this outcome (e.g. still grazing).
                        const active =
                          isDetailRecord(detailEntry.details) &&
                          String(detailEntry.details.mealCompletion ?? "") === outcome.id;
                        return (
                          <Pressable
                            key={outcome.id}
                            accessibilityRole="radio"
                            accessibilityLabel={outcome.label}
                            accessibilityHint={
                              active
                                ? `${outcome.label} is selected.`
                                : `Updates the meal outcome to ${outcome.label}.`
                            }
                            accessibilityState={{ checked: active }}
                            aria-checked={active}
                            onPress={() => updateMealOutcomeFromDetail(detailEntry, outcome.id)}
                            style={({ pressed }) => [
                              s.mealOutcomeButton,
                              {
                                backgroundColor: active
                                  ? colors.primary
                                  : pressed
                                    ? colors.secondary
                                    : colors.card,
                                borderColor: active ? colors.primary : colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.mealOutcomeButtonText,
                                {
                                  color: active ? colors.primaryForeground : colors.foreground,
                                  fontFamily: "Inter_700Bold",
                                },
                              ]}
                            >
                              {outcome.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {detailType === "potty" ? (
                  <View style={[s.pottyDetailPanel, { backgroundColor: colors.secondary + "14", borderColor: colors.secondary + "55" }]}>
                    <View style={s.mealOutcomeHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.detailSectionLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                          Clarify potty log
                        </Text>
                        <Text style={[s.mealOutcomeHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          Keep the quick tap fast, then clarify pee, stool, accident, or attempt details here.
                        </Text>
                      </View>
                    </View>

                    <View style={s.pottyDetailGroup}>
                      <Text style={[s.pottyDetailLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Outcome</Text>
                      <View style={s.pottyOptionGrid}>
                        {POTTY_DETAIL_OUTCOMES.map((option) => {
                          const active = pottyDetailDraft.outcome === option.id;
                          return (
                            <Pressable
                              key={option.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Set potty outcome: ${option.label}`}
                              onPress={() => setPottyDetailDraft((draft) => ({ ...draft, outcome: option.id }))}
                              style={({ pressed }) => [
                                s.pottyOptionButton,
                                {
                                  backgroundColor: active ? colors.primary : pressed ? colors.secondary : colors.card,
                                  borderColor: active ? colors.primary : colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  s.pottyOptionText,
                                  { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" },
                                ]}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <View style={s.pottyDetailGroup}>
                      <Text style={[s.pottyDetailLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Where</Text>
                      <View style={s.pottyOptionGrid}>
                        {POTTY_LOCATION_OPTIONS.map((option) => {
                          const active = pottyDetailDraft.location === option.id;
                          return (
                            <Pressable
                              key={option.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Set potty location: ${option.label}`}
                              onPress={() => setPottyDetailDraft((draft) => ({ ...draft, location: option.id }))}
                              style={({ pressed }) => [
                                s.pottyOptionButton,
                                {
                                  backgroundColor: active ? colors.primary : pressed ? colors.secondary : colors.card,
                                  borderColor: active ? colors.primary : colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  s.pottyOptionText,
                                  { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" },
                                ]}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    {pottyOutcomeHasPee(pottyDetailDraft.outcome) ? (
                      <View style={s.pottyDetailGroup}>
                        <Text style={[s.pottyDetailLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Pee detail</Text>
                        <View style={s.pottyOptionGrid}>
                          {POTTY_PEE_DETAIL_OPTIONS.map((option) => {
                            const active = pottyDetailDraft.peeDetail === option.id;
                            return (
                              <Pressable
                                key={option.id}
                                accessibilityRole="button"
                                accessibilityLabel={`Set pee detail: ${option.label}`}
                                onPress={() => setPottyDetailDraft((draft) => ({ ...draft, peeDetail: option.id }))}
                                style={({ pressed }) => [
                                  s.pottyOptionButton,
                                  {
                                    backgroundColor: active ? colors.primary : pressed ? colors.secondary : colors.card,
                                    borderColor: active ? colors.primary : colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.pottyOptionText,
                                    { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" },
                                  ]}
                                >
                                  {option.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {pottyOutcomeHasStool(pottyDetailDraft.outcome) ? (
                      <>
                        <View style={s.pottyDetailGroup}>
                          <Text style={[s.pottyDetailLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                            Stool consistency
                          </Text>
                          <View style={s.pottyOptionGrid}>
                            {POTTY_STOOL_CONDITION_OPTIONS.map((option) => {
                              const active = pottyDetailDraft.stoolCondition === option.id;
                              return (
                                <Pressable
                                  key={option.id}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Set stool consistency: ${option.label}`}
                                  onPress={() => setPottyDetailDraft((draft) => ({ ...draft, stoolCondition: option.id }))}
                                  style={({ pressed }) => [
                                    s.pottyOptionButton,
                                    {
                                      backgroundColor: active ? colors.primary : pressed ? colors.secondary : colors.card,
                                      borderColor: active ? colors.primary : colors.border,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      s.pottyOptionText,
                                      { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" },
                                    ]}
                                  >
                                    {option.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        <View style={s.pottyDetailGroup}>
                          <Text style={[s.pottyDetailLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Stool color</Text>
                          <View style={s.pottyOptionGrid}>
                            {POTTY_STOOL_COLOR_OPTIONS.map((option) => {
                              const active = pottyDetailDraft.stoolColor === option.id;
                              return (
                                <Pressable
                                  key={option.id}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Set stool color: ${option.label}`}
                                  onPress={() => setPottyDetailDraft((draft) => ({ ...draft, stoolColor: option.id }))}
                                  style={({ pressed }) => [
                                    s.pottyOptionButton,
                                    {
                                      backgroundColor: active ? colors.primary : pressed ? colors.secondary : colors.card,
                                      borderColor: active ? colors.primary : colors.border,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      s.pottyOptionText,
                                      { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" },
                                    ]}
                                  >
                                    {option.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      </>
                    ) : null}

                    <View style={s.pottyDetailGroup}>
                      <Text style={[s.pottyDetailLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Context</Text>
                      <View style={s.pottyOptionGrid}>
                        {POTTY_CONTEXT_DRAFT_OPTIONS.map((option) => {
                          const active = pottyDetailDraft.context === option.id;
                          return (
                            <Pressable
                              key={option.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Set potty context: ${option.label}`}
                              onPress={() => setPottyDetailDraft((draft) => ({ ...draft, context: option.id }))}
                              style={({ pressed }) => [
                                s.pottyOptionButton,
                                {
                                  backgroundColor: active ? colors.primary : pressed ? colors.secondary : colors.card,
                                  borderColor: active ? colors.primary : colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  s.pottyOptionText,
                                  { color: active ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" },
                                ]}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Save potty details"
                      onPress={() => updatePottyDetailFromDetail(detailEntry)}
                      style={({ pressed }) => [
                        s.pottySaveButton,
                        {
                          backgroundColor: pressed ? colors.primary + "DD" : colors.primary,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <Text style={[s.pottySaveText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Save potty details</Text>
                      <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryForeground} />
                    </Pressable>
                  </View>
                ) : null}

                {detailRoute ? (
                  <View style={s.detailTrailBlock}>
                    <TrailMap
                      route={detailRoute}
                      height={160}
                      accessibilityLabel="Map of this walk's recorded route"
                    />
                    <Text style={[s.detailTrailCaption, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {[
                        detailRouteDistanceM != null
                          ? `Route · ${formatRouteDistanceMiles(detailRouteDistanceM)}`
                          : "Recorded route",
                        "saved in this walk's log",
                      ].join(" · ")}
                    </Text>
                  </View>
                ) : null}

                <View style={s.detailGrid}>
                  {detailRows.length > 0 ? (
                    detailRows.map((row) => (
                      <View key={`${row.label}:${row.value}`} style={[s.detailField, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.detailFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{row.label}</Text>
                        <Text style={[s.detailFieldValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{row.value}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={[s.detailFieldWide, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[s.detailFieldValue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>No extra detail fields yet.</Text>
                    </View>
                  )}
                </View>

                {detailEntry.note ? (
                  <View style={[s.detailNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.detailSectionLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>Note</Text>
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
                  <View style={[s.detailFieldWide, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.detailFieldValue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>No sticky notes attached.</Text>
                  </View>
                )}

                <View style={s.detailSectionHeader}>
                  <Text style={[s.detailSectionTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Correction history</Text>
                  <Text style={[s.detailSectionCount, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {detailAuditSummary ? "Traceable" : "Original"}
                  </Text>
                </View>
                {detailAuditSummary ? (
                  <View style={[s.correctionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.correctionCardTop}>
                      <View style={[s.correctionIcon, { backgroundColor: colors.copper + "16", borderColor: colors.copper + "44" }]}>
                        <Ionicons name="git-commit-outline" size={17} color={colors.copper} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.correctionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                          {detailAuditSummary.title}
                        </Text>
                        <Text style={[s.correctionMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          Latest update: {detailAuditSummary.meta}
                        </Text>
                      </View>
                    </View>
                    <Text style={[s.correctionBody, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {detailAuditSummary.latest.summary}
                    </Text>
                    {detailAuditSummary.changeLabels.length ? (
                      <View style={s.correctionChipRow}>
                        {detailAuditSummary.changeLabels.map((label) => (
                          <View key={label} style={[s.correctionChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <Text style={[s.correctionChipText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                              {label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={[s.detailFieldWide, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.detailFieldValue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      No corrections yet. New edits, proof, and outcome updates will appear here.
                    </Text>
                  </View>
                )}

                <View style={s.detailSectionHeader}>
                  <Text style={[s.detailSectionTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Audit trail</Text>
                  <Text style={[s.detailSectionCount, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{detailAuditTrail.length}</Text>
                </View>
                {detailAuditTrail.length > 0 ? (
                  <View style={s.auditStack}>
                    {detailAuditTrail.map((event) => (
                      <View key={event.id} style={[s.auditRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                  <View style={[s.detailFieldWide, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.detailFieldValue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Original log, no later changes recorded.
                    </Text>
                  </View>
                )}

                <Text style={[s.detailSectionLabel, { color: colors.sage, fontFamily: "Inter_700Bold", marginTop: 18 }]}>
                  Record controls
                </Text>
                <View style={s.detailActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share care handoff"
                    onPress={() => shareEntryHandoff(detailEntry)}
                    style={({ pressed }) => [s.detailPrimaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="share-outline" size={17} color={colors.primaryForeground} />
                    <Text style={[s.detailPrimaryText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Share handoff</Text>
                  </Pressable>
                  <View style={s.detailIconActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add sticky note to care log"
                      onPress={() => {
                        setDetailEntryId(null);
                        openStickyPrompt(detailEntry);
                      }}
                      style={[s.detailIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Ionicons name="document-text-outline" size={17} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit care log"
                      onPress={() => {
                        setDetailEntryId(null);
                        openEditEntry(detailEntry);
                      }}
                      style={[s.detailIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Ionicons name="pencil-outline" size={17} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>
                {/* Mockup Log Detail bottom row: destructive delete is a
                    plain red text button, never a filled control. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete care log"
                  onPress={() => handleDelete(detailEntry.id, detailEntry.title, () => setDetailEntryId(null))}
                  style={({ pressed }) => [s.detailDeleteBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[s.detailDeleteText, { color: colors.destructive, fontFamily: "Inter_700Bold" }]}>
                    Delete
                  </Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Entry editor modal */}
      <Modal
        visible={editEntry !== null}
        transparent
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={() => setEditEntry(null)}
      >
        <Pressable accessible={false} style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setEditEntry(null)}>
          <Pressable accessible={false} accessibilityViewIsModal style={[s.editSheet, { backgroundColor: colors.background, paddingBottom: modalSheetBottomPadding }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.editHandle} />
            <Text style={[s.editSheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Edit entry</Text>
            <Text style={[s.editFieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Title</Text>
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholderTextColor={colors.mutedForeground}
              style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
            />
            <Text style={[s.editFieldLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Note (optional)</Text>
            <TextInput
              value={editNote}
              onChangeText={setEditNote}
              placeholder="Add or update a note..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[s.input, s.inputMulti, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            />
            <BoardActionButton
              label="Save changes"
              icon="checkmark"
              variant="primary"
              onPress={saveEditEntry}
              style={s.editSaveAction}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Post-log quick-note prompt */}
      <Modal
        visible={promptId !== null}
        transparent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={() => setPromptId(null)}
      >
        <Pressable accessible={false} style={[s.modalBackdrop, centeredModalPadding]} onPress={saveQuickNote}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboardOffset} style={s.modalCenter}>
            <Pressable accessible={false} accessibilityViewIsModal style={[s.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
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
                  <Text style={[s.modalSaveText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Save sticky</Text>
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
  syncBtn: { width: MIN_MOBILE_TOUCH_TARGET, height: MIN_MOBILE_TOUCH_TARGET, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },

  detailedLogActionRow: {
    paddingHorizontal: 8,
    paddingBottom: 8,
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
  outboxEyebrow: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  outboxTitle: { fontSize: 15.5, marginTop: 2 },
  outboxMessage: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  outboxButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  outboxButtonText: { fontSize: 12.5 },
  outboxMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  outboxMetric: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6 },
  outboxMetricText: { fontSize: 11.5 },

  detailedLogCard: {
    marginBottom: 12,
    padding: 10,
  },
  detailedLogIntro: {
    gap: 8,
  },
  moodDetailPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 10,
    marginBottom: 10,
  },
  aloneActivePanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    gap: 11,
    shadowColor: "#081424",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  aloneActiveTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  aloneActiveIcon: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  aloneActiveKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  aloneActiveTitle: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 1,
  },
  aloneActiveMeta: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  walkRouteStatus: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  returnCheckTitle: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  returnOutcomeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  returnOutcomeButton: {
    flexGrow: 1,
    flexBasis: "31%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  returnOutcomeText: {
    fontSize: 11.5,
    textAlign: "center",
  },
  returnDetailRow: {
    flexDirection: "row",
    gap: 8,
  },
  returnInput: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  // Every input in a two-column returnDetailRow must flex: a bare
  // TextInput keeps its ~217px intrinsic width on web and shoves the row
  // off the right edge of the screen.
  returnInputHalf: {
    flex: 1,
    minWidth: 0,
  },
  walkFinishButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  walkFinishText: {
    fontSize: 13,
  },
  composerHero: {
    borderRadius: 8,
    padding: 12,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  detailedLogDock: {
    gap: 10,
    marginBottom: 12,
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
  composerKicker: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1.1 },
  composerTitle: { fontSize: 22, lineHeight: 25, marginTop: 1 },
  composerHint: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  composerBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 118,
  },
  composerBadgeText: {
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
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 4,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeChipIcon: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  typeChipLabel: { flexShrink: 1, fontSize: 13.5, lineHeight: 18, textAlign: "center" },

  fieldBlock: { marginTop: 16 },
  fieldLabel: { fontSize: 12, letterSpacing: 0, marginBottom: 8 },
  segRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segPill: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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

  logSaveAction: { marginTop: 18, minHeight: 52 },
  requiredChoiceHint: { fontSize: 12, lineHeight: 16, marginTop: 14, textAlign: "center" },

  logBoardCard: { marginTop: 12 },
  logViewTabs: { marginBottom: 12 },
  searchPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14.5, minHeight: 28, paddingVertical: 0 },
  searchClear: { width: MIN_MOBILE_TOUCH_TARGET, height: MIN_MOBILE_TOUCH_TARGET, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  searchSummary: { fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 2 },

  filterScroll: { marginTop: 8 },
  filterRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
  },
  filterText: { fontSize: 13 },

  snapshotSummary: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  snapshotLeft: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  snapshotCount: { fontSize: 22, letterSpacing: -0.3 },
  snapshotLabel: { fontSize: 13 },
  snapshotIcons: { flexDirection: "row", gap: 6, flex: 1, justifyContent: "flex-end", flexWrap: "wrap" },
  snapshotChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  snapshotChipCount: { fontSize: 12 },

  dayEntries: { marginTop: -2 },
  entryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginHorizontal: -6,
    borderRadius: 8,
  },
  entryRowPending: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginVertical: 4,
  },
  entryTimeCol: { width: 64, flexShrink: 0, paddingTop: 2 },
  entryTime: { fontSize: 12, lineHeight: 16 },
  entryIconChip: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  entryTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  entryTitle: { fontSize: 14.5, flexShrink: 1 },
  sevBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  sevText: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  entryMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  entryMeta: { fontSize: 12, marginTop: 2, flexShrink: 1 },
  entryStatusChip: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  entryStatusText: {
    fontSize: 9.5,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  entryAttentionChip: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  entryAttentionText: {
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
  detailSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", padding: 22 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  detailIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  detailType: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1.1 },
  detailTitle: { fontSize: 21, marginTop: 2 },
  detailMeta: { fontSize: 12.5, marginTop: 3 },
  detailCommandRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  detailCommandCard: {
    width: "48%",
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  detailCommandLabel: {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  detailCommandDetail: {
    fontSize: 10.5,
    marginTop: 2,
  },
  detailNotice: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 15, padding: 11, marginBottom: 12 },
  detailNoticeText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  conflictResolutionPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  conflictResolutionTitle: { fontSize: 14, lineHeight: 19 },
  conflictResolutionCopy: { fontSize: 12.5, lineHeight: 18 },
  conflictVersionStack: { gap: 7 },
  conflictVersionCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  conflictVersionEyebrow: {
    fontSize: 10.5,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  conflictVersionTitle: { fontSize: 13.5, lineHeight: 18, marginTop: 2 },
  conflictVersionMeta: { fontSize: 11.5, lineHeight: 16, marginTop: 1 },
  conflictVersionNote: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  conflictResolutionActions: { gap: 8 },
  conflictResolutionButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  conflictResolutionButtonText: { fontSize: 13, textAlign: "center" },
  trustReviewPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  trustReviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  trustReviewTitle: {
    fontSize: 16,
    lineHeight: 20,
  },
  trustBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 136,
  },
  trustBadgeText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.45,
    textAlign: "center",
  },
  trustReviewHelp: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 8,
  },
  trustProofRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  trustProofText: { fontSize: 12.5, lineHeight: 17 },
  trustProofMeta: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  trustProofAttachButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 12,
  },
  trustProofAttachText: { fontSize: 12.5, textAlign: "center" },
  trustActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 11,
  },
  trustActionButton: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  trustActionText: { fontSize: 12.5, textAlign: "center" },
  trustLockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 10,
  },
  trustLockedText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  mealOutcomePanel: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,
  },
  mealOutcomeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  mealOutcomeHint: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: -2,
  },
  mealOutcomeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  mealOutcomeButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  mealOutcomeButtonText: {
    fontSize: 12.5,
    textAlign: "center",
  },
  pottyDetailPanel: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  pottyDetailGroup: {
    gap: 7,
  },
  pottyDetailLabel: {
    fontSize: 12,
    letterSpacing: 0,
  },
  pottyOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  pottyOptionButton: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  pottyOptionText: {
    fontSize: 12,
    textAlign: "center",
  },
  pottySaveButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  pottySaveText: {
    fontSize: 13.5,
    textAlign: "center",
  },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  detailTrailBlock: { marginTop: 4, marginBottom: 6 },
  detailTrailCaption: { fontSize: 11, lineHeight: 15, marginTop: 6 },
  detailField: { width: "48%", borderWidth: 1, borderRadius: 15, padding: 12 },
  detailFieldWide: { width: "100%", borderWidth: 1, borderRadius: 15, padding: 12 },
  detailFieldLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  detailFieldValue: { fontSize: 13.5, lineHeight: 18 },
  detailNote: { borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 12 },
  detailSectionLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 },
  detailBodyText: { fontSize: 13.5, lineHeight: 19 },
  detailSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 },
  detailSectionTitle: { fontSize: 16 },
  detailSectionCount: { fontSize: 12 },
  correctionCard: { borderWidth: 1, borderRadius: 16, padding: 13, gap: 10 },
  correctionCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  correctionIcon: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  correctionTitle: { fontSize: 13.5 },
  correctionMeta: { fontSize: 11.5, marginTop: 2 },
  correctionBody: { fontSize: 13, lineHeight: 18 },
  correctionChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  correctionChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  correctionChipText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.35 },
  auditStack: { gap: 8 },
  auditRow: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 15, padding: 12 },
  auditDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  auditSummary: { fontSize: 13, lineHeight: 18 },
  auditMeta: { fontSize: 11.5, marginTop: 3 },
  auditChanges: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  detailActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  detailPrimaryBtn: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  detailPrimaryText: { fontSize: 14.5 },
  detailIconActions: { flexDirection: "row", gap: 7 },
  detailDeleteBtn: {
    alignSelf: "center",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 4,
  },
  detailDeleteText: { fontSize: 13.5 },
  detailIconBtn: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  editHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", marginBottom: 16 },
  editSheetTitle: { fontSize: 20, marginBottom: 4, letterSpacing: -0.2 },
  editFieldLabel: { fontSize: 12, letterSpacing: 0, marginBottom: 7, marginTop: 14 },
  editSaveAction: { marginTop: 20 },

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
  modalSaveText: { fontSize: 15 },
});
