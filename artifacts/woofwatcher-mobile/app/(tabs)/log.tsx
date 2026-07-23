import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
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
import { isClerkConfigured } from "@/lib/auth";
import { confirmThroughSteps, notifyDialog } from "@/lib/confirmDialog";
import { resolvePetName } from "@/lib/petIdentity";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import {
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
  buildAloneTimeStartEntry,
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
import {
  buildQuickLogEntry,
  describeQuickLogDetailSheet,
  describeQuickLogLauncherAction,
  findRecentQuickLogDuplicate,
  getQuickLogPolicy,
  QUICK_LOG_DEDUPE_WINDOW_MS,
} from "@/lib/quickLogEntry";
import { formatRouteDistanceMiles, parseWalkRoute } from "@/lib/walkRoute";
import { buildWalkSessionFinishPatch, buildWalkSessionStartEntry, findOpenWalkSession } from "@/lib/walkSession";
import { dayKey, dayLabel } from "@/lib/time";
import { TrailMap } from "@/components/TrailMap";
import { useWalkRouteCaptureStatus } from "@/components/WalkRouteRecorder";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import { pixelImageStyle, stageImageFill } from "@/lib/pixelRendering";
import { shareTextPayload } from "@/lib/shareText";
import { BoardActionButton, BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { homeImmersiveRoomIsNight } from "./index";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
// Wide banner composed for the ~4:1 console stage; the square day-room
// painting stretched into a squashed wall band here.
const LOG_COMMAND_STAGE_ROOM = require("@/assets/avatar/rooms/phoenix-room-day-banner.png");
const LOG_COMMAND_STAGE_SPRITE = getCareTwinSpriteAsset("ear-perk");
const LOG_COMMAND_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["ear-perk"];

// Warm the console stage art when the bundle loads, not when the Log tab
// first mounts: on web the metro asset resolves to `{ uri }`, and holding a
// decoded HTMLImageElement here means the hero paints with the tab's first
// frame instead of popping in a few frames after the switch. Native bundles
// the PNGs locally, so only web needs the warm-up (kept referenced so the
// decoded bitmap is not garbage collected).
const WARMED_LOG_STAGE_ART: unknown[] = [];
if (Platform.OS === "web") {
  const WebImage = (
    globalThis as {
      Image?: new () => { src: string; decode?: () => Promise<void> };
    }
  ).Image;
  for (const assetModule of [
    LOG_COMMAND_STAGE_ROOM,
    LOG_COMMAND_STAGE_SPRITE?.source,
  ]) {
    const uri =
      assetModule && typeof assetModule === "object"
        ? (assetModule as { uri?: string }).uri
        : null;
    if (!uri || !WebImage) continue;
    const image = new WebImage();
    image.src = uri;
    image.decode?.().catch(() => {});
    WARMED_LOG_STAGE_ART.push(image);
  }
}
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const QUICK_LOG_DOCTRINE: Array<{
  label: string;
  detail: string;
  icon: IoniconName;
  tone: "quick" | "detail" | "edit";
}> = [
  { label: "Tap", detail: "quick log", icon: "flash-outline", tone: "quick" },
  { label: "Hold", detail: "details", icon: "finger-print-outline", tone: "detail" },
  { label: "Edit later", detail: "Timeline", icon: "create-outline", tone: "edit" },
];

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
    noteField: { placeholder: "Sticky note: factual timeline, body language, handler response, injury check, or what helped..." },
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
  { label: "Potty", type: "potty", icon: "pee", tab: "favorites" },
  { label: "Training", type: "training", icon: "training", tab: "favorites" },
  { label: "Treat", type: "treat", icon: "treat", tab: "favorites" },
  { label: "Play", type: "play", icon: "play", tab: "favorites" },
  { label: "Water", type: "water", icon: "bile", tab: "favorites" },
  { label: "Vomit", type: "symptom", icon: "vomit", tab: "health", preset: { what: "vomit", severity: "watch" } },
  // Distinct bolt icon (Anxious owns the raincloud) and no preset: incident
  // facts are never pre-claimed for the caregiver.
  { label: "Incident", type: "incident", icon: "energy", tab: "health" },
  { label: "Medication", type: "medication", icon: "medication", tab: "health" },
  { label: "Alone Time", type: "alone", icon: "clock", tab: "household" },
  { label: "Anxious", type: "mood", icon: "anxious", tab: "health", preset: { mood: "anxious" } },
  { label: "Note", type: "note", icon: "note", tab: "household" },
  { label: "Weight", type: "weight", icon: "health", tab: "health" },
  { label: "Grooming", type: "grooming", icon: "happy", tab: "all" },
];

const ALONE_RETURN_OPTIONS = getAloneTimeReturnOptions();

const MOOD_LAUNCHER: { key: string; label: string; icon: PixelIconName; mood: string }[] = [
  { key: "great", label: "Great", icon: "mood_great", mood: "happy" },
  { key: "good", label: "Good", icon: "mood_good", mood: "calm" },
  { key: "okay", label: "Okay", icon: "mood_okay", mood: "calm" },
  { key: "meh", label: "Meh", icon: "mood_meh", mood: "anxious" },
  { key: "rough", label: "Rough", icon: "mood_rough", mood: "unwell" },
];

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

function launcherActionKey(action: Pick<LauncherAction, "label" | "type">): string {
  return `${action.type}:${action.label}`;
}

function findLauncherActionForType(type: CareEventType | null): LauncherAction | null {
  if (!type) return null;
  return LAUNCHER_ACTIONS.find((action) => action.type === type) ?? null;
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
    rows.push({ label: humanizeKey(key), value: timestamp ?? humanizeKey(text) });
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
  const router = useRouter();
  const { state, addEntry, deleteEntry, updateEntry, updateCareDoc, refresh, syncOutbox, isSyncing } = useCare();
  const me = useGetMe();
  const routeParams = useLocalSearchParams<{
    type?: string | string[];
    detail?: string | string[];
    intent?: string | string[];
    entry?: string | string[];
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
  const lastRouteSelectedType = useRef<string | null>(null);
  const lastRouteDetailIntentKey = useRef<string | null>(null);
  const lastRouteEntryParam = useRef<string | null>(null);

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
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
  // Under 360pt the console chrome truncates ("Tap saves. Hold o...",
  // "SAVED On d..."), so narrow screens get shorter honest strings and
  // drop the decorative under-5-sec pill.
  const { width: viewportWidth } = useWindowDimensions();
  const narrowViewport = viewportWidth > 0 && viewportWidth < 360;

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
  const [launcherTab, setLauncherTab] = useState<LauncherTab>("favorites");
  const [selectedLauncherKey, setSelectedLauncherKey] = useState<string | null>(() => launcherActionKey(LAUNCHER_ACTIONS[0]!));
  const [launcherDetailAction, setLauncherDetailAction] = useState<LauncherAction | null>(null);
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
    if (!routeSelectedType) return;
    if (routeSelectedType !== lastRouteSelectedType.current) {
      setSelectedType(routeSelectedType);
      setSelectedLauncherKey(null);
      lastRouteSelectedType.current = routeSelectedType;
    }
    if (!routeWantsDetailSheet || !routeDetailIntentKey || routeDetailIntentKey === lastRouteDetailIntentKey.current) {
      return;
    }
    const routeDetailAction = findLauncherActionForType(routeSelectedType);
    if (!routeDetailAction) return;
    pendingChoicePreset.current = routeDetailAction.preset ?? null;
    setLauncherTab(routeDetailAction.tab === "health" ? "health" : routeDetailAction.tab === "all" ? "all" : "favorites");
    setSelectedLauncherKey(launcherActionKey(routeDetailAction));
    setSelectedType(routeDetailAction.type);
    // Detail intents land straight in the pre-focused composer - no
    // interstitial between "add details" and the real form.
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
  const [lastQuickLog, setLastQuickLog] = useState<{ id: string; title: string } | null>(null);

  // Entry editor
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    if (!routeEntryParam || routeEntryParam === lastRouteEntryParam.current) return;
    if (!state.entries.some((entry) => entry.id === routeEntryParam)) return;
    setDetailEntryId(routeEntryParam);
    lastRouteEntryParam.current = routeEntryParam;
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
  const fade = useRef(new Animated.Value(isWebRoutePreview ? 1 : 0)).current;
  const slide = useRef(new Animated.Value(isWebRoutePreview ? 0 : 16)).current;
  useEffect(() => {
    if (isWebRoutePreview) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: !isWebRoutePreview }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: !isWebRoutePreview }),
    ]).start();
  }, [fade, isWebRoutePreview, slide]);

  // Two-phase mount: the console stage and quick-log launcher (the whole
  // first screenful) render on the tab-press frame; the composer, search,
  // and timeline - all below the fold - mount right after the transition
  // settles. Rendering everything at once blocked the switch-to-Log frame
  // for ~80-100ms.
  const [belowFoldReady, setBelowFoldReady] = useState(false);
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
      updateEntry(promptId, { note: entry?.note ?? text, details });
    }
    setPromptId(null);
    setPromptNote("");
  }, [promptId, promptNote, promptMode, state.entries, caregiver, updateEntry]);

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
      );
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

  const updateMealOutcomeFromDetail = useCallback(
    (entry: Entry, outcome: DetailMealOutcome) => {
      const patch = buildMealOutcomeUpdatePatch(entry, {
        caregiver,
        now: new Date().toISOString(),
        outcome,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateEntry(entry.id, patch);
    },
    [caregiver, updateEntry],
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
      updateEntry(entry.id, patch);
    },
    [caregiver, pottyDetailDraft, updateEntry],
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
  // Honest route-recorder state: only ever says "recording" while location
  // fixes are actually landing; otherwise it explains what would enable it.
  const walkRouteCapture = useWalkRouteCaptureStatus();
  const walkRouteStatusText =
    walkRouteCapture.status === "recording"
      ? "Recording the route for this walk's map · stays in your care log"
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
      updateEntry(detailEntry.id, patch);
    },
    [caregiver, currentCaregiverRole, detailEntry, now, updateEntry],
  );

  const handleAttachProof = useCallback(async () => {
    if (!detailEntry) return;
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
      updateEntry(detailEntry.id, patch);
    } catch {
      notifyDialog("Photo unavailable", "Attach proof later. Medication logs stay pending until an owner confirms them.");
    }
  }, [caregiver, detailEntry, now, updateEntry]);

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
        // Zero-log day: "--" instead of a fabricated percentage, matching
        // Home - the score starts with the first real log.
        value: careIntelligence.visibleLogCount === 0 ? "--" : `${careIntelligence.score}%`,
        detail:
          careIntelligence.visibleLogCount === 0
            ? "starts with first log"
            : careIntelligence.status === "needs-attention"
              ? "review loops"
              : "day rhythm",
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
      SYNC_PROVIDER_CONFIGURED
        ? {
            label: "Sync",
            value: syncOutbox.total > 0 ? `${syncOutbox.total}` : "Ready",
            detail: syncOutbox.total > 0 ? "queued safely" : "protected",
            icon: syncOutbox.total > 0 ? ("cloud-offline-outline" as const) : ("cloud-done-outline" as const),
            tone: syncOutbox.status === "needs-retry" ? colors.amber : colors.primary,
          }
        : {
            label: "Saved",
            value: "On device",
            detail: "nothing waiting",
            icon: "shield-checkmark-outline" as const,
            tone: colors.sage,
          },
    ],
    [
      colors.amber,
      colors.copper,
      colors.primary,
      colors.sage,
      careIntelligence.score,
      careIntelligence.status,
      careIntelligence.visibleLogCount,
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

  const launcherActions = useMemo(() => {
    if (launcherTab === "favorites") return LAUNCHER_ACTIONS.slice(0, 12);
    if (launcherTab === "health") {
      return LAUNCHER_ACTIONS.filter((action) => action.tab === "health");
    }
    return LAUNCHER_ACTIONS;
  }, [launcherTab]);
  const launcherDetailPresentation = useMemo(
    () =>
      launcherDetailAction
        ? describeQuickLogDetailSheet(launcherDetailAction.type, launcherDetailAction.label)
        : null,
    [launcherDetailAction],
  );
  const selectedLauncherAction = useMemo(
    () =>
      launcherActions.find(
        (action) => selectedLauncherKey === launcherActionKey(action),
      ) ?? null,
    [launcherActions, selectedLauncherKey],
  );
  const selectedLauncherPresentation = useMemo(
    () =>
      selectedLauncherAction
        ? describeQuickLogLauncherAction(selectedLauncherAction.type, selectedLauncherAction.label)
        : null,
    [selectedLauncherAction],
  );
  const selectedLauncherRequiresDetail = selectedLauncherPresentation?.detailRequired ?? false;
  const logCommandOpenLoops =
    state.entries.filter(isPendingMealEntry).length +
    (openAloneSession ? 1 : 0) +
    (openWalkSession ? 1 : 0);
  // Time-aware console stage: same clock rule as Home's immersive room (dark
  // theme or lamplit hours). There is no night banner art, so a navy tint
  // over the day painting keeps the hero honest at 23:00 and in dark mode.
  const logCommandStageIsNight =
    colors.isDark || homeImmersiveRoomIsNight(new Date(now).getHours());
  const logCommandSpeech = selectedLauncherAction
    ? selectedLauncherRequiresDetail
      ? `${selectedLauncherAction.label} opens the details form before it saves.`
      : `Tap ${selectedLauncherAction.label}. Hold for proof, notes, and corrections.`
    : "Tap fast. Hold for proof, notes, or later updates.";
  const logCommandHud = [
    {
      label: "Today",
      value: String(todaySnapshot.total),
      tone: colors.copper,
    },
    {
      label: "Care IQ",
      // Zero-log day: "--" like Home instead of "0%" - the console HUD and
      // the Home quest meta must tell the same first-log story.
      value: careIntelligence.visibleLogCount === 0 ? "--" : `${careIntelligence.score}%`,
      tone:
        careIntelligence.status === "needs-attention"
          ? colors.amber
          : careIntelligence.status === "excellent"
            ? colors.sage
            : colors.primary,
    },
    {
      label: "Open",
      value: String(logCommandOpenLoops),
      tone: logCommandOpenLoops > 0 ? colors.amber : colors.sage,
    },
    {
      label: "Saved",
      value: SYNC_PROVIDER_CONFIGURED
        ? syncOutbox.total > 0
          ? `${syncOutbox.total}`
          : "Ready"
        : narrowViewport
          ? "Local"
          : "On device",
      tone: !SYNC_PROVIDER_CONFIGURED
        ? colors.sage
        : syncOutbox.status === "needs-retry"
          ? colors.amber
          : colors.primary,
    },
  ];

  const selectLauncherAction = (action: LauncherAction) => {
    Haptics.selectionAsync();
    pendingChoicePreset.current = action.preset ?? null;
    setSelectedLauncherKey(launcherActionKey(action));
    setSelectedType(action.type);
    if (selectedType === action.type && action.preset) {
      setChoices((prev) => ({ ...prev, ...action.preset }));
    }
  };

  const scrollToComposer = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max((composerSectionY.current ?? 620) - 12, 0),
      animated: true,
    });
  }, []);

  const focusFullComposerForLauncherAction = (action: LauncherAction) => {
    selectLauncherAction(action);
    setTimeout(() => {
      scrollToComposer();
    }, 80);
  };

  // The policy explainer is an on-demand guide behind the "?" affordance now;
  // tap and hold both land straight on real log surfaces.
  const openLauncherDetailSheet = (action: LauncherAction) => {
    Haptics.selectionAsync();
    setLauncherDetailAction(action);
  };

  const openQuickLogGuide = () => {
    const action =
      selectedLauncherAction ??
      findLauncherActionForType(TYPE_BY_ID[selectedType] ? (selectedType as CareEventType) : null) ??
      LAUNCHER_ACTIONS[0]!;
    openLauncherDetailSheet(action);
  };

  // Double-tap safety shared by every quick save on this screen: the ref
  // catches a second press in the same tick (React state cannot update in
  // between), the shared window check dedupes slower bounces against the
  // saved timeline. A deliberate second log after 1.5s still saves.
  const recentQuickSave = useRef<{ type: string; at: number } | null>(null);
  const isDuplicateQuickTap = useCallback((type: string): boolean => {
    const prev = recentQuickSave.current;
    return Boolean(
      prev &&
        prev.type === type &&
        Date.now() - prev.at <= QUICK_LOG_DEDUPE_WINDOW_MS,
    );
  }, []);
  const markQuickSave = useCallback((type: string) => {
    recentQuickSave.current = { type, at: Date.now() };
  }, []);

  const handleLeavingHome = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (openAloneSession) {
      setSelectedType("alone");
      setSelectedLauncherKey("alone:Alone Time");
      scrollRef.current?.scrollTo({ y: 360, animated: true });
      return;
    }
    // A rapid second tap lands before the open session exists in state.
    if (isDuplicateQuickTap("alone")) return;
    markQuickSave("alone");
    const entry = buildAloneTimeStartEntry({ caregiver, now });
    const id = addEntry(entry);
    setLastQuickLog({ id, title: `${petDisplayName} is home alone` });
    setSelectedType("alone");
    setSelectedLauncherKey("alone:Alone Time");
  }, [
    addEntry,
    caregiver,
    isDuplicateQuickTap,
    markQuickSave,
    now,
    openAloneSession,
    petDisplayName,
  ]);

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
      updateEntry(openAloneSession.id, patch);
      setLastQuickLog({ id: openAloneSession.id, title: patch.title });
      setReturnRecoveryMinutes("");
      setReturnNote("");
    },
    [caregiver, now, openAloneSession, returnNote, returnRecoveryMinutes, updateEntry],
  );

  const handleStartWalk = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (openWalkSession) {
      setSelectedType("walk");
      setSelectedLauncherKey("walk:Walk");
      scrollRef.current?.scrollTo({ y: 360, animated: true });
      return;
    }
    // A rapid second tap lands before the open session exists in state.
    if (isDuplicateQuickTap("walk")) return;
    markQuickSave("walk");
    const entry = buildWalkSessionStartEntry({ caregiver, now });
    const id = addEntry(entry as Omit<Entry, "id">);
    setLastQuickLog({ id, title: "Walk started" });
    setSelectedType("walk");
    setSelectedLauncherKey("walk:Walk");
  }, [addEntry, caregiver, isDuplicateQuickTap, markQuickSave, now, openWalkSession]);

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

    updateEntry(openWalkSession.id, patch as Partial<Omit<Entry, "id">>);
    setLastQuickLog({ id: openWalkSession.id, title: patch.title ?? "Walk completed" });
    setWalkFinishRouteName("");
    setWalkFinishDistanceMiles("");
    setWalkFinishDogInteractions("");
    setWalkFinishSocialOutcome("");
    setWalkFinishNote("");
  }, [
    caregiver,
    now,
    openWalkSession,
    updateEntry,
    walkFinishDistanceMiles,
    walkFinishDogInteractions,
    walkFinishNote,
    walkFinishRouteName,
    walkFinishSocialOutcome,
  ]);

  const handleQuickLauncherAction = (action: LauncherAction) => {
    if (action.type === "alone") {
      handleLeavingHome();
      return;
    }
    if (action.type === "walk") {
      handleStartWalk();
      return;
    }
    const policy = getQuickLogPolicy(action.type);
    if (policy.tapBehavior === "detail-required") {
      // Details-first actions go straight to the pre-focused composer.
      focusFullComposerForLauncherAction(action);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Dedupe: the first tap already saved this intent and its feedback card
    // is still up; a bounce inside the shared window must not double-log.
    // Wall-clock time here - the screen's 30s `now` tick would otherwise
    // block a deliberate second log inside the same tick.
    if (
      isDuplicateQuickTap(policy.type) ||
      findRecentQuickLogDuplicate(state.entries, action.type, Date.now())
    ) {
      return;
    }
    markQuickSave(policy.type);
    const role = state.caregivers.find((person) => person.name === caregiver)?.role;
    const entry = buildQuickLogEntry(
      {
        type: action.type,
        title: action.label,
        mood: action.preset?.mood,
        severity: action.preset?.severity,
      },
      state,
      { caregiver, caregiverRole: role, now },
    );
    const id = addEntry(entry);
    setLastQuickLog({ id, title: entry.title });
    setSelectedLauncherKey(launcherActionKey(action));
    setSelectedType(action.type);
  };

  const undoLastQuickLog = () => {
    if (!lastQuickLog) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void deleteEntry(lastQuickLog.id);
    setLastQuickLog(null);
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
            title="Log"
            back
            onBack={() => router.push("/")}
            actionIcon="notifications-outline"
            actionLabel="Open Health Watch"
            onAction={() => {
              Haptics.selectionAsync();
              router.push("/health?tab=health" as never);
            }}
          />

          <BoardCard padded={false} style={s.logCommandStageCard}>
            <ImageBackground
              source={LOG_COMMAND_STAGE_ROOM}
              resizeMode="cover"
              // Android fades images in over 300ms by default, which reads
              // as the hero art popping in after the tab switch.
              fadeDuration={0}
              imageStyle={[stageImageFill, s.logCommandStageImage, pixelImageStyle]}
              style={s.logCommandStage}
              testID="quick-log-command-pixel-stage"
            >
              <View
                style={[
                  s.logCommandStageShade,
                  logCommandStageIsNight ? { backgroundColor: "rgba(9,17,32,0.35)" } : null,
                ]}
              />
              <View style={s.logCommandStageTop}>
                <View style={s.logCommandBubble}>
                  <Text style={[s.logCommandKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    Quick Care Console
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[s.logCommandSpeech, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}
                  >
                    {logCommandSpeech}
                  </Text>
                  <View style={s.logCommandBubbleTail} />
                </View>
                <View style={[s.logCommandChip, { backgroundColor: colors.ivory + "F2", borderColor: colors.border }]}>
                  <PixelIcon name={selectedLauncherAction?.icon ?? "heart"} size={17} />
                  <Text
                    style={[
                      s.logCommandChipText,
                      {
                        color: selectedLauncherRequiresDetail ? colors.amber : colors.forest,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {selectedLauncherRequiresDetail ? "Details" : "Ready"}
                  </Text>
                </View>
              </View>

              <View style={[s.logCommandSprite, { pointerEvents: "none" }]}>
                <View style={s.logCommandSpriteShadow} />
                <SpriteSheetPlayer
                  asset={LOG_COMMAND_STAGE_SPRITE}
                  track={LOG_COMMAND_STAGE_TRACK}
                  width={68}
                  height={68}
                  testID="quick-log-command-pixel-sprite"
                />
              </View>

            </ImageBackground>
            <View style={[s.logCommandDock, { backgroundColor: colors.ivory + "F3", borderColor: colors.border }]}>
              <View style={s.logCommandHud}>
                {logCommandHud.map((metric) => (
                  <View
                    key={metric.label}
                    style={[s.logCommandHudCell, { backgroundColor: colors.cream, borderColor: colors.border }]}
                  >
                    <Text style={[s.logCommandHudLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      {metric.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[s.logCommandHudValue, { color: colors.brandNavy, fontFamily: DISPLAY_SEMI }]}
                    >
                      {metric.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={s.logCommandActionRow}>
              <BoardActionButton
                label={selectedLauncherRequiresDetail ? "Add details" : "Quick Log"}
                icon={selectedLauncherRequiresDetail ? "reader-outline" : "flash-outline"}
                variant="primary"
                accessibilityLabel={
                  selectedLauncherAction
                    ? `${selectedLauncherRequiresDetail ? "Open details for" : "Quick log"} ${selectedLauncherAction.label}`
                    : "Open full Quick Log composer"
                }
                onPress={() => {
                  if (selectedLauncherAction) {
                    handleQuickLauncherAction(selectedLauncherAction);
                    return;
                  }
                  Haptics.selectionAsync();
                  scrollToComposer();
                }}
              />
            </View>
          </BoardCard>

          <BoardCard style={s.launcherCard}>
            <View style={s.quickLogActionConsole}>
              <View style={s.quickLogActionConsoleHeader}>
                <View style={s.quickLogActionTitleBlock}>
                  <Text style={[s.quickLogActionKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    QUICK LOG FLOW
                  </Text>
                  <Text numberOfLines={1} style={[s.quickLogActionSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {narrowViewport ? "Tap saves. Hold: details." : "Tap saves. Hold opens details."}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`How ${selectedLauncherAction?.label ?? selectedLabel} quick logging works`}
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={openQuickLogGuide}
                  style={({ pressed }) => [
                    s.quickLogGuideButton,
                    {
                      backgroundColor: pressed ? colors.secondary : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name="help-circle-outline" size={17} color={colors.sage} />
                </Pressable>
              </View>

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
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.launcherTabText,
                        {
                          color: active ? colors.primaryForeground : colors.foreground,
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
                const launcherPresentation = describeQuickLogLauncherAction(action.type, action.label);
                return (
                  <PressScale
                    key={`${action.label}-${action.type}`}
                    accessibilityRole="button"
                    accessibilityLabel={launcherPresentation.accessibilityLabel}
                    accessibilityHint={launcherPresentation.feedbackHint}
                    accessibilityState={{ selected: active }}
                    onPress={() => handleQuickLauncherAction(action)}
                    onLongPress={() => focusFullComposerForLauncherAction(action)}
                    scaleTo={0.94}
                    haptic="none"
                    containerStyle={s.launcherTileLayout}
                    style={[
                      s.launcherTile,
                      {
                        backgroundColor: active ? colors.ivory : colors.background,
                        borderColor: launcherPresentation.detailRequired
                          ? colors.amber + "66"
                          : active
                            ? colors.primary
                            : colors.border,
                        boxShadow: active
                          ? `0 5px 10px ${launcherPresentation.detailRequired ? colors.amber : colors.primary}21`
                          : "none",
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.launcherIconHalo,
                        {
                          backgroundColor: active ? colors.sageSoft : colors.card,
                          borderColor: active ? colors.primary + "55" : colors.border,
                        },
                      ]}
                    >
                      <PixelIcon name={action.icon} size={30} />
                    </View>
                    {active ? (
                      <View style={[s.launcherSelectedMark, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />
                      </View>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[s.launcherTileText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                    >
                      {action.label}
                    </Text>
                    {/* Only detail-required tiles carry a pill: a quiet
                        differentiator instead of twelve identical labels. */}
                    {launcherPresentation.detailRequired ? (
                      <View style={[s.launcherTileMode, { backgroundColor: colors.amberSoft }]}>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={[
                            s.launcherTileModeText,
                            {
                              color: colors.amber,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {launcherPresentation.modeLabel}
                        </Text>
                      </View>
                    ) : null}
                  </PressScale>
                );
              })}
              {/* Invisible fillers square off the last space-between row so a
                  partial tab (like Health's 5 tiles) never leaves a mid-row hole. */}
              {Array.from(
                { length: (3 - (launcherActions.length % 3)) % 3 },
                (_, fillerIndex) => (
                  <View
                    key={`launcher-filler-${fillerIndex}`}
                    style={[s.launcherTileGhost, { pointerEvents: "none" }]}
                  />
                ),
              )}
            </View>

            <View style={s.launcherDoctrineRail}>
              {QUICK_LOG_DOCTRINE.map((item) => {
                const toneColor = item.tone === "quick" ? colors.sage : item.tone === "detail" ? colors.copper : colors.blueSignal;
                return (
                  <View
                    key={item.label}
                    style={[
                      s.launcherDoctrineCard,
                      {
                        backgroundColor: toneColor + "0F",
                        borderColor: toneColor + "33",
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={14} color={toneColor} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[s.launcherDoctrineLabel, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                        {item.label}
                      </Text>
                      <Text numberOfLines={1} style={[s.launcherDoctrineDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                        {item.detail}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {lastQuickLog ? (
              <View style={[s.quickFeedback, { backgroundColor: colors.sage + "12", borderColor: colors.sage + "44" }]}>
                <View style={s.quickFeedbackCopy}>
                  <Text style={[s.quickFeedbackTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {lastQuickLog.title} logged
                  </Text>
                  <Text style={[s.quickFeedbackSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {describeQuickLogLauncherAction(state.entries.find((item) => item.id === lastQuickLog.id)?.type, lastQuickLog.title).feedbackHint}
                  </Text>
                </View>
                <View style={s.quickFeedbackActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Undo ${lastQuickLog.title} quick log`}
                    onPress={undoLastQuickLog}
                    style={[s.quickFeedbackButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <Text style={[s.quickFeedbackButtonText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                      Undo
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add details to ${lastQuickLog.title}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDetailEntryId(lastQuickLog.id);
                    }}
                    style={[s.quickFeedbackButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[s.quickFeedbackButtonText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                      Add details
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {openWalkSession ? (
              <View style={[s.aloneActivePanel, { backgroundColor: colors.card, borderColor: colors.sage + "55" }]}>
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
                    style={[s.returnInput, s.returnInputNote, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                  <TextInput
                    value={walkFinishDistanceMiles}
                    onChangeText={setWalkFinishDistanceMiles}
                    placeholder="Miles"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    style={[s.returnInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
                <View style={s.returnDetailRow}>
                  <TextInput
                    value={walkFinishDogInteractions}
                    onChangeText={setWalkFinishDogInteractions}
                    placeholder="Dogs met"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    style={[s.returnInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                  <TextInput
                    value={walkFinishSocialOutcome}
                    onChangeText={setWalkFinishSocialOutcome}
                    placeholder="Social outcome"
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.returnInput, s.returnInputNote, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
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
              <View style={[s.aloneActivePanel, { backgroundColor: colors.card, borderColor: colors.amber + "55" }]}>
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
                    style={[s.returnInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                  <TextInput
                    value={returnNote}
                    onChangeText={setReturnNote}
                    placeholder="What helped?"
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.returnInput, s.returnInputNote, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
              </View>
            ) : null}

            <View style={[s.moodPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[s.moodQuestion, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                How is {petDisplayName} feeling?
              </Text>
              <View style={s.moodRow}>
                {MOOD_LAUNCHER.map((mood) => {
                  const active = selectedType === "mood" && choices.moodTone === mood.key;
                  return (
                    <Pressable
                      key={mood.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${petDisplayName} feels ${mood.label}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => selectMoodLauncher(mood)}
                      style={({ pressed }) => [
                        s.moodOption,
                        {
                          backgroundColor: active ? colors.sageSoft : "transparent",
                          borderColor: active ? colors.primary + "66" : "transparent",
                          opacity: pressed ? 0.72 : 1,
                        },
                      ]}
                    >
                      <PixelIcon name={mood.icon} size={30} />
                      <Text style={[s.moodOptionText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {mood.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <BoardActionButton
              label="Add details (optional)"
              accessibilityLabel={`Add details to the selected ${selectedLabel} log in the full composer`}
              variant="soft"
              onPress={() => {
                Haptics.selectionAsync();
                scrollToComposer();
              }}
            />
            </View>
          </BoardCard>

          <View style={s.quickLogSupportRail}>
            {todaySignalCards.map((card) => (
              <View
                key={card.label}
                style={[s.signalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[s.signalIcon, { backgroundColor: card.tone + "18" }]}>
                  <Ionicons name={card.icon} size={16} color={card.tone} />
                </View>
                <Text style={[s.signalLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
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

          {!SYNC_PROVIDER_CONFIGURED && state.entries.length > 0 ? (
            // Local-first build: device storage is the success state, so the
            // care record card confirms that instead of promising sync.
            <View
              style={[
                s.outboxCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.sage + "33",
                  boxShadow: `0 6px 16px ${colors.sage}14`,
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
                  boxShadow: `0 6px 16px ${syncOutbox.status === "needs-retry" ? colors.amber : colors.primary}14`,
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
                    {syncOutbox.status === "needs-retry" ? "Saved on this device" : "Syncing safely"}
                  </Text>
                  <Text style={[s.outboxMessage, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {syncOutbox.message} {petDisplayName}'s local record is safe on this device.
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
          <View
            style={{ height: 0 }}
            onLayout={(event) => {
              composerSectionY.current = event.nativeEvent.layout.y + topPadding;
            }}
          />
          {/* Everything from the composer down is below the fold and mounts
              one frame after the tab switch (two-phase render). */}
          {belowFoldReady ? (
            <>
          <BoardCard style={s.composerHero}>
            <View style={s.quickLogDetailDock}>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.typeRow}
              style={{ marginHorizontal: -4 }}
            >
              {LOG_TYPES.map((q) => {
                const active = selectedType === q.type;
                const tint = careTypeTone(q.type, q.icon);
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
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={[s.typeChipIcon, { backgroundColor: active ? "rgba(255,255,255,0.18)" : tint + "1A" }]}>
                      <CareTypeIcon type={q.type} icon={q.icon} size={15} color={active ? colors.primaryForeground : undefined} />
                    </View>
                    <Text
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
            </ScrollView>

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
                        onPress={() => {
                          Haptics.selectionAsync();
                          setChoices((prev) => ({ ...prev, [g.key]: o.id }));
                        }}
                        style={[
                          s.segPill,
                          {
                            backgroundColor: active ? colors.primary : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
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
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
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
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
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
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
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
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
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
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
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
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
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
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
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
                  accessibilityLabel="Share this log with the household"
                  accessibilityHint={householdVisible ? "Double tap to keep this log private" : "Double tap to share this log with household caregivers"}
                  accessibilityState={{ checked: householdVisible }}
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

      {/* Launcher detail sheet */}
      <Modal
        visible={launcherDetailAction !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLauncherDetailAction(null)}
      >
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setLauncherDetailAction(null)}>
          <Pressable
            style={[s.launcherDetailSheet, { backgroundColor: colors.card, paddingBottom: modalSheetBottomPadding }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={s.editHandle} />
            {launcherDetailAction && launcherDetailPresentation ? (
              <>
                <View style={s.launcherDetailTop}>
                  <View style={[s.launcherDetailIcon, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}>
                    <PixelIcon name={launcherDetailAction.icon} size={34} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.launcherDetailKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      QUICK LOG FLOW
                    </Text>
                    <Text style={[s.launcherDetailTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                      {launcherDetailPresentation.title}
                    </Text>
                    <Text style={[s.launcherDetailSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {launcherDetailPresentation.subtitle}
                    </Text>
                  </View>
                </View>

                <View style={[s.launcherDetailSummary, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="flash-outline" size={16} color={colors.sage} />
                  <Text style={[s.launcherDetailSummaryText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {launcherDetailPresentation.quickSummary}
                  </Text>
                </View>

                <View style={s.launcherDetailModeRail}>
                  {launcherDetailPresentation.interactionRail.map((item) => {
                    const toneColor = item.tone === "quick" ? colors.sage : item.tone === "detail" ? colors.copper : colors.blueSignal;
                    return (
                      <View
                        key={item.label}
                        style={[
                          s.launcherDetailModeCard,
                          {
                            backgroundColor: toneColor + "0F",
                            borderColor: toneColor + "33",
                          },
                        ]}
                      >
                        <Text numberOfLines={1} style={[s.launcherDetailModeLabel, { color: toneColor, fontFamily: "Inter_800ExtraBold" }]}>
                          {item.label}
                        </Text>
                        <Text numberOfLines={1} style={[s.launcherDetailModeDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                          {item.detail}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={s.launcherDetailChecklist}>
                  {launcherDetailPresentation.detailChecklist.map((item) => (
                    <View key={item} style={s.launcherDetailChecklistRow}>
                      <View style={[s.launcherDetailBullet, { backgroundColor: colors.sage }]} />
                      <Text style={[s.launcherDetailChecklistText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={[s.launcherDetailEditLater, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="create-outline" size={16} color={colors.sage} />
                  <Text style={[s.launcherDetailEditLaterText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {launcherDetailPresentation.editLaterCopy}
                  </Text>
                </View>

                {launcherDetailPresentation.safetyBoundary ? (
                  <View style={[s.launcherDetailBoundary, { backgroundColor: colors.amberSoft, borderColor: colors.amber + "44" }]}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.amber} />
                    <Text style={[s.launcherDetailBoundaryText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {launcherDetailPresentation.safetyBoundary}
                    </Text>
                  </View>
                ) : null}

                <View style={s.launcherDetailActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${launcherDetailPresentation.primaryActionLabel}: ${launcherDetailAction.label}`}
                    onPress={() => {
                      const action = launcherDetailAction;
                      setLauncherDetailAction(null);
                      if (!action) return;
                      if (launcherDetailPresentation.canQuickLog) {
                        handleQuickLauncherAction(action);
                      } else {
                        focusFullComposerForLauncherAction(action);
                      }
                    }}
                    style={({ pressed }) => [
                      s.launcherDetailPrimary,
                      {
                        backgroundColor: pressed ? colors.primary + "DD" : colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text style={[s.launcherDetailPrimaryText, { color: colors.primaryForeground, fontFamily: "Inter_800ExtraBold" }]}>
                      {launcherDetailPresentation.primaryActionLabel}
                    </Text>
                    <Ionicons name="arrow-forward" size={17} color={colors.primaryForeground} />
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${launcherDetailPresentation.secondaryActionLabel}: ${launcherDetailAction.label}`}
                    onPress={() => {
                      const action = launcherDetailAction;
                      setLauncherDetailAction(null);
                      if (action && launcherDetailPresentation.secondaryActionLabel === "Open full details") {
                        focusFullComposerForLauncherAction(action);
                      }
                    }}
                    style={({ pressed }) => [
                      s.launcherDetailSecondary,
                      {
                        backgroundColor: pressed ? colors.secondary : colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[s.launcherDetailSecondaryText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {launcherDetailPresentation.secondaryActionLabel}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Entry detail modal */}
      <Modal visible={detailEntry !== null} transparent animationType="slide" onRequestClose={() => setDetailEntryId(null)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setDetailEntryId(null)}>
          <Pressable style={[s.detailSheet, { backgroundColor: colors.background, paddingBottom: modalSheetBottomPadding }]} onPress={(e) => e.stopPropagation()}>
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

                {detailEntry.syncStatus === "failed" && detailEntry.syncError ? (
                  <View style={[s.detailNotice, { backgroundColor: colors.rose + "12", borderColor: colors.rose + "44" }]}>
                    <Ionicons name="warning-outline" size={16} color={colors.rose} />
                    <Text style={[s.detailNoticeText, { color: colors.rose, fontFamily: "Inter_500Medium" }]}>{detailEntry.syncError}</Text>
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
                            accessibilityRole="button"
                            accessibilityLabel={`Update meal outcome: ${outcome.label}`}
                            accessibilityState={{ selected: active }}
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
      <Modal visible={editEntry !== null} transparent animationType="slide" onRequestClose={() => setEditEntry(null)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setEditEntry(null)}>
          <Pressable style={[s.editSheet, { backgroundColor: colors.background, paddingBottom: modalSheetBottomPadding }]} onPress={(e) => e.stopPropagation()}>
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
      <Modal visible={promptId !== null} transparent animationType="fade" onRequestClose={() => setPromptId(null)}>
        <Pressable style={[s.modalBackdrop, centeredModalPadding]} onPress={saveQuickNote}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboardOffset} style={s.modalCenter}>
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
  syncBtn: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },

  logCommandStageCard: {
    alignSelf: "stretch",
    width: "100%",
    maxWidth: "100%",
    marginTop: 3,
    marginBottom: 8,
    overflow: "hidden",
  },
  logCommandStage: {
    width: "100%",
    minHeight: 82,
    overflow: "hidden",
    padding: 7,
    justifyContent: "flex-start",
  },
  logCommandStageImage: {
    borderRadius: 8,
  },
  logCommandStageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,20,36,0.08)",
  },
  logCommandStageTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
  },
  logCommandBubble: {
    maxWidth: "68%",
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#081424",
    backgroundColor: "rgba(255,249,239,0.94)",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  logCommandKicker: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  logCommandSpeech: {
    fontSize: 10.2,
    lineHeight: 12,
    marginTop: 1,
  },
  logCommandBubbleTail: {
    position: "absolute",
    left: 26,
    bottom: -10,
    width: 16,
    height: 16,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#081424",
    backgroundColor: "rgba(255,249,239,0.94)",
    transform: [{ rotate: "45deg" }],
  },
  logCommandChip: {
    maxWidth: 90,
    flexShrink: 1,
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  logCommandChipText: {
    fontSize: 10,
    lineHeight: 13,
  },
  logCommandSprite: {
    position: "absolute",
    right: 12,
    bottom: -2,
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  logCommandSpriteShadow: {
    position: "absolute",
    bottom: 3,
    width: 58,
    height: 11,
    borderRadius: 999,
    backgroundColor: "rgba(8,20,36,0.34)",
  },
  logCommandDock: {
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "stretch",
  },
  logCommandHud: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  logCommandHudCell: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  logCommandHudLabel: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  logCommandHudValue: {
    fontSize: 13.5,
    lineHeight: 17,
    marginTop: 2,
  },
  logCommandActionRow: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },

  quickLogSupportRail: {
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
    fontSize: 9,
    letterSpacing: 1.1,
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

  launcherCard: {
    marginBottom: 12,
    padding: 10,
  },
  quickLogActionConsole: {
    gap: 8,
  },
  quickLogActionConsoleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  quickLogActionTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  quickLogActionKicker: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  quickLogActionTitle: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 2,
  },
  quickLogActionSub: {
    fontSize: 11.5,
    lineHeight: 14,
    marginTop: 1,
  },
  quickLogGuideButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  launcherTabs: {
    flexDirection: "row",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(8, 20, 36, 0.08)",
    padding: 2,
  },
  launcherTab: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  launcherTabText: { fontSize: 12 },
  launcherDoctrineRail: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  launcherDoctrineCard: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  launcherDoctrineLabel: {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  launcherDoctrineDetail: {
    fontSize: 10,
    marginTop: 1,
  },
  launcherGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  launcherTileLayout: {
    width: "31.5%",
  },
  launcherTile: {
    width: "100%",
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 8,
    position: "relative",
  },
  // Zero-height filler that squares off the last space-between grid row.
  launcherTileGhost: {
    width: "31.5%",
    height: 0,
  },
  launcherIconHalo: {
    width: 38,
    height: 38,
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
  launcherTileMode: {
    minHeight: 18,
    maxWidth: "100%",
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  launcherTileModeText: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  moodPanel: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 9,
  },
  moodDetailPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 10,
    marginBottom: 10,
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
  quickFeedback: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 11,
    gap: 10,
  },
  quickFeedbackCopy: {
    gap: 2,
  },
  quickFeedbackTitle: {
    fontSize: 13.5,
  },
  quickFeedbackSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  quickFeedbackActions: {
    flexDirection: "row",
    gap: 8,
  },
  quickFeedbackButton: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  quickFeedbackButtonText: {
    fontSize: 12.5,
  },
  aloneActivePanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    gap: 11,
    boxShadow: "0 8px 16px #0814240F",
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
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  returnInputNote: {
    flex: 1,
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
    boxShadow: "0 5px 12px #08142414",
  },
  quickLogDetailDock: {
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
  typeRow: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 6,
    paddingRight: 13,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeChipIcon: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  typeChipLabel: { fontSize: 13.5 },

  fieldBlock: { marginTop: 16 },
  fieldLabel: { fontSize: 12, letterSpacing: 0, marginBottom: 8 },
  segRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segPill: {
    minHeight: 40,
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
  searchClear: { width: 28, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
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
  launcherDetailSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 14 },
  launcherDetailTop: { flexDirection: "row", alignItems: "center", gap: 13 },
  launcherDetailIcon: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  launcherDetailKicker: { fontSize: 9, letterSpacing: 1.1 },
  launcherDetailTitle: { fontSize: 23, marginTop: 2 },
  launcherDetailSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  launcherDetailSummary: { borderWidth: 1, borderRadius: 17, padding: 13, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  launcherDetailSummaryText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  launcherDetailModeRail: {
    flexDirection: "row",
    gap: 7,
  },
  launcherDetailModeCard: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
  },
  launcherDetailModeLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  launcherDetailModeDetail: {
    fontSize: 10.5,
    marginTop: 3,
  },
  launcherDetailChecklist: { gap: 9 },
  launcherDetailChecklistRow: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  launcherDetailBullet: { width: 7, height: 7, borderRadius: 2, marginTop: 6 },
  launcherDetailChecklistText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  launcherDetailEditLater: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 11,
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
  },
  launcherDetailEditLaterText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  launcherDetailBoundary: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  launcherDetailBoundaryText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  launcherDetailActions: { gap: 10, marginTop: 2 },
  launcherDetailPrimary: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  launcherDetailPrimaryText: { fontSize: 14.5 },
  launcherDetailSecondary: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  launcherDetailSecondaryText: { fontSize: 14 },
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
    boxShadow: "0 12px 30px #0F1F3333",
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
