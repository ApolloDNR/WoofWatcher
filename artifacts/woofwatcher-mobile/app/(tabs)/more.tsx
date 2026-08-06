import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Redirect,
  type Href,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
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
import { isClerkEnabledForBuild, useWoofAuth } from "@/lib/auth";
import {
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import {
  deriveCareIntelligence,
  deriveHouseholdResponsibility,
} from "@workspace/care-domain";
import { useColors } from "@/hooks/useColors";
import { useCare } from "@/context/CareContext";
import { useAvatar } from "@/context/AvatarContext";
import { confirmThroughSteps, notifyDialog } from "@/lib/confirmDialog";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";
import { deriveCareSyncDashboard, type CareSyncDashboard } from "@/lib/careSync";
import { deriveAttachmentManifest } from "@/lib/attachmentManifest";
import {
  buildBetaHandoffPacketShareText,
  RECORDED_LIVE_PREVIEW_HANDOFF_PROOF,
  RECORDED_MOBILE_BETA_CI_PROOF,
} from "@/lib/betaHandoffPacket";
import {
  deriveLaunchReadiness,
  type LaunchReadinessNativeQaSummary,
  type LaunchReadinessNextGateAction,
  type LaunchReadinessOverallStatus,
  type LaunchReadinessTileKey,
  type LaunchReadinessTileStatus,
} from "@/lib/launchReadiness";
import {
  buildLaunchProviderSetupShareText,
  deriveLaunchProviderSetup,
  normalizeLaunchProviderProfile,
  type LaunchProviderSetupKey,
  type LaunchProviderProfile,
} from "@/lib/launchProviderSetup";
import {
  buildMobileLaunchQaCapturePlan,
  buildMobileLaunchQaCaptureShareText,
  buildMobileLaunchQaFixBriefShareText,
  deriveNativeQaSummaryFromMobileQaSession,
  mobileLaunchQaCaptureTargetStatusLabel,
  type MobileLaunchQaCapturePlan,
  type MobileLaunchQaCaptureTarget,
} from "@/lib/mobileLaunchQaEvidence";
import {
  MOBILE_QA_SESSION_STORAGE_KEY,
  buildMobileQaSessionProofManifest,
  buildMobileQaSessionSnapshot,
  parseMobileQaSessionSnapshot,
  type MobileQaSessionProofManifest,
} from "@/lib/mobileQaSession";
import { buildReleasePacket, buildReleasePacketShareText } from "@/lib/releasePacket";
import { buildStoreSubmissionPacket, buildStoreSubmissionPacketShareText } from "@/lib/storeSubmissionPacket";
import { deriveSupportRunbookPlan } from "@/lib/supportRunbook";
import { shareTextPayload } from "@/lib/shareText";
import {
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { CARE_TWIN_ROOM_VARIANT_ASSETS, getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import { pixelImageStyle, stageImageFill } from "@/lib/pixelRendering";
import { BoardActionButton, BoardCard, BoardMetricTile, BoardPill, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { ProgressFill } from "@/components/motion/GameFeel";
import { getConsumerSurfacePolicy } from "@/lib/consumerSurfacePolicy";
import {
  CARE_READ_ONLY_MESSAGE,
  runAcceptedCareMutation,
} from "@/lib/careWriteProtection";
import { validateProfileWeightDraft } from "@/lib/careWorkflowValidation";
import { addLocalCalendarDays, localDateKey, todayLocalDateKey } from "@/lib/localCalendar";
import {
  deriveCareCareer,
  deriveCareerWeek,
  deriveCareStreak,
} from "@/lib/careCareer";
import { CareTeamSuppliesScreen } from "@/components/more/CareTeamSuppliesScreen";
import { resolveMoreSectionRoute } from "@/lib/moreSectionRouting";
import { resolveCanonicalDestination } from "@/lib/navigationOwnership";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const MORE_COMMAND_STAGE_ROOM = CARE_TWIN_ROOM_VARIANT_ASSETS.night.source;
const MORE_COMMAND_STAGE_SPRITE = getCareTwinSpriteAsset("idle-breathe");
const MORE_COMMAND_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["idle-breathe"];

type HouseholdMemberSummary = {
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
};

type MoreRouteSearchParams = {
  section?: string | string[];
  item?: string | string[];
  entry?: string | string[];
  walk?: string | string[];
  prompt?: string | string[];
  doc?: string | string[];
  focus?: string | string[];
};

interface MoreDirectoryItem {
  id: string;
  iconName: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  label: string;
  detail: string;
  actionLabel: string;
  tone: string;
  onPress: () => void;
}

type LaunchProviderFlagKey = keyof Pick<
  LaunchProviderProfile,
  | "authConfigured"
  | "databaseConfigured"
  | "storageProviderConfigured"
  | "aiProviderConfigured"
  | "paymentsEnabled"
  | "pushNotificationsConfigured"
  | "appStoreAccountsReady"
  | "accountDeletionEnabled"
>;

type LaunchProviderProofFlagKey = keyof Pick<
  LaunchProviderProfile,
  | "authProviderProofReady"
  | "databaseProviderProofReady"
  | "storageProviderProofReady"
  | "aiProviderProofReady"
  | "paymentsProviderProofReady"
  | "pushNotificationsProofReady"
  | "storeAccountsProofReady"
  | "accountDeletionProofReady"
>;

const PROVIDER_SETUP_FIELDS: Array<{
  key: LaunchProviderFlagKey;
  proofKey: LaunchProviderProofFlagKey;
  label: string;
  detail: string;
}> = [
  {
    key: "authConfigured",
    proofKey: "authProviderProofReady",
    label: "Production auth",
    detail: "Clerk keys, redirects, household sign-in, and session rules.",
  },
  {
    key: "databaseConfigured",
    proofKey: "databaseProviderProofReady",
    label: "Household database",
    detail: "Supabase/Postgres tables, RLS, backups, and migrations.",
  },
  {
    key: "storageProviderConfigured",
    proofKey: "storageProviderProofReady",
    label: "Records storage",
    detail: "Signed uploads/downloads, retention, export, and deletion rules.",
  },
  {
    key: "aiProviderConfigured",
    proofKey: "aiProviderProofReady",
    label: "WoofGuide AI",
    detail: "Provider key, model policy, owner review, and vet boundary.",
  },
  {
    key: "paymentsEnabled",
    proofKey: "paymentsProviderProofReady",
    label: "Plus payments",
    detail: "Subscription tiers, app-store billing, refunds, and entitlement checks.",
  },
  {
    key: "pushNotificationsConfigured",
    proofKey: "pushNotificationsProofReady",
    label: "Push reminders",
    detail: "Expo push, APNs/FCM, permission copy, quiet hours, and opt-out.",
  },
  {
    key: "appStoreAccountsReady",
    proofKey: "storeAccountsProofReady",
    label: "Store accounts",
    detail: "Apple Developer, App Store Connect, Google Play Console, bundle ids.",
  },
  {
    key: "accountDeletionEnabled",
    proofKey: "accountDeletionProofReady",
    label: "Account deletion",
    detail: "Self-serve deletion, export warning, provider deletion, and audit receipt.",
  },
];

function launchTileIcon(
  key: LaunchReadinessTileKey,
  syncIcon: keyof typeof Ionicons.glyphMap,
): keyof typeof Ionicons.glyphMap {
  switch (key) {
    case "native-qa":
      return "phone-portrait-outline";
    case "care-sync":
      return syncIcon;
    case "storage":
      return "folder-open-outline";
    case "woofguide-ai":
      return "sparkles-outline";
    case "plus-payments":
      return "diamond-outline";
    case "store-approval":
      return "shield-checkmark-outline";
  }
}

function launchStatusTone(
  status: LaunchReadinessTileStatus,
  colors: ReturnType<typeof useColors>,
): string {
  switch (status) {
    case "ready":
      return colors.sage;
    case "blocked":
      return colors.rose;
    case "local":
      return colors.copper;
    default:
      return colors.amber;
  }
}

function launchBadgeTone(
  status: LaunchReadinessOverallStatus,
  colors: ReturnType<typeof useColors>,
): string {
  if (status === "store-ready") return colors.sage;
  if (status === "approval-required") return colors.copper;
  if (status === "provider-gated") return colors.rose;
  return colors.amber;
}

function launchNextGateIcon(action: LaunchReadinessNextGateAction): keyof typeof Ionicons.glyphMap {
  switch (action) {
    case "open-native-qa":
    case "share-native-qa-fix-brief":
      return "phone-portrait-outline";
    case "open-provider-setup":
      return "construct-outline";
    case "open-privacy":
      return "shield-checkmark-outline";
    case "open-premium":
      return "diamond-outline";
    case "open-woofguide":
      return "sparkles-outline";
    case "open-avatar-studio":
      return "color-palette-outline";
    case "share-beta-handoff":
      return "rocket-outline";
    case "share-launch-packet":
      return "share-social-outline";
    case "share-store-packet":
      return "storefront-outline";
  }
}

function buildCareTwinQaFocusRoute(target: Pick<MobileLaunchQaCaptureTarget, "surfaceId"> | null | undefined): string {
  if (!target) return "/care-twin-qa";
  return `/care-twin-qa?qaSurface=${encodeURIComponent(target.surfaceId)}`;
}

type ProviderRowQaTarget = Pick<MobileLaunchQaCaptureTarget, "surfaceId"> & {
  detail: string;
  iconName: keyof typeof Ionicons.glyphMap;
};

function providerRowQaTarget(key: LaunchProviderSetupKey): ProviderRowQaTarget | null {
  switch (key) {
    case "auth":
      return {
        surfaceId: "auth-setup-onboarding-proof",
        detail: "Auth and Setup native proof",
        iconName: "log-in-outline",
      };
    case "database":
      return {
        surfaceId: "care-entry-provider-sync-proof",
        detail: "Care-entry Provider Sync Proof",
        iconName: "server-outline",
      };
    case "storage":
      return {
        surfaceId: "report-binary-export-proof",
        detail: "Report Binary Export Proof",
        iconName: "document-attach-outline",
      };
    case "ai":
      return {
        surfaceId: "woofguide-ai-provider-proof",
        detail: "WoofGuide AI Provider Proof",
        iconName: "chatbubbles-outline",
      };
    case "push":
      return {
        surfaceId: "push-notifications-proof",
        detail: "Push Notifications Proof",
        iconName: "notifications-outline",
      };
    case "payments":
      return {
        surfaceId: "payments-provider-proof",
        detail: "Payments Provider Proof",
        iconName: "card-outline",
      };
    case "storeAccounts":
      return {
        surfaceId: "store-accounts-proof",
        detail: "Store Accounts Proof",
        iconName: "storefront-outline",
      };
    case "accountDeletion":
      return {
        surfaceId: "account-deletion-proof",
        detail: "Account Deletion Proof",
        iconName: "trash-outline",
      };
    default:
      return null;
  }
}

export default function MoreScreen() {
  const routeParams = useLocalSearchParams<MoreRouteSearchParams>();
  const router = useRouter();
  const destination = resolveCanonicalDestination({
    pathname: "/more",
    params: routeParams,
  });
  const redirectHref: Href = destination.params
    ? { pathname: destination.pathname, params: { ...destination.params } }
    : destination.pathname;

  if (destination.parent === "health") {
    return <Redirect href={redirectHref} />;
  }

  const resolved = resolveMoreSectionRoute(routeParams);

  if (resolved.target.kind === "care-team-supplies") {
    return (
      <CareTeamSuppliesScreen
        section={resolved.target.section}
        itemId={resolved.itemId}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/more"))}
      />
    );
  }

  return <MoreScreenContent routeParams={routeParams} />;
}

function MoreScreenContent({
  routeParams,
}: {
  routeParams: Readonly<MoreRouteSearchParams>;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Owner launch tooling renders in development/internal builds only; store
  // production builds keep More to complete device-local care surfaces.
  const consumerSurfacePolicy = getConsumerSurfacePolicy();
  const ownerOps = consumerSurfacePolicy.ownerOps;
  const providerSyncEnabled =
    consumerSurfacePolicy.providerSyncControls && isClerkEnabledForBuild;
  const sectionParam = Array.isArray(routeParams.section) ? routeParams.section[0] : routeParams.section;
  // `focus` is a navigation nonce (Date.now() at the call site). More stays
  // mounted between tab visits, so without it a second tap on the same
  // Pack/Story shortcut would leave `section` unchanged and never re-scroll.
  const rawFocusParam = (routeParams as Record<string, string | string[] | undefined>).focus;
  const focusParam = Array.isArray(rawFocusParam) ? rawFocusParam[0] : rawFocusParam;
  const { state, careMutationsBlocked, refresh, updateCareDoc, syncOutbox, isLoaded, isSyncing } = useCare();
  const showCareReadOnly = () =>
    notifyDialog("Update WoofWatcher", CARE_READ_ONLY_MESSAGE);
  const { profile, entries, routines, caregivers } = state;
  const { avatarConfig, getAvatarSource, hasConfiguredAvatar } = useAvatar();

  const { signOut, isSignedIn } = useWoofAuth();
  const me = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled:
        consumerSurfacePolicy.householdProviderActions &&
        isClerkEnabledForBuild &&
        Boolean(isSignedIn),
    },
  });
  const household = me.data?.household;
  const members: HouseholdMemberSummary[] = me.data?.members ?? [];
  const myName = me.data?.user?.displayName?.trim() || "";

  const now = Date.now();
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const moreCareCareer = useMemo(
    () => deriveCareCareer(state.entries, now),
    [state.entries, now],
  );
  const moreCareStreak = useMemo(
    () => deriveCareStreak(state.entries, now),
    [state.entries, now],
  );
  const moreCareerWeek = useMemo(
    () => deriveCareerWeek(state.entries, now),
    [state.entries, now],
  );
  const careIntelligence = useMemo(
    () =>
      deriveCareIntelligence({
        entries,
        routines,
        caregivers,
        now,
        providerSyncEnabled,
      }),
    [entries, routines, caregivers, now, providerSyncEnabled],
  );
  const petName =
    profile.name && profile.name !== "My Dog"
      ? profile.name
      : "Phoenix";
  const avatarTemplate = useMemo(
    () => getAvatarTemplate(avatarConfig.templateId),
    [avatarConfig.templateId],
  );

  const streak = useMemo(() => {
    const days = new Set(
      entries.flatMap((entry) => {
        const occurredAt = new Date(entry.occurredAt);
        return Number.isFinite(occurredAt.getTime()) ? [localDateKey(occurredAt)] : [];
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
  }, [entries, now]);

  const todayLogCount = useMemo(() => {
    const today = todayLocalDateKey(new Date(now));
    return entries.filter((entry) => {
      const occurredAt = new Date(entry.occurredAt);
      return Number.isFinite(occurredAt.getTime()) && localDateKey(occurredAt) === today;
    }).length;
  }, [entries, now]);

  const latestCareUpdate = useMemo(
    () =>
      entries.reduce<string | undefined>((latest, entry) => {
        if (!latest) return entry.occurredAt;
        return Date.parse(entry.occurredAt) > Date.parse(latest)
          ? entry.occurredAt
          : latest;
      }, undefined),
    [entries],
  );

  const syncDashboard = useMemo<CareSyncDashboard>(() => {
    if (!providerSyncEnabled) {
      // Local-first build: device storage is the success state, so this card
      // reports the honest on-device record instead of implying a cloud
      // outbox or retries that no provider can service.
      return {
        status: "healthy",
        title: "Saved on this device",
        message: "Every care log is stored in this device's local care record. Nothing is waiting.",
        nextStep: consumerSurfacePolicy.providerSyncControls
          ? "Household sync is not connected - every care log stays on this device for now."
          : "Export a backup from Privacy & Safety before changing or resetting this device.",
        actionLabel: "Refresh",
        metrics: [
          {
            label: "Care log",
            value: `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`,
            detail: "Saved on this device",
          },
          {
            label: "Care team",
            value: `${caregivers.length} ${caregivers.length === 1 ? "member" : "members"}`,
            detail: "Caregivers on device",
          },
          {
            label: "Waiting",
            value: "0",
            detail: "Nothing to sync",
          },
        ],
      };
    }
    return deriveCareSyncDashboard({
      outbox: syncOutbox,
      isLoaded,
      isSyncing,
      lastUpdatedAt: latestCareUpdate ?? state.updatedAt,
      householdMemberCount: members.length || (household ? 1 : 0),
      totalEntries: entries.length,
    });
  }, [
    syncOutbox,
    isLoaded,
    isSyncing,
    latestCareUpdate,
    state.updatedAt,
    members.length,
    household,
    entries.length,
    caregivers.length,
    consumerSurfacePolicy.providerSyncControls,
    providerSyncEnabled,
  ]);
  const launchProviderSetupPlan = useMemo(
    () => deriveLaunchProviderSetup(state.launchProviderProfile),
    [state.launchProviderProfile],
  );
  const attachmentManifest = useMemo(
    () =>
      deriveAttachmentManifest(
        {
          entries,
          records: state.records,
          adventureMemories: state.adventureMemories,
          reportArtifacts: state.reportArtifacts,
        },
        {
          storageProviderConfigured: launchProviderSetupPlan.providerInput.storageProviderConfigured,
          storageProviderEvidence: launchProviderSetupPlan.providerInput.storageProviderEvidence,
        },
      ),
    [
      entries,
      launchProviderSetupPlan.providerInput.storageProviderConfigured,
      launchProviderSetupPlan.providerInput.storageProviderEvidence,
      state.adventureMemories,
      state.records,
      state.reportArtifacts,
    ],
  );
  const launchSupportPlan = useMemo(
    () => deriveSupportRunbookPlan(state.launchSupportProfile),
    [state.launchSupportProfile],
  );
  const supportRunbookOwnerReviewed =
    state.launchSupportProfile.providerStatus === "owner-reviewed" && launchSupportPlan.supportRunbookApproved;
  const privacyLegalOwnerReviewed =
    state.launchSupportProfile.providerStatus === "owner-reviewed" && launchSupportPlan.privacyLegalApproved;
  const supportRunbookApproved =
    state.launchSupportProfile.providerStatus === "provider-approved" && launchSupportPlan.supportRunbookApproved;
  const privacyLegalApproved =
    state.launchSupportProfile.providerStatus === "provider-approved" && launchSupportPlan.privacyLegalApproved;
  const supportRunbookProofReady = supportRunbookApproved;
  const privacyLegalProofReady = privacyLegalApproved;

  const syncTone =
    syncDashboard.status === "attention"
      ? colors.amber
      : syncDashboard.status === "syncing" || syncDashboard.status === "loading"
        ? colors.primary
        : colors.sage;
  const syncIcon: keyof typeof Ionicons.glyphMap = !providerSyncEnabled
    ? "phone-portrait-outline"
    : syncDashboard.status === "attention"
      ? "cloud-offline-outline"
      : syncDashboard.status === "syncing" || syncDashboard.status === "loading"
        ? "cloud-upload-outline"
        : "cloud-done-outline";

  const responsibilityCaregivers = useMemo(() => {
    const byName = new Map<string, { name: string; role: string }>();
    const add = (name: string, role: string) => {
      const cleaned = name.trim();
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: cleaned, role: role.trim() || "Caregiver" });
    };

    caregivers.forEach((caregiver) => add(caregiver.name, caregiver.role));
    members.forEach((member) => {
      const name = member.displayName?.trim() || member.email?.split("@")[0] || "";
      add(name, member.role === "owner" ? "Owner" : "Caregiver");
    });

    return [...byName.values()];
  }, [caregivers, members]);

  const householdResponsibility = useMemo(
    () => deriveHouseholdResponsibility({ routines, entries, caregivers: responsibilityCaregivers, now }),
    [routines, entries, responsibilityCaregivers, now],
  );
  const responsibilityTone =
    householdResponsibility.status === "needs-care"
      ? colors.rose
      : householdResponsibility.status === "needs-assignment"
        ? colors.amber
        : householdResponsibility.status === "needs-setup"
          ? colors.primary
          : colors.sage;
  const intelligenceTone =
    careIntelligence.status === "needs-attention"
      ? colors.amber
      : careIntelligence.status === "excellent"
        ? colors.sage
        : colors.primary;

  const energyDots = Math.round(((status.energy - 35) / (96 - 35)) * 4) + 1;

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  /** The remaining legacy career anchor stays until Story moves in Task 4c. */
  const scrollRef = useRef<ScrollView>(null);
  const sectionAnchorYRef = useRef<Record<string, number>>({});
  const pendingAnchorRef = useRef<string | null>(null);

  const scrollToAnchor = useCallback(
    (key: string): boolean => {
      const anchorY = sectionAnchorYRef.current[key];
      if (anchorY == null) return false;
      // Anchors measure against the content wrapper, which starts below the
      // ScrollView's own top content padding.
      scrollRef.current?.scrollTo({ y: Math.max(0, topPadding + anchorY - 8), animated: true });
      return true;
    },
    [topPadding],
  );

  const registerSectionAnchor = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      sectionAnchorYRef.current[key] = event.nativeEvent.layout.y;
      if (pendingAnchorRef.current === key) {
        pendingAnchorRef.current = null;
        requestAnimationFrame(() => scrollToAnchor(key));
      }
    },
    [scrollToAnchor],
  );

  const sectionAnchorTarget = sectionParam === "career" ? sectionParam : null;

  useEffect(() => {
    if (!sectionAnchorTarget) return;
    pendingAnchorRef.current = sectionAnchorTarget;
    const frame = requestAnimationFrame(() => {
      if (pendingAnchorRef.current === sectionAnchorTarget && scrollToAnchor(sectionAnchorTarget)) {
        pendingAnchorRef.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [sectionAnchorTarget, focusParam, scrollToAnchor]);
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pBreed, setPBreed] = useState("");
  const [pWeight, setPWeight] = useState("");
  const [pWeightError, setPWeightError] = useState<string | null>(null);
  const [pWeightUnit, setPWeightUnit] = useState<"lb" | "kg">("lb");
  const [pFocus, setPFocus] = useState("");
  const [pMicrochip, setPMicrochip] = useState("");
  const [pPrimaryVet, setPPrimaryVet] = useState("");
  const [pEmergencyContact, setPEmergencyContact] = useState("");
  const [pInsuranceProvider, setPInsuranceProvider] = useState("");
  const [pInsurancePolicy, setPInsurancePolicy] = useState("");

  const [savedNativeQaSummary, setSavedNativeQaSummary] =
    useState<LaunchReadinessNativeQaSummary | null>(null);
  const [nativeQaCapturePlan, setNativeQaCapturePlan] =
    useState<MobileLaunchQaCapturePlan>(() => buildMobileLaunchQaCapturePlan(null));
  const [savedQaProofManifest, setSavedQaProofManifest] =
    useState<MobileQaSessionProofManifest | null>(null);
  const [providerSetupOpen, setProviderSetupOpen] = useState(false);
  const [providerDraft, setProviderDraft] = useState<LaunchProviderProfile>(() =>
    normalizeLaunchProviderProfile(state.launchProviderProfile),
  );

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      AsyncStorage.getItem(MOBILE_QA_SESSION_STORAGE_KEY)
        .then((raw) => {
          if (cancelled) return;
          const savedSession = parseMobileQaSessionSnapshot(raw);
          setSavedNativeQaSummary(deriveNativeQaSummaryFromMobileQaSession(savedSession));
          setNativeQaCapturePlan(buildMobileLaunchQaCapturePlan(savedSession));
          setSavedQaProofManifest(
            savedSession
              ? buildMobileQaSessionProofManifest(buildMobileQaSessionSnapshot(savedSession, savedSession.savedAtIso))
              : null,
          );
        })
        .catch(() => {
          if (!cancelled) {
            setSavedNativeQaSummary(null);
            setNativeQaCapturePlan(buildMobileLaunchQaCapturePlan(null));
            setSavedQaProofManifest(null);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const openProfileEdit = () => {
    setPName(profile.name === "My Dog" ? "" : profile.name);
    setPBreed(profile.breed);
    setPWeight(profile.weight.current > 0 ? String(profile.weight.current) : "");
    setPWeightError(null);
    setPWeightUnit((profile.weight.unit as "lb" | "kg") || "lb");
    setPFocus(profile.careFocus);
    setPMicrochip(profile.microchipNumber ?? "");
    setPPrimaryVet(profile.primaryVet ?? "");
    setPEmergencyContact(profile.emergencyContact ?? "");
    setPInsuranceProvider(profile.insuranceProvider ?? "");
    setPInsurancePolicy(profile.insurancePolicy ?? "");
    setProfileOpen(true);
  };

  const saveProfile = () => {
    const weightValidation = validateProfileWeightDraft(pWeight);
    if (!weightValidation.ok) {
      setPWeightError(weightValidation.message);
      return;
    }
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    setPWeightError(null);
    const name = pName.trim() || "Phoenix";
    const weight = weightValidation.value;
    const updated = updateCareDoc((doc) => ({
      ...doc,
      profile: {
        ...doc.profile,
        name,
        publicLabel: name,
        breed: pBreed.trim(),
        careFocus: pFocus.trim(),
        microchipNumber: pMicrochip.trim(),
        primaryVet: pPrimaryVet.trim(),
        emergencyContact: pEmergencyContact.trim(),
        insuranceProvider: pInsuranceProvider.trim(),
        insurancePolicy: pInsurancePolicy.trim(),
        weight: {
          ...doc.profile.weight,
          current: weight ?? doc.profile.weight.current,
          unit: pWeightUnit,
        },
      },
    }));
    const accepted = runAcceptedCareMutation(updated, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setProfileOpen(false);
    });
    if (!accepted) showCareReadOnly();
  };

  const confirmSignOut = () => {
    confirmThroughSteps(
      [
        {
          title: "Sign out",
          message:
            "Care logs stay saved on this device. You'll need to sign back in before future changes can reach the household.",
          confirmLabel: "Sign out",
          destructive: true,
        },
      ],
      () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        signOut();
      },
    );
  };

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

  const nativeQaPrimaryMission = nativeQaCapturePlan.primaryMission;
  const nativeQaPrimaryMissionTarget =
    nativeQaPrimaryMission.target ??
    nativeQaCapturePlan.nextTargets[0] ??
    nativeQaCapturePlan.storeScreenshotProofStatus.nextTarget;
  const routeVisualConsistencyTarget =
    nativeQaCapturePlan.nextTargets.find((target) => target.surfaceId === "route-visual-consistency") ??
    ({ surfaceId: "route-visual-consistency" } as Pick<MobileLaunchQaCaptureTarget, "surfaceId">);
  const routeVisualConsistencyDetail =
    nativeQaCapturePlan.nextTargets.find((target) => target.surfaceId === "route-visual-consistency")?.missingEvidence[0] ??
    "Run the six-route design pass before native screenshots.";
  const careEntryProviderSyncProofTarget = {
    surfaceId: "care-entry-provider-sync-proof",
  } as Pick<MobileLaunchQaCaptureTarget, "surfaceId">;
  const openCareEntryProviderSyncProofMission = () => {
    Haptics.selectionAsync();
    router.push(buildCareTwinQaFocusRoute(careEntryProviderSyncProofTarget) as never);
  };

  const links: { icon: PulseIconName; iconName: keyof typeof Ionicons.glyphMap; label: string; sub: string; onPress: () => void }[] = [
    {
      icon: "paw",
      iconName: "sparkles",
      label: "Setup Checklist",
      sub: "Profile, diet, starter routine, and household basics",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/setup");
      },
    },
    {
      icon: "heart",
      iconName: "chatbubbles",
      label: "WoofGuide Assistant",
      sub: `Ask about ${petName}'s care, diet, and patterns`,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/woofguide");
      },
    },
    ...(ownerOps
      ? [
          {
            icon: "star" as PulseIconName,
            iconName: "diamond-outline" as keyof typeof Ionicons.glyphMap,
            label: "WoofWatcher Plus",
            sub: "Preview Plus, Family, and paid-value packaging",
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/premium");
            },
          },
        ]
      : []),
    {
      icon: "heart",
      iconName: "shield-checkmark-outline",
      label: "Privacy & Safety",
      sub: "Export data, deletion request, AI disclosure, and storage gates",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/privacy");
      },
    },
    {
      icon: "star",
      iconName: "map-outline",
      label: "Adventure Mode",
      sub: "Private quests, quest XP, and memories from real walks and wins",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/adventure" as never);
      },
    },
    {
      icon: "star",
      iconName: "color-palette",
      label: "Avatar Studio",
      sub: "Create a scan-assisted pixel care twin",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/portrait");
      },
    },
    ...(ownerOps
      ? [
          {
            icon: "star" as PulseIconName,
            iconName: "phone-portrait-outline" as keyof typeof Ionicons.glyphMap,
            label: "Care Twin QA",
            sub: "Internal device review for Phoenix room states and sprite loops",
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(buildCareTwinQaFocusRoute(nativeQaPrimaryMissionTarget) as never);
            },
          },
        ]
      : []),
    {
      icon: "paw",
      iconName: "card",
      label: "Care Pass",
      sub: "Share a summary for sitters or the vet",
      onPress: () => {
        Haptics.selectionAsync();
        router.push({ pathname: "/health", params: { section: "care-pass" } });
      },
    },
  ];

  const launchReadinessPlan = useMemo(
    () =>
      deriveLaunchReadiness({
        nativeQa: savedNativeQaSummary,
        local: {
          careWorkflowsReady: true,
          easProfilesReady: true,
          pixelAssetsReady: true,
          privacyExportReady: true,
        },
        provider: {
          authConfigured: Boolean(launchProviderSetupPlan.providerInput.authConfigured),
          authProviderProofReady: Boolean(launchProviderSetupPlan.providerInput.authProviderProofReady),
          databaseConfigured: Boolean(launchProviderSetupPlan.providerInput.databaseConfigured),
          databaseProviderProofReady: Boolean(launchProviderSetupPlan.providerInput.databaseProviderProofReady),
          storageProviderConfigured: Boolean(launchProviderSetupPlan.providerInput.storageProviderConfigured),
          storageProviderProofReady: Boolean(launchProviderSetupPlan.providerInput.storageProviderProofReady),
          storageQueue: attachmentManifest.launchQueue,
          aiProviderConfigured: Boolean(launchProviderSetupPlan.providerInput.aiProviderConfigured),
          aiProviderProofReady: Boolean(launchProviderSetupPlan.providerInput.aiProviderProofReady),
          paymentsEnabled: Boolean(launchProviderSetupPlan.providerInput.paymentsEnabled),
          paymentsProviderProofReady: Boolean(launchProviderSetupPlan.providerInput.paymentsProviderProofReady),
          accountDeletionEnabled: Boolean(launchProviderSetupPlan.providerInput.accountDeletionEnabled),
          accountDeletionProofReady: Boolean(launchProviderSetupPlan.providerInput.accountDeletionProofReady),
          pushNotificationsConfigured: Boolean(launchProviderSetupPlan.providerInput.pushNotificationsConfigured),
          pushNotificationsProofReady: Boolean(launchProviderSetupPlan.providerInput.pushNotificationsProofReady),
          appStoreAccountsReady: Boolean(launchProviderSetupPlan.providerInput.appStoreAccountsReady),
          storeAccountsProofReady: Boolean(launchProviderSetupPlan.providerInput.storeAccountsProofReady),
          privacyLegalApproved,
          privacyLegalOwnerReviewed,
          privacyLegalProofReady,
          supportRunbookApproved,
          supportRunbookOwnerReviewed,
          supportRunbookProofReady,
        },
        syncStatus: syncDashboard.status,
      }),
    [
      attachmentManifest.launchQueue,
      launchProviderSetupPlan.providerInput,
      privacyLegalOwnerReviewed,
      privacyLegalApproved,
      privacyLegalProofReady,
      savedNativeQaSummary,
      supportRunbookApproved,
      supportRunbookOwnerReviewed,
      supportRunbookProofReady,
      syncDashboard.status,
    ],
  );
  const launchReadiness = launchReadinessPlan.tiles.map((tile) => ({
    ...tile,
    iconName: launchTileIcon(tile.key, syncIcon),
    tone: launchStatusTone(tile.status, colors),
    onPress:
      tile.key === "native-qa"
        ? () => router.push(buildCareTwinQaFocusRoute(nativeQaPrimaryMissionTarget) as never)
        : tile.key === "storage" || tile.key === "store-approval"
          ? () => router.push("/privacy")
          : tile.key === "woofguide-ai"
            ? () => router.push("/woofguide")
            : tile.key === "plus-payments"
              ? () => router.push("/premium")
              : tile.status === "review"
                ? () => refresh()
                : undefined,
  }));
  const readinessBadgeTone = launchBadgeTone(launchReadinessPlan.status, colors);
  const launchNextGateIconName = launchNextGateIcon(launchReadinessPlan.nextGate.action);
  const launchReleasePacket = useMemo(
    () =>
      buildReleasePacket(launchReadinessPlan, {
        appName: "WoofWatcher",
        buildName: "premium mobile candidate",
        generatedAtIso: new Date(now).toISOString(),
      }),
    [launchReadinessPlan, now],
  );
  const launchStoreSubmissionPacket = useMemo(
    () => buildStoreSubmissionPacket(launchReleasePacket),
    [launchReleasePacket],
  );
  const storeSubmissionTone = launchStoreSubmissionPacket.submissionReady ? colors.sage : colors.amber;
  const betaShipTone =
    launchReleasePacket.betaShipStatus === "ready"
      ? colors.sage
      : launchReleasePacket.betaShipStatus === "qa-first"
        ? colors.amber
        : colors.rose;
  const providerSetupTone =
    launchProviderSetupPlan.status === "provider-approved"
      ? colors.sage
      : launchProviderSetupPlan.status === "owner-reviewed"
        ? colors.copper
        : colors.rose;
  const providerSetupVisibleRows = useMemo(() => {
    const openRows = launchProviderSetupPlan.rows.filter((row) => row.status !== "ready");
    return (openRows.length ? openRows : launchProviderSetupPlan.rows).slice(0, 4);
  }, [launchProviderSetupPlan.rows]);

  const openProviderSetup = () => {
    setProviderDraft(normalizeLaunchProviderProfile(state.launchProviderProfile));
    setProviderSetupOpen(true);
  };

  const toggleProviderDraft = (key: LaunchProviderFlagKey) => {
    Haptics.selectionAsync();
    setProviderDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveProviderSetup = () => {
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    const reviewedAt = new Date(now).toISOString();
    const normalized = normalizeLaunchProviderProfile(providerDraft);
    const allProviderGatesReady = PROVIDER_SETUP_FIELDS.every(
      (field) => normalized[field.key] && normalized[field.proofKey],
    );
    const providerStatus =
      normalized.providerStatus === "provider-approved" && !allProviderGatesReady
        ? "owner-reviewed"
        : normalized.providerStatus;
    const updated = updateCareDoc((doc) => ({
      ...doc,
      launchProviderProfile: {
        ...normalized,
        ownerReviewedAt: reviewedAt,
        providerStatus,
      },
    }));
    const accepted = runAcceptedCareMutation(updated, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setProviderSetupOpen(false);
    });
    if (!accepted) showCareReadOnly();
  };

  const shareProviderSetupPlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({
      message: buildLaunchProviderSetupShareText(launchProviderSetupPlan, new Date(now).toISOString()),
      title: launchProviderSetupPlan.title,
    });
  };

  const shareLaunchPacket = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({ message: buildReleasePacketShareText(launchReleasePacket), title: launchReleasePacket.title });
  };

  const shareBetaHandoffPacket = () => {
    const generatedAtIso = new Date(now).toISOString();
    const message = buildBetaHandoffPacketShareText(launchReleasePacket, nativeQaCapturePlan, {
      generatedAtIso,
      ciProof: RECORDED_MOBILE_BETA_CI_PROOF,
      livePreviewProof: RECORDED_LIVE_PREVIEW_HANDOFF_PROOF,
      providerSetupPlan: launchProviderSetupPlan,
      proofManifest: savedQaProofManifest,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({ message, title: "WoofWatcher 48-Hour Beta Handoff" });
  };

  const shareStoreSubmissionPacket = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({ message: buildStoreSubmissionPacketShareText(launchStoreSubmissionPacket), title: launchStoreSubmissionPacket.title });
  };

  const shareNativeQaCapturePlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({
      message: buildMobileLaunchQaCaptureShareText(nativeQaCapturePlan, new Date(now).toISOString()),
      title: "WoofWatcher Native QA Plan",
    });
  };

  const shareNativeQaFixBrief = () => {
    const message = buildMobileLaunchQaFixBriefShareText(nativeQaCapturePlan, new Date(now).toISOString());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({
      message,
      title: "WoofWatcher Needs Tune Fix Brief",
    });
  };

  const openLaunchNextGate = () => {
    switch (launchReadinessPlan.nextGate.action) {
      case "open-native-qa":
        Haptics.selectionAsync();
        router.push(buildCareTwinQaFocusRoute(nativeQaPrimaryMissionTarget) as never);
        return;
      case "share-native-qa-fix-brief":
        shareNativeQaFixBrief();
        return;
      case "open-provider-setup":
        Haptics.selectionAsync();
        openProviderSetup();
        return;
      case "open-privacy":
        Haptics.selectionAsync();
        router.push("/privacy" as never);
        return;
      case "open-premium":
        Haptics.selectionAsync();
        router.push("/premium" as never);
        return;
      case "open-woofguide":
        Haptics.selectionAsync();
        router.push("/woofguide" as never);
        return;
      case "open-avatar-studio":
        Haptics.selectionAsync();
        router.push("/portrait" as never);
        return;
      case "share-beta-handoff":
        shareBetaHandoffPacket();
        return;
      case "share-store-packet":
        shareStoreSubmissionPacket();
        return;
      case "share-launch-packet":
        shareLaunchPacket();
        return;
    }
  };

  const nativeQaCaptureNeedsTuneTarget = nativeQaCapturePlan.firstNeedsTuneTarget;
  const ownerPreviewProofStatus = nativeQaCapturePlan.ownerPreviewProofStatus;
  const storeScreenshotProofStatus = nativeQaCapturePlan.storeScreenshotProofStatus;
  const ownerPreviewProofHasPending = ownerPreviewProofStatus.statusLabel === "Pass pending proof";
  const ownerPreviewProofSummary =
    ownerPreviewProofStatus.missingEvidence[0] ?? "Owner preview proof is complete for the saved QA session.";
  const storeScreenshotProofHasPending = storeScreenshotProofStatus.statusLabel !== "Store proof complete";
  const storeScreenshotProofSummary =
    storeScreenshotProofStatus.missingEvidence[0] ?? "Store screenshot proof is complete for the saved QA session.";
  const nativeQaCaptureHasProofPending = nativeQaCapturePlan.nextTargets.some(
    (target) => mobileLaunchQaCaptureTargetStatusLabel(target) === "Pass pending proof",
  ) || ownerPreviewProofHasPending || storeScreenshotProofStatus.statusLabel === "Pass pending proof";
  const nativeQaCaptureCockpitActionLabel = nativeQaCaptureHasProofPending ? "Finish Proof" : "QA Cockpit";
  const moreCommandOpenGates = launchReadinessPlan.tiles.filter((tile) => tile.status !== "ready").length;
  const moreCommandProviderOpen = launchProviderSetupPlan.rows.filter((row) => row.status !== "ready").length;
  const moreCommandStatusLabel =
    launchReadinessPlan.status === "store-ready"
      ? "Store Ready"
      : launchReadinessPlan.status === "approval-required"
        ? "Owner Review"
        : launchReadinessPlan.status === "provider-gated"
          ? "Provider Gates"
          : "QA First";
  const moreCommandSpeech =
    launchReleasePacket.betaShipStatus === "ready"
      ? "Beta packet is ready. Review, then share."
      : launchReleasePacket.betaShipStatus === "qa-first"
        ? "Capture native QA proof before launch."
        : launchReadinessPlan.nextGate.detail;
  /* Same real launch stats as before, now rendered as light parchment chips:
     sage caps labels over ink values. */
  const moreCommandHud = [
    {
      label: "Launch",
      value: `${launchReleasePacket.readinessScore}%`,
    },
    {
      label: "QA",
      value: `${nativeQaCapturePlan.completeSurfaces}/${nativeQaCapturePlan.totalSurfaces}`,
    },
    {
      label: "Sync",
      value: syncDashboard.status === "healthy" ? "Current" : syncDashboard.actionLabel,
    },
    {
      label: "Roster",
      value: `1/${1 + (state.pets?.length ?? 0)}`,
    },
  ];

  const openCareIntelligenceNextAction = () => {
    Haptics.selectionAsync();
    if (careIntelligence.nextAction.kind === "retry-sync") {
      refresh();
      return;
    }
    if (careIntelligence.nextAction.targetEntryId) {
      router.push(`/log?entry=${encodeURIComponent(careIntelligence.nextAction.targetEntryId)}` as never);
      return;
    }
    if (careIntelligence.nextAction.kind === "handle-routine" || careIntelligence.nextAction.targetRoutineId) {
      router.push("/calendar");
      return;
    }
    if (careIntelligence.nextAction.kind === "update-meal-outcome") {
      router.push(`/log?type=meal&detail=1&intent=${Date.now()}` as never);
      return;
    }
    router.push("/log");
  };

  const moreDirectoryItems: MoreDirectoryItem[] = [
    {
      id: "care-today",
      iconName: "sparkles-outline",
      eyebrow: "Care today",
      label: careIntelligence.nextAction.label,
      detail: careIntelligence.subtitle,
      actionLabel: "Open",
      tone: intelligenceTone,
      onPress: openCareIntelligenceNextAction,
    },
    {
      id: "household",
      iconName: "people-outline",
      eyebrow: consumerSurfacePolicy.householdProviderActions
        ? "Household"
        : "Care team",
      label: householdResponsibility.title,
      detail: householdResponsibility.nextStep,
      actionLabel: "Review",
      tone: responsibilityTone,
      onPress: () => {
        Haptics.selectionAsync();
        router.push({ pathname: "/more", params: { section: "care-team" } });
      },
    },
    {
      id: "records-passes",
      iconName: "folder-open-outline",
      eyebrow: "Records & passes",
      label: "Care vault",
      detail: "Records, reports, Care Pass, and export-ready handoffs.",
      actionLabel: "Open",
      tone: colors.primary,
      onPress: () => {
        Haptics.selectionAsync();
        router.push({ pathname: "/health", params: { section: "records" } });
      },
    },
    ...(ownerOps
      ? [
          {
            id: "design-qa",
            iconName: "color-palette-outline" as const,
            eyebrow: "Design QA",
            label: "Route polish pass",
            detail: routeVisualConsistencyDetail,
            actionLabel: "Review",
            tone: colors.sage,
            onPress: () => {
              Haptics.selectionAsync();
              router.push(buildCareTwinQaFocusRoute(routeVisualConsistencyTarget) as never);
            },
          },
          {
            id: "launch-qa",
            iconName: "phone-portrait-outline" as const,
            eyebrow: "Launch QA",
            label: nativeQaPrimaryMission.label,
            detail: nativeQaPrimaryMission.detail,
            actionLabel: nativeQaCaptureCockpitActionLabel,
            tone: betaShipTone,
            onPress: () => {
              Haptics.selectionAsync();
              router.push(buildCareTwinQaFocusRoute(nativeQaPrimaryMissionTarget) as never);
            },
          },
        ]
      : []),
  ];

  const H_PAD = 16;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={s.container}
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BoardRouteHeader
            kicker="WOOFWATCHER"
            title="More"
            subtitle={`${petName}'s care tools, records, household, and settings.`}
            back
            onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            plain
            style={s.moreRouteHeader}
          />

          {ownerOps ? (
          /* Launch Command Hub: a light parchment console. Same real gates,
             QA counts, sync, and roster stats as light chips; the night-room
             pixel scene lives on as a small rounded living thumbnail. */
          <BoardCard style={s.moreCommandStageCard}>
            <View style={s.moreCommandHeadRow}>
              <ImageBackground
                source={MORE_COMMAND_STAGE_ROOM}
                resizeMode="cover"
                imageStyle={[stageImageFill, s.moreCommandThumbImage, pixelImageStyle]}
                style={[s.moreCommandThumb, { borderColor: colors.border }]}
                testID="more-launch-command-pixel-stage"
              >
                <SpriteSheetPlayer
                  asset={MORE_COMMAND_STAGE_SPRITE}
                  track={MORE_COMMAND_STAGE_TRACK}
                  width={44}
                  height={44}
                  testID="more-launch-command-pixel-sprite"
                />
              </ImageBackground>
              <View style={s.moreCommandHeadCopy}>
                <Text style={[s.moreCommandKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Launch Command Hub
                </Text>
                <Text
                  numberOfLines={3}
                  style={[s.moreCommandSpeech, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}
                >
                  {moreCommandSpeech}
                </Text>
              </View>
              <BoardPill
                label={moreCommandStatusLabel}
                tone={readinessBadgeTone}
                style={{ alignSelf: "center" }}
              />
            </View>

            <View style={s.moreCommandStats}>
              {moreCommandHud.map((metric) => (
                <View
                  key={metric.label}
                  style={[s.moreCommandStat, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[s.moreCommandStatLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    {metric.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[s.moreCommandStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}
                  >
                    {metric.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[s.moreCommandGates, { backgroundColor: colors.amberSoft }]}>
              <Ionicons name="flag-outline" size={14} color={colors.amber} />
              <Text
                numberOfLines={1}
                style={[s.moreCommandGatesText, { color: colors.amber, fontFamily: "Inter_700Bold" }]}
              >
                Open gates - {moreCommandOpenGates} launch / {moreCommandProviderOpen} provider
              </Text>
            </View>

            <BoardActionButton
              label={launchReleasePacket.betaShipStatus === "qa-first" ? "QA Cockpit" : "Beta Packet"}
              icon={launchReleasePacket.betaShipStatus === "qa-first" ? "camera-outline" : "share-social-outline"}
              accessibilityLabel={
                launchReleasePacket.betaShipStatus === "qa-first"
                  ? "Open native QA cockpit from launch command hub"
                  : "Share WoofWatcher beta handoff packet from launch command hub"
              }
              onPress={() => {
                Haptics.selectionAsync();
                if (launchReleasePacket.betaShipStatus === "qa-first") {
                  router.push(buildCareTwinQaFocusRoute(nativeQaPrimaryMissionTarget) as never);
                  return;
                }
                shareBetaHandoffPacket();
              }}
            />
          </BoardCard>
          ) : null}

          <View collapsable={false} onLayout={registerSectionAnchor("career")} />
          <BoardCard style={s.moreDirectoryCard}>
            <BoardSectionHeader
              title="Career & Stats"
              accessory={
                <BoardPill
                  label={`Lv ${moreCareCareer.level} ${moreCareCareer.title}`}
                  tone={colors.sage}
                />
              }
            />
            {/* XP toward the next level: real lifetime-care XP on the shared
                gentle-spring progress fill. */}
            <View style={s.careerXpBlock}>
              <View style={s.careerXpHeader}>
                <Text style={[s.careerXpLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  XP toward Lv {moreCareCareer.level + 1}
                </Text>
                <Text style={[s.careerXpValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {moreCareCareer.levelXp.toLocaleString()} / {moreCareCareer.levelSpanXp.toLocaleString()}
                </Text>
              </View>
              <ProgressFill
                ratio={Math.max(0.02, moreCareCareer.levelProgress)}
                color={colors.forest}
                trackColor={colors.muted}
                height={9}
              />
            </View>
            <View style={{ gap: 8 }}>
              <BoardMetricTile
                icon="note"
                label="Logs this week"
                value={String(moreCareerWeek.logsThisWeek)}
                detail="Real care logs in the last 7 days"
                tone={colors.sage}
              />
              <BoardMetricTile
                icon="clock"
                label="Active days"
                value={`${moreCareerWeek.activeDays}/7`}
                detail="Days with at least one real care log this week"
                tone={colors.blueSignal}
              />
              <BoardMetricTile
                icon="energy"
                label="Care streak"
                value={
                  moreCareStreak > 0
                    ? `${moreCareStreak} day${moreCareStreak === 1 ? "" : "s"}`
                    : "Start today"
                }
                detail="Consecutive days of logged care"
                tone={colors.amber}
              />
            </View>
          </BoardCard>

          <BoardCard style={s.moreDirectoryCard}>
            <BoardSectionHeader
              title="Command Directory"
              accessory={<BoardPill label={`${moreDirectoryItems.length} hubs`} tone={colors.sage} />}
            />
            <View style={s.moreDirectoryList}>
              {moreDirectoryItems.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.eyebrow}: ${item.label}. ${item.detail}`}
                  onPress={item.onPress}
                  style={({ pressed }) => [
                    s.moreDirectoryRow,
                    index < moreDirectoryItems.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                    {
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <View style={[s.moreDirectoryIcon, { backgroundColor: item.tone + "18" }]}>
                    <Ionicons name={item.iconName} size={19} color={item.tone} />
                  </View>
                  <View style={s.moreDirectoryCopy}>
                    <Text style={[s.moreDirectoryEyebrow, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      {item.eyebrow}
                    </Text>
                    {/* Wraps to a 2nd line rather than clipping mid-word: the
                        action chip squeezes this column, and the longest title
                        ("Owner Preview Core Loop") overran ~7px on one line.
                        Short titles still render on a single line. */}
                    <Text numberOfLines={2} style={[s.moreDirectoryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                      {item.label}
                    </Text>
                    <Text numberOfLines={2} style={[s.moreDirectoryDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {item.detail}
                    </Text>
                  </View>
                  <View style={[s.moreDirectoryAction, { borderColor: item.tone + "35", backgroundColor: item.tone + "10" }]}>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[s.moreDirectoryActionText, { color: item.tone, fontFamily: "Inter_800ExtraBold" }]}
                    >
                      {item.actionLabel}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={item.tone} />
                  </View>
                </Pressable>
              ))}
            </View>
          </BoardCard>

          {/* Profile header card */}
          <View style={[s.profileCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <LinearGradient
              colors={[colors.forest, colors.forestBright]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.profileBanner}
            />
            <Pressable
              onPress={openProfileEdit}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Edit dog profile"
              style={[s.profileEditBtn, { backgroundColor: colors.ivory }]}
            >
              <Ionicons name="pencil" size={14} color={colors.forest} />
            </Pressable>
            <View style={s.profileAvatarWrap}>
              <View style={[s.profileAvatar, { backgroundColor: colors.card, borderColor: colors.card }]}>
                <Image source={getAvatarSource(status.mood)} style={s.profileAvatarImg} resizeMode="cover" />
              </View>
            </View>
            <View style={s.profileBody}>
              <Text style={[s.profileName, { color: colors.foreground, fontFamily: DISPLAY }]}>{petName}</Text>
              <Text style={[s.profileBreed, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{profile.breed}</Text>
              <View style={[s.avatarIdentityPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name={hasConfiguredAvatar ? "sparkles" : "color-palette-outline"} size={12} color={colors.primary} />
                <Text style={[s.avatarIdentityText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {avatarTemplate.label} care twin{avatarConfig.scanAssisted ? " - scan-assisted" : ""}
                </Text>
              </View>
              <View style={[s.profileStats, { borderTopColor: colors.border }]}>
                <View style={s.profileStat}>
                  <Text style={[s.profileStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {profile.weight.current > 0 ? `${profile.weight.current} ${profile.weight.unit}` : "—"}
                  </Text>
                  <Text style={[s.profileStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Weight</Text>
                </View>
                <View style={[s.profileStatDivider, { backgroundColor: colors.border }]} />
                <View style={s.profileStat}>
                  <Text style={[s.profileStatValue, { color: streak > 0 ? colors.sage : colors.mutedForeground, fontFamily: DISPLAY_SEMI }]}>
                    {streak > 0 ? `${streak}d` : "—"}
                  </Text>
                  <Text style={[s.profileStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Streak</Text>
                </View>
                <View style={[s.profileStatDivider, { backgroundColor: colors.border }]} />
                <View style={s.profileStat}>
                  <Text style={[s.profileStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{routines.length}</Text>
                  <Text style={[s.profileStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Routines</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Today's status strip */}
          <View style={[s.statusStrip, { backgroundColor: colors.card, shadowColor: colors.primary, marginTop: 12 }]}>
            <View style={[s.statusCell, { borderRightWidth: 1, borderRightColor: colors.border }]}>
              <Text style={[s.statusValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{status.meta.label}</Text>
              <Text style={[s.statusLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>Mood</Text>
            </View>
            <View style={s.statusCell}>
              <View style={s.statusEnergyRow}>
                {[1, 2, 3, 4, 5].map((dot) => (
                  <View
                    key={dot}
                    style={[
                      s.statusEnergyDot,
                      { backgroundColor: dot <= energyDots ? colors.primary : colors.border },
                    ]}
                  />
                ))}
              </View>
              <Text style={[s.statusLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>Energy level</Text>
            </View>
            <View style={[s.statusCell, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
              <Text style={[s.statusValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{todayLogCount}</Text>
              <Text style={[s.statusLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>Logs today</Text>
            </View>
          </View>


          <BoardCard style={[s.moreBoardCard, { borderColor: intelligenceTone + "44" }]}>
            <BoardSectionHeader
              title="Care Intelligence"
              accessory={
                <View style={[s.intelligenceBadge, { backgroundColor: intelligenceTone + "18" }]}>
                  <Text style={[s.intelligenceBadgeText, { color: intelligenceTone, fontFamily: "Inter_700Bold" }]}>
                    {careIntelligence.score}% IQ
                  </Text>
                </View>
              }
            />
            <View style={s.intelligenceTop}>
              <View style={[s.intelligenceIcon, { backgroundColor: intelligenceTone + "18" }]}>
                <Ionicons name="analytics-outline" size={20} color={intelligenceTone} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.intelligenceTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {careIntelligence.title}
                </Text>
                <Text style={[s.intelligenceSummary, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {careIntelligence.subtitle}
                </Text>
              </View>
            </View>
            <View style={[s.intelligenceMeter, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View
                style={[
                  s.intelligenceMeterFill,
                  { width: `${careIntelligence.score}%`, backgroundColor: intelligenceTone },
                ]}
              />
            </View>
            <View style={s.intelligenceGrid}>
              {careIntelligence.metrics.map((metric) => (
                <View key={metric.label} style={[s.intelligenceMetric, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.intelligenceMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {metric.value}
                  </Text>
                  <Text style={[s.intelligenceMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    {metric.label}
                  </Text>
                  <Text style={[s.intelligenceMetricDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {metric.detail}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Care Intelligence next action: ${careIntelligence.nextAction.label}`}
              onPress={openCareIntelligenceNextAction}
              style={({ pressed }) => [
                s.intelligenceAction,
                { backgroundColor: intelligenceTone, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[s.intelligenceActionText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                {careIntelligence.nextAction.label}
              </Text>
              <Ionicons name="chevron-forward" size={17} color={colors.primaryForeground} />
            </Pressable>
          </BoardCard>

          {ownerOps ? (
            <>
          <BoardCard style={s.moreBoardCard}>
            <BoardSectionHeader
              title="Launch Readiness"
              accessory={
                <View style={[s.launchBadge, { backgroundColor: readinessBadgeTone + "18" }]}>
                  <Text style={[s.launchBadgeText, { color: readinessBadgeTone, fontFamily: "Inter_700Bold" }]}>
                    {launchReadinessPlan.badgeLabel}
                  </Text>
                </View>
              }
            />
            <View style={s.launchGrid}>
              {launchReadiness.map((item) => {
                const content = (
                  <>
                    <View style={[s.launchTileIcon, { backgroundColor: item.tone + "18" }]}>
                      <Ionicons name={item.iconName} size={18} color={item.tone} />
                    </View>
                    <Text style={[s.launchTileLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {item.label}
                    </Text>
                    <Text style={[s.launchTileValue, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {item.value}
                    </Text>
                  </>
                );
                if (item.onPress) {
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => {
                        Haptics.selectionAsync();
                        item.onPress?.();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label}. ${item.value}. ${item.detail}`}
                      style={({ pressed }) => [
                        s.launchTile,
                        { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      {content}
                    </Pressable>
                  );
                }
                return (
                  <View key={item.label} style={[s.launchTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {content}
                  </View>
                );
              })}
            </View>
            <View style={[s.launchNotice, { backgroundColor: readinessBadgeTone + "12", borderColor: readinessBadgeTone + "33" }]}>
              <Ionicons name="lock-closed-outline" size={15} color={readinessBadgeTone} />
              <Text style={[s.launchNoticeText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {launchReadinessPlan.summary} {launchReadinessPlan.nextActions[0] ?? "Prepare the final store packet after Apollo approval."}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Next launch gate: ${launchReadinessPlan.nextGate.label}. ${launchReadinessPlan.nextGate.detail}`}
              onPress={openLaunchNextGate}
              style={({ pressed }) => [
                s.launchNextGate,
                {
                  backgroundColor: readinessBadgeTone + "10",
                  borderColor: readinessBadgeTone + "3D",
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View style={[s.launchNextGateIcon, { backgroundColor: readinessBadgeTone + "18" }]}>
                <Ionicons name={launchNextGateIconName} size={18} color={readinessBadgeTone} />
              </View>
              <View style={s.launchNextGateBody}>
                <Text style={[s.launchNextGateKicker, { color: readinessBadgeTone, fontFamily: "Inter_800ExtraBold" }]}>
                  Next launch gate
                </Text>
                <Text style={[s.launchNextGateTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {launchReadinessPlan.nextGate.label}
                </Text>
                <Text style={[s.launchNextGateDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {launchReadinessPlan.nextGate.detail}
                </Text>
                <View style={s.launchNextGateCta}>
                  <Text style={[s.launchNextGateCtaText, { color: readinessBadgeTone, fontFamily: "Inter_800ExtraBold" }]}>
                    {launchReadinessPlan.nextGate.ctaLabel}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={readinessBadgeTone} />
                </View>
              </View>
            </Pressable>
            <View style={[s.providerSetupPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={s.providerSetupHeader}>
                <View style={[s.providerSetupScore, { backgroundColor: providerSetupTone + "16" }]}>
                  <Text style={[s.providerSetupScoreValue, { color: providerSetupTone, fontFamily: DISPLAY_SEMI }]}>
                    {launchProviderSetupPlan.percent}%
                  </Text>
                  <Text style={[s.providerSetupScoreLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    providers
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.providerSetupTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                    Provider Launch Setup
                  </Text>
                  <Text style={[s.providerSetupSub, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {launchProviderSetupPlan.headline}. {launchProviderSetupPlan.statusLabel}.
                  </Text>
                  <Text style={[s.providerSetupCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {launchProviderSetupPlan.summary}
                  </Text>
                </View>
              </View>
              {launchProviderSetupPlan.nextGate ? (
                <View
                  style={[
                    s.providerNextGate,
                    {
                      backgroundColor: providerSetupTone + "10",
                      borderColor: providerSetupTone + "30",
                    },
                  ]}
                >
                  <View style={s.providerNextGateHeader}>
                    <Ionicons name="flag-outline" size={15} color={providerSetupTone} />
                    <Text style={[s.providerNextGateKicker, { color: providerSetupTone, fontFamily: "Inter_800ExtraBold" }]}>
                      Next provider gate
                    </Text>
                  </View>
                  <Text style={[s.providerNextGateTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {launchProviderSetupPlan.nextGate.label}
                  </Text>
                  <Text style={[s.providerNextGateMeta, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    Owner: {launchProviderSetupPlan.nextGate.owner}
                  </Text>
                  <Text style={[s.providerNextGateCopy, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {launchProviderSetupPlan.nextGate.nextAction}
                  </Text>
                  <Text style={[s.providerNextGateProof, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    Proof: {launchProviderSetupPlan.nextGate.proofRequired}
                  </Text>
                  {launchProviderSetupPlan.nextGate.proofChecklist.length ? (
                    <View style={s.providerSetupProofChecklist}>
                      {launchProviderSetupPlan.nextGate.proofChecklist.slice(0, 4).map((proofItem) => (
                        <Text
                          key={proofItem}
                          numberOfLines={2}
                          style={[s.providerSetupProofItem, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                        >
                          - {proofItem}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : (
                <View
                  style={[
                    s.providerNextGate,
                    {
                      backgroundColor: colors.sage + "12",
                      borderColor: colors.sage + "35",
                    },
                  ]}
                >
                  <View style={s.providerNextGateHeader}>
                    <Ionicons name="checkmark-circle-outline" size={15} color={colors.sage} />
                    <Text style={[s.providerNextGateKicker, { color: colors.sage, fontFamily: "Inter_800ExtraBold" }]}>
                      Provider gates ready for owner approval
                    </Text>
                  </View>
                  <Text style={[s.providerNextGateCopy, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    Run native QA, confirm legal/support/store approvals, and keep this as a final review state until Apollo approves submission.
                  </Text>
                </View>
              )}
              <View style={s.providerSetupRows}>
                {providerSetupVisibleRows.map((row) => {
                  const rowTone = row.status === "ready" ? colors.sage : colors.amber;
                  const rowQaTarget = providerRowQaTarget(row.key);
                  return (
                    <View key={row.key} style={[s.providerSetupRow, { borderTopColor: colors.border }]}>
                      <Ionicons
                        name={row.status === "ready" ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={rowTone}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.providerSetupRowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                          {row.label}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={[s.providerSetupRowSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                        >
                          {row.status === "blocked" ? row.nextAction : row.detail}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={[s.providerSetupRowProof, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                        >
                          Proof needed: {row.proofRequired}
                        </Text>
                        {row.proofChecklist.length ? (
                          <View style={s.providerSetupProofChecklist}>
                            {row.proofChecklist.slice(0, 3).map((proofItem) => (
                              <Text
                                key={proofItem}
                                numberOfLines={2}
                                style={[s.providerSetupProofItem, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                              >
                                - {proofItem}
                              </Text>
                            ))}
                            {row.proofChecklist.length > 3 ? (
                              <Text
                                numberOfLines={1}
                                style={[s.providerSetupProofItem, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}
                              >
                                More proof steps: {row.proofChecklist.length - 3} in Share Provider Plan
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                        {rowQaTarget ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Open proof mission for ${row.label}: ${rowQaTarget.detail}`}
                            onPress={() => {
                              Haptics.selectionAsync();
                              router.push(buildCareTwinQaFocusRoute({ surfaceId: rowQaTarget.surfaceId }) as never);
                            }}
                            style={({ pressed }) => [
                              s.providerSetupRowAction,
                              {
                                backgroundColor: rowTone + "12",
                                borderColor: rowTone + "45",
                                opacity: pressed ? 0.74 : 1,
                              },
                            ]}
                          >
                            <Ionicons name={rowQaTarget.iconName} size={13} color={rowTone} />
                            <Text style={[s.providerSetupRowActionText, { color: rowTone, fontFamily: "Inter_800ExtraBold" }]}>
                              Open proof mission
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={s.providerSetupActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit WoofWatcher provider launch setup"
                  onPress={openProviderSetup}
                  style={({ pressed }) => [
                    s.providerSetupButton,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 },
                  ]}
                >
                  <Ionicons name="construct-outline" size={15} color="#FFFFFF" />
                  <Text style={[s.providerSetupButtonText, { fontFamily: "Inter_800ExtraBold" }]}>Edit Provider Plan</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share WoofWatcher provider setup plan"
                  onPress={shareProviderSetupPlan}
                  style={({ pressed }) => [
                    s.providerSetupButton,
                    { backgroundColor: colors.forest, opacity: pressed ? 0.84 : 1 },
                  ]}
                >
                  <Ionicons name="share-social-outline" size={15} color="#FFFFFF" />
                  <Text style={[s.providerSetupButtonText, { fontFamily: "Inter_800ExtraBold" }]}>Share Provider Plan</Text>
                </Pressable>
              </View>
            </View>
            {nativeQaCapturePlan.nextTargets.length > 0 ? (
              <View style={[s.nativeQaCapturePanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={s.nativeQaCaptureHeader}>
                  <View style={[s.nativeQaCaptureIcon, { backgroundColor: colors.primary + "14" }]}>
                    <Ionicons name="camera-outline" size={17} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nativeQaCaptureTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                      Native QA Next Captures
                    </Text>
                    <Text style={[s.nativeQaCaptureSub, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {nativeQaCapturePlan.completeSurfaces}/{nativeQaCapturePlan.totalSurfaces} surfaces complete.
                      {" "}
                      {nativeQaCapturePlan.openSurfaces} still open.
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open primary Native QA mission: ${nativeQaPrimaryMission.label}. ${nativeQaPrimaryMission.detail}`}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(buildCareTwinQaFocusRoute(nativeQaPrimaryMissionTarget) as never);
                  }}
                  style={({ pressed }) => [
                    s.nativeQaOwnerProofRow,
                    {
                      borderColor: colors.primary + "66",
                      backgroundColor: pressed ? colors.primary + "18" : colors.primary + "10",
                      opacity: pressed ? 0.76 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nativeQaOwnerProofLabel, { color: colors.primary, fontFamily: "Inter_800ExtraBold" }]}>
                      Primary mission
                    </Text>
                    <Text style={[s.nativeQaOwnerProofTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                      {nativeQaPrimaryMission.label}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[s.nativeQaOwnerProofDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                    >
                      {nativeQaPrimaryMission.detail}
                    </Text>
                  </View>
                  <Ionicons name="locate-outline" size={17} color={colors.primary} />
                </Pressable>
                {savedQaProofManifest ? (
                  <Pressable
                    accessibilityLabel={`Share beta handoff proof manifest ${savedQaProofManifest.proofId}`}
                    accessibilityRole="button"
                    onPress={shareBetaHandoffPacket}
                    style={[
                      s.nativeQaOwnerProofRow,
                      {
                        borderColor: colors.primary + "44",
                        backgroundColor: colors.primary + "0D",
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.nativeQaOwnerProofLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                        Proof manifest
                      </Text>
                      <Text style={[s.nativeQaOwnerProofTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                        {savedQaProofManifest.proofId}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[s.nativeQaOwnerProofDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                      >
                        {savedQaProofManifest.totalEvidenceFiles} files. {savedQaProofManifest.platformEvidenceLabel}. Local metadata only.
                      </Text>
                    </View>
                    <Ionicons name="share-social-outline" size={17} color={colors.primary} />
                  </Pressable>
                ) : null}
                <View
                  style={[
                    s.nativeQaOwnerProofRow,
                    {
                      borderColor: ownerPreviewProofHasPending ? colors.amber + "66" : colors.border,
                      backgroundColor: ownerPreviewProofHasPending ? colors.amber + "12" : colors.card,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nativeQaOwnerProofLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                      Owner preview proof
                    </Text>
                    <Text
                      style={[
                        s.nativeQaOwnerProofTitle,
                        {
                          color: ownerPreviewProofHasPending ? colors.amber : colors.foreground,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {ownerPreviewProofStatus.statusLabel}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[s.nativeQaOwnerProofDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                    >
                      {ownerPreviewProofStatus.evidenceAttached} attached. {ownerPreviewProofSummary}
                    </Text>
                  </View>
                  <Ionicons
                    name={ownerPreviewProofHasPending ? "lock-closed-outline" : "shield-checkmark-outline"}
                    size={17}
                    color={ownerPreviewProofHasPending ? colors.amber : colors.sage}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open store screenshot QA proof. ${storeScreenshotProofStatus.statusLabel}. ${storeScreenshotProofStatus.nextTarget ? `Next store screenshot: ${storeScreenshotProofStatus.nextTarget.title}. ${storeScreenshotProofSummary}` : storeScreenshotProofSummary}`}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(buildCareTwinQaFocusRoute(storeScreenshotProofStatus.nextTarget) as never);
                  }}
                  style={({ pressed }) => [
                    s.nativeQaOwnerProofRow,
                    {
                      borderColor: storeScreenshotProofHasPending ? colors.copper + "66" : colors.border,
                      backgroundColor: storeScreenshotProofHasPending ? colors.copper + "12" : colors.card,
                      opacity: pressed ? 0.76 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nativeQaOwnerProofLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                      Store screenshot proof
                    </Text>
                    <Text
                      style={[
                        s.nativeQaOwnerProofTitle,
                        {
                          color: storeScreenshotProofHasPending ? colors.copper : colors.foreground,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {storeScreenshotProofStatus.statusLabel}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.nativeQaOwnerProofDetail, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                    >
                      {storeScreenshotProofStatus.complete}/{storeScreenshotProofStatus.total} complete. {storeScreenshotProofStatus.open} open.
                    </Text>
                    {storeScreenshotProofStatus.nextTarget ? (
                      <Text
                        numberOfLines={2}
                        style={[s.nativeQaOwnerProofDetail, { color: colors.copper, fontFamily: "Inter_700Bold" }]}
                      >
                        Next store screenshot: {storeScreenshotProofStatus.nextTarget.title} - {storeScreenshotProofSummary}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={storeScreenshotProofHasPending ? "storefront-outline" : "shield-checkmark-outline"}
                    size={17}
                    color={storeScreenshotProofHasPending ? colors.copper : colors.sage}
                  />
                </Pressable>
                <View style={s.nativeQaCaptureActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share Native QA capture plan"
                    onPress={shareNativeQaCapturePlan}
                    style={({ pressed }) => [
                      s.nativeQaCaptureShare,
                      { backgroundColor: colors.forest, opacity: pressed ? 0.84 : 1 },
                    ]}
                  >
                    <Ionicons name="share-social-outline" size={15} color="#FFFFFF" />
                    <Text style={[s.nativeQaCaptureShareText, { fontFamily: "Inter_800ExtraBold" }]}>Share QA Plan</Text>
                  </Pressable>
                  {nativeQaCaptureNeedsTuneTarget ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open first Native QA Needs tune target: ${nativeQaCaptureNeedsTuneTarget.title}`}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push(buildCareTwinQaFocusRoute(nativeQaCaptureNeedsTuneTarget) as never);
                      }}
                      style={({ pressed }) => [
                        s.nativeQaCaptureNeedsTuneAction,
                        {
                          borderColor: colors.rose + "66",
                          backgroundColor: pressed ? colors.rose + "21" : colors.rose + "14",
                        },
                      ]}
                    >
                      <Ionicons name="locate-outline" size={15} color={colors.rose} />
                      <Text style={[s.nativeQaCaptureCockpitActionText, { color: colors.rose, fontFamily: "Inter_800ExtraBold" }]}>
                        Open Needs Tune
                      </Text>
                    </Pressable>
                  ) : null}
                  {nativeQaCaptureNeedsTuneTarget ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Share first Native QA Needs tune fix brief"
                      onPress={shareNativeQaFixBrief}
                      style={({ pressed }) => [
                        s.nativeQaCaptureFixBrief,
                        {
                          borderColor: colors.amber + "66",
                          backgroundColor: pressed ? colors.amber + "21" : colors.amber + "14",
                        },
                      ]}
                    >
                      <Ionicons name="construct-outline" size={15} color={colors.amber} />
                      <Text style={[s.nativeQaCaptureCockpitActionText, { color: colors.amber, fontFamily: "Inter_800ExtraBold" }]}>
                        Share Fix Brief
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      nativeQaCaptureHasProofPending
                        ? "Open QA Cockpit to finish pending Native QA proof"
                        : "Open QA Cockpit for Native QA capture"
                    }
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(buildCareTwinQaFocusRoute(nativeQaPrimaryMissionTarget) as never);
                    }}
                    style={({ pressed }) => [
                      s.nativeQaCaptureCockpitAction,
                      {
                        borderColor: nativeQaCaptureHasProofPending ? colors.amber + "66" : colors.border,
                        backgroundColor: nativeQaCaptureHasProofPending ? colors.amber + "14" : colors.card,
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={nativeQaCaptureHasProofPending ? "shield-checkmark-outline" : "clipboard-outline"}
                      size={15}
                      color={nativeQaCaptureHasProofPending ? colors.amber : colors.foreground}
                    />
                    <Text
                      style={[
                        s.nativeQaCaptureCockpitActionText,
                        {
                          color: nativeQaCaptureHasProofPending ? colors.amber : colors.foreground,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {nativeQaCaptureCockpitActionLabel}
                    </Text>
                  </Pressable>
                </View>
                {nativeQaCapturePlan.nextTargets.map((target) => {
                  const targetStatusLabel = mobileLaunchQaCaptureTargetStatusLabel(target);
                  const targetStatusTone =
                    targetStatusLabel === "Pass pending proof"
                      ? colors.amber
                      : target.status === "needs-review"
                        ? colors.amber
                        : target.status === "pass"
                          ? colors.sage
                          : colors.mutedForeground;

                  return (
                    <Pressable
                      key={target.surfaceId}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${target.title} QA capture. Status: ${targetStatusLabel}. ${target.missingEvidence.join(" ")} ${target.setupSteps[0] ?? ""} ${target.verificationSteps[0] ?? ""} ${target.acceptanceCriteria[0] ?? ""} ${target.failureEscalation}`}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push(buildCareTwinQaFocusRoute(target) as never);
                      }}
                      style={({ pressed }) => [
                        s.nativeQaCaptureRow,
                        { borderTopColor: colors.border, opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.nativeQaCaptureRowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                          {target.title}
                        </Text>
                        <View style={s.nativeQaCaptureStatusLine}>
                          <Text style={[s.nativeQaCaptureStatusLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                            Proof status
                          </Text>
                          <Text style={[s.nativeQaCaptureStatusValue, { color: targetStatusTone, fontFamily: "Inter_800ExtraBold" }]}>
                            {targetStatusLabel}
                          </Text>
                        </View>
                        <Text
                          numberOfLines={2}
                          style={[s.nativeQaCaptureRowSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                        >
                          {target.missingEvidence.join(" ")}
                        </Text>
                        {target.setupSteps[0] ? (
                          <Text
                            numberOfLines={2}
                            style={[s.nativeQaCaptureRowPrep, { color: colors.copper, fontFamily: "Inter_700Bold" }]}
                          >
                            Prep: {target.setupSteps[0]}
                          </Text>
                        ) : null}
                        {target.verificationSteps[0] ? (
                          <Text
                            numberOfLines={2}
                            style={[s.nativeQaCaptureRowStep, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                          >
                            Step: {target.verificationSteps[0]}
                          </Text>
                        ) : null}
                        {target.acceptanceCriteria[0] ? (
                          <Text
                            numberOfLines={2}
                            style={[s.nativeQaCaptureRowCriteria, { color: colors.sage, fontFamily: "Inter_700Bold" }]}
                          >
                            Pass: {target.acceptanceCriteria[0]}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          s.nativeQaCapturePill,
                          {
                            backgroundColor: (target.priority === "launch-critical" ? colors.rose : colors.copper) + "14",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.nativeQaCapturePillText,
                            {
                              color: target.priority === "launch-critical" ? colors.rose : colors.copper,
                              fontFamily: "Inter_800ExtraBold",
                            },
                          ]}
                        >
                          {target.priority === "launch-critical" ? "Critical" : "Polish"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={[s.launchPacket, { backgroundColor: betaShipTone + "10", borderColor: betaShipTone + "33" }]}>
              <View style={[s.launchScore, { backgroundColor: betaShipTone + "18" }]}>
                <Text style={[s.launchScoreValue, { color: betaShipTone, fontFamily: DISPLAY_SEMI }]}>48h</Text>
                <Text style={[s.launchScoreLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  beta
                </Text>
              </View>
              <View style={s.launchPacketBody}>
                <Text style={[s.launchPacketTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                  {launchReleasePacket.betaVerdictLabel}
                </Text>
                <Text style={[s.launchPacketCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {launchReleasePacket.betaSummary}
                </Text>
                <View style={s.betaNextActions}>
                  {launchReleasePacket.betaNextActions.slice(0, 3).map((action, index) => (
                    <View key={`${index}-${action}`} style={s.betaNextActionRow}>
                      <View style={[s.betaNextActionDot, { backgroundColor: betaShipTone }]} />
                      <Text style={[s.betaNextActionText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {action}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={s.betaNextActionRail}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      launchReleasePacket.betaShipStatus === "qa-first"
                        ? "Open beta device QA cockpit"
                        : "Share WoofWatcher beta release packet"
                    }
                    onPress={
                      launchReleasePacket.betaShipStatus === "qa-first"
                        ? () => router.push(buildCareTwinQaFocusRoute(nativeQaPrimaryMissionTarget) as never)
                        : shareBetaHandoffPacket
                    }
                    style={({ pressed }) => [
                      s.betaNextActionButton,
                      { backgroundColor: betaShipTone, opacity: pressed ? 0.86 : 1 },
                    ]}
                  >
                    <Ionicons
                      name={launchReleasePacket.betaShipStatus === "qa-first" ? "camera-outline" : "share-social-outline"}
                      size={15}
                      color="#FFFFFF"
                    />
                    <Text style={[s.betaNextActionButtonText, { fontFamily: "Inter_800ExtraBold" }]}>
                      {launchReleasePacket.betaShipStatus === "qa-first" ? "QA Cockpit" : "Share Beta Packet"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share WoofWatcher 48-hour beta handoff"
                    onPress={shareBetaHandoffPacket}
                    style={({ pressed }) => [
                      s.betaHandoffShareButton,
                      {
                        borderColor: betaShipTone + "66",
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="document-text-outline" size={15} color={betaShipTone} />
                    <Text style={[s.betaHandoffShareText, { color: betaShipTone, fontFamily: "Inter_800ExtraBold" }]}>
                      Share Beta Handoff
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={[s.launchPacket, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[s.launchScore, { backgroundColor: readinessBadgeTone + "16" }]}>
                <Text style={[s.launchScoreValue, { color: readinessBadgeTone, fontFamily: DISPLAY_SEMI }]}>
                  {launchReleasePacket.readinessScore}%
                </Text>
                <Text style={[s.launchScoreLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  release score
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.launchPacketTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                  {launchReleasePacket.verdictLabel}
                </Text>
                <Text style={[s.launchPacketCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {launchReleasePacket.ownerSummary}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share WoofWatcher release packet"
              onPress={shareLaunchPacket}
              style={({ pressed }) => [
                s.launchShare,
                { backgroundColor: colors.forest, opacity: pressed ? 0.84 : 1 },
              ]}
            >
              <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
              <Text style={[s.launchShareText, { fontFamily: "Inter_800ExtraBold" }]}>Share Launch Packet</Text>
            </Pressable>
            <View style={[s.launchPacket, { backgroundColor: storeSubmissionTone + "10", borderColor: storeSubmissionTone + "33" }]}>
              <View style={[s.launchScore, { backgroundColor: storeSubmissionTone + "18" }]}>
                <Text style={[s.launchScoreValue, { color: storeSubmissionTone, fontFamily: DISPLAY_SEMI }]}>
                  {launchStoreSubmissionPacket.screenshotChecklist.length}
                </Text>
                <Text style={[s.launchScoreLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  screens
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.launchPacketTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                  Store Submission - {launchStoreSubmissionPacket.verdictLabel}
                </Text>
                <Text style={[s.launchPacketCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {launchStoreSubmissionPacket.metadata.shortDescription} {launchStoreSubmissionPacket.reviewNotes[0]}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share WoofWatcher store submission packet"
              onPress={shareStoreSubmissionPacket}
              style={({ pressed }) => [
                s.launchShare,
                { backgroundColor: colors.forest, opacity: pressed ? 0.84 : 1 },
              ]}
            >
              <Ionicons name="storefront-outline" size={16} color="#FFFFFF" />
              <Text style={[s.launchShareText, { fontFamily: "Inter_800ExtraBold" }]}>Share Store Packet</Text>
            </Pressable>
          </BoardCard>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/premium");
            }}
            accessibilityRole="button"
            accessibilityLabel="Open WoofWatcher Plus"
            style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
          >
            <LinearGradient
              colors={[colors.forest, colors.forestBright]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.premiumCard}
            >
              <View style={s.premiumIcon}>
                <Ionicons name="diamond-outline" size={19} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.premiumTitle, { fontFamily: DISPLAY_SEMI }]}>WoofWatcher Plus</Text>
                <Text style={[s.premiumSub, { fontFamily: "Inter_500Medium" }]}>
                  Advanced meals, Health Watch, reports, records, and household care sync.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
            </>
          ) : null}


          {/* Sync health */}
          <BoardCard style={[s.moreBoardCard, { borderColor: syncTone + "44" }]}>
            <BoardSectionHeader
              title={
                consumerSurfacePolicy.providerSyncControls
                  ? "Sync Health"
                  : "Device Storage"
              }
              accessory={
                consumerSurfacePolicy.providerSyncControls ? (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (!isClerkEnabledForBuild) {
                        notifyDialog(
                          "Saved on this device",
                          "Everything is saved on this device. Nothing is waiting to upload.",
                        );
                        return;
                      }
                      if (!isSignedIn) {
                        notifyDialog(
                          "Sign in to sync",
                          "Care logs stay saved on this device until you sign in to the household account.",
                        );
                        return;
                      }
                      refresh();
                    }}
                    disabled={isSyncing}
                    accessibilityRole="button"
                    accessibilityLabel="Refresh household sync"
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                  >
                    <Text style={[s.sectionLink, { color: syncTone, fontFamily: "Inter_600SemiBold", opacity: isSyncing ? 0.65 : 1 }]}>
                      {syncDashboard.actionLabel}
                    </Text>
                  </Pressable>
                ) : (
                  <BoardPill label="Local" tone={colors.sage} />
                )
              }
            />
            <View style={s.syncTop}>
              <View style={[s.syncIcon, { backgroundColor: syncTone + "18" }]}>
                <Ionicons name={syncIcon} size={20} color={syncTone} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.syncTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {syncDashboard.title}
                </Text>
                <Text style={[s.syncMessage, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {syncDashboard.message}
                </Text>
              </View>
            </View>
            <View style={s.syncMetrics}>
              {syncDashboard.metrics.map((metric) => (
                <View key={metric.label} style={[s.syncMetric, { backgroundColor: colors.background }]}>
                  <Text style={[s.syncMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {metric.value}
                  </Text>
                  <Text style={[s.syncMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[s.syncNextStep, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {syncDashboard.nextStep}
            </Text>
            {ownerOps ? (
              <Pressable
                onPress={openCareEntryProviderSyncProofMission}
                accessibilityRole="button"
                accessibilityLabel="Open care-entry provider sync proof mission"
                hitSlop={MOBILE_INLINE_HIT_SLOP}
                style={({ pressed }) => [
                  s.providerSetupRowAction,
                  { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Ionicons name="server-outline" size={14} color={syncTone} />
                <Text style={[s.providerSetupRowActionText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  Open sync proof
                </Text>
              </Pressable>
            ) : null}
          </BoardCard>


          {/* Links */}
          <BoardCard style={s.moreBoardCard}>
            <BoardSectionHeader title="Tools & Sharing" />
            {links.map((l, i) => (
              <Pressable
                key={l.label}
                onPress={l.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${l.label}. ${l.sub}`}
                style={({ pressed }) => [s.linkRow, i < links.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={[s.linkIconWrap, { backgroundColor: PULSE_COLORS[l.icon] + "16" }]}>
                  <Ionicons name={l.iconName} size={20} color={PULSE_COLORS[l.icon]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.linkLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{l.label}</Text>
                  <Text numberOfLines={1} style={[s.linkSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{l.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </BoardCard>

          {/* About / boundary */}
          <View style={[s.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.sage} />
            <Text style={[s.noticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.vetBoundary}</Text>
          </View>

          {/* Sign out renders only when a real account provider is configured
              and someone is actually signed in; the local-first build has no
              sign-in, so a sign-out row would be a dead cloud-sync promise. */}
          {providerSyncEnabled && isSignedIn ? (
            <Pressable
              onPress={confirmSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out of WoofWatcher"
              style={({ pressed }) => [s.signOut, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="log-out-outline" size={19} color={colors.rose} />
              <Text style={[s.signOutText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>Sign out</Text>
            </Pressable>
          ) : null}

          <Text style={[s.footer, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            WoofWatcher · Happy dog, simplified care 💚
          </Text>
        </Animated.View>
      </ScrollView>


      <Modal visible={providerSetupOpen} transparent animationType="slide" onRequestClose={() => setProviderSetupOpen(false)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setProviderSetupOpen(false)}>
          <Pressable style={[s.profileModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: modalSheetBottomPadding, paddingHorizontal: 22 }}
              bounces={false}
            >
              <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
              <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Provider Launch Setup</Text>
              <Text style={[s.sheetSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Mark only production providers you have actually configured. This updates Launch Readiness but does not approve App Store or Play Store submission.
              </Text>

              <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>REVIEW STATUS</Text>
              <View style={s.providerStatusGrid}>
                {[
                  { key: "local-draft" as const, label: "Draft" },
                  { key: "owner-reviewed" as const, label: "Owner reviewed" },
                  { key: "provider-approved" as const, label: "Provider approved" },
                ].map((statusOption) => {
                  const selected = providerDraft.providerStatus === statusOption.key;
                  return (
                    <Pressable
                      key={statusOption.key}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setProviderDraft((prev) => ({ ...prev, providerStatus: statusOption.key }));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Set provider setup status to ${statusOption.label}`}
                      style={[
                        s.providerStatusPill,
                        {
                          backgroundColor: selected ? colors.primary + "18" : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[s.providerStatusText, { color: selected ? colors.primary : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {statusOption.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[s.providerChecklist, { borderTopColor: colors.border }]}>
                {PROVIDER_SETUP_FIELDS.map((field) => {
                  const checked = providerDraft[field.key];
                  return (
                    <Pressable
                      key={field.key}
                      onPress={() => toggleProviderDraft(field.key)}
                      accessibilityRole="checkbox"
                      aria-checked={checked}
                      accessibilityLabel={`${field.label}. ${field.detail}`}
                      style={({ pressed }) => [
                        s.providerChecklistRow,
                        { borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      <Ionicons
                        name={checked ? "checkbox" : "square-outline"}
                        size={21}
                        color={checked ? colors.sage : colors.mutedForeground}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.providerChecklistTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                          {field.label}
                        </Text>
                        <Text style={[s.providerChecklistSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {field.detail}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>OPERATOR NOTES</Text>
              <TextInput
                value={providerDraft.notes}
                onChangeText={(notes) => setProviderDraft((prev) => ({ ...prev, notes }))}
                placeholder="What still needs keys, rules, account approval, or QA?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[
                  s.profField,
                  {
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    fontFamily: "Inter_400Regular",
                    minHeight: 74,
                    textAlignVertical: "top",
                  },
                ]}
              />

              <Pressable
                onPress={saveProviderSetup}
                accessibilityRole="button"
                accessibilityLabel="Save provider launch setup"
                style={({ pressed }) => [s.profSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[s.profSaveBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Save provider setup</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Dog profile edit modal */}
      <Modal visible={profileOpen} transparent animationType="slide" onRequestClose={() => setProfileOpen(false)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setProfileOpen(false)}>
          <Pressable
            style={[s.profileModal, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: modalSheetBottomPadding, paddingHorizontal: 22 }}
              bounces={false}
            >
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Dog Profile</Text>

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NAME</Text>
            <TextInput
              value={pName}
              onChangeText={setPName}
              placeholder="e.g. Luna"
              placeholderTextColor={colors.mutedForeground}
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>BREED</Text>
            <TextInput
              value={pBreed}
              onChangeText={setPBreed}
              placeholder="e.g. Golden Retriever mix"
              placeholderTextColor={colors.mutedForeground}
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <View style={s.profWeightRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>WEIGHT</Text>
                <TextInput
                  value={pWeight}
                  onChangeText={(value) => { setPWeight(value); setPWeightError(null); }}
                  placeholder="0.0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[s.profField, { backgroundColor: colors.background, color: pWeightError ? colors.rose : colors.foreground, borderWidth: pWeightError ? 1 : 0, borderColor: pWeightError ? colors.rose : "transparent", fontFamily: "Inter_500Medium" }]}
                />
                {pWeightError ? (
                  <Text aria-live="polite" style={[s.profFieldLabel, { color: colors.rose, fontFamily: "Inter_600SemiBold" }]}>
                    {pWeightError}
                  </Text>
                ) : null}
              </View>
              <View>
                <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>UNIT</Text>
                <View style={s.unitRow}>
                  {(["lb", "kg"] as const).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => { Haptics.selectionAsync(); setPWeightUnit(u); }}
                      style={[s.unitPill, { backgroundColor: pWeightUnit === u ? colors.primary : colors.background, borderColor: pWeightUnit === u ? colors.primary : colors.border }]}
                    >
                      <Text style={[s.unitText, { color: pWeightUnit === u ? "#fff" : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>CARE FOCUS (OPTIONAL)</Text>
            <TextInput
              value={pFocus}
              onChangeText={setPFocus}
              placeholder="e.g. Maintain healthy weight, ease anxiety"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_400Regular", minHeight: 60, textAlignVertical: "top" }]}
            />

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>MICROCHIP NUMBER</Text>
            <TextInput
              value={pMicrochip}
              onChangeText={setPMicrochip}
              placeholder="985112..."
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>PRIMARY VET</Text>
            <TextInput
              value={pPrimaryVet}
              onChangeText={setPPrimaryVet}
              placeholder="Clinic or veterinarian"
              placeholderTextColor={colors.mutedForeground}
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>EMERGENCY CONTACT</Text>
            <TextInput
              value={pEmergencyContact}
              onChangeText={setPEmergencyContact}
              placeholder="Name and phone"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <View style={s.profWeightRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>INSURANCE</Text>
                <TextInput
                  value={pInsuranceProvider}
                  onChangeText={setPInsuranceProvider}
                  placeholder="Provider"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>POLICY</Text>
                <TextInput
                  value={pInsurancePolicy}
                  onChangeText={setPInsurancePolicy}
                  placeholder="Policy #"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
              </View>
            </View>

            <Pressable
              onPress={saveProfile}
              style={({ pressed }) => [s.profSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[s.profSaveBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Save profile</Text>
            </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  moreRouteHeader: {
    paddingHorizontal: 20,
  },

  moreCommandStageCard: {
    alignSelf: "stretch",
    width: "100%",
    maxWidth: "100%",
    marginTop: 6,
  },
  /* Parchment console anatomy: head row with the small living thumbnail,
     light stat chips, soft amber gates pill, forest action button. */
  moreCommandHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 12,
  },
  moreCommandThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  moreCommandThumbImage: {
    borderRadius: 13,
  },
  moreCommandHeadCopy: {
    flex: 1,
    minWidth: 0,
  },
  moreCommandKicker: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  moreCommandSpeech: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 3,
  },
  moreCommandStats: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
  },
  moreCommandStat: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  moreCommandStatLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  moreCommandStatValue: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 3,
  },
  moreCommandGates: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
  },
  moreCommandGatesText: {
    flexShrink: 1,
    fontSize: 11,
    letterSpacing: 0.2,
  },

  profileCard: {
    borderRadius: 26,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 5,
  },
  profileBanner: { height: 72, width: "100%" },
  profileAvatarWrap: { alignItems: "center", marginTop: -38 },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    overflow: "hidden",
  },
  profileAvatarImg: { width: "100%", height: "100%", borderRadius: 20 },
  profileBody: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10 },
  profileName: { fontSize: 24, letterSpacing: -0.3 },
  profileBreed: { fontSize: 13.5, marginTop: 2, textAlign: "center" },
  avatarIdentityPill: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatarIdentityText: { fontSize: 11.5 },
  profileStats: { flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 16, borderTopWidth: 1, width: "100%" },
  profileStat: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  profileStatValue: { fontSize: 16, letterSpacing: -0.2, textAlign: "center" },
  profileStatLabel: { fontSize: 12, marginTop: 3 },
  profileStatDivider: { width: 1, height: 36 },

  sectionLink: { fontSize: 14 },
  moreBoardCard: { marginTop: 14 },
  moreDirectoryCard: { marginTop: 12 },
  careerXpBlock: { marginBottom: 12 },
  careerXpHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  careerXpLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  careerXpValue: { fontSize: 12.5 },
  moreDirectoryList: {
    borderRadius: 8,
    overflow: "hidden",
  },
  moreDirectoryRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 9,
  },
  moreDirectoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  moreDirectoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  moreDirectoryEyebrow: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  moreDirectoryTitle: {
    fontSize: 14.5,
    lineHeight: 18,
    marginTop: 2,
  },
  moreDirectoryDetail: {
    fontSize: 11.4,
    lineHeight: 15,
    marginTop: 3,
  },
  moreDirectoryAction: {
    minWidth: 76,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  moreDirectoryActionText: {
    fontSize: 11,
    lineHeight: 14,
  },

  launchBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  launchBadgeText: { fontSize: 9.5, letterSpacing: 0.5 },
  intelligenceBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  intelligenceBadgeText: { fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  intelligenceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  intelligenceIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  intelligenceTitle: { fontSize: 16, letterSpacing: 0 },
  intelligenceSummary: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  intelligenceMeter: { height: 12, borderRadius: 999, borderWidth: 1, marginTop: 14, overflow: "hidden" },
  intelligenceMeterFill: { height: "100%", borderRadius: 999 },
  intelligenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  intelligenceMetric: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 82,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    justifyContent: "center",
  },
  intelligenceMetricValue: { fontSize: 17 },
  intelligenceMetricLabel: { fontSize: 10.5, lineHeight: 13, marginTop: 2, textTransform: "uppercase" },
  intelligenceMetricDetail: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  intelligenceAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 13,
  },
  intelligenceActionText: { color: "#FFFFFF", fontSize: 13.5 },
  launchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  launchTile: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 98,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  launchTileIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  launchTileLabel: { fontSize: 12.5, marginTop: 8 },
  launchTileValue: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  launchNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  launchNoticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  launchNextGate: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  launchNextGateIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  launchNextGateBody: { flex: 1 },
  launchNextGateKicker: { fontSize: 9.4, lineHeight: 12, textTransform: "uppercase" },
  launchNextGateTitle: { fontSize: 14.2, lineHeight: 18, marginTop: 3 },
  launchNextGateDetail: { fontSize: 11.4, lineHeight: 16, marginTop: 4 },
  launchNextGateCta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  launchNextGateCtaText: { fontSize: 11.5, lineHeight: 15 },
  providerSetupPanel: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  providerSetupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  providerSetupScore: {
    width: 74,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  providerSetupScoreValue: { fontSize: 22, lineHeight: 25 },
  providerSetupScoreLabel: { fontSize: 8.7, lineHeight: 12, textTransform: "uppercase", marginTop: 2 },
  providerSetupTitle: { fontSize: 13.5, lineHeight: 18 },
  providerSetupSub: { fontSize: 11.2, lineHeight: 15, marginTop: 2 },
  providerSetupCopy: { fontSize: 11.2, lineHeight: 16, marginTop: 4 },
  providerNextGate: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 4,
  },
  providerNextGateHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  providerNextGateKicker: { fontSize: 9.3, lineHeight: 12, textTransform: "uppercase" },
  providerNextGateTitle: { fontSize: 13, lineHeight: 17 },
  providerNextGateMeta: { fontSize: 10.3, lineHeight: 14 },
  providerNextGateCopy: { fontSize: 11, lineHeight: 15 },
  providerNextGateProof: { fontSize: 10.2, lineHeight: 14 },
  providerSetupProofChecklist: { gap: 3, marginTop: 4 },
  providerSetupProofItem: { fontSize: 9.8, lineHeight: 13 },
  providerSetupRows: { marginTop: 8 },
  providerSetupRow: {
    minHeight: 52,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
  },
  providerSetupRowTitle: { fontSize: 12.4, lineHeight: 16 },
  providerSetupRowSub: { fontSize: 10.8, lineHeight: 15, marginTop: 2 },
  providerSetupRowProof: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  providerSetupRowAction: {
    minHeight: 34,
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 8,
  },
  providerSetupRowActionText: { fontSize: 10.2, lineHeight: 13 },
  providerSetupActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  providerSetupButton: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 9,
  },
  providerSetupButtonText: { color: "#FFFFFF", fontSize: 11.8 },
  nativeQaCapturePanel: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  nativeQaCaptureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
  },
  nativeQaCaptureIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  nativeQaCaptureTitle: { fontSize: 13.5, lineHeight: 18 },
  nativeQaCaptureSub: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  nativeQaOwnerProofRow: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nativeQaOwnerProofLabel: { fontSize: 9.5, lineHeight: 13, textTransform: "uppercase" },
  nativeQaOwnerProofTitle: { fontSize: 13, lineHeight: 17, marginTop: 1 },
  nativeQaOwnerProofDetail: { fontSize: 10.8, lineHeight: 15, marginTop: 2 },
  nativeQaCaptureActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 2,
  },
  nativeQaCaptureShare: {
    flex: 1,
    minWidth: 132,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  nativeQaCaptureShareText: { color: "#FFFFFF", fontSize: 12.5 },
  nativeQaCaptureFixBrief: {
    flex: 1,
    minWidth: 132,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
  },
  nativeQaCaptureNeedsTuneAction: {
    flex: 1,
    minWidth: 132,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
  },
  nativeQaCaptureCockpitAction: {
    flex: 1,
    minWidth: 132,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
  },
  nativeQaCaptureCockpitActionText: { fontSize: 12.2, lineHeight: 15 },
  nativeQaCaptureRow: {
    minHeight: 54,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  nativeQaCaptureRowTitle: { fontSize: 12.5, lineHeight: 17 },
  nativeQaCaptureStatusLine: {
    marginTop: 3,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
  },
  nativeQaCaptureStatusLabel: {
    fontSize: 9.5,
    lineHeight: 13,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  nativeQaCaptureStatusValue: { fontSize: 11, lineHeight: 14 },
  nativeQaCaptureRowSub: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  nativeQaCaptureRowPrep: { fontSize: 11, lineHeight: 15, marginTop: 4 },
  nativeQaCaptureRowStep: { fontSize: 11, lineHeight: 15, marginTop: 4 },
  nativeQaCaptureRowCriteria: { fontSize: 11, lineHeight: 15, marginTop: 4 },
  nativeQaCapturePill: {
    minHeight: 26,
    borderRadius: 7,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  nativeQaCapturePillText: { fontSize: 9.5, lineHeight: 12 },
  launchPacket: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  launchPacketBody: { flex: 1, minWidth: 0 },
  launchScore: {
    width: 78,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  launchScoreValue: { fontSize: 22, lineHeight: 26 },
  launchScoreLabel: { fontSize: 9, lineHeight: 12, textTransform: "uppercase", marginTop: 2 },
  launchPacketTitle: { fontSize: 13.5, lineHeight: 18 },
  launchPacketCopy: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  betaNextActions: { marginTop: 8, gap: 6 },
  betaNextActionRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  betaNextActionDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  betaNextActionText: { flex: 1, fontSize: 10.5, lineHeight: 15 },
  betaNextActionRail: {
    marginTop: 10,
    gap: 8,
  },
  betaNextActionButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  betaNextActionButtonText: { color: "#FFFFFF", fontSize: 12.5 },
  betaHandoffShareButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
  },
  betaHandoffShareText: { fontSize: 12.2, lineHeight: 15 },
  launchShare: {
    marginTop: 12,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  launchShareText: { color: "#FFFFFF", fontSize: 13 },

  syncTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  syncIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  syncTitle: { fontSize: 16, letterSpacing: 0 },
  syncMessage: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  syncMetrics: { flexDirection: "row", gap: 8, marginTop: 14 },
  syncMetric: { flex: 1, minHeight: 66, borderRadius: 15, paddingHorizontal: 9, paddingVertical: 10, justifyContent: "center" },
  syncMetricValue: { fontSize: 14, textAlign: "center" },
  syncMetricLabel: { fontSize: 10.5, textAlign: "center", marginTop: 3 },
  syncNextStep: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },

  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  signOutText: { fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,31,36,0.45)", justifyContent: "center", paddingHorizontal: 28 },

  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15 },
  linkIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  linkLabel: { fontSize: 15.5 },
  linkSub: { fontSize: 13, marginTop: 2 },

  statusStrip: {
    flexDirection: "row",
    borderRadius: 22,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  statusCell: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 6 },
  statusValue: { fontSize: 16, letterSpacing: -0.2, textTransform: "capitalize" },
  statusLabel: { fontSize: 11.5, marginTop: 3, textAlign: "center" },
  statusEnergyRow: { flexDirection: "row", gap: 4, marginBottom: 1 },
  statusEnergyDot: { width: 8, height: 8, borderRadius: 4 },
  premiumCard: { flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 22, padding: 16, marginTop: 12 },
  premiumIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  premiumTitle: { color: "#FFFFFF", fontSize: 17, letterSpacing: 0 },
  premiumSub: { color: "rgba(255,255,255,0.78)", fontSize: 12.5, lineHeight: 18, marginTop: 2 },

  notice: { flexDirection: "row", gap: 10, borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 24 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  footer: { fontSize: 13, textAlign: "center", marginTop: 18 },

  profileEditBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  profileModal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", paddingTop: 14 },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  sheetTitle: { fontSize: 20, marginBottom: 4, letterSpacing: -0.2 },
  sheetSubtitle: { fontSize: 12.5, lineHeight: 18, marginBottom: 2 },
  providerStatusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  providerStatusPill: {
    flexGrow: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  providerStatusText: { fontSize: 12.2, lineHeight: 16 },
  providerChecklist: { borderTopWidth: 1, marginTop: 14 },
  providerChecklistRow: {
    minHeight: 62,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
  },
  providerChecklistTitle: { fontSize: 13.2, lineHeight: 17 },
  providerChecklistSub: { fontSize: 11.2, lineHeight: 16, marginTop: 2 },
  profFieldLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: 7, marginTop: 16 },
  profField: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  profWeightRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  unitRow: { flexDirection: "row", gap: 8, paddingBottom: 1 },
  unitPill: { minHeight: MIN_MOBILE_TOUCH_TARGET, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  unitText: { fontSize: 14 },
  profSaveBtn: { marginTop: 24, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 15, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  profSaveBtnText: { fontSize: 15.5 },
});
