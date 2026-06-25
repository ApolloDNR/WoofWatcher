import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
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
import { useWoofAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useUpdateHousehold,
  useJoinHousehold,
  useUpdateMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import {
  buildAccessPassDraft,
  deriveCareIntelligence,
  deriveAccessPassPlan,
  deriveHouseholdAccessPlan,
  deriveHouseholdResponsibility,
  deriveMyCareToday,
  getCareEventDefinition,
  type AccessPassKind,
} from "@workspace/care-domain";
import { useColors } from "@/hooks/useColors";
import { useCare } from "@/context/CareContext";
import { useAvatar } from "@/context/AvatarContext";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";
import { deriveCareSyncDashboard } from "@/lib/careSync";
import { buildCareTwinRosterDraft, deriveCareTwinRoster } from "@/lib/careTwinRoster";
import { deriveAttachmentManifest } from "@/lib/attachmentManifest";
import { buildBetaHandoffPacketShareText } from "@/lib/betaHandoffPacket";
import {
  deriveLaunchReadiness,
  type LaunchReadinessNativeQaSummary,
  type LaunchReadinessOverallStatus,
  type LaunchReadinessTileKey,
  type LaunchReadinessTileStatus,
} from "@/lib/launchReadiness";
import {
  buildLaunchProviderSetupShareText,
  deriveLaunchProviderSetup,
  normalizeLaunchProviderProfile,
  type LaunchProviderProfile,
} from "@/lib/launchProviderSetup";
import {
  buildMobileLaunchQaCapturePlan,
  buildMobileLaunchQaCaptureShareText,
  buildMobileLaunchQaFixBriefShareText,
  deriveNativeQaSummaryFromMobileQaSession,
  mobileLaunchQaCaptureTargetStatusLabel,
  type MobileLaunchQaCapturePlan,
} from "@/lib/mobileLaunchQaEvidence";
import {
  MOBILE_QA_SESSION_STORAGE_KEY,
  parseMobileQaSessionSnapshot,
} from "@/lib/mobileQaSession";
import { buildReleasePacket, buildReleasePacketShareText } from "@/lib/releasePacket";
import { buildStoreSubmissionPacket, buildStoreSubmissionPacketShareText } from "@/lib/storeSubmissionPacket";
import { deriveSupportRunbookPlan } from "@/lib/supportRunbook";
import {
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { BoardCard, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type HouseholdMemberSummary = {
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
};

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

const PROVIDER_SETUP_FIELDS: Array<{
  key: LaunchProviderFlagKey;
  label: string;
  detail: string;
}> = [
  {
    key: "authConfigured",
    label: "Production auth",
    detail: "Clerk keys, redirects, household sign-in, and session rules.",
  },
  {
    key: "databaseConfigured",
    label: "Household database",
    detail: "Supabase/Postgres tables, RLS, backups, and migrations.",
  },
  {
    key: "storageProviderConfigured",
    label: "Records storage",
    detail: "Signed uploads/downloads, retention, export, and deletion rules.",
  },
  {
    key: "aiProviderConfigured",
    label: "WoofGuide AI",
    detail: "Provider key, model policy, owner review, and vet boundary.",
  },
  {
    key: "paymentsEnabled",
    label: "Plus payments",
    detail: "Subscription tiers, app-store billing, refunds, and entitlement checks.",
  },
  {
    key: "pushNotificationsConfigured",
    label: "Push reminders",
    detail: "Expo push, APNs/FCM, permission copy, quiet hours, and opt-out.",
  },
  {
    key: "appStoreAccountsReady",
    label: "Store accounts",
    detail: "Apple Developer, App Store Connect, Google Play Console, bundle ids.",
  },
  {
    key: "accountDeletionEnabled",
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

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, refresh, updateCareDoc, syncOutbox, isLoaded, isSyncing } = useCare();
  const { dietProfile, profile, entries, routines, caregivers, accessPasses } = state;
  const { avatarConfig, getAvatarSource, hasConfiguredAvatar } = useAvatar();

  const { signOut } = useWoofAuth();
  const queryClient = useQueryClient();
  const me = useGetMe();
  const updateHousehold = useUpdateHousehold();
  const joinHousehold = useJoinHousehold();
  const updateMe = useUpdateMe();

  const household = me.data?.household;
  const members: HouseholdMemberSummary[] = me.data?.members ?? [];
  const myName = me.data?.user?.displayName?.trim() || "";
  const currentHuman = myName || caregivers[0]?.name || "Apollo";

  const now = Date.now();
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const careIntelligence = useMemo(
    () =>
      deriveCareIntelligence({
        entries,
        routines,
        caregivers,
        now,
      }),
    [entries, routines, caregivers, now],
  );
  const petName =
    profile.name && profile.name !== "My Dog"
      ? profile.name
      : "Phoenix";
  const careTwinRoster = useMemo(
    () => deriveCareTwinRoster(state),
    [state.activePetId, state.profile, state.pets],
  );
  const avatarTemplate = useMemo(
    () => getAvatarTemplate(avatarConfig.templateId),
    [avatarConfig.templateId],
  );

  const streak = useMemo(() => {
    const days = new Set(entries.map((e) => e.occurredAt.slice(0, 10)));
    let s = 0;
    let d = new Date(now);
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (!days.has(key)) break;
      s++;
      d = new Date(d.getTime() - 86400000);
    }
    return s;
  }, [entries, now]);

  const todayLogCount = useMemo(() => {
    const today = new Date(now).toISOString().slice(0, 10);
    return entries.filter((e) => e.occurredAt.startsWith(today)).length;
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

  const syncDashboard = useMemo(
    () =>
      deriveCareSyncDashboard({
        outbox: syncOutbox,
        isLoaded,
        isSyncing,
        lastUpdatedAt: latestCareUpdate ?? state.updatedAt,
        householdMemberCount: members.length || (household ? 1 : 0),
        totalEntries: entries.length,
      }),
    [
      syncOutbox,
      isLoaded,
      isSyncing,
      latestCareUpdate,
      state.updatedAt,
      members.length,
      household,
      entries.length,
    ],
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
        { storageProviderConfigured: false },
      ),
    [entries, state.adventureMemories, state.records, state.reportArtifacts],
  );
  const launchSupportPlan = useMemo(
    () => deriveSupportRunbookPlan(state.launchSupportProfile),
    [state.launchSupportProfile],
  );
  const supportRunbookOwnerReviewed =
    state.launchSupportProfile.providerStatus === "owner-reviewed" && launchSupportPlan.supportRunbookApproved;
  const privacyLegalOwnerReviewed =
    state.launchSupportProfile.providerStatus === "owner-reviewed" && launchSupportPlan.privacyLegalApproved;

  const syncTone =
    syncDashboard.status === "attention"
      ? colors.amber
      : syncDashboard.status === "syncing" || syncDashboard.status === "loading"
        ? colors.primary
        : colors.sage;
  const syncIcon: keyof typeof Ionicons.glyphMap =
    syncDashboard.status === "attention"
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
  const householdAccess = useMemo(
    () =>
      deriveHouseholdAccessPlan({
        household: household ? { name: household.name, inviteCode: household.inviteCode } : null,
        members,
        caregivers,
        routines,
      }),
    [household, members, caregivers, routines],
  );
  const accessPassPlan = useMemo(
    () =>
      deriveAccessPassPlan({
        passes: accessPasses,
        petName,
        now,
      }),
    [accessPasses, petName, now],
  );
  const myCareToday = useMemo(
    () =>
      deriveMyCareToday({
        personName: currentHuman,
        petName,
        routines,
        entries,
        now,
      }),
    [currentHuman, petName, routines, entries, now],
  );
  const responsibilityTone =
    householdResponsibility.status === "needs-care"
      ? colors.rose
      : householdResponsibility.status === "needs-assignment"
        ? colors.amber
        : householdResponsibility.status === "needs-setup"
          ? colors.primary
          : colors.sage;
  const accessTone =
    householdAccess.status === "needs-household" || householdAccess.status === "needs-invites"
      ? colors.amber
      : householdAccess.status === "needs-roles"
        ? colors.copper
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
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const [dietOpen, setDietOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [petRosterOpen, setPetRosterOpen] = useState(false);
  const [petRosterName, setPetRosterName] = useState("");
  const [petRosterBreed, setPetRosterBreed] = useState("");
  const [accessPassOpen, setAccessPassOpen] = useState(false);
  const [accessPassName, setAccessPassName] = useState("");
  const [accessPassKind, setAccessPassKind] = useState<AccessPassKind>("sitter");
  const [pName, setPName] = useState("");
  const [pBreed, setPBreed] = useState("");
  const [pWeight, setPWeight] = useState("");
  const [pWeightUnit, setPWeightUnit] = useState<"lb" | "kg">("lb");
  const [pFocus, setPFocus] = useState("");
  const [pMicrochip, setPMicrochip] = useState("");
  const [pPrimaryVet, setPPrimaryVet] = useState("");
  const [pEmergencyContact, setPEmergencyContact] = useState("");
  const [pInsuranceProvider, setPInsuranceProvider] = useState("");
  const [pInsurancePolicy, setPInsurancePolicy] = useState("");

  const [dietEditOpen, setDietEditOpen] = useState(false);
  const [dPrimaryFood, setDPrimaryFood] = useState("");
  const [dNormalPortion, setDNormalPortion] = useState("");
  const [dMealSchedule, setDMealSchedule] = useState("");
  const [dToppers, setDToppers] = useState("");
  const [dBedtimeSnack, setDBedtimeSnack] = useState("");
  const [dTreatsAllowed, setDTreatsAllowed] = useState("");
  const [dAvoid, setDAvoid] = useState("");
  const [dSensitivities, setDSensitivities] = useState("");
  const [dAppetiteQuirks, setDAppetiteQuirks] = useState("");
  const [dVetNotes, setDVetNotes] = useState("");
  const [dSupplements, setDSupplements] = useState("");
  const [savedNativeQaSummary, setSavedNativeQaSummary] =
    useState<LaunchReadinessNativeQaSummary | null>(null);
  const [nativeQaCapturePlan, setNativeQaCapturePlan] =
    useState<MobileLaunchQaCapturePlan>(() => buildMobileLaunchQaCapturePlan(null));
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
        })
        .catch(() => {
          if (!cancelled) {
            setSavedNativeQaSummary(null);
            setNativeQaCapturePlan(buildMobileLaunchQaCapturePlan(null));
          }
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const memberColor = (idx: number) => {
    const palette = [colors.primary, colors.copper, colors.sage, colors.amber, colors.rose];
    return palette[(idx >= 0 ? idx : 0) % palette.length];
  };

  const refreshMe = () => queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });

  const shareInvite = () => {
    if (!household) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({
      message: `Join our ${household.name} on WoofWatcher to help care for ${petName}. Invite code: ${household.inviteCode}`,
      title: "WoofWatcher invite",
    }).catch(() => Alert.alert("Invite code", household.inviteCode));
  };

  const openFuturePetSheet = () => {
    setPetRosterName("");
    setPetRosterBreed("");
    setPetRosterOpen(true);
  };

  const saveFuturePet = () => {
    const draft = buildCareTwinRosterDraft({
      name: petRosterName,
      breed: petRosterBreed,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({
      ...doc,
      activePetId: "primary",
      pets: [
        ...(doc.pets ?? []),
        draft,
      ],
    }));
    setPetRosterOpen(false);
  };

  const openAccessPassSheet = () => {
    setAccessPassName("");
    setAccessPassKind("sitter");
    setAccessPassOpen(true);
  };

  const saveAccessPassDraft = () => {
    const draft = buildAccessPassDraft({
      holderName: accessPassName,
      kind: accessPassKind,
      petName,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({
      ...doc,
      accessPasses: [
        ...(doc.accessPasses ?? []),
        draft,
      ],
    }));
    setAccessPassOpen(false);
  };

  const shareAccessPassSummary = () => {
    const pass = accessPassPlan.passes[0];
    if (!pass) {
      Alert.alert("Access Pass", "Create a local Access Pass draft before sharing helper instructions.");
      return;
    }
    const message = [
      `WoofWatcher Access Pass draft for ${pass.petName}`,
      "",
      `Helper: ${pass.holderName}`,
      `Role: ${pass.role}`,
      `Status: ${pass.status}`,
      `Time: ${pass.timeLabel}`,
      "",
      "Allowed:",
      ...pass.permissions.map((permission) => `- ${permission}`),
      "",
      "Not allowed:",
      ...pass.blockedPermissions.map((permission) => `- ${permission}`),
      "",
      accessPassPlan.permissionBoundary,
      "Provider-backed sharing is not live yet; review this before granting real access.",
    ].join("\n");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({ message, title: `WoofWatcher Access Pass - ${pass.holderName}` }).catch(() =>
      Alert.alert("Access Pass", message),
    );
  };

  const submitJoin = () => {
    const code = joinCode.trim();
    if (!code) return;
    joinHousehold.mutate(
      { data: { inviteCode: code } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setJoinOpen(false);
          setJoinCode("");
          refreshMe();
          refresh();
        },
        onError: () => Alert.alert("Couldn't join", "That invite code didn't match a household."),
      },
    );
  };

  const submitRename = () => {
    const name = renameValue.trim();
    if (!name) return;
    updateHousehold.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setRenameOpen(false);
          refreshMe();
        },
        onError: () => Alert.alert("Couldn't rename", "Please try again."),
      },
    );
  };

  const submitName = () => {
    const name = nameValue.trim();
    if (!name) return;
    updateMe.mutate(
      { data: { displayName: name } },
      {
        onSuccess: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setNameOpen(false);
          refreshMe();
        },
        onError: () => Alert.alert("Couldn't update name", "Please try again."),
      },
    );
  };

  const openProfileEdit = () => {
    setPName(profile.name === "My Dog" ? "" : profile.name);
    setPBreed(profile.breed);
    setPWeight(profile.weight.current > 0 ? String(profile.weight.current) : "");
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
    const name = pName.trim() || "Phoenix";
    const w = parseFloat(pWeight);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({
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
          current: Number.isFinite(w) && w > 0 ? w : doc.profile.weight.current,
          unit: pWeightUnit,
        },
      },
    }));
    setProfileOpen(false);
  };

  const openDietEdit = () => {
    setDPrimaryFood(dietProfile.primaryFood);
    setDNormalPortion(dietProfile.normalPortion);
    setDMealSchedule(dietProfile.mealSchedule);
    setDToppers(dietProfile.toppers);
    setDBedtimeSnack(dietProfile.bedtimeSnack);
    setDTreatsAllowed(dietProfile.treatsAllowed);
    setDAvoid(dietProfile.avoid);
    setDSensitivities(dietProfile.sensitivities);
    setDAppetiteQuirks(dietProfile.appetiteQuirks);
    setDVetNotes(dietProfile.vetNotes);
    setDSupplements(dietProfile.supplements);
    setDietEditOpen(true);
  };

  const saveDiet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({
      ...doc,
      dietProfile: {
        ...doc.dietProfile,
        primaryFood: dPrimaryFood.trim(),
        normalPortion: dNormalPortion.trim(),
        mealSchedule: dMealSchedule.trim(),
        toppers: dToppers.trim(),
        supplements: dSupplements.trim(),
        bedtimeSnack: dBedtimeSnack.trim(),
        treatsAllowed: dTreatsAllowed.trim(),
        avoid: dAvoid.trim(),
        sensitivities: dSensitivities.trim(),
        appetiteQuirks: dAppetiteQuirks.trim(),
        vetNotes: dVetNotes.trim(),
      },
    }));
    setDietEditOpen(false);
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out", "You'll need to sign back in to sync care logs.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          signOut();
        },
      },
    ]);
  };

  // Mount animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [fade, slide]);

  const generateCarePass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const recentLines = entries
      .slice(0, 5)
      .map((e) => {
        const label = getCareEventDefinition(e.type, e.details).label.toUpperCase();
        return `  - ${label}: ${e.title}${e.note ? ` - ${e.note}` : ""}`;
      })
      .join("\n");
    const routineLines = routines.map((r) => `  ${r.time} - ${r.label} (${r.owner})`).join("\n");
    const pass = [
      `WOOFWATCHER CARE PASS - ${today}`,
      "",
      `${petName} (${profile.breed})`,
      `Weight: ${profile.weight.current} ${profile.weight.unit}`,
      `Focus: ${profile.careFocus}`,
      "",
      "DIET",
      `Food: ${dietProfile.primaryFood}`,
      `Portion: ${dietProfile.normalPortion}`,
      `Schedule: ${dietProfile.mealSchedule}`,
      `Avoid: ${dietProfile.avoid}`,
      `Snack: ${dietProfile.bedtimeSnack}`,
      "",
      "DAILY SCHEDULE",
      routineLines,
      "",
      "RECENT LOG (last 5)",
      recentLines || "  (no entries)",
      "",
      `Care boundary: ${profile.vetBoundary}`,
    ].join("\n");

    Share.share({ message: pass, title: `WoofWatcher Care Pass - ${petName}` }).catch(() =>
      Alert.alert("Care Pass", pass),
    );
  };

  const dietItems: { icon: PulseIconName; label: string; value: string }[] = [
    { icon: "bowl", label: "Food", value: dietProfile.primaryFood },
    { icon: "bowl", label: "Portion", value: dietProfile.normalPortion },
    { icon: "star", label: "Schedule", value: dietProfile.mealSchedule },
    { icon: "candy", label: "Toppers", value: dietProfile.toppers },
    { icon: "bone", label: "Bedtime snack", value: dietProfile.bedtimeSnack },
    { icon: "bone", label: "Treats", value: dietProfile.treatsAllowed },
    { icon: "vomit", label: "Avoid", value: dietProfile.avoid },
  ];

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
    {
      icon: "star",
      iconName: "diamond-outline",
      label: "WoofWatcher Plus",
      sub: "Preview Plus, Family, and paid-value packaging",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/premium");
      },
    },
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
      sub: "Private care quests, XP, and memories from real walks and wins",
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
    ...(__DEV__
      ? [
          {
            icon: "star" as PulseIconName,
            iconName: "phone-portrait-outline" as keyof typeof Ionicons.glyphMap,
            label: "Care Twin QA",
            sub: "Internal device review for Phoenix room states and sprite loops",
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/care-twin-qa" as never);
            },
          },
        ]
      : []),
    {
      icon: "paw",
      iconName: "card",
      label: "Care Pass",
      sub: "Share a summary for sitters or the vet",
      onPress: generateCarePass,
    },
  ];

  const launchProviderSetupPlan = useMemo(
    () => deriveLaunchProviderSetup(state.launchProviderProfile),
    [state.launchProviderProfile],
  );

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
          authConfigured: Boolean(launchProviderSetupPlan.providerInput.authConfigured || (me.data?.user?.id && household)),
          databaseConfigured: Boolean(launchProviderSetupPlan.providerInput.databaseConfigured || (household && syncDashboard.status !== "attention")),
          storageProviderConfigured: Boolean(launchProviderSetupPlan.providerInput.storageProviderConfigured),
          storageQueue: attachmentManifest.launchQueue,
          aiProviderConfigured: Boolean(launchProviderSetupPlan.providerInput.aiProviderConfigured),
          paymentsEnabled: Boolean(launchProviderSetupPlan.providerInput.paymentsEnabled),
          accountDeletionEnabled: Boolean(launchProviderSetupPlan.providerInput.accountDeletionEnabled),
          pushNotificationsConfigured: Boolean(launchProviderSetupPlan.providerInput.pushNotificationsConfigured),
          appStoreAccountsReady: Boolean(launchProviderSetupPlan.providerInput.appStoreAccountsReady),
          privacyLegalApproved: false,
          privacyLegalOwnerReviewed,
          supportRunbookApproved: false,
          supportRunbookOwnerReviewed,
        },
        syncStatus: syncDashboard.status,
      }),
    [
      attachmentManifest.launchQueue,
      launchProviderSetupPlan.providerInput,
      me.data?.user?.id,
      household,
      privacyLegalOwnerReviewed,
      savedNativeQaSummary,
      supportRunbookOwnerReviewed,
      syncDashboard.status,
    ],
  );
  const launchReadiness = launchReadinessPlan.tiles.map((tile) => ({
    ...tile,
    iconName: launchTileIcon(tile.key, syncIcon),
    tone: launchStatusTone(tile.status, colors),
    onPress:
      tile.key === "native-qa"
        ? () => router.push("/care-twin-qa" as never)
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

  const openProviderSetup = () => {
    setProviderDraft(normalizeLaunchProviderProfile(state.launchProviderProfile));
    setProviderSetupOpen(true);
  };

  const toggleProviderDraft = (key: LaunchProviderFlagKey) => {
    Haptics.selectionAsync();
    setProviderDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveProviderSetup = () => {
    const reviewedAt = new Date(now).toISOString();
    const normalized = normalizeLaunchProviderProfile(providerDraft);
    const allProviderGatesReady = PROVIDER_SETUP_FIELDS.every((field) => normalized[field.key]);
    const providerStatus =
      normalized.providerStatus === "provider-approved" && !allProviderGatesReady
        ? "owner-reviewed"
        : normalized.providerStatus;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({
      ...doc,
      launchProviderProfile: {
        ...normalized,
        ownerReviewedAt: reviewedAt,
        providerStatus,
      },
    }));
    setProviderSetupOpen(false);
  };

  const shareProviderSetupPlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({
      message: buildLaunchProviderSetupShareText(launchProviderSetupPlan, new Date(now).toISOString()),
      title: launchProviderSetupPlan.title,
    }).catch(() =>
      Alert.alert("Provider Launch Setup", buildLaunchProviderSetupShareText(launchProviderSetupPlan, new Date(now).toISOString())),
    );
  };

  const shareLaunchPacket = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({ message: buildReleasePacketShareText(launchReleasePacket), title: launchReleasePacket.title }).catch(() =>
      Alert.alert("Launch Packet", buildReleasePacketShareText(launchReleasePacket)),
    );
  };

  const shareBetaHandoffPacket = () => {
    const generatedAtIso = new Date(now).toISOString();
    const message = buildBetaHandoffPacketShareText(launchReleasePacket, nativeQaCapturePlan, generatedAtIso);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({ message, title: "WoofWatcher 48-Hour Beta Handoff" }).catch(() =>
      Alert.alert("Beta Handoff", message),
    );
  };

  const shareStoreSubmissionPacket = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({ message: buildStoreSubmissionPacketShareText(launchStoreSubmissionPacket), title: launchStoreSubmissionPacket.title }).catch(() =>
      Alert.alert("Store Submission", buildStoreSubmissionPacketShareText(launchStoreSubmissionPacket)),
    );
  };

  const shareNativeQaCapturePlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({
      message: buildMobileLaunchQaCaptureShareText(nativeQaCapturePlan, new Date(now).toISOString()),
      title: "WoofWatcher Native QA Plan",
    }).catch(() =>
      Alert.alert("Native QA Plan", buildMobileLaunchQaCaptureShareText(nativeQaCapturePlan, new Date(now).toISOString())),
    );
  };

  const shareNativeQaFixBrief = () => {
    const message = buildMobileLaunchQaFixBriefShareText(nativeQaCapturePlan, new Date(now).toISOString());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({
      message,
      title: "WoofWatcher Needs Tune Fix Brief",
    }).catch(() => Alert.alert("Needs Tune Fix Brief", message));
  };

  const nativeQaCaptureNeedsTuneTarget = nativeQaCapturePlan.firstNeedsTuneTarget;
  const nativeQaCaptureHasProofPending = nativeQaCapturePlan.nextTargets.some(
    (target) => mobileLaunchQaCaptureTargetStatusLabel(target) === "Pass pending proof",
  );
  const nativeQaCaptureCockpitActionLabel = nativeQaCaptureHasProofPending ? "Finish Proof" : "Open QA Cockpit";

  const H_PAD = 20;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BoardRouteHeader
            kicker="WOOFWATCHER"
            title="More"
            subtitle={`Profile, household, roster, launch gates, and every care tool for ${petName}`}
            centered
            plain
          />

          {/* Profile header card */}
          <View style={[s.profileCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <LinearGradient
              colors={[colors.brandNavy, colors.midnight]}
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
              <Ionicons name="pencil" size={14} color={colors.brandNavy} />
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

          <BoardCard style={s.moreBoardCard}>
            <BoardSectionHeader
              title="CareTwin Roster"
              accessory={
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    openFuturePetSheet();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add future dog to CareTwin roster"
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                >
                  <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Add future dog</Text>
                </Pressable>
              }
            />
            <View style={[s.rosterSummary, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[s.rosterSummaryIcon, { backgroundColor: colors.primary + "16" }]}>
                <Ionicons name="paw-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rosterSummaryTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {careTwinRoster.summary}
                </Text>
                <Text style={[s.rosterSummaryText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {careTwinRoster.nextStep}
                </Text>
              </View>
            </View>
            <View style={s.rosterMetrics}>
              {[
                { label: "Live", value: careTwinRoster.liveCount, tone: colors.sage },
                { label: "Future", value: careTwinRoster.futureCount, tone: colors.copper },
                { label: "Gated", value: careTwinRoster.providerGatedCount, tone: colors.amber },
              ].map((metric) => (
                <View key={metric.label} style={[s.rosterMetric, { backgroundColor: metric.tone + "12", borderColor: metric.tone + "26" }]}>
                  <Text style={[s.rosterMetricValue, { color: metric.tone, fontFamily: DISPLAY_SEMI }]}>{metric.value}</Text>
                  <Text style={[s.rosterMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{metric.label}</Text>
                </View>
              ))}
            </View>
            <View style={[s.rosterList, { borderTopColor: colors.border }]}>
              {careTwinRoster.pets.map((pet, index) => (
                <Pressable
                  key={pet.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (!pet.canSwitch) {
                      Alert.alert(
                        "Multi-dog switching is staged",
                        "This dog is saved as a planned CareTwin slot. Separate logs, routines, records, and reports need provider-backed multi-dog care documents before switching is enabled.",
                      );
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${pet.name}. ${pet.statusLabel}. ${pet.detail}`}
                  style={({ pressed }) => [
                    s.rosterRow,
                    index < careTwinRoster.pets.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    { opacity: pressed ? 0.72 : 1 },
                  ]}
                >
                  <View style={[s.rosterAvatar, { backgroundColor: pet.isActive ? colors.primary + "18" : colors.background, borderColor: pet.isActive ? colors.primary + "33" : colors.border }]}>
                    <Text style={[s.rosterAvatarText, { color: pet.isActive ? colors.primary : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                      {pet.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.rosterNameLine}>
                      <Text style={[s.rosterName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{pet.name}</Text>
                      <View style={[s.rosterBadge, { backgroundColor: pet.isActive ? colors.sage + "18" : colors.amber + "18" }]}>
                        <Text style={[s.rosterBadgeText, { color: pet.isActive ? colors.sage : colors.amber, fontFamily: "Inter_700Bold" }]}>
                          {pet.statusLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={[s.rosterMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {pet.breed} - {pet.weightLabel}
                    </Text>
                    <Text style={[s.rosterDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {pet.detail}
                    </Text>
                  </View>
                  <Ionicons name={pet.canSwitch ? "checkmark-circle-outline" : "lock-closed-outline"} size={19} color={pet.canSwitch ? colors.sage : colors.amber} />
                </Pressable>
              ))}
            </View>
          </BoardCard>

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
              onPress={() => {
                Haptics.selectionAsync();
                if (careIntelligence.nextAction.kind === "retry-sync") {
                  refresh();
                } else if (careIntelligence.nextAction.kind === "handle-routine") {
                  router.push("/calendar");
                } else {
                  router.push("/log");
                }
              }}
              style={({ pressed }) => [
                s.intelligenceAction,
                { backgroundColor: intelligenceTone, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[s.intelligenceActionText, { fontFamily: "Inter_700Bold" }]}>
                {careIntelligence.nextAction.label}
              </Text>
              <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
            </Pressable>
          </BoardCard>

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
              <View style={s.providerSetupRows}>
                {launchProviderSetupPlan.rows.slice(0, 4).map((row) => {
                  const rowTone = row.status === "ready" ? colors.sage : colors.amber;
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
                          {row.status === "ready" ? row.detail : row.nextAction}
                        </Text>
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
                    { backgroundColor: colors.midnight, opacity: pressed ? 0.84 : 1 },
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
                <View style={s.nativeQaCaptureActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share Native QA capture plan"
                    onPress={shareNativeQaCapturePlan}
                    style={({ pressed }) => [
                      s.nativeQaCaptureShare,
                      { backgroundColor: colors.midnight, opacity: pressed ? 0.84 : 1 },
                    ]}
                  >
                    <Ionicons name="share-social-outline" size={15} color="#FFFFFF" />
                    <Text style={[s.nativeQaCaptureShareText, { fontFamily: "Inter_800ExtraBold" }]}>Share QA Plan</Text>
                  </Pressable>
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
                      router.push("/care-twin-qa" as never);
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
                        router.push(target.route as never);
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
                        ? () => router.push("/care-twin-qa" as never)
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
                      {launchReleasePacket.betaShipStatus === "qa-first" ? "Open QA Cockpit" : "Share Beta Packet"}
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
                { backgroundColor: colors.midnight, opacity: pressed ? 0.84 : 1 },
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
                { backgroundColor: colors.copper, opacity: pressed ? 0.84 : 1 },
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
              colors={[colors.midnight, colors.primary]}
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

          {/* Care Team / Household */}
          <BoardCard style={s.moreBoardCard}>
            <BoardSectionHeader
              title="Care Team"
              accessory={
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRenameValue(household?.name ?? "");
                    setRenameOpen(true);
                  }}
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  disabled={!household}
                >
                  <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Rename</Text>
                </Pressable>
              }
            />
            <View style={s.inviteTop}>
              <View style={[s.inviteIcon, { backgroundColor: colors.sage + "1A" }]}>
                <Ionicons name="people" size={20} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.inviteHousehold, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {householdAccess.householdName}
                </Text>
                <Text style={[s.inviteSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {householdAccess.summary}
                </Text>
              </View>
            </View>
            <View style={[s.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View>
                <Text style={[s.codeLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>INVITE CODE</Text>
                <Text style={[s.codeValue, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {householdAccess.inviteCode || "—"}
                </Text>
              </View>
              <Pressable
                onPress={shareInvite}
                disabled={!householdAccess.canShareInvite}
                accessibilityRole="button"
                accessibilityLabel="Share household invite"
                style={({ pressed }) => [s.shareBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name="share-outline" size={16} color="#fff" />
                <Text style={[s.shareBtnText, { fontFamily: "Inter_700Bold" }]}>Invite</Text>
              </Pressable>
            </View>

            <View style={[s.boardDivider, { borderTopColor: colors.border }]} />
            {householdAccess.people.length === 0 ? (
              <View style={s.teamRow}>
                <Text style={[s.teamRole, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Add the first caregiver to build household access.
                </Text>
              </View>
            ) : (
              householdAccess.people.map((person, i) => {
                const cg = memberColor(i);
                const logCount = entries.filter((e) => e.caregiver.trim().toLowerCase() === person.name.toLowerCase()).length;
                return (
                  <View
                    key={person.id}
                    style={[s.teamRow, i < householdAccess.people.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    <View style={[s.teamAvatar, { backgroundColor: cg + "1A" }]}>
                      <Text style={[s.teamInitial, { color: cg, fontFamily: "Inter_700Bold" }]}>
                        {person.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.teamNameLine}>
                        <Text style={[s.teamName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{person.name}</Text>
                        {myName && person.name.toLowerCase() === myName.toLowerCase() && (
                          <View style={[s.youBadge, { backgroundColor: colors.primary + "1A" }]}>
                            <Text style={[s.youBadgeText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>You</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.teamRole, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {person.role} - {person.needsInvite ? "Invite needed" : "Synced"}
                      </Text>
                    </View>
                    <View style={[s.logBadge, { backgroundColor: person.needsInvite ? colors.amber + "18" : colors.background }]}>
                      <Text style={[s.logBadgeText, { color: person.needsInvite ? colors.amber : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                        {person.needsInvite ? "Invite" : `${logCount} logs`}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </BoardCard>

          <BoardCard style={[s.moreBoardCard, { borderColor: accessTone + "44" }]}>
            <BoardSectionHeader
              title="Household Access"
              accessory={
                <Pressable
                  onPress={shareInvite}
                  disabled={!householdAccess.canShareInvite}
                  accessibilityRole="button"
                  accessibilityLabel="Share household invite"
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                >
                  <Text style={[s.sectionLink, { color: accessTone, fontFamily: "Inter_600SemiBold", opacity: householdAccess.canShareInvite ? 1 : 0.55 }]}>Invite</Text>
                </Pressable>
              }
            />
            <View style={s.responsibilityTop}>
              <View style={[s.responsibilityIcon, { backgroundColor: accessTone + "18" }]}>
                <Ionicons name="key-outline" size={21} color={accessTone} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.responsibilityTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {householdAccess.status === "ready" ? "Access is aligned" : "Access needs review"}
                </Text>
                <Text style={[s.responsibilitySummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {householdAccess.summary}
                </Text>
              </View>
            </View>
            <View style={s.responsibilityMetrics}>
              {[
                { label: "Synced", value: householdAccess.syncedMembers },
                { label: "Invites", value: householdAccess.localOnlyCaregivers },
                { label: "Routine-only", value: householdAccess.routineOnlyOwners },
              ].map((metric) => (
                <View key={metric.label} style={[s.responsibilityMetric, { backgroundColor: colors.background }]}>
                  <Text style={[s.responsibilityMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{metric.value}</Text>
                  <Text style={[s.responsibilityMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{metric.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.responsibilityNext, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {householdAccess.nextStep}
            </Text>
            {householdAccess.people.length > 0 && (
              <View style={[s.responsibilityRoster, { borderTopColor: colors.border }]}>
                {householdAccess.people.slice(0, 4).map((person) => (
                  <View key={`access-${person.id}`} style={s.responsibilityMember}>
                    <Text style={[s.responsibilityMemberName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{person.name}</Text>
                    <Text style={[s.responsibilityMemberMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {person.permissions.slice(0, 2).join(", ")}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </BoardCard>

          <BoardCard style={[s.moreBoardCard, { borderColor: colors.primary + "44" }]}>
            <BoardSectionHeader
              title="Access Passes"
              accessory={
                <Pressable
                  onPress={openAccessPassSheet}
                  accessibilityRole="button"
                  accessibilityLabel="Create Access Pass draft"
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                >
                  <Text style={[s.sectionLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>New pass</Text>
                </Pressable>
              }
            />
            <View style={s.responsibilityTop}>
              <View style={[s.responsibilityIcon, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="ticket-outline" size={21} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.responsibilityTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {accessPassPlan.title}
                </Text>
                <Text style={[s.responsibilitySummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {accessPassPlan.summary}
                </Text>
              </View>
            </View>
            <View style={s.responsibilityMetrics}>
              {[
                { label: "Active", value: accessPassPlan.activeCount },
                { label: "Upcoming", value: accessPassPlan.upcomingCount },
                { label: "Drafts", value: accessPassPlan.draftCount },
              ].map((metric) => (
                <View key={metric.label} style={[s.responsibilityMetric, { backgroundColor: colors.background }]}>
                  <Text style={[s.responsibilityMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{metric.value}</Text>
                  <Text style={[s.responsibilityMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{metric.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.responsibilityNext, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {accessPassPlan.nextStep}
            </Text>
            <View style={[s.passBoundary, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.sage} />
              <Text style={[s.passBoundaryText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                {accessPassPlan.permissionBoundary}
              </Text>
            </View>
            {accessPassPlan.passes.length > 0 && (
              <View style={[s.passList, { borderTopColor: colors.border }]}>
                {accessPassPlan.passes.slice(0, 3).map((pass) => (
                  <View key={pass.id} style={s.passRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.passName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{pass.holderName}</Text>
                      <Text style={[s.passMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {pass.role} - {pass.timeLabel}
                      </Text>
                    </View>
                    <View style={[s.passStatus, { backgroundColor: pass.status === "active" ? colors.sage + "1F" : colors.background }]}>
                      <Text style={[s.passStatusText, { color: pass.status === "active" ? colors.sage : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                        {pass.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <Pressable
              onPress={shareAccessPassSummary}
              accessibilityRole="button"
              accessibilityLabel="Share Access Pass draft summary"
              style={({ pressed }) => [
                s.passAction,
                { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 },
              ]}
            >
              <Ionicons name="share-outline" size={16} color="#FFFFFF" />
              <Text style={[s.passActionText, { fontFamily: "Inter_700Bold" }]}>Share Draft Summary</Text>
            </Pressable>
          </BoardCard>

          <BoardCard style={[s.moreBoardCard, { borderColor: responsibilityTone + "44" }]}>
            <BoardSectionHeader
              title="My Care Today"
              accessory={
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push("/calendar");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open assigned care"
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                >
                  <Text style={[s.sectionLink, { color: responsibilityTone, fontFamily: "Inter_600SemiBold" }]}>Open</Text>
                </Pressable>
              }
            />
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/calendar");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open My Care Today in Plans"
              style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
            >
              <View style={s.responsibilityTop}>
                <View style={[s.responsibilityIcon, { backgroundColor: responsibilityTone + "18" }]}>
                  <Ionicons name="person-circle-outline" size={22} color={responsibilityTone} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.responsibilityTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {myCareToday.title}
                  </Text>
                  <Text style={[s.responsibilitySummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {myCareToday.summary}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </View>
              <View style={s.responsibilityMetrics}>
                {[
                  { label: "Assigned", value: myCareToday.assignedCount },
                  { label: "Open", value: myCareToday.openCount },
                  { label: "Overdue", value: myCareToday.overdueCount },
                ].map((metric) => (
                  <View key={metric.label} style={[s.responsibilityMetric, { backgroundColor: colors.background }]}>
                    <Text style={[s.responsibilityMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{metric.value}</Text>
                    <Text style={[s.responsibilityMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{metric.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={[s.responsibilityNext, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {myCareToday.nextStep}
              </Text>
              {myCareToday.items.length > 0 && (
                <View style={[s.careTodayList, { borderTopColor: colors.border }]}>
                  {myCareToday.items.slice(0, 3).map((item) => (
                    <View key={item.id} style={s.careTodayRow}>
                      <Text style={[s.careTodayTime, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{item.time}</Text>
                      <Text style={[s.careTodayLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{item.label}</Text>
                      <Text style={[s.careTodayStatus, { color: item.status === "done" ? colors.sage : item.status === "overdue" ? colors.rose : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                        {item.status}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          </BoardCard>

          {/* Household responsibility */}
          <BoardCard style={[s.moreBoardCard, { borderColor: responsibilityTone + "44" }]}>
            <BoardSectionHeader
              title="Responsibility Center"
              accessory={
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push("/calendar");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open routine board"
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                >
                  <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Open routine board</Text>
                </Pressable>
              }
            />
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/calendar");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open routine board"
              style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
            >
              <View style={s.responsibilityTop}>
                <View style={[s.responsibilityIcon, { backgroundColor: responsibilityTone + "18" }]}>
                  <Ionicons name="people-circle-outline" size={22} color={responsibilityTone} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.responsibilityTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {householdResponsibility.title}
                  </Text>
                  <Text style={[s.responsibilitySummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {householdResponsibility.summary}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </View>
              <View style={s.responsibilityMetrics}>
                {[
                  { label: "Open", value: householdResponsibility.openRoutines },
                  { label: "Overdue", value: householdResponsibility.overdueRoutines },
                  { label: "Unassigned", value: householdResponsibility.unassignedRoutines },
                ].map((metric) => (
                  <View key={metric.label} style={[s.responsibilityMetric, { backgroundColor: colors.background }]}>
                    <Text style={[s.responsibilityMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{metric.value}</Text>
                    <Text style={[s.responsibilityMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{metric.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={[s.responsibilityNext, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {householdResponsibility.nextStep}
              </Text>
              {householdResponsibility.members.length > 0 && (
                <View style={[s.responsibilityRoster, { borderTopColor: colors.border }]}>
                  {householdResponsibility.members.slice(0, 3).map((member) => (
                    <View key={member.name} style={s.responsibilityMember}>
                      <Text style={[s.responsibilityMemberName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{member.name}</Text>
                      <Text style={[s.responsibilityMemberMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {member.done}/{member.assigned} routines - {member.todayLogs} logs
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          </BoardCard>

          {/* Sync health */}
          <BoardCard style={[s.moreBoardCard, { borderColor: syncTone + "44" }]}>
            <BoardSectionHeader
              title="Sync Health"
              accessory={
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
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
          </BoardCard>

          {/* Household actions */}
          <View style={[s.listCard, { backgroundColor: colors.card, shadowColor: colors.primary, marginTop: 12 }]}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setNameValue(myName);
                setNameOpen(true);
              }}
              style={({ pressed }) => [s.linkRow, { borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[s.linkIconWrap, { backgroundColor: colors.copper + "16" }]}>
                <Ionicons name="person-circle" size={20} color={colors.copper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.linkLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Your display name</Text>
                <Text numberOfLines={1} style={[s.linkSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {myName || "Set how you appear on logs"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setJoinCode("");
                setJoinOpen(true);
              }}
              style={({ pressed }) => [s.linkRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[s.linkIconWrap, { backgroundColor: colors.sage + "16" }]}>
                <Ionicons name="enter-outline" size={20} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.linkLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Join another household</Text>
                <Text numberOfLines={1} style={[s.linkSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Enter an invite code from a family member
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

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

          {/* Diet profile */}
          <BoardCard style={s.moreBoardCard}>
            <BoardSectionHeader
              title="Diet Profile"
              accessory={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Pressable onPress={() => { Haptics.selectionAsync(); openDietEdit(); }} hitSlop={MOBILE_INLINE_HIT_SLOP}>
                    <Text style={[s.sectionLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => { Haptics.selectionAsync(); setDietOpen((v) => !v); }} hitSlop={MOBILE_INLINE_HIT_SLOP}>
                    <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>{dietOpen ? "Hide" : "Details"}</Text>
                  </Pressable>
                </View>
              }
            />
            <View style={s.dietHeader}>
              <View style={[s.dietIconWrap, { backgroundColor: colors.copper + "1A" }]}>
                <PulseIcon name="bowl" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.dietTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{dietProfile.primaryFood}</Text>
                <Text style={[s.dietSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{dietProfile.mealSchedule}</Text>
              </View>
            </View>
            {dietOpen && (
              <View style={[s.dietBody, { borderTopColor: colors.border }]}>
                {dietItems.map((d) => (
                  <View key={d.label} style={s.dietRow}>
                    <View style={[s.dietRowIcon, { backgroundColor: PULSE_COLORS[d.icon] + "14" }]}>
                      <PulseIcon name={d.icon} size={14} />
                    </View>
                    <Text style={[s.dietLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{d.label}</Text>
                    <Text style={[s.dietValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{d.value}</Text>
                  </View>
                ))}
                {dietProfile.vetNotes ? (
                  <View style={[s.vetNote, { backgroundColor: colors.amber + "14", borderColor: colors.amber + "33" }]}>
                    <Ionicons name="information-circle" size={16} color={colors.amber} style={{ marginTop: 1 }} />
                    <Text style={[s.vetNoteText, { color: colors.amber, fontFamily: "Inter_500Medium" }]}>{dietProfile.vetNotes}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </BoardCard>

          {/* About / boundary */}
          <View style={[s.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.sage} />
            <Text style={[s.noticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.vetBoundary}</Text>
          </View>

          {/* Sign out */}
          <Pressable
            onPress={confirmSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out of WoofWatcher"
            style={({ pressed }) => [s.signOut, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="log-out-outline" size={19} color={colors.rose} />
            <Text style={[s.signOutText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>Sign out</Text>
          </Pressable>

          <Text style={[s.footer, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            WoofWatcher · Happy dog, simplified care 💚
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Diet profile edit modal */}
      <Modal visible={dietEditOpen} transparent animationType="slide" onRequestClose={() => setDietEditOpen(false)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setDietEditOpen(false)}>
          <Pressable style={[s.profileModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: modalSheetBottomPadding, paddingHorizontal: 22 }}
              bounces={false}
            >
              <View style={s.modalHandle} />
              <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Diet Profile</Text>

              {[
                { label: "PRIMARY FOOD", value: dPrimaryFood, set: setDPrimaryFood, placeholder: "e.g. Royal Canin GI dry kibble" },
                { label: "NORMAL PORTION", value: dNormalPortion, set: setDNormalPortion, placeholder: "e.g. 1¼ cups twice daily" },
                { label: "MEAL SCHEDULE", value: dMealSchedule, set: setDMealSchedule, placeholder: "e.g. 7 AM and 6 PM" },
                { label: "TOPPERS", value: dToppers, set: setDToppers, placeholder: "e.g. Bone broth, low-sodium" },
                { label: "SUPPLEMENTS", value: dSupplements, set: setDSupplements, placeholder: "e.g. Probiotic daily" },
                { label: "BEDTIME SNACK", value: dBedtimeSnack, set: setDBedtimeSnack, placeholder: "e.g. ½ cup kibble at 10 PM" },
                { label: "TREATS ALLOWED", value: dTreatsAllowed, set: setDTreatsAllowed, placeholder: "e.g. Zuke's minis, max 3/day" },
                { label: "AVOID", value: dAvoid, set: setDAvoid, placeholder: "e.g. Grains, chicken, rawhide" },
                { label: "SENSITIVITIES", value: dSensitivities, set: setDSensitivities, placeholder: "e.g. Chicken allergy confirmed" },
                { label: "APPETITE QUIRKS", value: dAppetiteQuirks, set: setDAppetiteQuirks, placeholder: "e.g. Eats slowly, dislikes change" },
                { label: "VET NOTES", value: dVetNotes, set: setDVetNotes, placeholder: "e.g. Low-fat diet per Dr. Kim" },
              ].map((f) => (
                <View key={f.label}>
                  <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{f.label}</Text>
                  <TextInput
                    value={f.value}
                    onChangeText={f.set}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
              ))}

              <Pressable
                onPress={saveDiet}
                style={({ pressed }) => [s.profSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[s.profSaveBtnText, { fontFamily: "Inter_700Bold" }]}>Save diet profile</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Join household modal */}
      <PromptModal
        visible={joinOpen}
        colors={colors}
        icon="enter-outline"
        title="Join a household"
        subtitle="Enter the invite code shared by a family member."
        placeholder="e.g. PHX-7QK2"
        value={joinCode}
        onChangeText={setJoinCode}
        autoCapitalize="characters"
        confirmLabel="Join"
        loading={joinHousehold.isPending}
        onCancel={() => setJoinOpen(false)}
        onConfirm={submitJoin}
      />

      {/* Rename household modal */}
      <PromptModal
        visible={renameOpen}
        colors={colors}
        icon="home-outline"
        title="Rename household"
        subtitle="Give your care team a name everyone recognizes."
        placeholder="The Phoenix Pack"
        value={renameValue}
        onChangeText={setRenameValue}
        confirmLabel="Save"
        loading={updateHousehold.isPending}
        onCancel={() => setRenameOpen(false)}
        onConfirm={submitRename}
      />

      {/* Display name modal */}
      <PromptModal
        visible={nameOpen}
        colors={colors}
        icon="person-circle-outline"
        title="Your display name"
        subtitle="This is how you'll appear on every care log."
        placeholder="Alex"
        value={nameValue}
        onChangeText={setNameValue}
        confirmLabel="Save"
        loading={updateMe.isPending}
        onCancel={() => setNameOpen(false)}
        onConfirm={submitName}
      />

      <Modal visible={petRosterOpen} transparent animationType="slide" onRequestClose={() => setPetRosterOpen(false)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setPetRosterOpen(false)}>
          <Pressable style={[s.profileModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={{ paddingBottom: modalSheetBottomPadding, paddingHorizontal: 22 }}>
              <View style={s.modalHandle} />
              <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Add future dog</Text>
              <Text style={[s.sheetSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                This stages a CareTwin slot only. Separate logs, routines, and records stay locked until multi-dog storage is approved.
              </Text>

              <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NAME</Text>
              <TextInput
                value={petRosterName}
                onChangeText={setPetRosterName}
                placeholder="e.g. London"
                placeholderTextColor={colors.mutedForeground}
                style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              />

              <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>BREED</Text>
              <TextInput
                value={petRosterBreed}
                onChangeText={setPetRosterBreed}
                placeholder="e.g. Golden Retriever"
                placeholderTextColor={colors.mutedForeground}
                style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              />

              <Pressable
                onPress={saveFuturePet}
                accessibilityRole="button"
                accessibilityLabel="Save future dog to CareTwin roster"
                style={({ pressed }) => [s.profSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[s.profSaveBtnText, { fontFamily: "Inter_700Bold" }]}>Save planned slot</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={accessPassOpen} transparent animationType="slide" onRequestClose={() => setAccessPassOpen(false)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setAccessPassOpen(false)}>
          <Pressable style={[s.profileModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={{ paddingBottom: modalSheetBottomPadding, paddingHorizontal: 22 }}>
              <View style={s.modalHandle} />
              <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Create Access Pass</Text>
              <Text style={[s.sheetSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Stage temporary helper permissions locally. Remote access stays locked until provider-backed sharing is approved.
              </Text>

              <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>HELPER NAME</Text>
              <TextInput
                value={accessPassName}
                onChangeText={setAccessPassName}
                placeholder="e.g. Maya"
                placeholderTextColor={colors.mutedForeground}
                style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              />

              <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>ROLE</Text>
              <View style={s.passKindGrid}>
                {[
                  { key: "sitter" as const, label: "Sitter" },
                  { key: "trainer" as const, label: "Trainer" },
                  { key: "vet" as const, label: "Vet viewer" },
                  { key: "emergency" as const, label: "Emergency" },
                ].map((kind) => {
                  const selected = accessPassKind === kind.key;
                  return (
                    <Pressable
                      key={kind.key}
                      onPress={() => setAccessPassKind(kind.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Set Access Pass role to ${kind.label}`}
                      style={[
                        s.passKind,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + "18" : colors.background,
                        },
                      ]}
                    >
                      <Text style={[s.passKindText, { color: selected ? colors.primary : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {kind.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={saveAccessPassDraft}
                accessibilityRole="button"
                accessibilityLabel="Save Access Pass draft"
                style={({ pressed }) => [s.profSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[s.profSaveBtnText, { fontFamily: "Inter_700Bold" }]}>Save Local Draft</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={providerSetupOpen} transparent animationType="slide" onRequestClose={() => setProviderSetupOpen(false)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setProviderSetupOpen(false)}>
          <Pressable style={[s.profileModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: modalSheetBottomPadding, paddingHorizontal: 22 }}
              bounces={false}
            >
              <View style={s.modalHandle} />
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
                      accessibilityState={{ checked }}
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
                <Text style={[s.profSaveBtnText, { fontFamily: "Inter_700Bold" }]}>Save provider setup</Text>
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
            <View style={s.modalHandle} />
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
                  onChangeText={setPWeight}
                  placeholder="0.0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
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
              <Text style={[s.profSaveBtnText, { fontFamily: "Inter_700Bold" }]}>Save profile</Text>
            </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PromptModal({
  visible,
  colors,
  icon,
  title,
  subtitle,
  placeholder,
  value,
  onChangeText,
  confirmLabel,
  loading,
  autoCapitalize = "sentences",
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  colors: ReturnType<typeof useColors>;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  confirmLabel: string;
  loading?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.modalBackdrop} onPress={onCancel}>
        <Pressable style={[s.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[s.modalIcon, { backgroundColor: colors.primary + "1A" }]}>
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
          <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{title}</Text>
          <Text style={[s.modalSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>
          <TextInput
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            style={[s.modalInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
            returnKeyType="done"
            onSubmitEditing={onConfirm}
          />
          <View style={s.modalActions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [s.modalCancel, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[s.modalCancelText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => [s.modalConfirm, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.7 : 1 }]}
            >
              <Text style={[s.modalConfirmText, { fontFamily: "Inter_700Bold" }]}>{loading ? "…" : confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: { marginBottom: 18 },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 3 },

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
  boardDivider: { borderTopWidth: 1, marginTop: 14 },

  rosterSummary: {
    minHeight: 78,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  rosterSummaryIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rosterSummaryTitle: { fontSize: 15.5, lineHeight: 20 },
  rosterSummaryText: { fontSize: 12.2, lineHeight: 17, marginTop: 3 },
  rosterMetrics: { flexDirection: "row", gap: 8, marginTop: 12 },
  rosterMetric: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  rosterMetricValue: { fontSize: 18, lineHeight: 21 },
  rosterMetricLabel: { fontSize: 10.5, marginTop: 2, textTransform: "uppercase" },
  rosterList: { borderTopWidth: 1, marginTop: 12 },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13 },
  rosterAvatar: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rosterAvatarText: { fontSize: 17 },
  rosterNameLine: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  rosterName: { fontSize: 14.5, flexShrink: 1 },
  rosterBadge: { minHeight: 22, borderRadius: 7, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  rosterBadgeText: { fontSize: 9.5, textTransform: "uppercase" },
  rosterMeta: { fontSize: 11.8, lineHeight: 16, marginTop: 3 },
  rosterDetail: { fontSize: 11.4, lineHeight: 16, marginTop: 3 },

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

  listCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  teamAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  teamInitial: { fontSize: 17 },
  teamNameLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  teamName: { fontSize: 15.5 },
  teamRole: { fontSize: 13, marginTop: 2 },
  youBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  youBadgeText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 },
  logBadge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 11 },
  logBadgeText: { fontSize: 12 },

  responsibilityTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  responsibilityIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  responsibilityTitle: { fontSize: 16, letterSpacing: 0 },
  responsibilitySummary: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  responsibilityMetrics: { flexDirection: "row", gap: 8, marginTop: 14 },
  responsibilityMetric: { flex: 1, minHeight: 64, borderRadius: 15, alignItems: "center", justifyContent: "center", padding: 8 },
  responsibilityMetricValue: { fontSize: 16, textAlign: "center" },
  responsibilityMetricLabel: { fontSize: 10.5, textAlign: "center", marginTop: 3 },
  responsibilityNext: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  responsibilityRoster: { borderTopWidth: 1, marginTop: 14, paddingTop: 12, gap: 8 },
  responsibilityMember: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  responsibilityMemberName: { fontSize: 12.5, flex: 1 },
  responsibilityMemberMeta: { fontSize: 12, textAlign: "right" },

  passBoundary: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, padding: 11, marginTop: 12 },
  passBoundaryText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  passList: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 8 },
  passRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  passName: { fontSize: 13.5 },
  passMeta: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  passStatus: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  passStatusText: { fontSize: 10.5, textTransform: "capitalize" },
  passAction: { minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 13 },
  passActionText: { color: "#FFFFFF", fontSize: 13.5 },
  passKindGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 4 },
  passKind: { flexGrow: 1, flexBasis: "47%", minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  passKindText: { fontSize: 12.5 },
  careTodayList: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 8 },
  careTodayRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  careTodayTime: { width: 68, fontSize: 11.5 },
  careTodayLabel: { flex: 1, fontSize: 12.5 },
  careTodayStatus: { width: 66, textAlign: "right", fontSize: 11.5, textTransform: "capitalize" },

  syncTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  syncIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  syncTitle: { fontSize: 16, letterSpacing: 0 },
  syncMessage: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  syncMetrics: { flexDirection: "row", gap: 8, marginTop: 14 },
  syncMetric: { flex: 1, minHeight: 66, borderRadius: 15, paddingHorizontal: 9, paddingVertical: 10, justifyContent: "center" },
  syncMetricValue: { fontSize: 14, textAlign: "center" },
  syncMetricLabel: { fontSize: 10.5, textAlign: "center", marginTop: 3 },
  syncNextStep: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },

  inviteTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  inviteIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  inviteHousehold: { fontSize: 16 },
  inviteSub: { fontSize: 13, marginTop: 2 },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  codeLabel: { fontSize: 10.5, letterSpacing: 0.6 },
  codeValue: { fontSize: 21, letterSpacing: 1, marginTop: 3 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 13 },
  shareBtnText: { color: "#fff", fontSize: 14 },

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
  modalSub: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  modalInput: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, marginTop: 16 },
  modalActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, minHeight: MIN_MOBILE_TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 15 },
  modalConfirm: { flex: 2, minHeight: MIN_MOBILE_TOUCH_TARGET, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modalConfirmText: { color: "#fff", fontSize: 15 },

  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15 },
  linkIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  linkLabel: { fontSize: 15.5 },
  linkSub: { fontSize: 13, marginTop: 2 },

  dietHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  dietIconWrap: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dietTitle: { fontSize: 15.5 },
  dietSub: { fontSize: 13, marginTop: 2 },
  dietBody: { borderTopWidth: 1, marginTop: 14, paddingTop: 6 },
  dietRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  dietRowIcon: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  dietLabel: { fontSize: 13, width: 92 },
  dietValue: { fontSize: 13, flex: 1, textAlign: "right" },
  vetNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12 },
  vetNoteText: { flex: 1, fontSize: 13.5, lineHeight: 19 },

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
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", marginBottom: 16 },
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
  profSaveBtnText: { color: "#fff", fontSize: 15.5 },
});
