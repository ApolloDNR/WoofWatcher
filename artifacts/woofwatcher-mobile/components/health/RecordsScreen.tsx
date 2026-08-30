import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  buildPetCredential,
  buildCarePass,
  createCarePassArtifact,
  describeCarePassArtifactExport,
  deriveAloneTime,
  deriveCareTrends,
  deriveGroomingCare,
  deriveHealthWatch,
  deriveIncidentWatch,
  deriveMedicationAdherence,
  deriveMedicationFollowUps,
  deriveMedicationHistory,
  deriveMoodTrend,
  derivePottyHealth,
  deriveRecordReminders,
  deriveTrainingProgress,
  deriveWalkActivity,
  deriveWalkRouteTemplates,
  deriveWaterHydration,
  deriveWeightTrend,
  getCarePassArtifactPrintView,
  getPetCredentialImageView,
  getPetCredentialPrintView,
  getPetCredentialTitle,
  getRecordDueStatus,
  summarizeRecordVault,
  type CareEventType,
  type CarePassAudience,
  type CarePassArtifact,
  type MedicationHistoryOutcomeFilter,
  type RecordKind,
} from "@workspace/care-domain";
import { useAppViewport } from "@/context/AppViewportContext";
import { useAppFileSystem } from "@/context/AppFileSystemContext";
import { useCare, type Record as CareRecord } from "@/context/CareContext";
import { useActiveCurrentTime } from "@/hooks/useActiveCurrentTime";
import { useColors } from "@/hooks/useColors";
import {
  createRecordsDeepLinkController,
  decideRecordsDeepLinkRequest,
} from "@/lib/recordsDeepLink";
import {
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { PetPortrait } from "@/components/PetPortrait";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import {
  BoardCard,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
  ModalBackdropPressable,
  ModalSheetPressable,
} from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { isOwnerOpsBuild } from "@/lib/buildChannel";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import { confirmThroughSteps, notifyDialog } from "@/lib/confirmDialog";
import { homeImmersiveRoomIsNight } from "@/app/(tabs)/index";
import { pixelImageStyle, stageImageFill } from "@/lib/pixelRendering";
import type { ReportArtifactPrintableSource } from "@/lib/reportArtifactExportFile";
import {
  buildCarePassPdfArtifactSource,
  buildDogIdPngArtifactSource,
  type GeneratedBinaryArtifactSource,
} from "@/lib/reportGeneratedBinaryArtifact";
import { buildPetSummaryLine, resolvePetName } from "@/lib/petIdentity";
import {
  buildRecordsOwnerBinaryProofManifest,
  deriveRecordsOwnerProviderRuntime,
} from "@/lib/recordsOwnerProviderRuntime";
import {
  buildRecordsProgressReport,
  selectRecordsHouseholdEntries,
  selectRecordsRecentMealNotes,
} from "@/lib/recordsHouseholdPrivacy";
import { shareTextPayload } from "@/lib/shareText";
import { shareNativeFilePayload } from "@/lib/nativeFileShare";
import {
  cancelPickedMediaDraft,
  commitPickedMediaDraft,
  createPickedMediaDraft,
  isPickedMediaDraftSettlementCurrent,
  PickedMediaLocalDataActionError,
  releasePickedMediaReferences,
  runRecordAttachmentPicker,
  settlePickedMediaDraftRelease,
  stagePickedMediaDraft,
  type PickedMediaAsset,
  type PickedMediaDraft,
} from "@/lib/pickedMediaLocalDataActions";
import {
  runGeneratedRecordsFileShare,
  runPrintableRecordsFileShare,
} from "@/lib/recordsFileShareActions";
import { runDurableCarePassSaveShare } from "@/lib/recordsCarePassSaveShare";
import type { AppArtifactDestination } from "@/lib/appOwnedFileInventory";
import { collectCareAppOwnedFileReferences } from "@/lib/appOwnedFileReferences";
import { runCareFileCleanupAfterDurableSnapshot } from "@/lib/careFileCleanup";
import { createExclusiveAsyncAction } from "@/lib/exclusiveAsyncAction";
import {
  getCareCorrectionPresentation,
  mergeValidatedRecordEdit,
  orderCareItemsCorrectionsLast,
  validateRecordDueDraft,
} from "@/lib/careWorkflowValidation";
import {
  addLocalCalendarDays,
  localDateKey,
  todayLocalDateKey,
} from "@/lib/localCalendar";
import {
  CARE_READ_ONLY_MESSAGE,
  runAcceptedCareMutation,
} from "@/lib/careWriteProtection";
import type { RecordsHealthSection } from "@/lib/healthSectionRouting";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const REPORT_PRESET_REGENERATION_NOTE =
  "Report preset note: regenerated from current household-visible WoofWatcher data; not a historical snapshot.";

const RECORDS_CREDENTIAL_STAGE_ROOM = require("@/assets/avatar/rooms/phoenix-room-day-pixellab-400x300.png");
// Night sibling for the credential stage: the storybook night render of the
// same Phoenix room (identical 4:3 frame), picked with the same clock rule
// Home's immersive room uses so Records never shows daylight at night.
const RECORDS_CREDENTIAL_STAGE_ROOM_NIGHT = require("@/assets/avatar/rooms/phoenix-room-night.png");
const RECORDS_CREDENTIAL_STAGE_SPRITE = getCareTwinSpriteAsset("tail-wag");
const RECORDS_CREDENTIAL_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["tail-wag"];

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface RecordsCommandItem {
  id: string;
  icon: IoniconName;
  eyebrow: string;
  label: string;
  detail: string;
  actionLabel: string;
  tone: string;
  onPress: () => void;
  disabled?: boolean;
}

const HEALTH_ICON: Record<string, PulseIconName> = {
  vomit: "vomit",
  symptom: "vomit",
  incident: "sad",
  health: "heart",
  vet: "heart",
  mood: "sad",
  alone: "house",
  medication: "pill",
  meds: "pill",
};

const PERIODS = [
  { key: 7, label: "Week" },
  { key: 30, label: "Month" },
  { key: 90, label: "Quarter" },
] as const;

const CARE_PASS_OPTIONS: {
  audience: CarePassAudience;
  label: string;
  detail: string;
  icon: IoniconName;
}[] = [
  {
    audience: "sitter",
    label: "Sitter",
    detail: "Routine, food, next care",
    icon: "home-outline",
  },
  {
    audience: "vet",
    label: "Vet",
    detail: "Health signals, records",
    icon: "medkit-outline",
  },
  {
    audience: "trainer",
    label: "Trainer",
    detail: "Behavior, activity, focus",
    icon: "school-outline",
  },
  {
    audience: "caregiver",
    label: "Caregiver",
    detail: "Shift handoff",
    icon: "people-outline",
  },
];

const RECORD_OPTIONS: {
  kind: RecordKind;
  label: string;
  detail: string;
  icon: IoniconName;
  dueLabel: string;
}[] = [
  {
    kind: "vaccine",
    label: "Vaccine",
    detail: "Shots and boosters",
    icon: "shield-checkmark-outline",
    dueLabel: "Due date or expiry (YYYY-MM-DD)",
  },
  {
    kind: "vet",
    label: "Vet Visit",
    detail: "Visits and exam notes",
    icon: "medkit-outline",
    dueLabel: "Visit date (YYYY-MM-DD)",
  },
  {
    kind: "receipt",
    label: "Receipt",
    detail: "Bills and purchases",
    icon: "receipt-outline",
    dueLabel: "Receipt date (YYYY-MM-DD)",
  },
  {
    kind: "insurance",
    label: "Insurance",
    detail: "Policy and card details",
    icon: "card-outline",
    dueLabel: "Renewal date (YYYY-MM-DD)",
  },
  {
    kind: "microchip",
    label: "Microchip",
    detail: "Chip and registry info",
    icon: "scan-outline",
    dueLabel: "Registration date (YYYY-MM-DD)",
  },
  {
    kind: "medication",
    label: "Medication",
    detail: "Prescriptions and doses",
    icon: "bandage-outline",
    dueLabel: "Refill date (YYYY-MM-DD)",
  },
  {
    kind: "weight",
    label: "Weight",
    detail: "Weigh-ins and targets",
    icon: "scale-outline",
    dueLabel: "Weigh-in date (YYYY-MM-DD)",
  },
  {
    kind: "document",
    label: "Document",
    detail: "Certificates and files",
    icon: "document-text-outline",
    dueLabel: "Document date (YYYY-MM-DD)",
  },
];

const RECORD_DOCUMENT_PICKER_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
] as const;

const RECORD_ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  odt: "application/vnd.oasis.opendocument.text",
  pdf: "application/pdf",
  png: "image/png",
  rtf: "application/rtf",
  txt: "text/plain",
  webp: "image/webp",
};

const SUPPORTED_RECORD_ATTACHMENT_MIME_TYPES = new Set([
  ...RECORD_DOCUMENT_PICKER_TYPES,
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MEDICATION_OUTCOME_FILTERS: {
  id: MedicationHistoryOutcomeFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "taken", label: "Taken" },
  { id: "attention", label: "Needs review" },
  { id: "skipped", label: "Skipped" },
  { id: "missed", label: "Missed" },
];

function daysBetween(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 86400000;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function relativeDay(iso: string, now: number): string {
  const d = Math.floor(daysBetween(iso, now));
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return shortDate(iso);
}

function countNoun(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function sentenceCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function hasAttachment(record: unknown): boolean {
  const attachment = (record as { attachmentUri?: unknown }).attachmentUri;
  return typeof attachment === "string" && attachment.trim().length > 0;
}

function recordAttachmentExtension(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/, 1)[0] ?? "";
  return path.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase() ?? null;
}

function normalizeRecordAttachmentMimeType(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function inferRecordAttachmentMimeType(
  mimeType: string | null | undefined,
  fileNameOrUri: string | null | undefined,
): string | null {
  const normalized = normalizeRecordAttachmentMimeType(mimeType);
  if (normalized && normalized !== "application/octet-stream")
    return normalized;
  const extension = recordAttachmentExtension(fileNameOrUri);
  return extension
    ? (RECORD_ATTACHMENT_MIME_BY_EXTENSION[extension] ?? null)
    : null;
}

function validateRecordAttachment(
  asset: PickedMediaAsset,
): { ok: true; mimeType: string } | { ok: false; message: string } {
  const fileNameOrUri = asset.fileName?.trim() || asset.uri;
  const mimeType = inferRecordAttachmentMimeType(asset.mimeType, fileNameOrUri);
  if (mimeType && SUPPORTED_RECORD_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    return {
      ok: true,
      mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
    };
  }
  return {
    ok: false,
    message:
      "Choose a PDF, Word, text, RTF, CSV, OpenDocument, JPEG, PNG, HEIC, GIF, or WebP file.",
  };
}

function credentialFieldReady(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    normalized !== "not on file" &&
    normalized !== "not set" &&
    normalized !== "none"
  );
}

export interface RecordsScreenProps {
  section: RecordsHealthSection;
  entryId?: string;
  reportId?: string;
  onBack: () => void;
}

export default function RecordsScreen({
  section,
  entryId,
  reportId,
  onBack,
}: RecordsScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const appFileSystem = useAppFileSystem();
  const ownerOps = isOwnerOpsBuild();
  const {
    state,
    careMutationsBlocked,
    isLoaded,
    isSyncing,
    isInitialSyncSettled,
    initialSyncStatus,
    retryInitialSync,
    updateCareDoc,
    persistCurrentCareSnapshot,
  } = useCare();
  const careStateRef = useRef(state);
  careStateRef.current = state;
  const showCareReadOnly = () =>
    notifyDialog("Update WoofWatcher", CARE_READ_ONLY_MESSAGE);
  const { width } = useAppViewport();
  const reducedMotion = useReducedMotion();

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
  const keyboardOffset = getKeyboardAvoidingVerticalOffset({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const scrollRef = useRef<ScrollView>(null);
  const sectionAnchorYRef = useRef<
    Partial<Record<RecordsHealthSection, number>>
  >({});
  const pendingSectionRef = useRef<RecordsHealthSection | null>(null);
  const scrollToSection = useCallback(
    (target: RecordsHealthSection): boolean => {
      const anchorY = sectionAnchorYRef.current[target];
      if (anchorY == null) return false;
      // Anchors are nested inside the Animated content wrapper, so their
      // layout.y excludes the ScrollView content container's top padding.
      scrollRef.current?.scrollTo({
        y: Math.max(0, topPadding + anchorY - 8),
        animated: false,
      });
      return true;
    },
    [topPadding],
  );
  const registerSectionAnchor = useCallback(
    (target: RecordsHealthSection) => (event: LayoutChangeEvent) => {
      sectionAnchorYRef.current[target] = event.nativeEvent.layout.y;
      if (pendingSectionRef.current === target) {
        pendingSectionRef.current = null;
        requestAnimationFrame(() => scrollToSection(target));
      }
    },
    [scrollToSection],
  );
  useEffect(() => {
    pendingSectionRef.current = section;
    const frame = requestAnimationFrame(() => {
      if (pendingSectionRef.current === section && scrollToSection(section)) {
        pendingSectionRef.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollToSection, section]);
  const now = useActiveCurrentTime(60_000);
  // Time-aware credential stage: same clock rule as Home's immersive room
  // (dark theme or lamplit hours), so Records follows the household's real
  // day instead of staying frozen in daylight.
  const recordsStageIsNight =
    colors.isDark || homeImmersiveRoomIsNight(new Date(now).getHours());

  const unit = state.profile.weight.unit;

  const [period, setPeriod] = useState<number>(30);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordEditId, setRecordEditId] = useState<string | null>(null);
  const [recordType, setRecordType] = useState<RecordKind>("vaccine");
  const [recordTitle, setRecordTitle] = useState("");
  const [recordDue, setRecordDue] = useState("");
  const [recordDueError, setRecordDueError] = useState<string | null>(null);
  const [recordNote, setRecordNote] = useState("");
  const [recordAttachmentUri, setRecordAttachmentUri] = useState("");
  const [recordAttachmentName, setRecordAttachmentName] = useState("");
  const [recordAttachmentMimeType, setRecordAttachmentMimeType] = useState("");
  const recordAttachmentDraftRef = useRef<PickedMediaDraft>(
    createPickedMediaDraft(),
  );
  const recordFormOpenRef = useRef(false);
  const recordsScreenMountedRef = useRef(true);
  const deepLinkControllerRef = useRef<ReturnType<
    typeof createRecordsDeepLinkController
  > | null>(null);
  if (!deepLinkControllerRef.current) {
    deepLinkControllerRef.current = createRecordsDeepLinkController();
  }
  const deepLinkController = deepLinkControllerRef.current;
  const recordPickerInFlightRef = useRef(false);
  const recordSaveInFlightRef = useRef(false);
  const recordsShareGateRef = useRef<ReturnType<
    typeof createExclusiveAsyncAction
  > | null>(null);
  if (recordsShareGateRef.current === null) {
    recordsShareGateRef.current = createExclusiveAsyncAction();
  }
  const recordsShareGate = recordsShareGateRef.current;
  const recordFormSessionRef = useRef(0);
  const [recordPickerBusy, setRecordPickerBusy] = useState(false);
  const [recordSaveBusy, setRecordSaveBusy] = useState(false);
  const [recordsShareBusy, setRecordsShareBusy] = useState(false);
  const [carePassSaveShareBusy, setCarePassSaveShareBusy] = useState(false);
  const [carePassSaveShareNotice, setCarePassSaveShareNotice] = useState<
    string | null
  >(null);
  const [pendingCarePassArtifactId, setPendingCarePassArtifactId] = useState<
    string | null
  >(null);
  const [carePassPreviewAudience, setCarePassPreviewAudience] =
    useState<CarePassAudience | null>(null);
  const [medicationSearch, setMedicationSearch] = useState("");
  const [medicationOutcomeFilter, setMedicationOutcomeFilter] =
    useState<MedicationHistoryOutcomeFilter>("all");

  useEffect(() => {
    recordsScreenMountedRef.current = true;
    return () => {
      recordsScreenMountedRef.current = false;
      recordFormOpenRef.current = false;
      recordFormSessionRef.current += 1;
      const releaseUris = cancelPickedMediaDraft(
        recordAttachmentDraftRef.current,
      ).releaseUris;
      recordAttachmentDraftRef.current = createPickedMediaDraft();
      if (releaseUris.length > 0) {
        const protectedUris = collectCareAppOwnedFileReferences({
          doc: careStateRef.current,
          entries: careStateRef.current.entries,
        });
        void releasePickedMediaReferences({
          appFileSystem,
          uris: releaseUris,
          protectedUris,
        });
      }
    };
  }, [appFileSystem]);

  const recordOption =
    RECORD_OPTIONS.find((option) => option.kind === recordType) ??
    RECORD_OPTIONS[0];
  const recordsOwnerProviderRuntime = useMemo(
    () => deriveRecordsOwnerProviderRuntime(state.launchProviderProfile),
    [state.launchProviderProfile],
  );
  const householdEntries = useMemo(
    () => selectRecordsHouseholdEntries(state.entries, now),
    [state.entries, now],
  );

  const healthWatch = useMemo(
    () =>
      deriveHealthWatch({
        entries: householdEntries,
        routines: state.routines,
        now,
      }),
    [householdEntries, state.routines, now],
  );
  const incidentWatch = useMemo(
    () =>
      deriveIncidentWatch({ entries: householdEntries, now, lookbackDays: 90 }),
    [householdEntries, now],
  );
  const careTrends = useMemo(
    () => deriveCareTrends({ entries: householdEntries, now, windowDays: 7 }),
    [householdEntries, now],
  );
  const medicationAdherence = useMemo(
    () =>
      deriveMedicationAdherence({
        entries: householdEntries,
        routines: state.routines,
        now,
      }),
    [householdEntries, state.routines, now],
  );
  const medicationFollowUps = useMemo(
    () =>
      deriveMedicationFollowUps({
        entries: householdEntries,
        routines: state.routines,
        records: state.records,
        now,
      }).slice(0, 3),
    [householdEntries, state.routines, state.records, now],
  );
  const medicationHistory = useMemo(
    () =>
      deriveMedicationHistory({
        entries: householdEntries,
        now,
        limit: 8,
        query: medicationSearch,
        outcome: medicationOutcomeFilter,
      }),
    [householdEntries, now, medicationSearch, medicationOutcomeFilter],
  );
  const waterHydration = useMemo(
    () => deriveWaterHydration({ entries: householdEntries, now }),
    [householdEntries, now],
  );
  const walkActivity = useMemo(
    () =>
      deriveWalkActivity({
        entries: householdEntries,
        now,
        petName: state.profile.name,
      }),
    [householdEntries, now, state.profile.name],
  );
  const walkRouteTemplates = useMemo(
    () =>
      deriveWalkRouteTemplates({ entries: householdEntries, now, limit: 3 }),
    [householdEntries, now],
  );
  const pottyHealth = useMemo(
    () => derivePottyHealth({ entries: householdEntries, now }),
    [householdEntries, now],
  );
  // The shared summary says "stool normal" whenever nothing needs review, but
  // quick taps carry no stool detail at all. Until a condition or stool color
  // is actually recorded, say so instead of claiming a normal outcome.
  // (derivePottyHealth also feeds Care Pass, so this stays a display-only fix.)
  const pottyOutcomeRecorded = pottyHealth.items.some(
    (item) => item.condition !== "not logged" || Boolean(item.stoolColor),
  );
  const pottySummary =
    pottyHealth.total > 0 &&
    pottyHealth.watchCount === 0 &&
    !pottyOutcomeRecorded
      ? `${countNoun(pottyHealth.total, "potty log")} today - ${pottyHealth.peeCount} pee, ${pottyHealth.poopCount} poop, outcome not recorded`
      : pottyHealth.summary;
  const trainingProgress = useMemo(
    () =>
      deriveTrainingProgress({
        entries: householdEntries,
        now,
        lookbackDays: 30,
      }),
    [householdEntries, now],
  );
  const aloneTime = useMemo(
    () => deriveAloneTime({ entries: householdEntries, now, lookbackDays: 30 }),
    [householdEntries, now],
  );
  const groomingCare = useMemo(
    () =>
      deriveGroomingCare({ entries: householdEntries, now, lookbackDays: 45 }),
    [householdEntries, now],
  );
  const weightTrend = useMemo(
    () =>
      deriveWeightTrend({
        entries: householdEntries,
        profile: state.profile,
        goals: state.goals,
        now,
        lookbackDays: 90,
        limit: 8,
      }),
    [householdEntries, state.profile, state.goals, now],
  );
  const current = weightTrend.currentWeight;

  // ---- Weight trend (real weigh-ins only; never synthesize a series) ----
  const goalWeight = weightTrend.goalWeight;

  const { series, labels } = useMemo(() => {
    const real = weightTrend.items;
    if (real.length < 2)
      return { series: [] as number[], labels: [] as string[] };
    return {
      series: real.map((item) => item.weight),
      labels: real.map((item, i) =>
        i === real.length - 1 ? "Now" : shortDate(item.occurredAt),
      ),
    };
  }, [weightTrend.items]);
  const hasWeightSeries = series.length >= 2;

  // ---- Mood distribution (last 30 days) ----
  const moodStats = useMemo(
    () =>
      deriveMoodTrend({
        entries: householdEntries,
        now,
        lookbackDays: 30,
        limit: 3,
      }),
    [householdEntries, now],
  );

  // ---- Incident lookback ----
  const incidents = useMemo(
    () =>
      [...incidentWatch.items].sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
    [incidentWatch.items],
  );
  const incidentWindow = (days: number) =>
    incidentWatch.trend.windows.find((item) => item.days === days)?.count ?? 0;
  const incident7 = incidentWindow(7);
  const incident30 = incidentWindow(30);
  const incidentLookbackWindow =
    incidentWatch.trend.windows[incidentWatch.trend.windows.length - 1];
  const incident90 = incidentLookbackWindow?.count ?? incidentWindow(90);
  const incidentTone =
    incidentWatch.status === "review"
      ? colors.rose
      : incidentWatch.status === "watch"
        ? colors.amber
        : colors.sage;

  // ---- Progress report (period-scoped, computed from real logs) ----
  const report = useMemo(
    () => buildRecordsProgressReport(householdEntries, period, now),
    [householdEntries, period, now],
  );

  const dietHistory = useMemo(
    () => selectRecordsRecentMealNotes(householdEntries, now),
    [householdEntries, now],
  );
  const dietPrimaryFood = (state.dietProfile.primaryFood ?? "").trim();
  const dietMeta = [
    state.dietProfile.normalPortion,
    state.dietProfile.mealSchedule,
  ]
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .join(" - ");
  const hasDietOnFile = Boolean(dietPrimaryFood || dietMeta);

  const recordVault = useMemo(
    () => summarizeRecordVault(state.records),
    [state.records],
  );
  // One reminder derivation feeds both surfaces: the HUD counts every open
  // setup item exactly once (missing-critical records are already reminders,
  // so adding missingCritical on top double-counted them), while the visible
  // checklist shows the top four.
  const recordRemindersAll = useMemo(
    () => deriveRecordReminders(state.records, { now }),
    [state.records, now],
  );
  const recordReminders = useMemo(
    () => recordRemindersAll.slice(0, 4),
    [recordRemindersAll],
  );
  const credential = useMemo(
    () =>
      // Resolve the placeholder profile name first so shares, exports, and the
      // ID card all use the real name or neutral fallback, never "My Dog Dog ID".
      buildPetCredential({
        profile: { ...state.profile, name: resolvePetName(state.profile.name) },
        caregivers: state.caregivers,
        records: state.records,
      }),
    [state.profile, state.caregivers, state.records],
  );
  const credentialImageView = useMemo(
    () => getPetCredentialImageView(credential),
    [credential],
  );
  const credentialTitle = getPetCredentialTitle(credential.name);
  const credentialPngArtifactSource = useMemo(
    () =>
      ownerOps
        ? buildDogIdPngArtifactSource({
            fileName: credentialImageView.fileName,
            title: credentialTitle,
            lines: [
              `Breed: ${credential.breed}`,
              `Weight: ${credential.weight}`,
              `Care focus: ${credential.careFocus}`,
              `Primary vet: ${credential.primaryVet}`,
              `Emergency: ${credential.emergencyContact}`,
              `Microchip: ${credential.microchip}`,
              `Insurance: ${credential.insurance}`,
            ],
          })
        : null,
    [
      credential.breed,
      credential.careFocus,
      credential.emergencyContact,
      credential.insurance,
      credential.microchip,
      credential.name,
      credentialTitle,
      credential.primaryVet,
      credential.weight,
      credentialImageView.fileName,
      ownerOps,
    ],
  );

  const buildCredentialPngSource = () =>
    credentialPngArtifactSource ??
    buildDogIdPngArtifactSource({
      fileName: credentialImageView.fileName,
      title: credentialTitle,
      lines: [
        `Breed: ${credential.breed}`,
        `Weight: ${credential.weight}`,
        `Care focus: ${credential.careFocus}`,
        `Primary vet: ${credential.primaryVet}`,
        `Emergency: ${credential.emergencyContact}`,
        `Microchip: ${credential.microchip}`,
        `Insurance: ${credential.insurance}`,
      ],
    });

  const carePickedMediaUris = (excludeRecordId?: string): string[] =>
    collectCareAppOwnedFileReferences({
      doc: careStateRef.current,
      entries: careStateRef.current.entries,
      excludeRecordIds: excludeRecordId ? [excludeRecordId] : [],
    });

  const reportPickedMediaCleanupFailure = (count: number) => {
    if (!recordsScreenMountedRef.current || count <= 0) return;
    notifyDialog(
      "Local file cleanup incomplete",
      `The record change is complete, but ${count} saved attachment${count === 1 ? "" : "s"} could not be removed from this device. Privacy & Data reset will try again.`,
    );
  };

  const closeRecordForm = async () => {
    if (recordSaveInFlightRef.current || !recordFormOpenRef.current) return;
    recordFormOpenRef.current = false;
    const closedSession = ++recordFormSessionRef.current;
    setRecordOpen(false);
    const releaseUris = cancelPickedMediaDraft(
      recordAttachmentDraftRef.current,
    ).releaseUris;
    recordAttachmentDraftRef.current = createPickedMediaDraft();
    const cleanup = await releasePickedMediaReferences({
      appFileSystem,
      uris: releaseUris,
      protectedUris: carePickedMediaUris(),
    });
    if (
      cleanup.status === "partial-failure" &&
      recordsScreenMountedRef.current &&
      !recordFormOpenRef.current &&
      recordFormSessionRef.current === closedSession
    ) {
      const count = cleanup.failedUris.length;
      notifyDialog(
        "Draft file cleanup incomplete",
        `${count} temporary attachment${count === 1 ? "" : "s"} from the canceled record could not be removed from this device. No record was saved. Privacy & Data reset will try cleanup again.`,
      );
    }
  };

  const openRecordForm = (kind: RecordKind = "vaccine") => {
    if (recordSaveInFlightRef.current) return;
    recordFormSessionRef.current += 1;
    setRecordEditId(null);
    setRecordType(kind);
    setRecordTitle("");
    setRecordDue("");
    setRecordDueError(null);
    setRecordNote("");
    setRecordAttachmentUri("");
    setRecordAttachmentName("");
    setRecordAttachmentMimeType("");
    recordAttachmentDraftRef.current = createPickedMediaDraft();
    recordFormOpenRef.current = true;
    setRecordOpen(true);
    Haptics.selectionAsync();
  };

  const openEditRecord = (record: CareRecord) => {
    if (recordSaveInFlightRef.current) return;
    recordFormSessionRef.current += 1;
    const dueCorrection = getCareCorrectionPresentation(record, "due");
    setRecordEditId(record.id);
    setRecordType(record.type as RecordKind);
    setRecordTitle(record.title);
    setRecordDue(
      dueCorrection?.preservedValue ??
        (typeof record.due === "string" ? record.due : ""),
    );
    setRecordDueError(null);
    setRecordNote(record.note);
    setRecordAttachmentUri(record.attachmentUri ?? "");
    setRecordAttachmentName(record.attachmentName ?? "");
    setRecordAttachmentMimeType(
      inferRecordAttachmentMimeType(
        record.attachmentMimeType,
        record.attachmentName ?? record.attachmentUri,
      ) ?? "",
    );
    recordAttachmentDraftRef.current = createPickedMediaDraft(
      record.attachmentUri,
    );
    recordFormOpenRef.current = true;
    setRecordOpen(true);
    Haptics.selectionAsync();
  };

  // Stage checklist button: opens the add-record form on the first missing
  // critical section so the "Checklist" state always has a real next step.
  const openRecordsChecklist = () => {
    const missingKind = recordVault.sections.find(
      (section) => section.label === recordVault.missingCritical[0],
    )?.kind;
    openRecordForm(missingKind ?? "document");
  };

  const pickRecordAttachment = async (source: "photo" | "document") => {
    if (recordPickerInFlightRef.current || recordSaveInFlightRef.current)
      return;
    recordPickerInFlightRef.current = true;
    setRecordPickerBusy(true);
    const formSession = recordFormSessionRef.current;
    const draftBeforePick = recordAttachmentDraftRef.current;
    let rejectedAttachmentMessage: string | null = null;
    try {
      const action = await runRecordAttachmentPicker({
        appFileSystem,
        preserveUris: [
          draftBeforePick.originalUri,
          ...draftBeforePick.stagedUris,
        ],
        pick: async () => {
          let asset: PickedMediaAsset | null = null;
          if (source === "photo") {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.8,
              allowsEditing: false,
            });
            if (!result.canceled && result.assets[0]) {
              asset = {
                uri: result.assets[0].uri,
                fileName: result.assets[0].fileName,
                mimeType: result.assets[0].mimeType,
              };
            }
          } else {
            const result = await DocumentPicker.getDocumentAsync({
              type: [...RECORD_DOCUMENT_PICKER_TYPES],
              copyToCacheDirectory: true,
              multiple: false,
            });
            if (!result.canceled && result.assets[0]) {
              asset = {
                uri: result.assets[0].uri,
                fileName: result.assets[0].name,
                mimeType: result.assets[0].mimeType,
              };
            }
          }
          if (!asset) return { canceled: true as const, assets: null };
          const validation = validateRecordAttachment(asset);
          if (!validation.ok) {
            rejectedAttachmentMessage = validation.message;
            return { canceled: true as const, assets: null };
          }
          return {
            canceled: false as const,
            assets: [{ ...asset, mimeType: validation.mimeType }],
          };
        },
        apply: ({ asset, uri }) => {
          if (
            !recordsScreenMountedRef.current ||
            !recordFormOpenRef.current ||
            recordFormSessionRef.current !== formSession
          ) {
            return false;
          }
          const staged = stagePickedMediaDraft(
            recordAttachmentDraftRef.current,
            uri,
          );
          recordAttachmentDraftRef.current = staged.draft;
          setRecordAttachmentUri(uri);
          setRecordAttachmentName(
            asset.fileName?.trim() ||
              uri.split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] ||
              `${recordOption.label} attachment`,
          );
          setRecordAttachmentMimeType(asset.mimeType?.trim() ?? "");
          return true;
        },
      });
      if (
        !recordsScreenMountedRef.current ||
        !recordFormOpenRef.current ||
        recordFormSessionRef.current !== formSession
      )
        return;
      if (rejectedAttachmentMessage) {
        notifyDialog("Unsupported attachment", rejectedAttachmentMessage);
      } else if (action.status === "not-saved") {
        notifyDialog(
          "Attachment not saved",
          action.cleanupFailed
            ? "WoofWatcher could not save that file, and its temporary picker copy could not be removed. No record attachment was added. Privacy & Data reset will retry cleanup."
            : "WoofWatcher could not save that file on this device. No record attachment was added. Try again or choose another file.",
        );
      } else if (action.status === "rejected" && action.cleanupFailed) {
        reportPickedMediaCleanupFailure(1);
      } else if (action.status === "applied") {
        const draft = recordAttachmentDraftRef.current;
        const supersededUris = draft.stagedUris.filter(
          (uri) => uri !== draft.selectedUri,
        );
        const cleanup = await releasePickedMediaReferences({
          appFileSystem,
          uris: supersededUris,
          protectedUris: [
            draft.originalUri,
            draft.selectedUri,
            ...carePickedMediaUris(),
          ],
        });
        if (
          cleanup.status !== "revoked" &&
          isPickedMediaDraftSettlementCurrent({
            mounted: recordsScreenMountedRef.current,
            formOpen: recordFormOpenRef.current,
            currentSession: recordFormSessionRef.current,
            operationSession: formSession,
            currentDraft: recordAttachmentDraftRef.current,
            operationDraft: draft,
          })
        ) {
          recordAttachmentDraftRef.current = settlePickedMediaDraftRelease(
            draft,
            cleanup.releasedUris,
          );
          if (cleanup.status === "partial-failure") {
            reportPickedMediaCleanupFailure(cleanup.failedUris.length);
          }
        }
      }
    } catch (error) {
      if (
        !recordsScreenMountedRef.current ||
        !recordFormOpenRef.current ||
        recordFormSessionRef.current !== formSession
      )
        return;
      notifyDialog(
        "Attachment unavailable",
        error instanceof PickedMediaLocalDataActionError && error.cleanupFailed
          ? "The attachment was not added, and one temporary local file could not be removed. Privacy & Data reset will retry cleanup."
          : "Try again or choose another supported photo or document.",
      );
    } finally {
      recordPickerInFlightRef.current = false;
      if (recordsScreenMountedRef.current) setRecordPickerBusy(false);
    }
  };

  const saveRecord = () => {
    if (recordSaveInFlightRef.current || recordPickerInFlightRef.current)
      return;
    const title = recordTitle.trim();
    if (!title) {
      notifyDialog(
        "Add a title",
        `Name this ${recordOption.label.toLowerCase()} record.`,
      );
      return;
    }
    const dueValidation = validateRecordDueDraft(recordDue);
    if (!dueValidation.ok) {
      setRecordDueError(dueValidation.message);
      return;
    }
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    recordSaveInFlightRef.current = true;
    setRecordSaveBusy(true);
    setRecordDueError(null);
    const id =
      recordEditId ??
      `record_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const draft: CareRecord = {
      id,
      type: recordType,
      title,
      due: dueValidation.value,
      note: recordNote.trim(),
      ...(recordAttachmentUri
        ? {
            attachmentUri: recordAttachmentUri,
            attachmentName:
              recordAttachmentName || `${recordOption.label} attachment`,
            ...(recordAttachmentMimeType
              ? { attachmentMimeType: recordAttachmentMimeType }
              : {}),
          }
        : {}),
    };
    const updated = updateCareDoc((doc) => ({
      ...doc,
      records: recordEditId
        ? doc.records.map((record) =>
            record.id === recordEditId
              ? {
                  ...mergeValidatedRecordEdit(record, draft),
                  ...(draft.attachmentMimeType
                    ? { attachmentMimeType: draft.attachmentMimeType }
                    : {}),
                }
              : record,
          )
        : [...doc.records, draft],
    }));
    const accepted = runAcceptedCareMutation(updated, () => {
      const cleanupPlan = commitPickedMediaDraft(
        recordAttachmentDraftRef.current,
      );
      recordAttachmentDraftRef.current = createPickedMediaDraft(
        cleanupPlan.retainedUri,
      );
      recordFormOpenRef.current = false;
      recordFormSessionRef.current += 1;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setRecordOpen(false);
      void runCareFileCleanupAfterDurableSnapshot({
        persistSnapshot: persistCurrentCareSnapshot,
        cleanup: () =>
          releasePickedMediaReferences({
            appFileSystem,
            uris: cleanupPlan.releaseUris,
            protectedUris: carePickedMediaUris(recordEditId ?? undefined),
          }),
      })
        .then((result) => {
          if (!recordsScreenMountedRef.current) return;
          if (result.status === "snapshot-not-confirmed") {
            notifyDialog(
              "Previous file retained",
              "WoofWatcher could not confirm the record change in device storage, so it kept the previous local attachment. The updated record is still shown for this session; try saving again before relaunching.",
            );
          } else if (result.cleanup.status === "partial-failure") {
            reportPickedMediaCleanupFailure(result.cleanup.failedUris.length);
          }
        })
        .finally(() => {
          recordSaveInFlightRef.current = false;
          if (recordsScreenMountedRef.current) setRecordSaveBusy(false);
        });
    });
    if (!accepted) {
      recordSaveInFlightRef.current = false;
      setRecordSaveBusy(false);
      showCareReadOnly();
    }
  };

  const deleteRecord = (id: string | undefined, title: string) => {
    if (!id) return;
    confirmThroughSteps(
      [
        {
          title: "Delete record",
          message: `Remove "${title}" from ${resolvePetName(state.profile.name)}'s vault?`,
          confirmLabel: "Delete",
          destructive: true,
        },
      ],
      async () => {
        if (careMutationsBlocked) {
          showCareReadOnly();
          return;
        }
        const record = careStateRef.current.records.find(
          (candidate) => candidate.id === id,
        );
        const updated = updateCareDoc((doc) => ({
          ...doc,
          records: doc.records.filter((record) => record.id !== id),
        }));
        const accepted = runAcceptedCareMutation(updated, () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        });
        if (!accepted) showCareReadOnly();
        if (!accepted) return;
        const result = await runCareFileCleanupAfterDurableSnapshot({
          persistSnapshot: persistCurrentCareSnapshot,
          cleanup: () =>
            releasePickedMediaReferences({
              appFileSystem,
              uris: [record?.attachmentUri],
              protectedUris: carePickedMediaUris(id),
            }),
        });
        if (!recordsScreenMountedRef.current) return;
        if (result.status === "snapshot-not-confirmed") {
          notifyDialog(
            "Attachment retained",
            "The record was removed from this session, but WoofWatcher could not confirm that change in device storage. Its local attachment was kept so a relaunch cannot restore a record with a missing file.",
          );
        } else if (result.cleanup.status === "partial-failure") {
          reportPickedMediaCleanupFailure(result.cleanup.failedUris.length);
        }
      },
    );
  };

  const removeRecordAttachment = (record: CareRecord) => {
    if (!record.attachmentUri) return;
    confirmThroughSteps(
      [
        {
          title: "Remove attachment",
          message: `Remove the device-only attachment from "${record.title}"? The record and its notes will stay in the vault.`,
          confirmLabel: "Remove attachment",
          destructive: true,
        },
      ],
      async () => {
        if (careMutationsBlocked) {
          showCareReadOnly();
          return;
        }
        const uri = record.attachmentUri;
        const updated = updateCareDoc((doc) => ({
          ...doc,
          records: doc.records.map((candidate) => {
            if (candidate.id !== record.id) return candidate;
            const {
              attachmentUri: _attachmentUri,
              attachmentName: _attachmentName,
              attachmentMimeType: _attachmentMimeType,
              ...withoutAttachment
            } = candidate;
            return withoutAttachment;
          }),
        }));
        const accepted = runAcceptedCareMutation(updated, () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        });
        if (!accepted) {
          showCareReadOnly();
          return;
        }
        const result = await runCareFileCleanupAfterDurableSnapshot({
          persistSnapshot: persistCurrentCareSnapshot,
          cleanup: () =>
            releasePickedMediaReferences({
              appFileSystem,
              uris: [uri],
              protectedUris: carePickedMediaUris(record.id),
            }),
        });
        if (!recordsScreenMountedRef.current) return;
        if (result.status === "snapshot-not-confirmed") {
          notifyDialog(
            "Attachment retained for safety",
            "WoofWatcher removed the attachment from this session but could not confirm the record change in device storage, so the local file was kept. Try again before relaunching.",
          );
        } else if (result.cleanup.status === "partial-failure") {
          reportPickedMediaCleanupFailure(result.cleanup.failedUris.length);
        }
      },
    );
  };

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Month";

  const runRecordsShare = async <T,>(work: () => Promise<T>) =>
    await recordsShareGate.run(async () => {
      if (recordsScreenMountedRef.current) setRecordsShareBusy(true);
      try {
        return await work();
      } finally {
        if (recordsScreenMountedRef.current) setRecordsShareBusy(false);
      }
    });

  const openOrShareRecordAttachment = async (record: CareRecord) =>
    await runRecordsShare(async () => {
      const uri = record.attachmentUri?.trim();
      if (!uri) return;
      const availability = await appFileSystem.inspect(uri);
      if (availability === "missing") {
        notifyDialog(
          "Attachment missing",
          "This device no longer has the saved file. Remove the attachment reference and choose the file again.",
        );
        return;
      }
      try {
        if (Platform.OS === "web") {
          const canOpen = await Linking.canOpenURL(uri);
          if (!canOpen)
            throw new Error("The browser cannot open this local file.");
          await Linking.openURL(uri);
          return;
        }
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error("File sharing is unavailable on this device.");
        }
        await Sharing.shareAsync(uri, {
          dialogTitle: `Open or share ${record.attachmentName?.trim() || record.title}`,
          ...(record.attachmentMimeType
            ? { mimeType: record.attachmentMimeType }
            : {}),
        });
      } catch {
        notifyDialog(
          "Attachment unavailable",
          "WoofWatcher could not open the saved file on this device. Try again or choose the file again from the record editor.",
        );
      }
    });

  const shareReport = async () =>
    await runRecordsShare(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const lines = [
        `WOOFWATCHER PROGRESS REPORT - Last ${period} days`,
        buildPetSummaryLine(state.profile.name, state.profile.breed),
        "",
        `Total entries logged: ${report.total}`,
        `Meals: ${report.meals}`,
        `Walks: ${report.walks} (${report.walkMinutes} min)`,
        `Play & training: ${report.play}`,
        `Potty breaks: ${report.potty}`,
        `Treats: ${report.treats}`,
        `Health incidents: ${report.incidents}`,
        report.topCaregiver
          ? `Most active caregiver: ${report.topCaregiver.name} (${report.topCaregiver.count})`
          : "",
        "",
        current > 0
          ? `Current weight: ${current} ${unit}${goalWeight > 0 ? ` (goal ${goalWeight} ${unit})` : ""}`
          : "",
        moodStats.total
          ? `Mood average: ${moodStats.averageScore.toFixed(1)}/5 over ${moodStats.total} check-ins`
          : "",
        "",
        "Shared from WoofWatcher - patterns for caregiver & vet review.",
      ]
        .filter(Boolean)
        .join("\n");
      await shareTextPayload({
        message: lines,
        title: `${resolvePetName(state.profile.name)} - ${periodLabel} report`,
      });
    });

  const shareCredential = async () =>
    await runRecordsShare(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await shareTextPayload({
        message: credential.message,
        title: credentialTitle,
      });
    });

  const sharePrintableSourceFile = async (
    printable: ReportArtifactPrintableSource,
    options: {
      destination: AppArtifactDestination;
      printableLabel?: string;
      title: string;
    },
  ) => {
    await runPrintableRecordsFileShare({
      appFileSystem,
      destination: options.destination,
      printable,
      printableLabel: options.printableLabel,
      title: options.title,
      shareNative: shareNativeFilePayload,
      shareText: shareTextPayload,
    });
  };

  const shareGeneratedBinaryArtifactFile = async (
    source: GeneratedBinaryArtifactSource,
    options: { destination: AppArtifactDestination; title: string },
  ) => {
    await runGeneratedRecordsFileShare({
      appFileSystem,
      destination: options.destination,
      source,
      title: options.title,
      shareNative: shareNativeFilePayload,
      shareText: shareTextPayload,
    });
  };

  const sharePrintableCredential = async () =>
    await runRecordsShare(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const printable = getPetCredentialPrintView(credential);
      await sharePrintableSourceFile(
        {
          ...printable,
          fallbackText: credential.message,
        },
        {
          destination: "credentials",
          printableLabel: "Dog ID credential source",
          title: credentialTitle,
        },
      );
    });

  const shareCredentialImageSource = async () =>
    await runRecordsShare(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await sharePrintableSourceFile(
        {
          fileName: credentialImageView.fileName,
          html: credentialImageView.svg,
          fallbackText: credential.message,
          mimeType: credentialImageView.mimeType,
          formatLabel: credentialImageView.formatLabel,
          boundary: credentialImageView.boundary,
        },
        {
          destination: "credentials",
          printableLabel: "Dog ID SVG image source",
          title: credentialTitle,
        },
      );
    });

  const shareCredentialPngArtifact = async () =>
    await runRecordsShare(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await shareGeneratedBinaryArtifactFile(buildCredentialPngSource(), {
        destination: "credentials",
        title: credentialTitle,
      });
    });

  const buildCarePassFor = (audience: CarePassAudience) =>
    buildCarePass({
      audience,
      profile: state.profile,
      dietProfile: state.dietProfile,
      entries: householdEntries,
      routines: state.routines,
      caregivers: state.caregivers,
      records: state.records,
      goals: state.goals,
      now,
    });

  const buildCurrentCarePassArtifact = (artifact: CarePassArtifact) => {
    const currentPass = buildCarePassFor(artifact.audience);
    return createCarePassArtifact(
      {
        ...currentPass,
        message: `${currentPass.message}\n\n${REPORT_PRESET_REGENERATION_NOTE}`,
        sections: [
          ...currentPass.sections,
          {
            title: "Report preset disclosure",
            lines: [REPORT_PRESET_REGENERATION_NOTE],
          },
        ],
      },
      artifact.createdAt,
    );
  };
  const carePassPreview = carePassPreviewAudience
    ? buildCarePassFor(carePassPreviewAudience)
    : null;

  const openCarePassPreview = (audience: CarePassAudience) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCarePassPreviewAudience(audience);
  };

  const openIncidentFollowUp = (
    route: "log-incident" | "review-latest" | "trainer-care-pass",
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (route === "trainer-care-pass") {
      setCarePassPreviewAudience("trainer");
      return;
    }
    if (route === "review-latest" && incidentWatch.latest?.id) {
      router.push(
        `/log?entry=${encodeURIComponent(incidentWatch.latest.id)}` as never,
      );
      return;
    }
    router.push(`/log?type=incident&detail=1&intent=${Date.now()}` as never);
  };

  const reportArtifacts = useMemo(
    () =>
      [...state.reportArtifacts]
        .filter((artifact) => artifact.id !== pendingCarePassArtifactId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5)
        .map((artifact) => buildCurrentCarePassArtifact(artifact)),
    [
      householdEntries,
      now,
      pendingCarePassArtifactId,
      state.caregivers,
      state.dietProfile,
      state.goals,
      state.profile,
      state.records,
      state.reportArtifacts,
      state.routines,
    ],
  );

  const updateReportArtifacts = (
    updater: (artifacts: CarePassArtifact[]) => CarePassArtifact[],
  ): boolean => {
    const updated = updateCareDoc((doc) => ({
      ...doc,
      reportArtifacts: updater(doc.reportArtifacts),
    }));
    return runAcceptedCareMutation(updated, () => {});
  };

  const shareCarePass = async (audience: CarePassAudience) => {
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    await runRecordsShare(async () => {
      const pass = buildCarePassFor(audience);
      const artifact = createCarePassArtifact(pass);
      if (recordsScreenMountedRef.current) {
        setCarePassSaveShareBusy(true);
        setCarePassSaveShareNotice(null);
        setPendingCarePassArtifactId(artifact.id);
      }
      let keepPendingArtifactHidden = false;
      try {
        const result = await runDurableCarePassSaveShare({
          save: () =>
            updateReportArtifacts((artifacts) =>
              [
                artifact,
                ...artifacts.filter((item) => item.id !== artifact.id),
              ].slice(0, 12),
            ),
          persist: persistCurrentCareSnapshot,
          rollback: () =>
            updateReportArtifacts((artifacts) =>
              artifacts.filter((item) => item.id !== artifact.id),
            ),
          persistRollback: persistCurrentCareSnapshot,
          share: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            return await shareTextPayload(
              {
                message: `${pass.message}\n\n${REPORT_PRESET_REGENERATION_NOTE}`,
                title: pass.title,
              },
              { notifyOnFailure: false },
            );
          },
        });
        if (!recordsScreenMountedRef.current) return;
        if (result.status === "shared") {
          setCarePassSaveShareNotice(
            "Saved as a current-data preset. Share handoff completed.",
          );
          setCarePassPreviewAudience(null);
          return;
        }
        if (result.status === "saved-not-shared") {
          setCarePassSaveShareNotice(
            result.outcome === "dismissed"
              ? "Saved as a current-data preset. Sharing was canceled."
              : "Saved as a current-data preset, but the share sheet could not open. Use Share under Saved Report Presets to try again.",
          );
          setCarePassPreviewAudience(null);
          return;
        }
        if (result.reason === "mutation-rejected") {
          showCareReadOnly();
          setCarePassSaveShareNotice(
            "Not saved or shared because Records is read-only right now.",
          );
          return;
        }
        if (result.rollback === "durable-complete") {
          setCarePassSaveShareNotice(
            "Not saved or shared. WoofWatcher confirmed the pending preset was removed from device storage.",
          );
          return;
        }
        keepPendingArtifactHidden =
          result.rollbackReason === "mutation-rejected";
        setCarePassSaveShareNotice(
          result.rollbackReason === "mutation-rejected"
            ? "Not shared. Device storage was not confirmed, and the pending preset could not be removed from this session. It remains hidden here; relaunch may restore it. Do not treat it as saved or deleted."
            : "Not shared. The pending preset was removed from this session, but WoofWatcher could not confirm that removal in device storage. Relaunch may restore it. Do not treat it as deleted or safely saved.",
        );
      } finally {
        if (recordsScreenMountedRef.current) {
          setCarePassSaveShareBusy(false);
          if (!keepPendingArtifactHidden) setPendingCarePassArtifactId(null);
        }
      }
    });
  };

  const shareReportArtifact = async (artifact: CarePassArtifact) =>
    await runRecordsShare(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const currentArtifact = buildCurrentCarePassArtifact(artifact);
      await shareTextPayload({
        message: currentArtifact.message,
        title: currentArtifact.title,
      });
    });

  const sharePrintableReportArtifact = async (artifact: CarePassArtifact) =>
    await runRecordsShare(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const currentArtifact = buildCurrentCarePassArtifact(artifact);
      const printable = getCarePassArtifactPrintView(currentArtifact);
      await sharePrintableSourceFile(
        {
          ...printable,
          fallbackText: currentArtifact.message,
          boundary:
            "This action shares printable HTML source. The file stays inside WoofWatcher unless you share it; WoofWatcher cloud backup is not included.",
        },
        {
          destination: "reports",
          title: currentArtifact.title,
        },
      );
    });

  const shareGeneratedCarePassPdfArtifact = async (
    artifact: CarePassArtifact,
  ) =>
    await runRecordsShare(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const currentArtifact = buildCurrentCarePassArtifact(artifact);
      const printable = getCarePassArtifactPrintView(currentArtifact);
      const source = buildCarePassPdfArtifactSource({
        fileName: printable.fileName,
        title: currentArtifact.title,
        summary: currentArtifact.summary,
        message: currentArtifact.message,
      });
      await shareGeneratedBinaryArtifactFile(source, {
        destination: "reports",
        title: currentArtifact.title,
      });
    });

  const openRecordsFileProofMission = () => {
    Haptics.selectionAsync();
    router.push("/care-twin-qa?qaSurface=records-local-file-handoff" as never);
  };

  const openReportBinaryExportProofMission = () => {
    Haptics.selectionAsync();
    router.push("/care-twin-qa?qaSurface=report-binary-export-proof" as never);
  };

  // Resolve one canonical Records target at a time. Entry wins when a crafted
  // route includes both identifiers, and an absent target stays pending until
  // CareProvider proves local hydration and the current auth cycle's first
  // signed-in refresh. An unavailable notice is not consumption: a later
  // successful refresh can still supply and open the same target.
  useEffect(() => {
    const action = deepLinkController.next(
      decideRecordsDeepLinkRequest({
        entryId,
        reportId,
        isLoaded,
        isSyncing,
        isInitialSyncSettled,
        entryIds: householdEntries.map((entry) => entry.id),
        reportIds: state.reportArtifacts.map((artifact) => artifact.id),
      }),
    );
    if (!action) return;

    if (action.kind === "open-entry") {
      const matchingEntry = householdEntries.find(
        (entry) => entry.id === action.id,
      );
      if (matchingEntry) {
        Haptics.selectionAsync().catch(() => {});
        // Consume the Records deep link while opening Log's canonical entry
        // detail. Replace avoids a Back loop that would remount this same
        // identifier and immediately open it again.
        router.replace({ pathname: "/log", params: { entry: action.id } });
      }
      return;
    }

    if (action.kind === "unavailable-entry") {
      notifyDialog(
        "Record entry unavailable",
        "That care entry is no longer in household-visible Records. It may have been removed or made private.",
      );
      return;
    }

    if (action.kind === "open-report") {
      const matchingReport = state.reportArtifacts.find(
        (artifact) => artifact.id === action.id,
      );
      if (matchingReport) {
        Haptics.selectionAsync().catch(() => {});
        setCarePassPreviewAudience(matchingReport.audience);
      }
      return;
    }

    notifyDialog(
      "Report preset unavailable",
      "That saved report preset is no longer in Records. Choose a current Care Pass audience or save a new preset.",
    );
  }, [
    entryId,
    householdEntries,
    isInitialSyncSettled,
    isLoaded,
    isSyncing,
    deepLinkController,
    reportId,
    router,
    state.reportArtifacts,
  ]);

  // Chart geometry
  const H_PAD = 16;
  const cardPad = 18;
  const chartW = width - H_PAD * 2 - cardPad * 2;
  const chartH = 140;
  const padL = 6;
  const padR = 6;
  const padT = 12;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const allVals = goalWeight > 0 ? [...series, goalWeight] : series;
  const minV = allVals.length ? Math.min(...allVals) - 0.6 : 0;
  const maxV = allVals.length ? Math.max(...allVals) + 0.6 : 1;
  const xAt = (i: number) =>
    padL + (i / Math.max(1, series.length - 1)) * plotW;
  const yAt = (v: number) =>
    padT + (1 - (v - minV) / (maxV - minV || 1)) * plotH;
  const linePath = series
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`,
    )
    .join(" ");
  const areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  const goalY = yAt(goalWeight);
  // Goal-distance math only exists once a real current weight and a real goal
  // are on file (the lib already returns 0 when no goal is set).
  const remaining = current > 0 ? weightTrend.remainingToGoal : 0;
  const firstChartWeight = series[0] ?? 0;
  const latestChartWeight = series[series.length - 1] ?? current;
  const chartWeightDelta = Math.abs(latestChartWeight - firstChartWeight);
  const formatChartWeight = (value: number) =>
    Number(value.toFixed(1)).toString();
  const weightChartDirection =
    chartWeightDelta < 0.05
      ? "no change"
      : `${latestChartWeight > firstChartWeight ? "up" : "down"} ${formatChartWeight(chartWeightDelta)} ${unit}`;
  const weightChartAccessibilityLabel = `Weight trend chart for the last 90 days. ${series.length} weigh-ins from ${formatChartWeight(firstChartWeight)} ${unit} to ${formatChartWeight(latestChartWeight)} ${unit}, ${weightChartDirection}.${goalWeight > 0 ? ` Goal ${formatChartWeight(goalWeight)} ${unit}.` : " No goal set."}`;
  const maxBar = Math.max(1, ...moodStats.bars.map((b) => b.count));
  const incidentMax = Math.max(1, incident7, incident30, incident90);

  const streak = useMemo(() => {
    const days = new Set(
      householdEntries.flatMap((entry) => {
        const occurredAt = new Date(entry.occurredAt);
        return Number.isFinite(occurredAt.getTime())
          ? [localDateKey(occurredAt)]
          : [];
      }),
    );
    let s = 0;
    let key = todayLocalDateKey(new Date(now));
    for (let i = 0; i < 365; i++) {
      if (!days.has(key)) break;
      s++;
      key = addLocalCalendarDays(key, -1);
    }
    return s;
  }, [householdEntries, now]);

  const lastIncidentDays = useMemo(() => {
    if (incidents.length === 0) return null;
    return Math.floor(daysBetween(incidents[0].occurredAt, now));
  }, [incidents, now]);

  // `icon` tints the stat chip; `pixelIcon` (when set) overrides the glyph with
  // a shared pixel-art icon. Potty reads as the same green "pee" leaf used on
  // every care timeline (its "heart" tint just keeps the chip green); the blue
  // "drop" glyph stays reserved for Water.
  const reportStats: {
    icon: PulseIconName;
    pixelIcon?: PixelIconName;
    label: string;
    value: string;
  }[] = [
    { icon: "bowl", label: "Meals", value: String(report.meals) },
    {
      icon: "paw",
      label: "Walks",
      value: `${report.walks} - ${report.walkMinutes}m`,
    },
    { icon: "candy", label: "Play & train", value: String(report.play) },
    {
      icon: "heart",
      pixelIcon: "pee",
      label: "Potty",
      value: String(report.potty),
    },
    { icon: "bone", label: "Treats", value: String(report.treats) },
    { icon: "vomit", label: "Incidents", value: String(report.incidents) },
  ];
  const trendSignals = careTrends.signals.slice(0, 3);
  const walkMinutes = careTrends.current.walks.totalMinutes;
  const mealCompletion = careTrends.current.meals.completionPercent;
  const mealPendingOutcomes = careTrends.current.meals.pending;

  const recordSections = recordVault.sections.filter((section) =>
    [
      "vaccine",
      "vet",
      "receipt",
      "insurance",
      "microchip",
      "document",
    ].includes(section.kind),
  );
  const recordList = orderCareItemsCorrectionsLast(
    recordVault.priorityRecords,
    (record) => getCareCorrectionPresentation(record, "due") !== null,
  );
  const filedRecordSections = recordSections.filter(
    (section) => section.count > 0,
  ).length;
  // One readiness number per measure, each verifiable on this screen:
  // - Vault readiness is filed-section coverage, matching the Record Vault
  //   grid below; the stage HUD and the Vault Command pill show this same
  //   value from this same variable.
  // - Dog ID readiness is "N of M ID fields" from the same credential that
  //   renders the ID card, and it is worded as ID fields so it can never
  //   read as a second, contradicting vault percent. (The old blended
  //   65/35 score put "Vault 5%" beside "14% ready" with no visible source
  //   for either number.)
  const recordsVaultScore = Math.round(
    (filedRecordSections / Math.max(1, recordSections.length)) * 100,
  );
  const credentialReadyFields = [
    credential.breed,
    credential.weight,
    credential.microchip,
    credential.insurance,
    credential.primaryVet,
    credential.emergencyContact,
    credential.vaccines,
  ].filter(credentialFieldReady).length;
  const credentialFieldTotal = 7;
  // Missing records for a fresh vault are setup suggestions, not emergencies:
  // keep the chip and HUD wording calm while the counts stay real.
  const recordsVaultStatus =
    recordVault.missingCritical.length > 0
      ? "Checklist"
      : recordReminders.length > 0
        ? "Review soon"
        : "Vault steady";
  const recordsVaultSpeech =
    recordVault.missingCritical.length > 0
      ? `Let's file ${recordVault.missingCritical[0].toLowerCase()} next.`
      : recordReminders.length > 0
        ? `${recordReminders[0].label} is worth checking.`
        : recordVault.total > 0
          ? "Dog ID and care files are ready."
          : `Let's build ${resolvePetName(state.profile.name)}'s care vault.`;
  const recordsVaultTone =
    recordVault.missingCritical.length > 0
      ? colors.amber
      : recordReminders.length > 0
        ? colors.copper
        : colors.sage;
  const recordsCommandItems: RecordsCommandItem[] = [
    {
      id: "dog-id",
      icon: "card-outline",
      eyebrow: "Dog ID",
      label: `${resolvePetName(credential.name)} credential`,
      detail: `${credentialReadyFields} of ${credentialFieldTotal} ID fields ready for sitter, vet, and emergency handoff.`,
      actionLabel: "Share",
      tone: recordsVaultTone,
      onPress: shareCredential,
      disabled: recordsShareBusy,
    },
    {
      id: "record-vault",
      icon: "folder-open-outline",
      eyebrow: "Record vault",
      label: `${countNoun(recordVault.total, "record")} saved`,
      detail: recordVault.missingCritical.length
        ? `File ${recordVault.missingCritical[0].toLowerCase()} next.`
        : (recordReminders[0]?.label ??
          "Vaccines, visits, receipts, insurance, chip, and meds."),
      actionLabel: "Add",
      tone: recordVault.missingCritical.length ? colors.amber : colors.sage,
      onPress: () => openRecordForm("document"),
    },
    {
      id: "care-pass",
      icon: "document-text-outline",
      eyebrow: "Care Pass",
      label: "Vet or sitter packet",
      detail: "Generate owner-reviewed care summaries from records and logs.",
      actionLabel: "Build",
      tone: colors.copper,
      onPress: () => openCarePassPreview("vet"),
    },
    {
      id: "reports",
      icon: "analytics-outline",
      eyebrow: "Reports",
      label: `${periodLabel} progress`,
      detail: `${countNoun(report.total, "log")} and ${countNoun(recordReminders.length, "record reminder")} are ready to review.`,
      actionLabel: "Share",
      tone: colors.primary,
      onPress: shareReport,
      disabled: recordsShareBusy,
    },
    ...(ownerOps
      ? [
          {
            id: "proof",
            icon: "shield-checkmark-outline" as const,
            eyebrow: "Native proof",
            label: "Records file handoff",
            detail:
              "Capture Care Pass local HTML, Dog ID HTML/SVG, share-sheet behavior, and fallback copy.",
            actionLabel: "Proof",
            tone: colors.amber,
            onPress: openRecordsFileProofMission,
          },
        ]
      : []),
  ];

  // Trend sections with zero logs in their own window fold into one compact
  // Baselines Checklist row each instead of a corridor of near-identical
  // all-zero cards. A section gets its full trend card back the moment it
  // has real data, and every row routes to the same Log composer flow that
  // starts that baseline. Each status states the section's real derivation
  // window (today / 30 days / 45 days) so the zero is verifiable.
  const openBaselineLog = (type: CareEventType) => {
    Haptics.selectionAsync();
    router.push(`/log?type=${type}&detail=1&intent=${Date.now()}` as never);
  };
  interface BaselineChecklistRow {
    key: string;
    icon: IoniconName;
    label: string;
    status: string;
    type: CareEventType;
  }
  const baselineChecklistCandidates: (BaselineChecklistRow | null)[] = [
    weightTrend.totalWeighIns === 0 && current <= 0
      ? {
          key: "weight",
          icon: "scale-outline" as const,
          label: "Weight Trend",
          status: "No weight on file",
          type: "weight" as const,
        }
      : null,
    moodStats.total === 0
      ? {
          key: "mood",
          icon: "heart-circle-outline" as const,
          label: "Mood Trend",
          status: "0 check-ins in 30 days",
          type: "mood" as const,
        }
      : null,
    waterHydration.total === 0
      ? {
          key: "water",
          icon: "water-outline" as const,
          label: "Hydration",
          status: "0 water logs today",
          type: "water" as const,
        }
      : null,
    walkActivity.total === 0
      ? {
          key: "walk",
          icon: "walk-outline" as const,
          label: "Walk Activity",
          status: "0 walks today",
          type: "walk" as const,
        }
      : null,
    trainingProgress.totalSessions === 0
      ? {
          key: "training",
          icon: "school-outline" as const,
          label: "Training Progress",
          status: "0 sessions in 30 days",
          type: "training" as const,
        }
      : null,
    aloneTime.totalSessions === 0
      ? {
          key: "alone",
          icon: "home-outline" as const,
          label: "Alone Time",
          status: "0 logs in 30 days",
          type: "alone" as const,
        }
      : null,
    groomingCare.totalSessions === 0
      ? {
          key: "grooming",
          icon: "sparkles-outline" as const,
          label: "Grooming Care",
          status: "0 logs in 45 days",
          type: "grooming" as const,
        }
      : null,
    pottyHealth.total === 0
      ? {
          key: "potty",
          icon: "medical-outline" as const,
          label: "Potty Health",
          status: "0 potty logs today",
          type: "potty" as const,
        }
      : null,
  ];
  const baselineChecklist: BaselineChecklistRow[] =
    baselineChecklistCandidates.filter(
      (row): row is BaselineChecklistRow => row !== null,
    );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={s.container}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: H_PAD,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <BoardRouteHeader
            kicker="Records"
            title="Records"
            subtitle={`${resolvePetName(state.profile.name)}'s file cabinet - trends, incidents & reports`}
            back
            onBack={onBack}
          />
          {(entryId || reportId) && initialSyncStatus.state !== "settled" ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[
                s.deepLinkSyncError,
                {
                  backgroundColor: colors.amber + "14",
                  borderColor: colors.amber + "55",
                },
              ]}
            >
              <View style={s.deepLinkSyncErrorCopy}>
                <Text
                  style={[
                    s.deepLinkSyncErrorTitle,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {initialSyncStatus.state === "error"
                    ? "Records could not confirm this target"
                    : "Confirming current household records"}
                </Text>
                <Text
                  style={[
                    s.deepLinkSyncErrorBody,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {initialSyncStatus.state === "error"
                    ? (initialSyncStatus.message ??
                      "WoofWatcher could not confirm the current household records.")
                    : "WoofWatcher will open this target only after the current household refresh finishes."}
                </Text>
              </View>
              {initialSyncStatus.state === "error" &&
              initialSyncStatus.retryable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry current household Records refresh"
                  onPress={retryInitialSync}
                  style={({ pressed }) => [
                    s.deepLinkSyncRetry,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 13,
                    }}
                  >
                    Retry
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {recordsShareBusy || carePassSaveShareNotice ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[
                s.shareStatusRow,
                {
                  backgroundColor: colors.primary + "12",
                  borderColor: colors.primary + "33",
                },
              ]}
            >
              <Ionicons
                name={
                  recordsShareBusy
                    ? "hourglass-outline"
                    : "information-circle-outline"
                }
                size={16}
                color={colors.primary}
              />
              <Text
                style={[
                  s.shareStatusText,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {recordsShareBusy
                  ? carePassSaveShareBusy
                    ? "Saving & sharing after device storage confirms…"
                    : "Preparing share… Keep WoofWatcher open."
                  : carePassSaveShareNotice}
              </Text>
            </View>
          ) : null}

          <BoardCard
            padded={false}
            style={s.recordsCredentialStageCard}
            enter={0}
          >
            <ImageBackground
              source={
                recordsStageIsNight
                  ? RECORDS_CREDENTIAL_STAGE_ROOM_NIGHT
                  : RECORDS_CREDENTIAL_STAGE_ROOM
              }
              resizeMode="stretch"
              imageStyle={[
                stageImageFill,
                s.recordsCredentialStageImage,
                pixelImageStyle,
              ]}
              style={s.recordsCredentialStage}
              testID="records-credential-pixel-stage"
            >
              <View style={s.recordsCredentialStageShade} />
              <View style={s.recordsCredentialStageTop}>
                <View style={s.recordsCredentialBubble}>
                  <Text
                    style={[
                      s.recordsCredentialKicker,
                      { color: colors.sage, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Records Command Vault
                  </Text>
                  {/* brandNavy: constant ink for the fixed-light bubble in both themes
                      (colors.navy flips to cream in dark mode and disappears). */}
                  <Text
                    style={[
                      s.recordsCredentialSpeech,
                      { color: colors.brandNavy, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {recordsVaultSpeech}
                  </Text>
                  <View style={s.recordsCredentialBubbleTail} />
                </View>
                {/* Soft cream checklist button (was a navy HUD chip). brandNavy:
                    constant ink for this fixed-light surface in both themes,
                    same rule as the speech bubble above. */}
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Records checklist: ${recordsVaultStatus}. Opens the add record form.`}
                  onPress={openRecordsChecklist}
                  haptic="none"
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  scaleTo={0.95}
                  style={[
                    s.recordsCredentialChip,
                    {
                      backgroundColor: colors.ivory + "F2",
                      borderColor: colors.brandNavy + "33",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      recordsVaultScore >= 80
                        ? "shield-checkmark"
                        : "folder-open"
                    }
                    size={16}
                    color={colors.brandNavy}
                  />
                  <Text
                    style={[
                      s.recordsCredentialChipText,
                      { color: colors.brandNavy, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {recordsVaultStatus}
                  </Text>
                </PressScale>
              </View>

              <View pointerEvents="none" style={s.recordsCredentialSprite}>
                <View style={s.recordsCredentialSpriteShadow} />
                <SpriteSheetPlayer
                  asset={RECORDS_CREDENTIAL_STAGE_SPRITE}
                  track={RECORDS_CREDENTIAL_STAGE_TRACK}
                  width={108}
                  height={108}
                  testID="records-credential-pixel-sprite"
                />
              </View>
            </ImageBackground>
            <View
              style={[
                s.recordsCredentialDock,
                {
                  backgroundColor: colors.ivory + "F4",
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  s.recordsCredentialIdPlate,
                  {
                    backgroundColor: colors.ivory,
                    borderColor: colors.navy + "22",
                  },
                ]}
              >
                {/* A real ID card carries a photo, not a glyph: the canonical
                    portrait makes the credential read as a document. */}
                <PetPortrait size={38} ringColor={recordsVaultTone + "55"} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      s.recordsCredentialIdLabel,
                      { color: colors.sage, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    WOOFWATCHER DOG ID
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.recordsCredentialIdName,
                      { color: colors.brandNavy, fontFamily: DISPLAY },
                    ]}
                  >
                    {resolvePetName(credential.name)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.recordsCredentialIdMeta,
                      {
                        color: colors.brandNavy + "99",
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {credential.breed} - {credential.weight}
                  </Text>
                </View>
              </View>

              {/* Light parchment stat chips (was a navy strip): sage caps
                  labels, ink values - same real vault numbers. */}
              <View style={s.recordsCredentialHud}>
                {[
                  { label: "Saved", value: String(recordVault.total) },
                  { label: "Vault", value: `${recordsVaultScore}%` },
                  {
                    label: "To set up",
                    value: String(recordRemindersAll.length),
                  },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={[
                      s.recordsCredentialHudCell,
                      {
                        backgroundColor: colors.cream,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.recordsCredentialHudLabel,
                        { color: colors.sage, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        s.recordsCredentialHudValue,
                        { color: colors.brandNavy, fontFamily: DISPLAY_SEMI },
                      ]}
                    >
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </BoardCard>

          <BoardCard style={s.recordsCommandCard} enter={1}>
            <BoardSectionHeader
              title="Vault Command"
              accessory={
                <BoardPill
                  label={`${recordsVaultScore}% ready`}
                  tone={recordsVaultTone}
                />
              }
            />
            <View style={s.recordsCommandList}>
              {recordsCommandItems.map((item) => (
                <PressScale
                  key={item.id}
                  onPress={item.onPress}
                  disabled={item.disabled}
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  scaleTo={0.97}
                  style={[
                    s.recordsCommandRow,
                    {
                      borderColor: colors.border,
                      opacity: item.disabled ? 0.5 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}. ${item.detail}. ${item.actionLabel}`}
                  accessibilityState={{
                    disabled: Boolean(item.disabled),
                    busy: Boolean(item.disabled && recordsShareBusy),
                  }}
                >
                  <View
                    style={[
                      s.recordsCommandIcon,
                      { backgroundColor: item.tone + "18" },
                    ]}
                  >
                    <Ionicons name={item.icon} size={18} color={item.tone} />
                  </View>
                  <View style={s.recordsCommandCopy}>
                    {/* Quiet sage caps eyebrow (was tone-colored copper/orange). */}
                    <Text
                      style={[
                        s.recordsCommandEyebrow,
                        { color: colors.sage, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {item.eyebrow}
                    </Text>
                    <Text
                      style={[
                        s.recordsCommandTitle,
                        { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        s.recordsCommandDetail,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {item.detail}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.recordsCommandAction,
                      { backgroundColor: item.tone + "14" },
                    ]}
                  >
                    <Text
                      style={[
                        s.recordsCommandActionText,
                        { color: item.tone, fontFamily: "Inter_800ExtraBold" },
                      ]}
                    >
                      {item.actionLabel}
                    </Text>
                  </View>
                </PressScale>
              ))}
            </View>
          </BoardCard>

          {/* Care highlights strip */}
          <View
            style={[
              s.highlightStrip,
              { backgroundColor: colors.card, shadowColor: colors.primary },
            ]}
          >
            {[
              {
                value: streak > 0 ? `${streak}d` : "--",
                label: "Streak",
                color:
                  streak >= 7
                    ? colors.sage
                    : streak > 0
                      ? colors.primary
                      : colors.mutedForeground,
              },
              {
                value: String(report.total),
                label: `${periodLabel} entries`,
                color: colors.primary,
              },
              {
                value:
                  lastIncidentDays !== null ? `${lastIncidentDays}d` : "Clear",
                label: "Since incident",
                color:
                  lastIncidentDays === 0
                    ? colors.rose
                    : lastIncidentDays !== null && lastIncidentDays <= 3
                      ? colors.amber
                      : colors.sage,
              },
            ].map((h, i) => (
              <View
                key={h.label}
                style={[
                  s.highlightCell,
                  i < 2 && {
                    borderRightWidth: 1,
                    borderRightColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.highlightValue,
                    { color: h.color, fontFamily: DISPLAY },
                  ]}
                >
                  {h.value}
                </Text>
                <Text
                  style={[
                    s.highlightLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {h.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Care trends */}
          <BoardCard style={s.recordsBoardCard} enter={2}>
            <BoardSectionHeader
              title="Care Trends"
              accessory={<BoardPill label="7 days" tone={colors.primary} />}
            />
            <View style={s.trendHeroRow}>
              <View
                style={[
                  s.watchSummaryIcon,
                  { backgroundColor: colors.primary + "14" },
                ]}
              >
                <Ionicons
                  name="analytics-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    s.watchSummaryTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  {careTrends.current.totalLogs
                    ? "Weekly pattern"
                    : "Build a trend baseline"}
                </Text>
                <Text
                  style={[
                    s.watchSummaryDetail,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {careTrends.summary}
                </Text>
              </View>
            </View>
            <View style={s.trendStatGrid}>
              {[
                {
                  label: "Logs",
                  value: String(careTrends.current.totalLogs),
                  color: colors.primary,
                },
                {
                  label: "Meal %",
                  value: careTrends.current.meals.total
                    ? `${mealCompletion}%`
                    : "--",
                  color: colors.copper,
                },
                {
                  label: "Meal open",
                  value: mealPendingOutcomes
                    ? String(mealPendingOutcomes)
                    : "--",
                  color: mealPendingOutcomes ? colors.amber : colors.sage,
                },
                {
                  label: "Walk min",
                  value: String(walkMinutes),
                  color: colors.sage,
                },
              ].map((item) => (
                <View key={item.label} style={s.trendStatCell}>
                  <Text
                    style={[
                      s.trendStatValue,
                      { color: item.color, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {item.value}
                  </Text>
                  <Text
                    style={[
                      s.trendStatLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
            {trendSignals.length ? (
              <View style={s.trendSignalStack}>
                {trendSignals.map((signal) => {
                  const tone =
                    signal.tone === "alert"
                      ? colors.rose
                      : signal.tone === "watch"
                        ? colors.amber
                        : signal.tone === "good"
                          ? colors.sage
                          : colors.primary;
                  return (
                    <View
                      key={signal.kind}
                      style={[
                        s.trendSignalRow,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <View
                        style={[s.watchSignalDot, { backgroundColor: tone }]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            s.trendSignalTitle,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {signal.label}
                        </Text>
                        <Text
                          style={[
                            s.trendSignalDetail,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {signal.detail}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Text
              style={[
                s.hydrationNext,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {careTrends.nextStep}
            </Text>
          </BoardCard>

          <View
            collapsable={false}
            onLayout={registerSectionAnchor("dog-id")}
          />
          {/* Dog ID card. The four export actions live on their own wrapping
              row under the heading so the title and every action stay fully
              visible at narrow widths (a single header row clipped the title
              to "ID ..." at 393px). The pet's name is shown large on the card
              itself right below. */}
          <BoardSectionHeader
            title="ID Card"
            style={{ marginTop: 28, marginBottom: 2 }}
          />
          <View style={s.idShareRow}>
            <Pressable
              onPress={shareCredential}
              disabled={recordsShareBusy}
              accessibilityRole="button"
              accessibilityLabel="Share dog ID card"
              accessibilityState={{
                disabled: recordsShareBusy,
                busy: recordsShareBusy,
              }}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={[s.shareInline, recordsShareBusy && { opacity: 0.5 }]}
            >
              <Ionicons name="share-outline" size={15} color={colors.copper} />
              <Text
                style={[
                  s.sectionLink,
                  { color: colors.copper, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Share
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void sharePrintableCredential()}
              disabled={recordsShareBusy}
              accessibilityRole="button"
              accessibilityLabel="Share local printable Dog ID source file"
              accessibilityState={{
                disabled: recordsShareBusy,
                busy: recordsShareBusy,
              }}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={[s.shareInline, recordsShareBusy && { opacity: 0.5 }]}
            >
              <Ionicons name="print-outline" size={15} color={colors.copper} />
              <Text
                style={[
                  s.sectionLink,
                  { color: colors.copper, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Print
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void shareCredentialImageSource()}
              disabled={recordsShareBusy}
              accessibilityRole="button"
              accessibilityLabel="Share local SVG Dog ID image source"
              accessibilityState={{
                disabled: recordsShareBusy,
                busy: recordsShareBusy,
              }}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={[s.shareInline, recordsShareBusy && { opacity: 0.5 }]}
            >
              <Ionicons name="image-outline" size={15} color={colors.copper} />
              <Text
                style={[
                  s.sectionLink,
                  { color: colors.copper, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                SVG
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void shareCredentialPngArtifact()}
              disabled={recordsShareBusy}
              accessibilityRole="button"
              accessibilityLabel="Share generated Dog ID PNG"
              accessibilityState={{
                disabled: recordsShareBusy,
                busy: recordsShareBusy,
              }}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              style={[s.shareInline, recordsShareBusy && { opacity: 0.5 }]}
            >
              <Ionicons
                name="download-outline"
                size={15}
                color={colors.copper}
              />
              <Text
                style={[
                  s.sectionLink,
                  { color: colors.copper, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                PNG
              </Text>
            </Pressable>
          </View>
          <BoardCard tone="navy" padded={false} style={s.idCard} enter={3}>
            <View style={s.idCardTop}>
              <View style={[s.idBadge, { backgroundColor: colors.copper }]}>
                <Ionicons name="paw" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.idEyebrow,
                    { color: colors.cream, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  WOOFWATCHER DOG ID
                </Text>
                <Text
                  style={[s.idName, { color: "#FFFFFF", fontFamily: DISPLAY }]}
                >
                  {credential.name}
                </Text>
              </View>
            </View>
            <View style={s.idGrid}>
              {[
                { label: "Breed", value: credential.breed },
                { label: "Weight", value: credential.weight },
                { label: "Microchip", value: credential.microchip },
                { label: "Insurance", value: credential.insurance },
                { label: "Primary vet", value: credential.primaryVet },
                { label: "Emergency", value: credential.emergencyContact },
              ].map((item) => (
                <View key={item.label} style={s.idField}>
                  <Text
                    style={[
                      s.idFieldLabel,
                      { color: colors.cream, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      s.idFieldValue,
                      { color: "#FFFFFF", fontFamily: "Inter_500Medium" },
                    ]}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={[s.idFooter, { borderTopColor: "rgba(255,255,255,0.14)" }]}
            >
              <Text
                numberOfLines={2}
                style={[
                  s.idFooterText,
                  { color: colors.cream, fontFamily: "Inter_500Medium" },
                ]}
              >
                Vaccines: {credential.vaccines}
              </Text>
            </View>
          </BoardCard>

          {/* Record vault */}
          <BoardCard style={s.recordsBoardCard} enter={4}>
            <BoardSectionHeader
              title="Record Vault"
              accessory={
                <Pressable
                  onPress={() => openRecordForm("document")}
                  accessibilityRole="button"
                  accessibilityLabel="Add a document to Record Vault"
                  accessibilityState={{ disabled: false }}
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  style={s.shareInline}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={15}
                    color={colors.copper}
                  />
                  <Text
                    style={[
                      s.sectionLink,
                      { color: colors.copper, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    Add
                  </Text>
                </Pressable>
              }
            />
            <View style={s.vaultGrid}>
              {recordSections.map((section) => {
                const option =
                  RECORD_OPTIONS.find((item) => item.kind === section.kind) ??
                  RECORD_OPTIONS[0];
                const tone =
                  section.status === "On file" ? colors.sage : colors.amber;
                return (
                  <PressScale
                    key={section.kind}
                    accessibilityRole="button"
                    accessibilityLabel={`${section.label}. ${section.count > 0 ? `${section.count} on file` : "Nothing filed yet"}. Add a ${option.label.toLowerCase()} record.`}
                    onPress={() => openRecordForm(section.kind)}
                    scaleTo={0.96}
                    containerStyle={s.vaultCardLayout}
                    style={[
                      s.vaultCard,
                      {
                        backgroundColor: colors.background,
                        borderColor:
                          section.status === "On file"
                            ? colors.border
                            : colors.amber + "66",
                      },
                    ]}
                  >
                    <View
                      style={[s.vaultIcon, { backgroundColor: tone + "16" }]}
                    >
                      <Ionicons name={option.icon} size={17} color={tone} />
                    </View>
                    <Text
                      style={[
                        s.vaultLabel,
                        { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                      ]}
                    >
                      {section.label}
                    </Text>
                    <Text
                      style={[
                        s.vaultMeta,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {section.count > 0
                        ? `${section.count} on file`
                        : "Add now"}
                    </Text>
                  </PressScale>
                );
              })}
            </View>
            {recordVault.missingCritical.length > 0 ? (
              <View
                style={[
                  s.vaultNotice,
                  {
                    backgroundColor: colors.amber + "12",
                    borderColor: colors.amber + "44",
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.amber}
                />
                <Text
                  style={[
                    s.vaultNoticeText,
                    { color: colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  Missing: {recordVault.missingCritical.join(", ")}
                </Text>
              </View>
            ) : null}
            {recordReminders.length > 0 ? (
              <View
                style={[
                  s.reminderList,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                {recordReminders.map((reminder, index) => {
                  const tone =
                    reminder.urgency === "alert" ? colors.rose : colors.amber;
                  return (
                    <View
                      key={`${reminder.kind}_${reminder.recordId ?? reminder.label}`}
                      style={[
                        s.reminderRow,
                        index > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.reminderIcon,
                          { backgroundColor: tone + "16" },
                        ]}
                      >
                        <Ionicons
                          name={
                            reminder.urgency === "alert"
                              ? "alert-circle"
                              : "time-outline"
                          }
                          size={16}
                          color={tone}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            s.reminderTitle,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {reminder.label}
                        </Text>
                        <Text
                          style={[
                            s.reminderDetail,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {reminder.detail}
                        </Text>
                        <Text
                          style={[
                            s.reminderAction,
                            { color: tone, fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          {reminder.action}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </BoardCard>

          {/* Baselines checklist - every zero-data trend section as one
              tappable row; full cards below render only with real data. */}
          {baselineChecklist.length > 0 ? (
            <BoardCard style={s.recordsBoardCard} enter={5}>
              <BoardSectionHeader
                title="Baselines Checklist"
                accessory={
                  <BoardPill
                    label={`${baselineChecklist.length} to start`}
                    tone={colors.mutedForeground}
                  />
                }
              />
              <Text
                style={[
                  s.baselineIntro,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Nothing logged in these sections yet. Tap one to log its first
                entry; each grows into a full trend card with real data.
              </Text>
              {baselineChecklist.map((row, index) => (
                <PressScale
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label}. ${row.status}. Log the first entry.`}
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={() => openBaselineLog(row.type)}
                  scaleTo={0.97}
                  style={[
                    s.baselineRow,
                    {
                      borderTopColor: colors.border,
                      borderTopWidth: index > 0 ? 1 : 0,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.baselineIcon,
                      { backgroundColor: colors.mutedForeground + "14" },
                    ]}
                  >
                    <Ionicons
                      name={row.icon}
                      size={17}
                      color={colors.mutedForeground}
                    />
                  </View>
                  <Text
                    style={[
                      s.baselineLabel,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {row.label}
                  </Text>
                  <Text
                    style={[
                      s.baselineStatus,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {row.status}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={colors.mutedForeground}
                  />
                </PressScale>
              ))}
            </BoardCard>
          ) : null}

          {/* Weight trend - charts real weigh-ins only; with fewer than two
              logged weights it shows an honest empty state instead of a
              synthesized line, and goal math only appears once a goal is set. */}
          {weightTrend.totalWeighIns > 0 || current > 0 ? (
            <BoardCard style={[s.recordsBoardCard, { padding: cardPad }]}>
              <BoardSectionHeader
                title="Weight Trend"
                accessory={
                  <BoardPill
                    label={
                      remaining > 0
                        ? `${remaining.toFixed(1)} ${unit} ${weightTrend.direction === "reduce" ? "over goal" : "to go"}`
                        : goalWeight > 0
                          ? current > 0
                            ? "Goal reached"
                            : `Goal ${goalWeight} ${unit}`
                          : "No goal set"
                    }
                    tone={
                      remaining > 0
                        ? colors.amber
                        : goalWeight > 0
                          ? colors.sage
                          : colors.mutedForeground
                    }
                  />
                }
              />
              {current > 0 ? (
                <View style={s.chartTopRow}>
                  <View>
                    <Text
                      style={[
                        s.chartBig,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {current}
                      <Text
                        style={[
                          s.chartUnit,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {" "}
                        {unit}
                      </Text>
                    </Text>
                    <Text
                      style={[
                        s.chartCaption,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {hasWeightSeries
                        ? "From logged weigh-ins"
                        : "Current weight on profile"}
                    </Text>
                  </View>
                  {goalWeight > 0 ? (
                    <View
                      style={[
                        s.goalPill,
                        { backgroundColor: colors.sage + "16" },
                      ]}
                    >
                      <Ionicons name="flag" size={13} color={colors.sage} />
                      <Text
                        style={[
                          s.goalPillText,
                          { color: colors.sage, fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        Goal {goalWeight} {unit}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {hasWeightSeries ? (
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={weightChartAccessibilityLabel}
                >
                  <Svg width={chartW} height={chartH}>
                    <Defs>
                      <SvgGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                        <Stop
                          offset="0"
                          stopColor={colors.sage}
                          stopOpacity={0.28}
                        />
                        <Stop
                          offset="1"
                          stopColor={colors.sage}
                          stopOpacity={0.02}
                        />
                      </SvgGradient>
                    </Defs>
                    {[0.25, 0.5, 0.75].map((t) => {
                      const gy = padT + t * plotH;
                      return (
                        <Line
                          key={t}
                          x1={padL}
                          y1={gy}
                          x2={padL + plotW}
                          y2={gy}
                          stroke={colors.border}
                          strokeWidth={1}
                          opacity={0.7}
                        />
                      );
                    })}
                    {goalWeight > 0 ? (
                      <Line
                        x1={padL}
                        y1={goalY}
                        x2={padL + plotW}
                        y2={goalY}
                        stroke={colors.sage}
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        opacity={0.55}
                      />
                    ) : null}
                    <Path d={areaPath} fill="url(#weightFill)" />
                    <Path
                      d={linePath}
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {series.map((v, i) => {
                      const last = i === series.length - 1;
                      return (
                        <Circle
                          key={i}
                          cx={xAt(i)}
                          cy={yAt(v)}
                          r={last ? 5.5 : 3}
                          fill={last ? colors.copper : colors.card}
                          stroke={last ? colors.card : colors.primary}
                          strokeWidth={last ? 2.5 : 2}
                        />
                      );
                    })}
                    {labels.map((lbl, i) => (
                      <SvgText
                        key={`l${i}`}
                        x={xAt(i)}
                        y={chartH - 8}
                        fill={colors.mutedForeground}
                        fontSize={10}
                        fontFamily="Inter_500Medium"
                        // End labels anchor inward so they never clip at the card edges.
                        textAnchor={
                          i === 0
                            ? "start"
                            : i === labels.length - 1
                              ? "end"
                              : "middle"
                        }
                      >
                        {lbl}
                      </SvgText>
                    ))}
                  </Svg>
                </View>
              ) : (
                <View
                  style={[
                    s.weightEmpty,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="scale-outline"
                    size={24}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      s.weightEmptyTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {weightTrend.totalWeighIns === 1
                      ? "Log another weigh-in to chart the trend"
                      : "Log a weight to start the trend"}
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(
                        `/log?type=weight&detail=1&intent=${Date.now()}` as never,
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Log a weight from the Log tab"
                    style={({ pressed }) => [
                      s.emptyAddBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="add"
                      size={16}
                      color={colors.primaryForeground}
                    />
                    <Text
                      style={[
                        s.emptyAddText,
                        {
                          color: colors.primaryForeground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Log weight
                    </Text>
                  </Pressable>
                </View>
              )}
              <Text
                style={[
                  s.chartNote,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {weightTrend.nextStep}
              </Text>
            </BoardCard>
          ) : null}

          {/* Mood trend */}
          {moodStats.total > 0 ? (
            <BoardCard style={s.recordsBoardCard}>
              <BoardSectionHeader
                title="Mood Trend"
                accessory={
                  <BoardPill
                    label={
                      moodStats.total > 0
                        ? `${moodStats.averageScore.toFixed(1)}/5 avg`
                        : "No mood logs"
                    }
                    tone={
                      moodStats.status === "watch" ? colors.amber : colors.sage
                    }
                  />
                }
              />
              {moodStats.bars.length === 0 ? (
                <Text
                  style={[
                    s.empty,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  No shared mood check-ins yet. Log mood with energy and care
                  context to see trends.
                </Text>
              ) : (
                <>
                  <View style={s.moodSummary}>
                    <View
                      style={[
                        s.watchSummaryIcon,
                        {
                          backgroundColor:
                            (moodStats.status === "watch"
                              ? colors.amber
                              : colors.sage) + "18",
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          moodStats.status === "watch"
                            ? "alert-circle-outline"
                            : "heart-circle-outline"
                        }
                        size={18}
                        color={
                          moodStats.status === "watch"
                            ? colors.amber
                            : colors.sage
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.watchSummaryTitle,
                          {
                            color: colors.foreground,
                            fontFamily: DISPLAY_SEMI,
                          },
                        ]}
                      >
                        {moodStats.status === "watch"
                          ? "Worth watching"
                          : "Mood steady"}
                      </Text>
                      <Text
                        style={[
                          s.watchSummaryDetail,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {moodStats.summary}
                      </Text>
                    </View>
                  </View>
                  <View style={s.moodEnergyRow}>
                    {[
                      {
                        label: "Low",
                        value: moodStats.energy.low,
                        color: colors.amber,
                      },
                      {
                        label: "Steady",
                        value: moodStats.energy.steady,
                        color: colors.sage,
                      },
                      {
                        label: "High",
                        value: moodStats.energy.high,
                        color: colors.primary,
                      },
                    ].map((item) => (
                      <View
                        key={item.label}
                        style={[
                          s.moodEnergyPill,
                          {
                            backgroundColor: item.color + "14",
                            borderColor: item.color + "33",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.moodEnergyValue,
                            { color: item.color, fontFamily: DISPLAY_SEMI },
                          ]}
                        >
                          {item.value}
                        </Text>
                        <Text
                          style={[
                            s.moodEnergyLabel,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {moodStats.bars.map((b) => {
                    const tone =
                      b.tone === "alert"
                        ? colors.rose
                        : b.tone === "watch"
                          ? colors.amber
                          : colors.sage;
                    const pct =
                      moodStats.total > 0
                        ? Math.round((b.count / moodStats.total) * 100)
                        : 0;
                    return (
                      <View key={b.key} style={s.moodRow}>
                        <Text
                          style={[
                            s.moodLabel,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {b.label}
                        </Text>
                        <View
                          style={[
                            s.moodTrack,
                            { backgroundColor: colors.background },
                          ]}
                        >
                          <View
                            style={[
                              s.moodFill,
                              {
                                backgroundColor: tone,
                                width: `${(b.count / maxBar) * 100}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            s.moodPct,
                            { color: tone, fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          {pct}%
                        </Text>
                        <Text
                          style={[
                            s.moodCount,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          ({b.count})
                        </Text>
                      </View>
                    );
                  })}
                  {moodStats.latest ? (
                    <View
                      style={[s.moodLatest, { borderTopColor: colors.border }]}
                    >
                      <View
                        style={[
                          s.watchSignalDot,
                          {
                            backgroundColor:
                              moodStats.latest.tone === "alert"
                                ? colors.rose
                                : moodStats.latest.tone === "watch"
                                  ? colors.amber
                                  : colors.sage,
                          },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            s.watchPatternLabel,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          Latest: {moodStats.latest.moodLabel}
                          {moodStats.latest.energyLevel
                            ? ` - ${moodStats.latest.energyLevel} energy`
                            : ""}
                        </Text>
                        <Text
                          style={[
                            s.watchPatternEvidence,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {moodStats.latest.caregiver} -{" "}
                          {relativeDay(moodStats.latest.occurredAt, now)}
                        </Text>
                        {moodStats.latest.context ? (
                          <Text
                            style={[
                              s.watchPatternNext,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_400Regular",
                              },
                            ]}
                          >
                            {moodStats.latest.context}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                  <Text
                    style={[
                      s.watchPatternNext,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {moodStats.nextStep}
                  </Text>
                </>
              )}
            </BoardCard>
          ) : null}

          {/* Hydration */}
          {waterHydration.total > 0 ? (
            <BoardCard style={s.recordsBoardCard}>
              <BoardSectionHeader
                title="Hydration"
                accessory={
                  <BoardPill
                    label={
                      waterHydration.total
                        ? countNoun(waterHydration.total, "log")
                        : "No logs"
                    }
                    tone={colors.primary}
                  />
                }
              />
              <View style={s.hydrationSummary}>
                <View
                  style={[
                    s.watchSummaryIcon,
                    { backgroundColor: colors.primary + "18" },
                  ]}
                >
                  <Ionicons
                    name="water-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      s.watchSummaryTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {waterHydration.status === "logged"
                      ? "Fresh water logged"
                      : "Water watch"}
                  </Text>
                  <Text
                    style={[
                      s.watchSummaryDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {waterHydration.summary}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.hydrationMeter,
                  { backgroundColor: colors.background },
                ]}
              >
                <View
                  style={[
                    s.hydrationMeterFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${waterHydration.percent}%`,
                    },
                  ]}
                />
              </View>
              <View style={s.hydrationStats}>
                {[
                  {
                    label: "Bowl refills",
                    value: String(waterHydration.refillEquivalent),
                  },
                  { label: "Goal", value: `${waterHydration.targetRefills}` },
                  {
                    label: "Caregivers",
                    value: String(waterHydration.caregivers.length),
                  },
                ].map((item, index) => (
                  <View
                    key={item.label}
                    style={[
                      s.hydrationStat,
                      index < 2 && {
                        borderRightWidth: 1,
                        borderRightColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.hydrationValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {item.value}
                    </Text>
                    <Text
                      style={[
                        s.hydrationLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                style={[
                  s.hydrationNext,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {waterHydration.nextStep}
              </Text>
              {waterHydration.last ? (
                <View
                  style={[s.watchPatternRow, { borderTopColor: colors.border }]}
                >
                  <View
                    style={[
                      s.watchSignalDot,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.watchPatternLabel,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Latest: {waterHydration.last.amountLabel}
                    </Text>
                    <Text
                      style={[
                        s.watchPatternEvidence,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {waterHydration.last.caregiver} -{" "}
                      {relativeDay(waterHydration.last.occurredAt, now)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </BoardCard>
          ) : null}

          {/* Walk activity */}
          {walkActivity.total > 0 ? (
            <BoardCard style={s.recordsBoardCard}>
              <BoardSectionHeader
                title="Walk Activity"
                accessory={
                  <BoardPill
                    label={
                      walkActivity.total
                        ? countNoun(walkActivity.total, "walk")
                        : "No walks"
                    }
                    tone={colors.sage}
                  />
                }
              />
              <View style={s.hydrationSummary}>
                <View
                  style={[
                    s.watchSummaryIcon,
                    { backgroundColor: colors.sage + "18" },
                  ]}
                >
                  <Ionicons name="walk-outline" size={18} color={colors.sage} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      s.watchSummaryTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {walkActivity.status === "active"
                      ? "Activity steady"
                      : walkActivity.status === "light"
                        ? "Light activity"
                        : "Walk check"}
                  </Text>
                  <Text
                    style={[
                      s.watchSummaryDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {walkActivity.summary}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.hydrationMeter,
                  { backgroundColor: colors.background },
                ]}
              >
                <View
                  style={[
                    s.hydrationMeterFill,
                    {
                      backgroundColor: colors.sage,
                      width: `${walkActivity.percent}%`,
                    },
                  ]}
                />
              </View>
              <View style={s.hydrationStats}>
                {[
                  {
                    label: "Minutes",
                    value: String(walkActivity.totalMinutes),
                  },
                  {
                    label: "dog interactions",
                    value: String(walkActivity.dogInteractions),
                  },
                  {
                    label: "Places",
                    value: String(walkActivity.places.length),
                  },
                ].map((item, index) => (
                  <View
                    key={item.label}
                    style={[
                      s.hydrationStat,
                      index < 2 && {
                        borderRightWidth: 1,
                        borderRightColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.hydrationValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {item.value}
                    </Text>
                    {/* sentenceCase keeps "Dog interactions" aligned with its Title-case siblings. */}
                    <Text
                      style={[
                        s.hydrationLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {sentenceCase(item.label)}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                style={[
                  s.hydrationNext,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {walkActivity.nextStep}
              </Text>
              {walkActivity.last ? (
                <View
                  style={[s.watchPatternRow, { borderTopColor: colors.border }]}
                >
                  <View
                    style={[s.watchSignalDot, { backgroundColor: colors.sage }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.watchPatternLabel,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Latest: {walkActivity.last.label}
                    </Text>
                    <Text
                      style={[
                        s.watchPatternEvidence,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {[
                        walkActivity.last.place,
                        walkActivity.last.caregiver,
                        relativeDay(walkActivity.last.occurredAt, now),
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </Text>
                    {walkActivity.last.socialOutcome ? (
                      <Text
                        style={[
                          s.watchPatternNext,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {walkActivity.last.socialOutcome}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {walkRouteTemplates.length > 0 ? (
                <View
                  style={[
                    s.routeTemplateList,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <View style={s.routeTemplateHeader}>
                    <Text
                      style={[
                        s.routeTemplateTitle,
                        { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                      ]}
                    >
                      Saved Routes
                    </Text>
                    <Text
                      style={[
                        s.routeTemplateCount,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {countNoun(walkRouteTemplates.length, "template")}
                    </Text>
                  </View>
                  {walkRouteTemplates.map((template, index) => (
                    <View
                      key={template.id}
                      style={[
                        s.routeTemplateRow,
                        index > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.routeTemplateIcon,
                          { backgroundColor: colors.sage + "14" },
                        ]}
                      >
                        <Ionicons
                          name="map-outline"
                          size={16}
                          color={colors.sage}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={[
                            s.routeTemplateName,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {template.name}
                        </Text>
                        <Text
                          style={[
                            s.routeTemplateMeta,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {template.suggestedUse} - {template.visits}{" "}
                          {template.visits === 1 ? "visit" : "visits"} -{" "}
                          {template.averageMinutes}m avg
                        </Text>
                        {template.socialOutcomes[0] ? (
                          <Text
                            numberOfLines={2}
                            style={[
                              s.routeTemplateNote,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_400Regular",
                              },
                            ]}
                          >
                            {template.socialOutcomes[0]}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          s.routeTemplateMetric,
                          { backgroundColor: colors.background },
                        ]}
                      >
                        <Text
                          style={[
                            s.routeTemplateMetricValue,
                            { color: colors.sage, fontFamily: DISPLAY_SEMI },
                          ]}
                        >
                          {template.dogInteractions}
                        </Text>
                        <Text
                          style={[
                            s.routeTemplateMetricLabel,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          dogs
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </BoardCard>
          ) : null}

          {/* Training progress */}
          {trainingProgress.totalSessions > 0 ? (
            <BoardCard style={s.recordsBoardCard}>
              <BoardSectionHeader
                title="Training Progress"
                accessory={
                  <BoardPill
                    label={
                      trainingProgress.totalSessions
                        ? countNoun(trainingProgress.totalSessions, "session")
                        : "No sessions"
                    }
                    tone={colors.copper}
                  />
                }
              />
              <View style={s.hydrationSummary}>
                <View
                  style={[
                    s.watchSummaryIcon,
                    { backgroundColor: colors.copper + "18" },
                  ]}
                >
                  <Ionicons
                    name="school-outline"
                    size={18}
                    color={colors.copper}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      s.watchSummaryTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {trainingProgress.status === "needs-practice"
                      ? "Practice focus"
                      : trainingProgress.status === "steady"
                        ? "Training steady"
                        : trainingProgress.status === "building"
                          ? "Training building"
                          : "Build training baseline"}
                  </Text>
                  <Text
                    style={[
                      s.watchSummaryDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {trainingProgress.summary}
                  </Text>
                </View>
              </View>
              <View style={s.hydrationStats}>
                {[
                  {
                    label: "Minutes",
                    value: String(trainingProgress.totalMinutes),
                  },
                  { label: "Wins", value: String(trainingProgress.winCount) },
                  {
                    label: "Skills",
                    value: String(trainingProgress.skillCount),
                  },
                ].map((item, index) => (
                  <View
                    key={item.label}
                    style={[
                      s.hydrationStat,
                      index < 2 && {
                        borderRightWidth: 1,
                        borderRightColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.hydrationValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {item.value}
                    </Text>
                    <Text
                      style={[
                        s.hydrationLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
              {trainingProgress.focusSkills.length ? (
                <Text
                  style={[
                    s.hydrationNext,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Skills: {trainingProgress.focusSkills.slice(0, 4).join(", ")}
                </Text>
              ) : null}
              <Text
                style={[
                  s.hydrationNext,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    marginTop: trainingProgress.focusSkills.length ? 5 : 0,
                  },
                ]}
              >
                {trainingProgress.nextStep}
              </Text>
              {trainingProgress.latest ? (
                <View
                  style={[s.watchPatternRow, { borderTopColor: colors.border }]}
                >
                  <View
                    style={[
                      s.watchSignalDot,
                      {
                        backgroundColor: trainingProgress.struggleCount
                          ? colors.amber
                          : colors.copper,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.watchPatternLabel,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Latest: {trainingProgress.latest.label}
                    </Text>
                    <Text
                      style={[
                        s.watchPatternEvidence,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {[
                        trainingProgress.latest.outcome,
                        trainingProgress.latest.skill,
                        trainingProgress.latest.caregiver,
                        relativeDay(trainingProgress.latest.occurredAt, now),
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </Text>
                    {trainingProgress.latest.nextPractice ? (
                      <Text
                        style={[
                          s.watchPatternNext,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {trainingProgress.latest.nextPractice}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </BoardCard>
          ) : null}

          {/* Alone time */}
          {aloneTime.totalSessions > 0 ? (
            <BoardCard style={s.recordsBoardCard}>
              <BoardSectionHeader
                title="Alone Time"
                accessory={
                  <BoardPill
                    label={
                      aloneTime.totalSessions
                        ? countNoun(aloneTime.totalSessions, "log")
                        : "No logs"
                    }
                    tone={
                      aloneTime.distressedCount
                        ? colors.rose
                        : aloneTime.anxiousCount
                          ? colors.amber
                          : colors.mutedForeground
                    }
                  />
                }
              />
              <View style={s.hydrationSummary}>
                <View
                  style={[
                    s.watchSummaryIcon,
                    { backgroundColor: colors.mutedForeground + "18" },
                  ]}
                >
                  <Ionicons
                    name="home-outline"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      s.watchSummaryTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {aloneTime.status === "needs-support"
                      ? "Support needed"
                      : aloneTime.status === "watch"
                        ? "Anxiety watch"
                        : aloneTime.status === "steady"
                          ? "Alone steady"
                          : "Build alone baseline"}
                  </Text>
                  <Text
                    style={[
                      s.watchSummaryDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {aloneTime.summary}
                  </Text>
                </View>
              </View>
              <View style={s.hydrationStats}>
                {[
                  { label: "Minutes", value: String(aloneTime.totalMinutes) },
                  { label: "Anxious", value: String(aloneTime.anxiousCount) },
                  {
                    label: "Distress",
                    value: String(aloneTime.distressedCount),
                  },
                ].map((item, index) => (
                  <View
                    key={item.label}
                    style={[
                      s.hydrationStat,
                      index < 2 && {
                        borderRightWidth: 1,
                        borderRightColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.hydrationValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {item.value}
                    </Text>
                    <Text
                      style={[
                        s.hydrationLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
              {aloneTime.triggers.length ? (
                <Text
                  style={[
                    s.hydrationNext,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Triggers: {aloneTime.triggers.slice(0, 4).join(", ")}
                </Text>
              ) : null}
              {aloneTime.supports.length ? (
                <Text
                  style={[
                    s.hydrationNext,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      marginTop: 5,
                    },
                  ]}
                >
                  Supports: {aloneTime.supports.slice(0, 4).join(", ")}
                </Text>
              ) : null}
              <Text
                style={[
                  s.hydrationNext,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    marginTop:
                      aloneTime.triggers.length || aloneTime.supports.length
                        ? 5
                        : 0,
                  },
                ]}
              >
                {aloneTime.nextStep}
              </Text>
              {aloneTime.latest ? (
                <View
                  style={[s.watchPatternRow, { borderTopColor: colors.border }]}
                >
                  <View
                    style={[
                      s.watchSignalDot,
                      {
                        backgroundColor: aloneTime.distressedCount
                          ? colors.rose
                          : aloneTime.anxiousCount
                            ? colors.amber
                            : colors.mutedForeground,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.watchPatternLabel,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Latest: {aloneTime.latest.label}
                    </Text>
                    <Text
                      style={[
                        s.watchPatternEvidence,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {[
                        aloneTime.latest.outcome,
                        aloneTime.latest.caregiver,
                        aloneTime.latest.durationMinutes
                          ? `${aloneTime.latest.durationMinutes} min`
                          : "",
                        aloneTime.latest.recoveryMinutes
                          ? `${aloneTime.latest.recoveryMinutes} min recovery`
                          : "",
                        relativeDay(aloneTime.latest.occurredAt, now),
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </Text>
                    {aloneTime.latest.calmingSupport ? (
                      <Text
                        style={[
                          s.watchPatternNext,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        Support: {aloneTime.latest.calmingSupport}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </BoardCard>
          ) : null}

          {/* Grooming care */}
          {groomingCare.totalSessions > 0 ? (
            <BoardCard style={s.recordsBoardCard}>
              <BoardSectionHeader
                title="Grooming Care"
                accessory={
                  <BoardPill
                    label={
                      groomingCare.totalSessions
                        ? countNoun(groomingCare.totalSessions, "log")
                        : "No logs"
                    }
                    tone={colors.sage}
                  />
                }
              />
              <View style={s.hydrationSummary}>
                <View
                  style={[
                    s.watchSummaryIcon,
                    { backgroundColor: colors.sage + "18" },
                  ]}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={18}
                    color={colors.sage}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      s.watchSummaryTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {groomingCare.status === "watch"
                      ? "Coat watch"
                      : groomingCare.status === "due-soon"
                        ? "Grooming due soon"
                        : groomingCare.status === "steady"
                          ? "Grooming steady"
                          : "Build grooming baseline"}
                  </Text>
                  <Text
                    style={[
                      s.watchSummaryDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {groomingCare.summary}
                  </Text>
                </View>
              </View>
              <View style={s.hydrationStats}>
                {[
                  { label: "Brush", value: String(groomingCare.brushCount) },
                  { label: "Bath", value: String(groomingCare.bathCount) },
                  { label: "Nails", value: String(groomingCare.nailCount) },
                ].map((item, index) => (
                  <View
                    key={item.label}
                    style={[
                      s.hydrationStat,
                      index < 2 && {
                        borderRightWidth: 1,
                        borderRightColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.hydrationValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {item.value}
                    </Text>
                    <Text
                      style={[
                        s.hydrationLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
              {groomingCare.products.length ? (
                <Text
                  style={[
                    s.hydrationNext,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Products: {groomingCare.products.slice(0, 4).join(", ")}
                </Text>
              ) : null}
              {groomingCare.nextDue ? (
                <Text
                  style={[
                    s.hydrationNext,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      marginTop: groomingCare.products.length ? 5 : 0,
                    },
                  ]}
                >
                  Next due: {groomingCare.nextDue}
                </Text>
              ) : null}
              <Text
                style={[
                  s.hydrationNext,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    marginTop:
                      groomingCare.products.length || groomingCare.nextDue
                        ? 5
                        : 0,
                  },
                ]}
              >
                {groomingCare.nextStep}
              </Text>
              {groomingCare.latest ? (
                <View
                  style={[s.watchPatternRow, { borderTopColor: colors.border }]}
                >
                  <View
                    style={[
                      s.watchSignalDot,
                      {
                        backgroundColor: groomingCare.watchCount
                          ? colors.amber
                          : colors.sage,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.watchPatternLabel,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Latest: {groomingCare.latest.kindLabel}
                    </Text>
                    <Text
                      style={[
                        s.watchPatternEvidence,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {[
                        groomingCare.latest.condition,
                        groomingCare.latest.caregiver,
                        groomingCare.latest.durationMinutes
                          ? `${groomingCare.latest.durationMinutes} min`
                          : "",
                        relativeDay(groomingCare.latest.occurredAt, now),
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </Text>
                  </View>
                </View>
              ) : null}
            </BoardCard>
          ) : null}

          {/* Potty health */}
          {pottyHealth.total > 0 ? (
            <BoardCard style={s.recordsBoardCard}>
              <BoardSectionHeader
                title="Potty Health"
                accessory={
                  <BoardPill
                    label={
                      pottyHealth.total
                        ? countNoun(pottyHealth.total, "log")
                        : "No logs"
                    }
                    tone={pottyHealth.watchCount ? colors.amber : colors.sage}
                  />
                }
              />
              <View style={s.hydrationSummary}>
                <View
                  style={[
                    s.watchSummaryIcon,
                    { backgroundColor: colors.amber + "18" },
                  ]}
                >
                  <Ionicons
                    name="medical-outline"
                    size={18}
                    color={colors.amber}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      s.watchSummaryTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {pottyHealth.status === "watch"
                      ? "Stool watch"
                      : pottyHealth.status === "steady"
                        ? "Potty steady"
                        : "Potty check"}
                  </Text>
                  <Text
                    style={[
                      s.watchSummaryDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {pottySummary}
                  </Text>
                </View>
              </View>
              <View style={s.hydrationStats}>
                {[
                  { label: "Pee", value: String(pottyHealth.peeCount) },
                  { label: "Poop", value: String(pottyHealth.poopCount) },
                  { label: "Review", value: String(pottyHealth.watchCount) },
                ].map((item, index) => (
                  <View
                    key={item.label}
                    style={[
                      s.hydrationStat,
                      index < 2 && {
                        borderRightWidth: 1,
                        borderRightColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.hydrationValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {item.value}
                    </Text>
                    <Text
                      style={[
                        s.hydrationLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                style={[
                  s.hydrationNext,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {pottyHealth.nextStep}
              </Text>
              {pottyHealth.stoolColors.length ? (
                <Text
                  style={[
                    s.hydrationNext,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      marginTop: 6,
                    },
                  ]}
                >
                  Colors: {pottyHealth.stoolColors.join(", ")}
                </Text>
              ) : null}
              {pottyHealth.contexts.length ? (
                <Text
                  style={[
                    s.hydrationNext,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      marginTop: 4,
                    },
                  ]}
                >
                  Context: {pottyHealth.contexts.join(", ")}
                </Text>
              ) : null}
              {pottyHealth.last ? (
                <View
                  style={[s.watchPatternRow, { borderTopColor: colors.border }]}
                >
                  <View
                    style={[
                      s.watchSignalDot,
                      {
                        backgroundColor: pottyHealth.watchCount
                          ? colors.amber
                          : colors.sage,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.watchPatternLabel,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Latest: {sentenceCase(pottyHealth.last.kindLabel)}
                    </Text>
                    <Text
                      style={[
                        s.watchPatternEvidence,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {[
                        pottyHealth.last.condition !== "not logged"
                          ? pottyHealth.last.condition
                          : "",
                        pottyHealth.last.stoolColor
                          ? `${pottyHealth.last.stoolColor} stool detail`
                          : "",
                        pottyHealth.last.context,
                        pottyHealth.last.caregiver,
                        relativeDay(pottyHealth.last.occurredAt, now),
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </Text>
                  </View>
                </View>
              ) : null}
            </BoardCard>
          ) : null}

          {/* Incident lookback */}
          <BoardCard style={s.recordsBoardCard}>
            <BoardSectionHeader title="Incident Watch" />
            <View style={s.watchSummary}>
              <View
                style={[
                  s.watchSummaryIcon,
                  { backgroundColor: incidentTone + "18" },
                ]}
              >
                <Ionicons
                  name={
                    incidentWatch.status === "clear"
                      ? "shield-checkmark"
                      : "alert-circle"
                  }
                  size={18}
                  color={incidentTone}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.watchSummaryTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  {incidentWatch.status === "clear"
                    ? "No incidents logged"
                    : incidentWatch.status === "review"
                      ? "Review incident"
                      : "Watch incident pattern"}
                </Text>
                <Text
                  style={[
                    s.watchSummaryDetail,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {incidentWatch.summary}
                </Text>
              </View>
            </View>
            <View
              style={[s.watchPatternRow, { borderTopColor: colors.border }]}
            >
              <View
                style={[s.watchSignalDot, { backgroundColor: incidentTone }]}
              />
              <View style={{ flex: 1 }}>
                <View style={s.watchPatternTop}>
                  <Text
                    style={[
                      s.watchPatternLabel,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Trend signal
                  </Text>
                  <Text
                    style={[
                      s.watchPatternWindow,
                      { color: incidentTone, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {incidentWatch.trend.label}
                  </Text>
                </View>
                <Text
                  style={[
                    s.watchPatternEvidence,
                    { color: colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {incidentWatch.trend.windows
                    .map((item) => `${item.label}: ${item.count}`)
                    .join(" - ")}
                </Text>
                <Text
                  style={[
                    s.watchPatternNext,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {incidentWatch.trend.detail}
                </Text>
              </View>
            </View>
            {incidentWatch.triggers.length || incidentWatch.exposures.length ? (
              <View
                style={[s.watchPatternRow, { borderTopColor: colors.border }]}
              >
                <View
                  style={[s.watchSignalDot, { backgroundColor: incidentTone }]}
                />
                <View style={{ flex: 1 }}>
                  <View style={s.watchPatternTop}>
                    <Text
                      style={[
                        s.watchPatternLabel,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Incident context
                    </Text>
                    <Text
                      style={[
                        s.watchPatternWindow,
                        { color: incidentTone, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {incidentLookbackWindow?.label ?? "Lookback"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.watchPatternEvidence,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {[
                      incidentWatch.triggers.length
                        ? `Triggers: ${incidentWatch.triggers.slice(0, 3).join(", ")}`
                        : "",
                      incidentWatch.exposures.length
                        ? `Exposure: ${incidentWatch.exposures.slice(0, 3).join(", ")}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" - ")}
                  </Text>
                  <Text
                    style={[
                      s.watchPatternNext,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {incidentWatch.nextStep}
                  </Text>
                </View>
              </View>
            ) : null}
            {incidentWatch.followUpTasks.length > 0 && (
              <View
                style={[
                  s.incidentActionList,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={s.incidentActionHeader}>
                  <Text
                    style={[
                      s.incidentActionTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    Follow-up plan
                  </Text>
                  <Text
                    style={[
                      s.incidentActionCount,
                      { color: incidentTone, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {incidentWatch.followUpTasks.length} action
                    {incidentWatch.followUpTasks.length === 1 ? "" : "s"}
                  </Text>
                </View>
                {incidentWatch.followUpTasks.map((task) => {
                  const taskTone =
                    task.tone === "review"
                      ? colors.rose
                      : task.tone === "watch"
                        ? colors.amber
                        : colors.sage;
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => openIncidentFollowUp(task.route)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open Incident Watch follow-up: ${task.label}`}
                      style={[
                        s.incidentActionRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: taskTone + "0F",
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.incidentActionIcon,
                          { backgroundColor: taskTone + "1F" },
                        ]}
                      >
                        <Ionicons
                          name={
                            task.route === "trainer-care-pass"
                              ? "document-text-outline"
                              : "clipboard-outline"
                          }
                          size={15}
                          color={taskTone}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            s.incidentActionLabel,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {task.label}
                        </Text>
                        <Text
                          style={[
                            s.incidentActionDetail,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {task.detail}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
            {incidentWatch.trainerGoals.length > 0 && (
              <View
                style={[s.incidentGoalList, { borderTopColor: colors.border }]}
              >
                <View style={s.incidentActionHeader}>
                  <Text
                    style={[
                      s.incidentActionTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    Trainer goals
                  </Text>
                  <Text
                    style={[
                      s.incidentActionCount,
                      { color: colors.sage, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Review
                  </Text>
                </View>
                {incidentWatch.trainerGoals.map((goal) => (
                  <View
                    key={goal.id}
                    style={[s.incidentGoalRow, { borderColor: colors.border }]}
                  >
                    <View
                      style={[
                        s.incidentActionIcon,
                        { backgroundColor: colors.sage + "1A" },
                      ]}
                    >
                      <Ionicons
                        name={
                          goal.status === "review"
                            ? "shield-outline"
                            : "flag-outline"
                        }
                        size={15}
                        color={colors.sage}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.incidentActionLabel,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {goal.label}
                      </Text>
                      <Text
                        style={[
                          s.incidentActionDetail,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {goal.detail}
                      </Text>
                      <Text
                        style={[
                          s.incidentGoalEvidence,
                          { color: colors.sage, fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        {goal.evidence}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <Text
              style={[
                s.watchBoundary,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              Incident Watch keeps factual household context for trainer,
              sitter, and veterinarian review; it does not diagnose behavior or
              medical issues.
            </Text>
            <View style={s.incidentRow}>
              {incidentWatch.trend.windows.map((b, i) => (
                <View
                  key={b.label}
                  style={[
                    s.incidentCol,
                    i < 2 && {
                      borderRightWidth: 1,
                      borderRightColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.incidentValue,
                      {
                        color: b.count > 0 ? colors.rose : colors.sage,
                        fontFamily: DISPLAY,
                      },
                    ]}
                  >
                    {b.count}
                  </Text>
                  <Text
                    style={[
                      s.incidentLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {b.label}
                  </Text>
                  <View
                    style={[
                      s.incidentBarTrack,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <View
                      style={[
                        s.incidentBarFill,
                        {
                          backgroundColor:
                            b.count > 0 ? colors.rose : colors.sage,
                          width: `${(b.count / incidentMax) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
            {incidents.slice(0, 4).map((e, i) => (
              <View
                key={e.id}
                style={[
                  s.row,
                  { borderTopWidth: 1, borderTopColor: colors.border },
                ]}
              >
                <View
                  style={[
                    s.rowIconWrap,
                    { backgroundColor: PULSE_COLORS.sad + "16" },
                  ]}
                >
                  <PulseIcon name="sad" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.rowTitle,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {e.label}
                  </Text>
                  <Text
                    style={[
                      s.rowMeta,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {[
                      e.caregiver,
                      e.trigger || e.exposure || e.kind,
                      relativeDay(e.occurredAt, now),
                    ]
                      .filter(Boolean)
                      .join(" - ")}
                  </Text>
                </View>
                {e.severity && (
                  <View
                    style={[
                      s.sevBadge,
                      {
                        backgroundColor:
                          (e.severity === "alert"
                            ? colors.rose
                            : colors.amber) + "1A",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.sevText,
                        {
                          color:
                            e.severity === "alert" ? colors.rose : colors.amber,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {e.severity}
                    </Text>
                  </View>
                )}
              </View>
            ))}
            {incidents.length === 0 && (
              <Text
                style={[
                  s.empty,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                No incidents logged. If something happens, record the trigger,
                exposure, injury check, and follow-up here.
              </Text>
            )}
          </BoardCard>

          {/* Medication plan */}
          <BoardCard style={s.recordsBoardCard}>
            <BoardSectionHeader
              title="Medication Plan"
              accessory={
                <Pressable
                  onPress={() => router.push("/calendar")}
                  accessibilityRole="button"
                  accessibilityLabel="Open calendar medication routines"
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  style={s.shareInline}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={colors.copper}
                  />
                  <Text
                    style={[
                      s.sectionLink,
                      { color: colors.copper, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    Routines
                  </Text>
                </Pressable>
              }
            />
            <View
              style={[s.medSummaryRow, { borderBottomColor: colors.border }]}
            >
              {[
                // With no medications on file there is nothing to have logged,
                // so show a dash instead of a fabricated 100%.
                {
                  value:
                    medicationAdherence.total === 0
                      ? "—"
                      : `${medicationAdherence.adherencePercent}%`,
                  label: "Logged",
                  color:
                    medicationAdherence.total === 0
                      ? colors.mutedForeground
                      : medicationAdherence.missedCount > 0
                        ? colors.rose
                        : colors.sage,
                },
                {
                  value: String(medicationAdherence.dueCount),
                  label: "Due now",
                  color:
                    medicationAdherence.dueCount > 0
                      ? colors.amber
                      : colors.sage,
                },
                {
                  value: String(medicationAdherence.missedCount),
                  label: "Missed",
                  color:
                    medicationAdherence.missedCount > 0
                      ? colors.rose
                      : colors.sage,
                },
              ].map((item, index) => (
                <View
                  key={item.label}
                  style={[
                    s.medSummaryCell,
                    index < 2 && {
                      borderRightWidth: 1,
                      borderRightColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.medSummaryValue,
                      { color: item.color, fontFamily: DISPLAY },
                    ]}
                  >
                    {item.value}
                  </Text>
                  <Text
                    style={[
                      s.medSummaryLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
            {medicationAdherence.next ? (
              <View style={[s.medNext, { borderBottomColor: colors.border }]}>
                <Ionicons
                  name={
                    medicationAdherence.next.status === "missed"
                      ? "alert-circle"
                      : "time"
                  }
                  size={16}
                  color={
                    medicationAdherence.next.status === "missed"
                      ? colors.rose
                      : colors.amber
                  }
                />
                <Text
                  style={[
                    s.medNextText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Next: {medicationAdherence.next.label} at{" "}
                  {medicationAdherence.next.time}
                </Text>
              </View>
            ) : null}
            {medicationAdherence.total === 0 ? (
              <Text
                style={[
                  s.empty,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Add medication routines in Calendar, then medication logs will
                show what was taken, missed, or still coming up.
              </Text>
            ) : (
              medicationAdherence.items.slice(0, 5).map((item, index) => {
                const tone =
                  item.status === "taken"
                    ? colors.sage
                    : item.status === "missed"
                      ? colors.rose
                      : item.status === "due"
                        ? colors.amber
                        : colors.primary;
                const statusLabel =
                  item.status === "taken"
                    ? "Taken"
                    : item.status === "missed"
                      ? "Missed"
                      : item.status === "due"
                        ? "Due now"
                        : "Upcoming";
                const iconName =
                  item.status === "taken"
                    ? "checkmark-circle"
                    : item.status === "missed"
                      ? "alert-circle"
                      : item.status === "due"
                        ? "time"
                        : "time-outline";
                return (
                  <View
                    key={item.id}
                    style={[
                      s.row,
                      index > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[s.rowIconWrap, { backgroundColor: tone + "16" }]}
                    >
                      <Ionicons name={iconName} size={18} color={tone} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.rowTitle,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.rowMeta,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {item.dose} - {item.time}
                        {item.owner ? ` - ${item.owner}` : ""}
                      </Text>
                      {item.takenBy && item.takenAt ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            s.rowMeta,
                            {
                              color: colors.sage,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          Logged by {item.takenBy} -{" "}
                          {relativeDay(item.takenAt, now)}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        s.medStatusPill,
                        { backgroundColor: tone + "16" },
                      ]}
                    >
                      <Text
                        style={[
                          s.medStatusText,
                          { color: tone, fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
            <View style={[s.medFollowUps, { borderTopColor: colors.border }]}>
              <View style={s.medFollowUpHeader}>
                <Text
                  style={[
                    s.medFollowUpTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  Medication Follow-ups
                </Text>
                {/* Calm pill grammar (matches Incident Watch's green Clear pill)
                    instead of orange all-caps text that reads as an alert. */}
                <BoardPill
                  label={
                    medicationFollowUps.length
                      ? `${medicationFollowUps.length} active`
                      : "Clear"
                  }
                  tone={
                    medicationFollowUps.length ? colors.copper : colors.sage
                  }
                />
              </View>
              {medicationFollowUps.length === 0 ? (
                <Text
                  style={[
                    s.medFollowUpEmpty,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  No medication follow-ups right now. Refill records and
                  medication routines will surface here when they need
                  attention.
                </Text>
              ) : (
                medicationFollowUps.map((item, index) => {
                  const tone =
                    item.urgency === "alert"
                      ? colors.rose
                      : item.urgency === "watch"
                        ? colors.amber
                        : colors.primary;
                  return (
                    <View
                      key={item.id}
                      style={[
                        s.medFollowUpRow,
                        index > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.rowIconWrap,
                          { backgroundColor: tone + "16" },
                        ]}
                      >
                        <Ionicons
                          name={
                            item.kind === "refill"
                              ? "reload-circle"
                              : "notifications-outline"
                          }
                          size={18}
                          color={tone}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            s.rowTitle,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {item.label}
                        </Text>
                        <Text
                          style={[
                            s.rowMeta,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {item.detail}
                        </Text>
                        <Text
                          style={[
                            s.medFollowUpAction,
                            { color: tone, fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          {item.action}
                        </Text>
                        <Text
                          style={[
                            s.medFollowUpRule,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {item.notificationRule}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
            <View style={[s.medHistory, { borderTopColor: colors.border }]}>
              <View style={s.medFollowUpHeader}>
                <Text
                  style={[
                    s.medFollowUpTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  Medication History
                </Text>
                <BoardPill
                  label={
                    medicationHistory.total
                      ? countNoun(medicationHistory.total, "log")
                      : "No logs"
                  }
                  tone={
                    medicationHistory.total
                      ? colors.copper
                      : colors.mutedForeground
                  }
                />
              </View>
              <View
                style={[
                  s.medSearchCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="search"
                  size={16}
                  color={colors.mutedForeground}
                />
                <TextInput
                  value={medicationSearch}
                  onChangeText={setMedicationSearch}
                  accessibilityLabel="Search medication history"
                  placeholder="Search meds, dose, caregiver..."
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    s.medSearchInput,
                    { color: colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                />
                {medicationSearch.trim() ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear medication search"
                    accessibilityState={{ disabled: false }}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setMedicationSearch("");
                    }}
                    style={[s.medSearchClear, { backgroundColor: colors.card }]}
                  >
                    <Ionicons
                      name="close"
                      size={14}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.medFilterRow}
              >
                {MEDICATION_OUTCOME_FILTERS.map((option) => {
                  const active = medicationOutcomeFilter === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter medication history: ${option.label}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setMedicationOutcomeFilter(option.id);
                      }}
                      style={[
                        s.medFilterPill,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.medFilterText,
                          {
                            color: active
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {medicationHistory.hasActiveFilters ? (
                <Text
                  style={[
                    s.medHistorySummary,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {medicationHistory.summary}
                </Text>
              ) : null}
              {medicationHistory.items.length === 0 ? (
                <Text
                  style={[
                    s.medFollowUpEmpty,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {medicationHistory.emptyMessage}
                </Text>
              ) : (
                medicationHistory.items.map((item, index) => {
                  const tone =
                    item.outcome === "taken"
                      ? colors.sage
                      : item.outcome === "skipped" || item.outcome === "missed"
                        ? colors.rose
                        : colors.primary;
                  const iconName =
                    item.outcome === "taken"
                      ? "checkmark-circle"
                      : item.outcome === "missed"
                        ? "alert-circle"
                        : item.outcome === "skipped"
                          ? "remove-circle"
                          : "document-text-outline";
                  return (
                    <View
                      key={item.id}
                      style={[
                        s.medHistoryRow,
                        index > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.rowIconWrap,
                          { backgroundColor: tone + "16" },
                        ]}
                      >
                        <Ionicons name={iconName} size={18} color={tone} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={s.medHistoryTop}>
                          <Text
                            numberOfLines={1}
                            style={[
                              s.rowTitle,
                              {
                                color: colors.foreground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                          <View
                            style={[
                              s.medStatusPill,
                              { backgroundColor: tone + "16" },
                            ]}
                          >
                            <Text
                              style={[
                                s.medStatusText,
                                { color: tone, fontFamily: "Inter_700Bold" },
                              ]}
                            >
                              {item.statusLabel}
                            </Text>
                          </View>
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            s.rowMeta,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {item.dose} - {item.caregiver} -{" "}
                          {relativeDay(item.occurredAt, now)}
                        </Text>
                        {item.note ? (
                          <Text
                            style={[
                              s.medHistoryNote,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_400Regular",
                              },
                            ]}
                          >
                            {item.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </BoardCard>

          {/* Care pass */}
          <View
            collapsable={false}
            onLayout={registerSectionAnchor("care-pass")}
          />
          <BoardCard style={s.recordsBoardCard}>
            <BoardSectionHeader
              title="Care Pass"
              accessory={<BoardPill label="Preview" tone={colors.copper} />}
            />
            <View style={s.carePassList}>
              {CARE_PASS_OPTIONS.map((option) => (
                <PressScale
                  key={option.audience}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview the ${option.label} Care Pass. ${option.detail}.`}
                  onPress={() => openCarePassPreview(option.audience)}
                  scaleTo={0.97}
                  style={[
                    s.carePassRow,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.carePassIcon,
                      { backgroundColor: colors.primary + "14" },
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        s.carePassLabel,
                        { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        s.carePassDetail,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {option.detail}
                    </Text>
                  </View>
                  <Ionicons
                    name="share-outline"
                    size={16}
                    color={colors.copper}
                  />
                </PressScale>
              ))}
            </View>
          </BoardCard>

          <BoardCard style={s.recordsBoardCard}>
            <BoardSectionHeader
              title="Saved Report Presets"
              accessory={
                <BoardPill
                  label={
                    reportArtifacts.length
                      ? countNoun(reportArtifacts.length, "preset")
                      : "No presets"
                  }
                  tone={colors.primary}
                />
              }
            />
            <Text
              style={[
                s.reportPresetDisclosure,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              Saved audiences are current-data presets, not historical
              snapshots. Every preview and share is regenerated from current
              household-visible data.
            </Text>
            {reportArtifacts.length === 0 ? (
              <Text
                style={[
                  s.empty,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Save a Care Pass audience to create a current-data preset. No
                report snapshot is stored here.
              </Text>
            ) : (
              reportArtifacts.map((artifact, index) => {
                const printable = getCarePassArtifactPrintView(artifact);
                const exportView = describeCarePassArtifactExport(artifact, {
                  storageProviderConfigured: ownerOps
                    ? recordsOwnerProviderRuntime.storageProviderConfigured
                    : false,
                  storageProviderEvidence: ownerOps
                    ? recordsOwnerProviderRuntime.storageProviderEvidence
                    : null,
                });
                const binaryProofManifest = ownerOps
                  ? buildRecordsOwnerBinaryProofManifest({
                      carePassHtmlFileName: exportView.fileName,
                      dogIdSvgFileName: credentialImageView.fileName,
                      ...(credentialPngArtifactSource
                        ? {
                            generatedDogIdPng: {
                              fileName: credentialPngArtifactSource.fileName,
                              mimeType: credentialPngArtifactSource.mimeType,
                              byteSize: credentialPngArtifactSource.byteSize,
                            },
                          }
                        : {}),
                      providerRuntime: recordsOwnerProviderRuntime,
                    })
                  : null;
                const storage = exportView.storage;
                const storageProviderBacked =
                  ownerOps && storage.providerBacked;
                const sectionCount = Array.isArray(artifact.sectionTitles)
                  ? artifact.sectionTitles.length
                  : 0;
                return (
                  <View
                    key={artifact.id}
                    style={[
                      s.reportArtifactRow,
                      index < reportArtifacts.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.rowIconWrap,
                        { backgroundColor: colors.primary + "14" },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.rowTitle,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {artifact.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.rowMeta,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {shortDate(artifact.createdAt)} preset saved -{" "}
                        {countNoun(sectionCount, "current section")} -
                        regenerated when opened or shared
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.rowMeta,
                          {
                            color: colors.copper,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {exportView.fileName}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.rowMeta,
                          {
                            color: colors.sage,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {exportView.manifestRows[2]?.value}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[
                          s.artifactStorageDetail,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {ownerOps
                          ? exportView.pdfDetail
                          : "The PDF is created when you tap PDF, then stays inside WoofWatcher unless you choose to share it."}
                      </Text>
                      <View style={s.artifactStorageRow}>
                        <View
                          style={[
                            s.artifactStoragePill,
                            {
                              backgroundColor:
                                (storageProviderBacked
                                  ? colors.sage
                                  : colors.amber) + "18",
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              storageProviderBacked
                                ? "cloud-done-outline"
                                : "phone-portrait-outline"
                            }
                            size={12}
                            color={
                              storageProviderBacked ? colors.sage : colors.amber
                            }
                          />
                          <Text
                            numberOfLines={1}
                            style={[
                              s.artifactStorageText,
                              {
                                color: storageProviderBacked
                                  ? colors.sage
                                  : colors.amber,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            {ownerOps
                              ? `Preset: ${storage.label}`
                              : "Preset saved in WoofWatcher"}
                          </Text>
                        </View>
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          s.artifactStorageDetail,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        The audience preset stays in WoofWatcher. Report text
                        and printable HTML are regenerated from current
                        household-visible data when you share.
                      </Text>
                      {ownerOps && binaryProofManifest ? (
                        <>
                          <Text
                            style={[
                              s.artifactManifestTitle,
                              {
                                color: colors.foreground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            Export manifest
                          </Text>
                          <View style={s.artifactManifestGrid}>
                            {exportView.manifestRows.map((row) => (
                              <View
                                key={row.label}
                                style={[
                                  s.artifactManifestCell,
                                  {
                                    borderColor: colors.border,
                                    backgroundColor: colors.background,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.artifactManifestLabel,
                                    {
                                      color: colors.mutedForeground,
                                      fontFamily: "Inter_700Bold",
                                    },
                                  ]}
                                >
                                  {row.label}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    s.artifactManifestValue,
                                    {
                                      color: colors.foreground,
                                      fontFamily: "Inter_700Bold",
                                    },
                                  ]}
                                >
                                  {row.value}
                                </Text>
                                <Text
                                  numberOfLines={2}
                                  style={[
                                    s.artifactManifestDetail,
                                    {
                                      color: colors.mutedForeground,
                                      fontFamily: "Inter_400Regular",
                                    },
                                  ]}
                                >
                                  {row.label === "Source"
                                    ? "Regenerated from current household-visible data; not restored from a historical snapshot."
                                    : row.label === "Storage"
                                      ? "This stores the audience preset, not a report snapshot."
                                      : row.detail}
                                </Text>
                              </View>
                            ))}
                          </View>
                          <Text
                            style={[
                              s.artifactManifestTitle,
                              {
                                color: colors.foreground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            Binary proof manifest
                          </Text>
                          <View style={s.artifactManifestGrid}>
                            {binaryProofManifest.rows.map((row) => (
                              <View
                                key={row.label}
                                style={[
                                  s.artifactManifestCell,
                                  {
                                    borderColor: colors.border,
                                    backgroundColor: colors.background,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.artifactManifestLabel,
                                    {
                                      color: colors.mutedForeground,
                                      fontFamily: "Inter_700Bold",
                                    },
                                  ]}
                                >
                                  {row.label}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    s.artifactManifestValue,
                                    {
                                      color:
                                        row.status === "ready"
                                          ? colors.sage
                                          : colors.amber,
                                      fontFamily: "Inter_700Bold",
                                    },
                                  ]}
                                >
                                  {row.value}
                                </Text>
                                <Text
                                  numberOfLines={2}
                                  style={[
                                    s.artifactManifestDetail,
                                    {
                                      color: colors.mutedForeground,
                                      fontFamily: "Inter_400Regular",
                                    },
                                  ]}
                                >
                                  {row.detail}
                                </Text>
                              </View>
                            ))}
                          </View>
                          {binaryProofManifest.blockers.map((blocker) => (
                            <Text
                              key={blocker}
                              numberOfLines={2}
                              style={[
                                s.artifactManifestDetail,
                                {
                                  color: colors.mutedForeground,
                                  fontFamily: "Inter_400Regular",
                                },
                              ]}
                            >
                              - {blocker}
                            </Text>
                          ))}
                        </>
                      ) : null}
                    </View>
                    <View style={s.reportArtifactActions}>
                      <View
                        style={[
                          s.artifactBadge,
                          { backgroundColor: colors.sage + "14" },
                        ]}
                      >
                        <Text
                          style={[
                            s.artifactBadgeText,
                            { color: colors.sage, fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          {artifact.audience}
                        </Text>
                      </View>
                      <View style={s.reportArtifactButtonRow}>
                        <Pressable
                          onPress={() => shareReportArtifact(artifact)}
                          disabled={recordsShareBusy}
                          accessibilityRole="button"
                          accessibilityLabel={`Share current ${artifact.audience} Care Pass from this preset; regenerated from current household-visible data, not a historical snapshot`}
                          accessibilityState={{
                            disabled: recordsShareBusy,
                            busy: recordsShareBusy,
                          }}
                          hitSlop={MOBILE_INLINE_HIT_SLOP}
                          style={({ pressed }) => [
                            s.artifactIconButton,
                            {
                              backgroundColor: colors.primary + "12",
                              opacity: recordsShareBusy
                                ? 0.5
                                : pressed
                                  ? 0.75
                                  : 1,
                            },
                          ]}
                        >
                          <Ionicons
                            name="share-outline"
                            size={15}
                            color={colors.primary}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            void sharePrintableReportArtifact(artifact)
                          }
                          disabled={recordsShareBusy}
                          accessibilityRole="button"
                          accessibilityLabel={`Share printable current ${artifact.audience} Care Pass from this preset; regenerated from current household-visible data, not a historical snapshot`}
                          accessibilityState={{
                            disabled: recordsShareBusy,
                            busy: recordsShareBusy,
                          }}
                          hitSlop={MOBILE_INLINE_HIT_SLOP}
                          style={({ pressed }) => [
                            s.artifactIconButton,
                            {
                              backgroundColor: colors.copper + "14",
                              opacity: recordsShareBusy
                                ? 0.5
                                : pressed
                                  ? 0.75
                                  : 1,
                            },
                          ]}
                        >
                          <Ionicons
                            name="print-outline"
                            size={15}
                            color={colors.copper}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            void shareGeneratedCarePassPdfArtifact(artifact)
                          }
                          disabled={recordsShareBusy}
                          accessibilityRole="button"
                          accessibilityLabel={`Share PDF of current ${artifact.audience} Care Pass from this preset; regenerated from current household-visible data, not a historical snapshot`}
                          accessibilityState={{
                            disabled: recordsShareBusy,
                            busy: recordsShareBusy,
                          }}
                          hitSlop={MOBILE_INLINE_HIT_SLOP}
                          style={({ pressed }) => [
                            s.artifactIconButton,
                            {
                              backgroundColor: colors.sage + "14",
                              opacity: recordsShareBusy
                                ? 0.5
                                : pressed
                                  ? 0.75
                                  : 1,
                            },
                          ]}
                        >
                          <Ionicons
                            name="download-outline"
                            size={15}
                            color={colors.sage}
                          />
                        </Pressable>
                        {ownerOps ? (
                          <Pressable
                            onPress={openReportBinaryExportProofMission}
                            accessibilityRole="button"
                            accessibilityLabel={`Open report binary export proof mission for ${artifact.title}`}
                            hitSlop={MOBILE_INLINE_HIT_SLOP}
                            style={({ pressed }) => [
                              s.artifactIconButton,
                              {
                                backgroundColor: colors.amber + "14",
                                opacity: pressed ? 0.75 : 1,
                              },
                            ]}
                          >
                            <Ionicons
                              name="shield-checkmark-outline"
                              size={15}
                              color={colors.amber}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </BoardCard>

          {/* Progress report */}
          <BoardCard style={s.recordsBoardCard}>
            <BoardSectionHeader
              title="Progress Report"
              accessory={
                <Pressable
                  onPress={shareReport}
                  disabled={recordsShareBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Share the current progress report"
                  accessibilityState={{
                    disabled: recordsShareBusy,
                    busy: recordsShareBusy,
                  }}
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  style={[s.shareInline, recordsShareBusy && { opacity: 0.5 }]}
                >
                  <Ionicons
                    name="share-outline"
                    size={15}
                    color={colors.copper}
                  />
                  <Text
                    style={[
                      s.sectionLink,
                      { color: colors.copper, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    Share
                  </Text>
                </Pressable>
              }
            />
            <View style={[s.segRow, { backgroundColor: colors.background }]}>
              {PERIODS.map((p) => {
                const active = period === p.key;
                return (
                  <Pressable
                    key={p.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${p.label} progress report`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPeriod(p.key);
                    }}
                    style={[
                      s.segPill,
                      active && {
                        backgroundColor: colors.card,
                        shadowColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.segText,
                        {
                          color: active
                            ? colors.foreground
                            : colors.mutedForeground,
                          fontFamily: active
                            ? "Inter_700Bold"
                            : "Inter_500Medium",
                        },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View
              style={[
                s.reportTotalRow,
                { backgroundColor: colors.primary + "10" },
              ]}
            >
              <View>
                <Text
                  style={[
                    s.reportTotalValue,
                    { color: colors.primary, fontFamily: DISPLAY },
                  ]}
                >
                  {report.total}
                </Text>
                <Text
                  style={[
                    s.reportTotalLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  total care entries
                </Text>
              </View>
              {report.topCaregiver && (
                <View
                  style={[
                    s.topCaregiverInline,
                    { backgroundColor: colors.sage + "14" },
                  ]}
                >
                  <Ionicons name="ribbon" size={13} color={colors.sage} />
                  <Text
                    style={[
                      s.topCaregiverInlineText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {report.topCaregiver.name}
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        color: colors.mutedForeground,
                      }}
                    >
                      {" "}
                      - {countNoun(report.topCaregiver.count, "log")}
                    </Text>
                  </Text>
                </View>
              )}
            </View>
            <View style={s.reportGrid}>
              {reportStats.map((r) => (
                <View
                  key={r.label}
                  style={[s.reportCell, { backgroundColor: colors.background }]}
                >
                  <View
                    style={[
                      s.reportIcon,
                      { backgroundColor: PULSE_COLORS[r.icon] + "16" },
                    ]}
                  >
                    {r.pixelIcon ? (
                      <PixelIcon name={r.pixelIcon} size={16} />
                    ) : (
                      <PulseIcon name={r.icon} size={16} />
                    )}
                  </View>
                  <Text
                    style={[
                      s.reportValue,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {r.value}
                  </Text>
                  <Text
                    style={[
                      s.reportLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {r.label}
                  </Text>
                </View>
              ))}
            </View>
          </BoardCard>

          {/* Diet folder */}
          <BoardCard style={s.recordsBoardCard}>
            <BoardSectionHeader
              title="Diet on File"
              accessory={
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/health",
                      params: { section: "diet" },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Edit diet on file"
                  accessibilityState={{ disabled: false }}
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                >
                  <Text
                    style={[
                      s.sectionLink,
                      { color: colors.copper, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    Edit
                  </Text>
                </Pressable>
              }
            />
            <View style={s.dietHead}>
              <View
                style={[
                  s.rowIconWrap,
                  { backgroundColor: colors.copper + "16" },
                ]}
              >
                <PulseIcon name="bowl" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.rowTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  {hasDietOnFile
                    ? dietPrimaryFood || "Food not set yet"
                    : "No diet set yet"}
                </Text>
                <Text
                  style={[
                    s.rowMeta,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {hasDietOnFile
                    ? dietMeta || "Add portion and schedule with Edit."
                    : "Add food and portion with Edit."}
                </Text>
              </View>
            </View>
            {dietHistory.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text
                  style={[
                    s.subHeading,
                    { color: colors.sage, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  RECENT MEAL NOTES
                </Text>
                {dietHistory.map((e) => (
                  <View key={e.id} style={s.dietNoteRow}>
                    <View style={[s.dot, { backgroundColor: colors.copper }]} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.rowNote,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {e.note}
                      </Text>
                      <Text
                        style={[
                          s.rowMeta,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {relativeDay(e.occurredAt, now)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </BoardCard>

          {/* Records cabinet */}
          <View
            collapsable={false}
            onLayout={registerSectionAnchor("records")}
          />
          <BoardCard style={s.recordsBoardCard}>
            <BoardSectionHeader
              title="Records Cabinet"
              accessory={
                <BoardPill
                  label={`${recordVault.total} saved`}
                  tone={colors.primary}
                />
              }
            />
            {recordList.length === 0 ? (
              <View style={s.recordEmpty}>
                <Ionicons
                  name="folder-open-outline"
                  size={28}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    s.empty,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  No records saved yet. Add vaccines, visits, receipts,
                  insurance, or microchip info.
                </Text>
                <Pressable
                  onPress={() => openRecordForm("vaccine")}
                  accessibilityRole="button"
                  accessibilityLabel="Add first record"
                  accessibilityState={{ disabled: false }}
                  style={({ pressed }) => [
                    s.emptyAddBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="add"
                    size={16}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={[
                      s.emptyAddText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Add first record
                  </Text>
                </Pressable>
              </View>
            ) : (
              recordList.map((r, i) => {
                const option =
                  RECORD_OPTIONS.find((item) => item.kind === r.type) ??
                  RECORD_OPTIONS[7];
                const tone =
                  r.type === "receipt"
                    ? colors.copper
                    : r.type === "insurance" || r.type === "microchip"
                      ? colors.primary
                      : colors.sage;
                const sourceRecord = r.id
                  ? state.records.find((record) => record.id === r.id)
                  : undefined;
                const correction = getCareCorrectionPresentation(r, "due");
                const dueStatus = correction
                  ? null
                  : getRecordDueStatus(r, now);
                const statusTone = correction
                  ? colors.amber
                  : dueStatus?.status === "expired"
                    ? colors.rose
                    : dueStatus?.status === "due_soon"
                      ? colors.amber
                      : dueStatus?.status === "current"
                        ? colors.sage
                        : colors.mutedForeground;
                return (
                  <View
                    key={r.id ?? `${r.type}-${i}`}
                    style={[
                      s.row,
                      i < recordList.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[s.rowIconWrap, { backgroundColor: tone + "16" }]}
                    >
                      <Ionicons name={option.icon} size={19} color={tone} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.rowTitle,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {r.title}
                      </Text>
                      {r.note ? (
                        <Text
                          numberOfLines={2}
                          style={[
                            s.rowNote,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {r.note}
                        </Text>
                      ) : null}
                      {sourceRecord && hasAttachment(sourceRecord) ? (
                        <View style={s.recordAttachmentSummary}>
                          <Text
                            numberOfLines={1}
                            style={[
                              s.rowMeta,
                              {
                                color: colors.copper,
                                fontFamily: "Inter_600SemiBold",
                              },
                            ]}
                          >
                            {sourceRecord.attachmentName?.trim() ||
                              "Saved attachment"}
                          </Text>
                          <Text
                            style={[
                              s.attachmentDeviceOnly,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_500Medium",
                              },
                            ]}
                          >
                            Saved on this device only · not included in
                            household sync
                          </Text>
                        </View>
                      ) : null}
                      {correction ? (
                        <Text
                          style={[
                            s.rowMeta,
                            {
                              color: colors.amber,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {correction.label} · Saved value:{" "}
                          {correction.preservedValue}
                        </Text>
                      ) : null}
                    </View>
                    <View style={s.recordStatusStack}>
                      <View
                        style={[
                          s.duePill,
                          { backgroundColor: statusTone + "16" },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            s.dueText,
                            { color: statusTone, fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          {correction?.label ?? dueStatus?.label}
                        </Text>
                      </View>
                      {r.due && !correction ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            s.recordDueRef,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {dueStatus?.date ?? r.due}
                        </Text>
                      ) : null}
                    </View>
                    <View style={s.recordActions}>
                      {sourceRecord && hasAttachment(sourceRecord) ? (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Open or share attachment for ${r.title}`}
                            accessibilityState={{
                              disabled: recordsShareBusy,
                              busy: recordsShareBusy,
                            }}
                            disabled={recordsShareBusy}
                            onPress={() =>
                              void openOrShareRecordAttachment(sourceRecord)
                            }
                            style={s.deleteRecordBtn}
                          >
                            <Ionicons
                              name="open-outline"
                              size={15}
                              color={colors.copper}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove attachment from ${r.title}`}
                            accessibilityState={{ disabled: false }}
                            onPress={() => removeRecordAttachment(sourceRecord)}
                            style={s.deleteRecordBtn}
                          >
                            <Ionicons
                              name="close-circle-outline"
                              size={15}
                              color={colors.rose}
                            />
                          </Pressable>
                        </>
                      ) : null}
                      {r.id ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${r.title}`}
                          onPress={() => {
                            const source = state.records.find(
                              (record) => record.id === r.id,
                            );
                            if (source) openEditRecord(source);
                          }}
                          style={s.deleteRecordBtn}
                        >
                          <Ionicons
                            name="pencil-outline"
                            size={15}
                            color={colors.primary}
                          />
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${r.title}`}
                        onPress={() => deleteRecord(r.id, r.title)}
                        style={s.deleteRecordBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </BoardCard>

          {/* Vet boundary */}
          <View
            style={[
              s.notice,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="shield-checkmark" size={16} color={colors.sage} />
            <Text
              style={[
                s.noticeText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {state.profile.vetBoundary}
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={carePassPreview !== null}
        transparent
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={() => {
          if (!carePassSaveShareBusy) setCarePassPreviewAudience(null);
        }}
      >
        <ModalBackdropPressable
          style={s.modalBackdrop}
          onPress={() => {
            if (!carePassSaveShareBusy) setCarePassPreviewAudience(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={keyboardOffset}
            style={s.modalDock}
          >
            <ModalSheetPressable
              visible={carePassPreview !== null}
              closeDisabled={carePassSaveShareBusy}
              closeBusy={carePassSaveShareBusy}
              onRequestClose={() => {
                if (!carePassSaveShareBusy) setCarePassPreviewAudience(null);
              }}
              style={[
                s.recordSheet,
                {
                  backgroundColor: colors.card,
                  paddingBottom: modalSheetBottomPadding,
                },
              ]}
            >
              <View style={s.sheetHandle} />
              {carePassPreview ? (
                <>
                  <View style={s.sheetHeader}>
                    <View
                      style={[
                        s.rowIconWrap,
                        { backgroundColor: colors.primary + "14" },
                      ]}
                    >
                      <Ionicons
                        name="newspaper-outline"
                        size={19}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        accessibilityRole="header"
                        style={[
                          s.sheetTitle,
                          {
                            color: colors.foreground,
                            fontFamily: DISPLAY_SEMI,
                          },
                        ]}
                      >
                        {carePassPreview.title}
                      </Text>
                      <Text
                        style={[
                          s.sheetSub,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {carePassPreview.generatedAt}
                      </Text>
                    </View>
                  </View>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    style={s.passPreviewScroll}
                  >
                    <Text
                      style={[
                        s.passSummary,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {carePassPreview.summary}
                    </Text>
                    <Text
                      style={[
                        s.reportPresetDisclosure,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      Saving creates an audience preset. It is regenerated from
                      current household-visible data each time, not a historical
                      snapshot.
                    </Text>
                    {carePassPreview.sections.map((section) => (
                      <View
                        key={section.title}
                        style={[
                          s.passSection,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.passSectionTitle,
                            {
                              color: colors.foreground,
                              fontFamily: DISPLAY_SEMI,
                            },
                          ]}
                        >
                          {section.title}
                        </Text>
                        {section.lines.map((line) => (
                          <View key={line} style={s.passLineRow}>
                            <View
                              style={[
                                s.passDot,
                                { backgroundColor: colors.primary },
                              ]}
                            />
                            <Text
                              style={[
                                s.passLine,
                                {
                                  color: colors.mutedForeground,
                                  fontFamily: "Inter_400Regular",
                                },
                              ]}
                            >
                              {line}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                  {carePassSaveShareNotice ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[
                        s.carePassSaveNotice,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {carePassSaveShareNotice}
                    </Text>
                  ) : null}
                  <View style={s.sheetActions}>
                    <Pressable
                      onPress={() => setCarePassPreviewAudience(null)}
                      disabled={carePassSaveShareBusy}
                      accessibilityRole="button"
                      accessibilityLabel="Close Care Pass preview"
                      accessibilityState={{
                        disabled: carePassSaveShareBusy,
                        busy: carePassSaveShareBusy,
                      }}
                      style={[
                        s.sheetCancel,
                        carePassSaveShareBusy && { opacity: 0.5 },
                      ]}
                    >
                      <Text
                        style={[
                          s.sheetCancelText,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        Close
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => shareCarePass(carePassPreview.audience)}
                      disabled={recordsShareBusy || carePassSaveShareBusy}
                      accessibilityRole="button"
                      accessibilityLabel="Save Care Pass and share current data"
                      accessibilityState={{
                        disabled: recordsShareBusy || carePassSaveShareBusy,
                        busy: carePassSaveShareBusy,
                      }}
                      style={({ pressed }) => [
                        s.sheetSave,
                        {
                          backgroundColor: colors.primary,
                          opacity:
                            recordsShareBusy || carePassSaveShareBusy
                              ? 0.5
                              : pressed
                                ? 0.85
                                : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.sheetSaveText,
                          {
                            color: colors.primaryForeground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {carePassSaveShareBusy
                          ? "Saving & sharing…"
                          : "Save & share"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </ModalSheetPressable>
          </KeyboardAvoidingView>
        </ModalBackdropPressable>
      </Modal>

      <Modal
        visible={recordOpen}
        transparent
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={() => void closeRecordForm()}
      >
        <ModalBackdropPressable
          style={s.modalBackdrop}
          onPress={() => void closeRecordForm()}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={keyboardOffset}
            style={s.modalDock}
          >
            <ModalSheetPressable
              visible={recordOpen}
              closeDisabled={recordSaveBusy}
              closeBusy={recordSaveBusy}
              onRequestClose={() => void closeRecordForm()}
              style={[
                s.recordSheet,
                {
                  backgroundColor: colors.card,
                  paddingBottom: modalSheetBottomPadding,
                },
              ]}
            >
              <View style={s.sheetHandle} />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                bounces={false}
                style={s.recordFormScroll}
                contentContainerStyle={s.recordFormContent}
              >
                <View style={s.sheetHeader}>
                  <View
                    style={[
                      s.rowIconWrap,
                      { backgroundColor: colors.primary + "14" },
                    ]}
                  >
                    <Ionicons
                      name={recordOption.icon}
                      size={19}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      accessibilityRole="header"
                      style={[
                        s.sheetTitle,
                        { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                      ]}
                    >
                      {recordEditId
                        ? `Edit ${recordOption.label}`
                        : `Add ${recordOption.label}`}
                    </Text>
                    <Text
                      style={[
                        s.sheetSub,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {recordOption.detail}
                    </Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.recordTypeRow}
                >
                  {RECORD_OPTIONS.map((option) => {
                    const active = option.kind === recordType;
                    return (
                      <Pressable
                        key={option.kind}
                        disabled={recordPickerBusy || recordSaveBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${option.label} record type`}
                        accessibilityState={{
                          selected: active,
                          disabled: recordPickerBusy || recordSaveBusy,
                        }}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setRecordType(option.kind);
                        }}
                        style={[
                          s.recordTypePill,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : colors.background,
                            borderColor: active
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={14}
                          color={
                            active ? colors.primaryForeground : colors.primary
                          }
                        />
                        <Text
                          style={[
                            s.recordTypeText,
                            {
                              color: active
                                ? colors.primaryForeground
                                : colors.foreground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text
                  style={[
                    s.editFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  TITLE
                </Text>
                <TextInput
                  value={recordTitle}
                  onChangeText={setRecordTitle}
                  accessibilityLabel={`${recordOption.label} title`}
                  placeholder={`${recordOption.label} name`}
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    s.recordInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />
                <Text
                  style={[
                    s.editFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {recordOption.dueLabel.toUpperCase()}
                </Text>
                <TextInput
                  value={recordDue}
                  onChangeText={(value) => {
                    setRecordDue(value);
                    setRecordDueError(null);
                  }}
                  accessibilityLabel={recordOption.dueLabel}
                  placeholder="YYYY-MM-DD (optional)"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={10}
                  style={[
                    s.recordInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: recordDueError ? colors.rose : colors.border,
                      color: recordDueError ? colors.rose : colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />
                {recordDueError ? (
                  <Text
                    aria-live="polite"
                    style={[
                      s.sheetSub,
                      { color: colors.rose, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {recordDueError}
                  </Text>
                ) : null}
                <Text
                  style={[
                    s.editFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  NOTES
                </Text>
                <TextInput
                  value={recordNote}
                  onChangeText={setRecordNote}
                  accessibilityLabel={`${recordOption.label} notes`}
                  placeholder="Dose, provider, receipt amount, card details, or anything useful"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[
                    s.recordInput,
                    s.recordInputMulti,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                />
                <View style={s.attachmentPickerRow}>
                  <Pressable
                    onPress={() => void pickRecordAttachment("photo")}
                    disabled={recordPickerBusy || recordSaveBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Choose a photo attachment"
                    accessibilityState={{
                      disabled: recordPickerBusy || recordSaveBusy,
                      busy: recordPickerBusy,
                    }}
                    style={({ pressed }) => [
                      s.attachmentBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        opacity:
                          recordPickerBusy || recordSaveBusy
                            ? 0.5
                            : pressed
                              ? 0.75
                              : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        s.attachmentText,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      Photo
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void pickRecordAttachment("document")}
                    disabled={recordPickerBusy || recordSaveBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Choose a PDF or document attachment"
                    accessibilityState={{
                      disabled: recordPickerBusy || recordSaveBusy,
                      busy: recordPickerBusy,
                    }}
                    style={({ pressed }) => [
                      s.attachmentBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        opacity:
                          recordPickerBusy || recordSaveBusy
                            ? 0.5
                            : pressed
                              ? 0.75
                              : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        s.attachmentText,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      PDF or document
                    </Text>
                  </Pressable>
                </View>
                {recordAttachmentUri ? (
                  <View
                    style={[
                      s.selectedAttachment,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.sage}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.attachmentText,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {recordAttachmentName ||
                          `${recordOption.label} attachment`}
                      </Text>
                      <Text
                        style={[
                          s.attachmentDeviceOnly,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        Saved on this device only · not included in household
                        sync
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text
                    style={[
                      s.attachmentDeviceOnly,
                      s.attachmentDeviceOnlyHint,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Attachments stay on this device and are not included in
                    household sync.
                  </Text>
                )}
                <View style={s.sheetActions}>
                  <Pressable
                    onPress={() => void closeRecordForm()}
                    disabled={recordSaveBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel record editor"
                    accessibilityState={{
                      disabled: recordSaveBusy,
                      busy: recordSaveBusy,
                    }}
                    style={[s.sheetCancel, recordSaveBusy && { opacity: 0.5 }]}
                  >
                    <Text
                      style={[
                        s.sheetCancelText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={saveRecord}
                    disabled={recordPickerBusy || recordSaveBusy}
                    accessibilityRole="button"
                    accessibilityLabel={
                      recordEditId ? "Save record changes" : "Save new record"
                    }
                    accessibilityState={{
                      disabled: recordPickerBusy || recordSaveBusy,
                      busy: recordSaveBusy,
                    }}
                    style={({ pressed }) => [
                      s.sheetSave,
                      {
                        backgroundColor: colors.primary,
                        opacity:
                          recordPickerBusy || recordSaveBusy
                            ? 0.5
                            : pressed
                              ? 0.85
                              : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.sheetSaveText,
                        {
                          color: colors.primaryForeground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {recordEditId ? "Save changes" : "Save record"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </ModalSheetPressable>
          </KeyboardAvoidingView>
        </ModalBackdropPressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },

  sectionLink: { fontSize: 14 },
  shareStatusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  shareStatusText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  deepLinkSyncError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  deepLinkSyncErrorCopy: { flex: 1, gap: 2 },
  deepLinkSyncErrorTitle: { fontSize: 13.5, lineHeight: 18 },
  deepLinkSyncErrorBody: { fontSize: 12, lineHeight: 17 },
  deepLinkSyncRetry: {
    minWidth: 68,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  shareInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingHorizontal: 8,
    gap: 4,
  },
  // Dog ID export actions: a wrapping row under the section title so all four
  // actions and the title stay visible at narrow (393px) widths.
  idShareRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 8,
    marginLeft: -8,
    marginBottom: 4,
  },

  recordsCredentialStageCard: {
    alignSelf: "stretch",
    width: "100%",
    maxWidth: "100%",
    marginTop: 2,
    marginBottom: 14,
    padding: 0,
    overflow: "hidden",
  },
  recordsCredentialStage: {
    width: "100%",
    minHeight: 190,
    overflow: "hidden",
    justifyContent: "flex-start",
  },
  recordsCredentialStageImage: {
    borderRadius: 22,
  },
  recordsCredentialStageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 16, 28, 0.12)",
  },
  recordsCredentialStageTop: {
    zIndex: 3,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    padding: 10,
  },
  recordsCredentialBubble: {
    maxWidth: "61%",
    borderWidth: 2,
    borderColor: "#18314A",
    backgroundColor: "rgba(255,249,239,0.96)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: "#071523",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  // Quiet sage caps kicker (mockup parity: no copper/orange kickers).
  recordsCredentialKicker: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  recordsCredentialSpeech: {
    fontSize: 13,
    lineHeight: 17,
  },
  recordsCredentialBubbleTail: {
    position: "absolute",
    left: 42,
    bottom: -10,
    width: 14,
    height: 14,
    backgroundColor: "rgba(255,249,239,0.96)",
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#18314A",
    transform: [{ rotate: "45deg" }],
  },
  recordsCredentialChip: {
    maxWidth: 104,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  recordsCredentialChipText: {
    flexShrink: 1,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  recordsCredentialSprite: {
    position: "absolute",
    right: 22,
    bottom: 8,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  recordsCredentialSpriteShadow: {
    position: "absolute",
    bottom: 3,
    width: 78,
    height: 13,
    borderRadius: 999,
    backgroundColor: "rgba(7, 18, 30, 0.25)",
  },
  recordsCredentialDock: {
    borderTopWidth: 1,
    paddingHorizontal: 9,
    paddingTop: 8,
    paddingBottom: 9,
    gap: 7,
  },
  recordsCredentialIdPlate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#071523",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  recordsCredentialIdLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  recordsCredentialIdName: {
    fontSize: 21,
    letterSpacing: -0.2,
    marginTop: 1,
  },
  recordsCredentialIdMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  // Parchment stat chips (was one navy strip): each cell is its own light
  // chip with a sage caps label over an ink value.
  recordsCredentialHud: {
    flexDirection: "row",
    gap: 7,
  },
  recordsCredentialHudCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  recordsCredentialHudLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  recordsCredentialHudValue: {
    fontSize: 16,
  },

  recordsCommandCard: {
    marginTop: 0,
    marginBottom: 14,
  },
  recordsCommandList: {
    gap: 9,
  },
  recordsCommandRow: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  recordsCommandIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  recordsCommandCopy: {
    flex: 1,
    minWidth: 0,
  },
  recordsCommandEyebrow: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  recordsCommandTitle: {
    fontSize: 14.6,
    lineHeight: 19,
    marginTop: 2,
  },
  recordsCommandDetail: {
    fontSize: 11.7,
    lineHeight: 16,
    marginTop: 2,
  },
  recordsCommandAction: {
    width: 58,
    flexShrink: 0,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  recordsCommandActionText: {
    fontSize: 10.5,
    lineHeight: 14,
  },

  idCard: {
    borderRadius: 22,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 5,
  },
  idCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  idBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  idEyebrow: { fontSize: 10.5, letterSpacing: 0.8 },
  idName: { fontSize: 28, letterSpacing: -0.3, marginTop: 1 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  idField: { width: "48%" },
  idFieldLabel: {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.72,
  },
  idFieldValue: { fontSize: 13.5, lineHeight: 18, marginTop: 3 },
  idFooter: { borderTopWidth: 1, marginTop: 16, paddingTop: 12 },
  idFooterText: { fontSize: 12.5, lineHeight: 17 },

  vaultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // Springy vault tiles: layout width lives on the PressScale container,
  // visuals on the inner scaled card.
  vaultCardLayout: { width: "48%" },
  vaultCard: {
    width: "100%",
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
  },
  vaultIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  vaultLabel: { fontSize: 15 },
  vaultMeta: { fontSize: 12.5, marginTop: 3 },
  vaultNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  vaultNoticeText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  reminderList: {
    borderWidth: 1,
    borderRadius: 18,
    marginTop: 12,
    overflow: "hidden",
  },
  reminderRow: { flexDirection: "row", gap: 10, padding: 12 },
  reminderIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderTitle: { fontSize: 13.5 },
  reminderDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  reminderAction: { fontSize: 11.5, lineHeight: 16, marginTop: 4 },

  chartTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  chartBig: { fontSize: 30, letterSpacing: -0.5 },
  chartUnit: { fontSize: 15 },
  chartCaption: { fontSize: 12.5, marginTop: 1 },
  goalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 13,
  },
  goalPillText: { fontSize: 12.5 },
  chartNote: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  weightEmpty: {
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  weightEmptyTitle: { fontSize: 14.5, textAlign: "center" },

  empty: { fontSize: 14, paddingVertical: 16, textAlign: "center" },
  trendHeroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  trendStatGrid: { flexDirection: "row", gap: 9, marginBottom: 8 },
  trendStatCell: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  trendStatValue: { fontSize: 21, letterSpacing: 0 },
  trendStatLabel: { fontSize: 10.5, marginTop: 2, textAlign: "center" },
  trendSignalStack: { marginTop: 2, marginBottom: 10 },
  trendSignalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  trendSignalTitle: { fontSize: 12.8 },
  trendSignalDetail: { fontSize: 12.3, lineHeight: 17, marginTop: 3 },

  moodSummary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  moodEnergyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  moodEnergyPill: {
    flex: 1,
    minWidth: 80,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  moodEnergyValue: { fontSize: 18, letterSpacing: 0 },
  moodEnergyLabel: {
    fontSize: 10.5,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  moodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  moodLabel: { fontSize: 14, width: 64 },
  moodTrack: { flex: 1, height: 12, borderRadius: 6, overflow: "hidden" },
  moodFill: { height: "100%", borderRadius: 6 },
  moodPct: { fontSize: 12.5, width: 34, textAlign: "right" },
  moodCount: { fontSize: 12, width: 28 },
  moodLatest: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 8,
  },

  hydrationSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  hydrationMeter: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  hydrationMeterFill: { height: "100%", borderRadius: 4 },
  hydrationStats: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
  },
  hydrationStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  hydrationValue: { fontSize: 21, letterSpacing: 0 },
  hydrationLabel: { fontSize: 10.5, marginTop: 2, textAlign: "center" },
  hydrationNext: { fontSize: 12.5, lineHeight: 18 },
  routeTemplateList: { borderTopWidth: 1, marginTop: 14, paddingTop: 13 },
  routeTemplateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 4,
  },
  routeTemplateTitle: { fontSize: 15.5 },
  routeTemplateCount: {
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  routeTemplateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
  },
  routeTemplateIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  routeTemplateName: { fontSize: 14.5 },
  routeTemplateMeta: { fontSize: 12.2, lineHeight: 17, marginTop: 2 },
  routeTemplateNote: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  routeTemplateMetric: {
    minWidth: 48,
    borderRadius: 13,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  routeTemplateMetricValue: { fontSize: 18, letterSpacing: -0.2 },
  routeTemplateMetricLabel: { fontSize: 10.2, marginTop: 1 },

  incidentRow: { flexDirection: "row", marginBottom: 4 },
  watchSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  watchSummaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  watchSummaryTitle: { fontSize: 15 },
  watchSummaryDetail: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  watchSignalDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  watchPatternRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
  },
  watchPatternTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  watchPatternLabel: { fontSize: 12.5, flex: 1 },
  watchPatternWindow: { fontSize: 10.5 },
  watchPatternEvidence: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  watchPatternNext: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  watchBoundary: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 12,
    marginBottom: 10,
  },
  incidentActionList: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    gap: 9,
  },
  incidentGoalList: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    gap: 9,
  },
  incidentActionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  incidentActionTitle: { fontSize: 15 },
  incidentActionCount: {
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  incidentActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  incidentGoalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  incidentActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  incidentActionLabel: { fontSize: 12.8 },
  incidentActionDetail: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  incidentGoalEvidence: { fontSize: 11.2, lineHeight: 15, marginTop: 5 },
  incidentCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingBottom: 14,
  },
  incidentValue: { fontSize: 26, letterSpacing: -0.4 },
  incidentLabel: { fontSize: 12, marginTop: 1 },
  incidentBarTrack: {
    height: 5,
    borderRadius: 3,
    width: "70%",
    marginTop: 8,
    overflow: "hidden",
  },
  incidentBarFill: { height: "100%", borderRadius: 3 },

  medSummaryRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 4,
  },
  medSummaryCell: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  medSummaryValue: { fontSize: 24, letterSpacing: -0.3 },
  medSummaryLabel: { fontSize: 11.5, marginTop: 2, textAlign: "center" },
  medNext: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  medNextText: { flex: 1, fontSize: 12.8, lineHeight: 18 },
  medStatusPill: {
    minWidth: 76,
    alignItems: "center",
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  medStatusText: {
    fontSize: 10.8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  medFollowUps: { borderTopWidth: 1, marginTop: 4, paddingTop: 14 },
  medFollowUpHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 2,
  },
  medFollowUpTitle: { fontSize: 15 },
  medFollowUpEmpty: { fontSize: 12.5, lineHeight: 18, paddingTop: 8 },
  medFollowUpRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  medFollowUpAction: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  medFollowUpRule: { fontSize: 11.2, lineHeight: 16, marginTop: 4 },
  medHistory: { borderTopWidth: 1, marginTop: 4, paddingTop: 14 },
  medSearchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 6,
  },
  medSearchInput: {
    flex: 1,
    fontSize: 13.5,
    minHeight: 26,
    paddingVertical: 0,
  },
  medSearchClear: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  medFilterRow: { gap: 7, paddingVertical: 9 },
  medFilterPill: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 7,
    justifyContent: "center",
  },
  medFilterText: { fontSize: 11.5 },
  medHistorySummary: { fontSize: 12, lineHeight: 17, marginBottom: 1 },
  medHistoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  medHistoryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  medHistoryNote: { fontSize: 12.2, lineHeight: 17, marginTop: 5 },

  recordsBoardCard: { marginTop: 20 },
  baselineIntro: { fontSize: 12.5, lineHeight: 18, marginBottom: 6 },
  baselineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingVertical: 6,
    borderRadius: 10,
  },
  baselineIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  baselineLabel: { flex: 1, minWidth: 0, fontSize: 13.5 },
  baselineStatus: { fontSize: 11.5 },
  carePassList: { gap: 9 },
  carePassRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  carePassIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  carePassLabel: { fontSize: 15 },
  carePassDetail: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    paddingRight: 14,
  },
  reportPresetDisclosure: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  reportArtifactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  reportArtifactActions: { alignItems: "flex-end", gap: 8 },
  reportArtifactButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  artifactStorageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },
  artifactStoragePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    maxWidth: 170,
  },
  artifactStorageText: {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  artifactStorageDetail: { fontSize: 11.5, lineHeight: 15, marginTop: 5 },
  artifactManifestTitle: {
    fontSize: 11.5,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  artifactManifestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 7,
  },
  artifactManifestCell: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  artifactManifestLabel: {
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  artifactManifestValue: { fontSize: 11.5, marginTop: 3 },
  artifactManifestDetail: { fontSize: 10.5, lineHeight: 14, marginTop: 3 },
  artifactIconButton: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  artifactBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  artifactBadgeText: {
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 15, flexShrink: 1 },
  rowNote: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  rowMeta: { fontSize: 12, marginTop: 4 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sevText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 },
  recordStatusStack: { alignItems: "flex-end", maxWidth: 96, gap: 4 },
  duePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  dueText: { fontSize: 11.5 },
  recordDueRef: { fontSize: 10.5, maxWidth: 96 },
  recordActions: {
    width: MIN_MOBILE_TOUCH_TARGET * 2,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  deleteRecordBtn: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  recordEmpty: { alignItems: "center", gap: 8, paddingVertical: 10 },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyAddText: { fontSize: 13.5 },

  highlightStrip: {
    flexDirection: "row",
    borderRadius: 22,
    marginBottom: 0,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
    overflow: "hidden",
  },
  highlightCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 6,
  },
  highlightValue: { fontSize: 24, letterSpacing: -0.4 },
  highlightLabel: { fontSize: 11.5, marginTop: 3, textAlign: "center" },

  reportTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  reportTotalValue: { fontSize: 30, letterSpacing: -0.5 },
  reportTotalLabel: { fontSize: 12.5, marginTop: 1 },
  topCaregiverInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topCaregiverInlineText: { fontSize: 13 },

  segRow: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  segPill: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  segText: { fontSize: 13.5 },
  reportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reportCell: {
    flexBasis: "45%",
    flexGrow: 1,
    minWidth: 110,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  reportIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  reportValue: { fontSize: 18, letterSpacing: -0.3 },
  reportLabel: { fontSize: 11, marginTop: 2 },
  dietHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 6,
  },
  subHeading: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 4,
  },
  dietNoteRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 7,
    alignItems: "flex-start",
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },

  notice: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 24,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,31,36,0.45)" },
  modalDock: { flex: 1, justifyContent: "flex-end" },
  recordSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: "92%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 20, letterSpacing: -0.2 },
  sheetSub: { fontSize: 13, marginTop: 2 },
  passPreviewScroll: { maxHeight: 420 },
  passSummary: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  carePassSaveNotice: { fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  passSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
  },
  passSectionTitle: { fontSize: 15, marginBottom: 8 },
  passLineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  passDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  passLine: { flex: 1, fontSize: 12.8, lineHeight: 18 },
  recordTypeRow: { gap: 8, paddingVertical: 4 },
  recordTypePill: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recordTypeText: { fontSize: 12.5 },
  recordFormScroll: { flexShrink: 1 },
  recordFormContent: { paddingBottom: 4 },
  editFieldLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 7,
    marginTop: 14,
  },
  recordInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
  },
  recordInputMulti: { minHeight: 76, textAlignVertical: "top" },
  attachmentPickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attachmentBtn: {
    minWidth: 140,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  attachmentText: { flexShrink: 1, fontSize: 13.5, textAlign: "center" },
  selectedAttachment: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  attachmentDeviceOnly: { fontSize: 11.5, lineHeight: 16 },
  attachmentDeviceOnlyHint: { marginTop: 8 },
  recordAttachmentSummary: { gap: 2, marginTop: 3 },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  sheetCancel: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelText: { fontSize: 15 },
  sheetSave: {
    flex: 2,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSaveText: { fontSize: 15 },
});
