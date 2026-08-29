import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";
import { useCare, type LaunchSupportProfile } from "@/context/CareContext";
import { useAppFileSystem } from "@/context/AppFileSystemContext";
import { useLocalDataReset } from "@/context/LocalDataResetContext";
import { useColors } from "@/hooks/useColors";
import {
  BoardCard,
  BoardPill,
  BoardSectionHeader,
  ModalBackdropPressable,
  ModalSheetPressable,
} from "@/components/board/BoardPrimitives";
import {
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import {
  buildAccountDeletionRequest,
  buildPrivacyExportBundle,
  deriveAccountSafetyPlan,
  serializePrivacyExportBundle,
  type AccountSafetySection,
  type AccountSafetyStatus,
} from "@/lib/privacySafety";
import { isOwnerOpsBuild } from "@/lib/buildChannel";
import { isClerkEnabledForBuild, useWoofAuth } from "@/lib/auth";
import { deriveLaunchProviderSetup } from "@/lib/launchProviderSetup";
import { shareTextPayload } from "@/lib/shareText";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  CARE_READ_ONLY_MESSAGE,
  runAcceptedCareMutation,
} from "@/lib/careWriteProtection";
import {
  buildSupportRunbookShareText,
  deriveSupportRunbookPlan,
  type SupportRunbookSection,
  type SupportRunbookStatus,
} from "@/lib/supportRunbook";
import type { AttachmentReviewRow } from "@/lib/attachmentManifest";
import {
  PrivacyExportDismissedError,
  preparePrivacyCareExportWithDeviceInventory,
  runPrivacyCareDataExport,
  runPrivacyLocalDataReset,
} from "@/lib/privacyLocalDataActions";
import { derivePrivacyConfirmationLayout } from "@/lib/privacyConfirmationLayout";
import { getPrivacyDataTruthCopy } from "@/lib/privacyDataTruth";
import {
  activateDeliberateConfirmation,
  createDeliberateConfirmationLatch,
  DELIBERATE_CONFIRMATION_TRANSITION_MS,
  getDeliberateConfirmationDelay,
  resetDeliberateConfirmation,
  transitionDeliberateConfirmation,
  trySettleDeliberateConfirmation,
} from "@/lib/deliberateConfirmation";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type EraseStage = "confirm" | "confirm-final";
type EraseStepToken = Readonly<{ stage: EraseStage }>;

type SafetySectionLike = AccountSafetySection | SupportRunbookSection;
type SafetyStatusLike = AccountSafetyStatus | SupportRunbookStatus;

function statusIcon(status: SafetyStatusLike): keyof typeof Ionicons.glyphMap {
  if (status === "ready") return "checkmark-circle";
  if (status === "limited") return "information-circle";
  if (status === "manual_required") return "clipboard";
  return "lock-closed";
}

function statusColor(status: SafetyStatusLike, colors: ReturnType<typeof useColors>): string {
  if (status === "ready") return colors.sage;
  if (status === "limited") return colors.amber;
  if (status === "manual_required") return colors.copper;
  return colors.rose;
}

function attachmentIcon(kind: AttachmentReviewRow["kind"]): keyof typeof Ionicons.glyphMap {
  if (kind === "care-log-proof") return "camera-outline";
  if (kind === "record-document") return "document-text-outline";
  if (kind === "adventure-memory") return "map-outline";
  if (kind === "report-artifact") return "receipt-outline";
  return "phone-portrait-outline";
}

function attachmentStatusColor(status: AttachmentReviewRow["status"], colors: ReturnType<typeof useColors>): string {
  if (status === "synced") return colors.sage;
  if (status === "upload-ready") return colors.amber;
  if (status === "provider-required") return colors.copper;
  return colors.mutedForeground;
}

export interface PrivacyDataScreenProps {
  onBack: () => void;
  onOpenLegal: (document: "privacy" | "terms") => void;
}

export default function PrivacyDataScreen({ onBack, onOpenLegal }: PrivacyDataScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { height: viewportHeight, fontScale } = useWindowDimensions();
  const router = useRouter();
  const { state, careMutationsBlocked, updateCareDoc } = useCare();
  const fileSystem = useAppFileSystem();
  const { operationState, runExport, runReset } = useLocalDataReset();
  // Launch-ops cards (support runbook, launch gates) are owner tooling and
  // stay out of store production builds.
  const ownerOps = isOwnerOpsBuild();
  const privacyTruthCopy = useMemo(
    () => getPrivacyDataTruthCopy(ownerOps),
    [ownerOps],
  );
  const privacyScreenMountedRef = useRef(true);
  const privacyExportInFlightRef = useRef(false);
  const [privacyExportBusy, setPrivacyExportBusy] = useState(false);
  const [launchEditorOpen, setLaunchEditorOpen] = useState(false);
  const [launchDraft, setLaunchDraft] = useState<LaunchSupportProfile>(state.launchSupportProfile);
  const [eraseStep, setEraseStep] = useState<EraseStepToken | null>(null);
  const [eraseActivationEpoch, setEraseActivationEpoch] = useState(0);
  const eraseConfirmationLatchRef = useRef(
    createDeliberateConfirmationLatch<EraseStepToken>(
      DELIBERATE_CONFIRMATION_TRANSITION_MS,
    ),
  );
  const { isSignedIn } = useWoofAuth();
  const me = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: isClerkEnabledForBuild && Boolean(isSignedIn),
    },
  });
  const context = useMemo(
    () => ({
      userId: me.data?.user?.id ?? null,
      householdId: me.data?.household?.id ?? null,
      householdName: me.data?.household?.name ?? null,
    }),
    [me.data?.household?.id, me.data?.household?.name, me.data?.user?.id],
  );

  const launchProviderSetupPlan = useMemo(
    () => deriveLaunchProviderSetup(state.launchProviderProfile),
    [state.launchProviderProfile],
  );

  const plan = useMemo(
    () =>
      deriveAccountSafetyPlan({
        state,
        aiProviderConfigured: Boolean(launchProviderSetupPlan.providerInput.aiProviderConfigured),
        storageProviderConfigured: Boolean(state.launchProviderProfile.storageProviderConfigured),
        storageProviderEvidence: state.launchProviderProfile.storageProviderEvidence,
        accountDeletionEnabled: Boolean(launchProviderSetupPlan.providerInput.accountDeletionEnabled),
        paymentsEnabled: Boolean(launchProviderSetupPlan.providerInput.paymentsEnabled),
      }),
    [launchProviderSetupPlan.providerInput, state],
  );

  const bundle = useMemo(() => buildPrivacyExportBundle(state, context), [state, context]);
  const supportPlan = useMemo(
    () => deriveSupportRunbookPlan(state.launchSupportProfile),
    [state.launchSupportProfile],
  );
  useEffect(() => {
    if (!launchEditorOpen) setLaunchDraft(state.launchSupportProfile);
  }, [launchEditorOpen, state.launchSupportProfile]);
  useEffect(() => {
    privacyScreenMountedRef.current = true;
    return () => {
      privacyScreenMountedRef.current = false;
      resetDeliberateConfirmation(eraseConfirmationLatchRef.current);
    };
  }, []);

  const sections = [
    plan.export,
    plan.accountDeletion,
    plan.aiDisclosure,
    plan.documentStorage,
    plan.payments,
  ];
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
  const privacyConfirmationLayout = derivePrivacyConfirmationLayout({
    viewportHeight,
    topInset: insets.top,
    fontScale,
  });

  const launchProfileProviderApproved =
    state.launchSupportProfile.providerStatus === "provider-approved" && supportPlan.launchReady;
  const launchProfileStatus =
    launchProfileProviderApproved
      ? "Provider-approved packet"
      : state.launchSupportProfile.providerStatus === "owner-reviewed" ||
          state.launchSupportProfile.providerStatus === "provider-approved"
      ? "Owner-reviewed local packet"
      : "Local draft";

  const updateLaunchDraft = <K extends keyof LaunchSupportProfile>(
    key: K,
    value: LaunchSupportProfile[K],
  ) => {
    setLaunchDraft((current) => ({ ...current, [key]: value }));
  };

  const openLaunchProfileEditor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLaunchDraft(state.launchSupportProfile);
    setLaunchEditorOpen(true);
  };

  const saveLaunchSupportProfile = (providerStatus: LaunchSupportProfile["providerStatus"]) => {
    if (careMutationsBlocked) {
      notifyDialog("Update WoofWatcher", CARE_READ_ONLY_MESSAGE);
      return;
    }
    const requestedSupportPlan = deriveSupportRunbookPlan(launchDraft);
    const savedProviderStatus =
      providerStatus === "provider-approved" && !requestedSupportPlan.launchReady
        ? "owner-reviewed"
        : providerStatus;
    const updated = updateCareDoc((doc) => ({
      ...doc,
      launchSupportProfile: {
        ...launchDraft,
        supportEmail: launchDraft.supportEmail.trim(),
        privacyPolicyUrl: launchDraft.privacyPolicyUrl.trim(),
        termsUrl: launchDraft.termsUrl.trim(),
        providerStatus: savedProviderStatus,
        ownerReviewedAt:
          savedProviderStatus === "owner-reviewed" || savedProviderStatus === "provider-approved"
            ? new Date().toISOString()
            : doc.launchSupportProfile.ownerReviewedAt,
      },
    }));
    const accepted = runAcceptedCareMutation(updated, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLaunchEditorOpen(false);
    });
    if (!accepted) notifyDialog("Update WoofWatcher", CARE_READ_ONLY_MESSAGE);
  };

  const localDataOperationBusy =
    operationState.status === "exporting" ||
    operationState.status === "deleting";

  const shareExport = () => {
    if (localDataOperationBusy || privacyExportInFlightRef.current) return;
    privacyExportInFlightRef.current = true;
    setPrivacyExportBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const operation = runPrivacyCareDataExport({
      runExport,
      capture: () => {
        const inventoryIntent = fileSystem.captureIntent();
        if (!inventoryIntent) {
          throw new Error("A local data reset is in progress.");
        }
        const fresh = buildPrivacyExportBundle(state, context, Date.now());
        return {
          title: `WoofWatcher care export - ${fresh.dogName}`,
          serializedBundle: serializePrivacyExportBundle(fresh),
          inventoryIntent,
        };
      },
      prepare: (captured) =>
        preparePrivacyCareExportWithDeviceInventory(
          captured,
          fileSystem.listOwnedFiles,
        ),
      share: (payload) =>
        shareTextPayload(payload, { notifyOnFailure: false }),
    });
    void operation
      .catch((error: unknown) => {
        if (
          error instanceof PrivacyExportDismissedError ||
          !privacyScreenMountedRef.current
        ) return;
        notifyDialog(
          "Export not shared",
          "WoofWatcher could not share the care export. Your local data was not changed. Try again.",
        );
      })
      .finally(() => {
        privacyExportInFlightRef.current = false;
        if (privacyScreenMountedRef.current) setPrivacyExportBusy(false);
      });
  };

  const shareDeletionRequest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const request = buildAccountDeletionRequest(state, context, Date.now());
    void shareTextPayload({
      title: request.subject,
      message: `${request.subject}\n\n${request.body}`,
    });
  };

  const shareSupportRunbook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = buildSupportRunbookShareText(supportPlan, {
      appName: "WoofWatcher",
      generatedAtIso: new Date().toISOString(),
    });
    void shareTextPayload({
      title: "WoofWatcher Support Runbook",
      message,
    });
  };

  const openSupportLegalProofMission = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/care-twin-qa?qaSurface=support-legal-readiness-proof" as never);
  };

  const openLegalDocuments = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenLegal("privacy");
  };

  // Themed two-step delete-all confirmation: the native confirm()/alert()
  // fallback read as browser chrome on web, so the flow now runs in the
  // app's own board-style sheet on every platform. Semantics are unchanged:
  // two deliberate confirmations (with a transition latch between them), then
  // the root reset shield owns progress and the terminal complete/partial-
  // failure verdict after this screen unmounts.
  const eraseSteps = privacyTruthCopy.eraseSteps;

  const confirmEraseAllLocalData = () => {
    if (localDataOperationBusy) return;
    const firstStep: EraseStepToken = { stage: "confirm" };
    if (
      !activateDeliberateConfirmation(
        eraseConfirmationLatchRef.current,
        firstStep,
        Date.now(),
      )
    ) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEraseStep(firstStep);
  };

  const cancelEraseFlow = () => {
    if (localDataOperationBusy) return;
    resetDeliberateConfirmation(eraseConfirmationLatchRef.current);
    setEraseStep(null);
  };

  const advanceEraseFlow = () => {
    if (!eraseStep || localDataOperationBusy) return;
    const settledAt = Date.now();
    if (
      !trySettleDeliberateConfirmation(
        eraseConfirmationLatchRef.current,
        eraseStep,
        settledAt,
      )
    ) {
      return;
    }

    if (eraseStep.stage === "confirm") {
      const finalStep: EraseStepToken = { stage: "confirm-final" };
      transitionDeliberateConfirmation(
        eraseConfirmationLatchRef.current,
        finalStep,
        settledAt,
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setEraseStep(finalStep);
      setEraseActivationEpoch((epoch) => epoch + 1);
      return;
    }
    if (eraseStep.stage === "confirm-final") {
      resetDeliberateConfirmation(eraseConfirmationLatchRef.current);
      setEraseStep(null);
      void runPrivacyLocalDataReset(runReset);
      return;
    }
  };

  const eraseTransitionDelay = eraseStep
    ? getDeliberateConfirmationDelay(
        eraseConfirmationLatchRef.current,
        eraseStep,
        Date.now(),
      )
    : 0;
  const eraseTransitionBlocked =
    eraseStep !== null &&
    (!Number.isFinite(eraseTransitionDelay) || eraseTransitionDelay > 0);

  useEffect(() => {
    if (
      !eraseStep ||
      !Number.isFinite(eraseTransitionDelay) ||
      eraseTransitionDelay <= 0
    ) {
      return;
    }
    const timer = setTimeout(
      () => setEraseActivationEpoch((epoch) => epoch + 1),
      Math.max(1, eraseTransitionDelay),
    );
    return () => clearTimeout(timer);
  }, [eraseActivationEpoch, eraseStep, eraseTransitionDelay]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        // 16 matches the tab screens' shared side gutter (Home/Log/Records
        // all use 16), so modal routes stop sitting 4px narrower.
        contentContainerStyle={{ paddingTop: topPadding, paddingHorizontal: 16, paddingBottom: bottomPadding }}
      >
        <LinearGradient
          colors={colors.isDark
            ? [colors.brandNavy, colors.shellNavy]
            : [colors.midnight, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTop}>
            <View style={s.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" />
            </View>
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Close Privacy and Safety"
              style={s.heroCloseButton}
            >
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.82)" />
            </Pressable>
          </View>
          <Text style={[s.heroTitle, { fontFamily: DISPLAY }]}>Privacy & Safety</Text>
          <Text style={[s.heroSub, { fontFamily: "Inter_500Medium" }]}>
            {privacyTruthCopy.hero}
          </Text>
        </LinearGradient>

        <BoardCard enter={0} style={s.privacyBoard}>
          <BoardSectionHeader
            title="Export summary"
            accessory={<BoardPill label="Local bundle" tone={colors.sage} />}
          />
          <Text style={[s.queueSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {privacyTruthCopy.exportLimitation}
          </Text>
          <View style={s.statsGrid}>
            <StatCard label="Logs" value={String(bundle.counts.entries)} colors={colors} />
            <StatCard label="Records" value={String(bundle.counts.records)} colors={colors} />
            <StatCard label="Reports" value={String(bundle.counts.reportArtifacts)} colors={colors} />
            <StatCard label="File refs" value={String(bundle.counts.localAttachments)} colors={colors} />
          </View>
        </BoardCard>

        {ownerOps ? (
          <BoardCard enter={1} style={s.privacyBoard}>
            <BoardSectionHeader
              title="Attachment queue"
              accessory={<BoardPill label={`${bundle.storage.attachmentQueue.total} files`} tone={colors.copper} />}
            />
            <Text style={[s.queueSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {bundle.storage.attachmentSummary}
            </Text>
            <View style={s.queueStack}>
              {bundle.storage.attachmentReviewRows.length > 0 ? (
                bundle.storage.attachmentReviewRows.map((row) => (
                  <AttachmentQueueRow key={row.kind} row={row} colors={colors} />
                ))
              ) : (
                <Text style={[s.emptyQueue, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  No proof photos, record uploads, memories, reports, or QA screenshots are waiting for storage.
                </Text>
              )}
            </View>
          </BoardCard>
        ) : null}

        <View style={s.actionRow}>
          <Pressable
            onPress={shareExport}
            disabled={localDataOperationBusy || privacyExportBusy}
            accessibilityRole="button"
            accessibilityLabel="Export WoofWatcher care data"
            accessibilityState={{
              disabled: localDataOperationBusy || privacyExportBusy,
            }}
            style={({ pressed }) => [
              s.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: localDataOperationBusy || privacyExportBusy ? 0.55 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="download-outline" size={18} color={colors.primaryForeground} />
            <Text style={[s.primaryText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Export care data</Text>
          </Pressable>
          {/* The provider-account deletion request is owner tooling. It stays
              distinct from the device reset because neither operation proves
              that the other data location has been deleted. */}
          {ownerOps ? (
            <Pressable
              onPress={shareDeletionRequest}
              accessibilityRole="button"
              accessibilityLabel="Prepare account deletion request"
              style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}
            >
              <Ionicons name="trash-outline" size={17} color={colors.rose} />
              <Text style={[s.secondaryText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>Deletion request</Text>
            </Pressable>
          ) : null}
        </View>

        <BoardCard enter={2} style={s.privacyBoard}>
          <BoardSectionHeader
            title="Your data, your rules"
            accessory={<BoardPill label="On this device" tone={colors.sage} />}
          />
          <Text style={[s.queueSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {privacyTruthCopy.rules}
          </Text>
          <Pressable
            onPress={openLegalDocuments}
            accessibilityRole="button"
            accessibilityLabel="Open privacy policy and terms of service"
            style={({ pressed }) => [
              s.legalRow,
              { borderColor: colors.border, backgroundColor: pressed ? colors.secondary : colors.background },
            ]}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.forest} />
            <View style={{ flex: 1 }}>
              <Text style={[s.legalRowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Privacy policy & terms
              </Text>
              <Text style={[s.legalRowSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Plain-language rules for your household's data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={confirmEraseAllLocalData}
            disabled={localDataOperationBusy}
            accessibilityRole="button"
            accessibilityLabel="Delete all WoofWatcher data on this device"
            accessibilityState={{ disabled: localDataOperationBusy }}
            style={({ pressed }) => [
              s.legalRow,
              {
                borderColor: colors.rose + "55",
                backgroundColor: pressed ? colors.rose + "14" : colors.background,
                opacity: localDataOperationBusy ? 0.55 : 1,
              },
            ]}
          >
            <Ionicons name="trash-bin-outline" size={18} color={colors.rose} />
            <View style={{ flex: 1 }}>
              <Text style={[s.legalRowTitle, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>
                Delete all data on this device
              </Text>
              <Text style={[s.legalRowSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Permanent. Resets WoofWatcher to a fresh household.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
          </Pressable>
        </BoardCard>

        {ownerOps ? (
          <>
        <BoardCard enter={3} style={s.privacyBoard}>
          <BoardSectionHeader
            title="Support runbook"
            accessory={<BoardPill label="Launch gate" tone={colors.amber} />}
          />
          <Text style={[s.supportVerdict, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
            {supportPlan.verdictLabel}
          </Text>
          <Text style={[s.queueSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {supportPlan.summary}
          </Text>
          <View style={[s.launchProfilePanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.launchProfileEyebrow, { color: colors.copper, fontFamily: "Inter_800ExtraBold" }]}>
                Launch support profile
              </Text>
              <Text style={[s.launchProfileStatus, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                {launchProfileStatus}
              </Text>
              <Text style={[s.launchProfileDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {supportPlan.supportEmail ?? "No support inbox yet"} / {supportPlan.privacyPolicyUrl ? "Policy links staged" : "Policy links needed"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit WoofWatcher launch support profile"
              onPress={openLaunchProfileEditor}
              style={({ pressed }) => [
                s.profileEditBtn,
                { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
              ]}
            >
              <Ionicons name="create-outline" size={15} color={colors.foreground} />
              <Text style={[s.profileEditText, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>Edit</Text>
            </Pressable>
          </View>
          <View style={s.sectionStack}>
            {supportPlan.sections.map((section) => (
              <SafetyRow key={section.title} section={section} colors={colors} />
            ))}
          </View>
          <View style={[s.supportBlockers, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "33" }]}>
            {supportPlan.launchBlockers.slice(0, 4).map((blocker) => (
              <Text key={blocker} style={[s.supportBlockerText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                - {blocker}
              </Text>
            ))}
          </View>
          <View style={s.supportActionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open support legal readiness proof mission"
              onPress={openSupportLegalProofMission}
              style={({ pressed }) => [
                s.supportProofBtn,
                { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.76 : 1 },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.foreground} />
              <Text style={[s.supportProofText, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                Proof mission
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share WoofWatcher support runbook"
              onPress={shareSupportRunbook}
              style={({ pressed }) => [
                s.supportShareBtn,
                { backgroundColor: colors.midnight, opacity: pressed ? 0.84 : 1 },
              ]}
            >
              <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
              <Text style={[s.supportShareText, { fontFamily: "Inter_800ExtraBold" }]}>Share support runbook</Text>
            </Pressable>
          </View>
        </BoardCard>

        <BoardCard enter={4} style={s.privacyBoard}>
          <BoardSectionHeader
            title="Launch safety gates"
            accessory={<BoardPill label={`${sections.length} gates`} tone={colors.primary} />}
          />
          <View style={s.sectionStack}>
            {sections.map((section) => (
              <SafetyRow key={section.title} section={section} colors={colors} />
            ))}
          </View>
        </BoardCard>

        <BoardCard enter={5} style={[s.noticeBoard, { backgroundColor: colors.amber + "14", borderColor: colors.amber + "45" }]}>
          <View style={s.noticeContent}>
            <Ionicons name="alert-circle-outline" size={17} color={colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={[s.noticeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Before public launch
              </Text>
              {plan.launchBlockers.map((blocker) => (
                <Text key={blocker} style={[s.noticeLine, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  - {blocker}
                </Text>
              ))}
            </View>
          </View>
        </BoardCard>
          </>
        ) : null}
      </ScrollView>
      <Modal
        visible={eraseStep !== null}
        transparent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={cancelEraseFlow}
      >
        <ModalBackdropPressable
          style={s.modalBackdrop}
          onPress={cancelEraseFlow}
        >
          <ModalSheetPressable
            visible={eraseStep !== null}
            onRequestClose={cancelEraseFlow}
            closeAccessibilityLabel="Cancel local data reset"
            style={[
              s.confirmSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(modalSheetBottomPadding, 18),
                maxHeight: privacyConfirmationLayout.maxHeight,
              },
            ]}
          >
            <View style={s.modalHandle} />
            {eraseStep ? (
              <>
                <ScrollView
                  style={s.confirmScroll}
                  contentContainerStyle={s.confirmScrollContent}
                  showsVerticalScrollIndicator
                >
                  <View style={s.confirmHeader}>
                    <View
                      style={[
                        s.confirmIcon,
                        {
                          backgroundColor:
                            colors.rose + "14",
                        },
                      ]}
                    >
                      <Ionicons
                        name="trash-bin-outline"
                        size={20}
                        color={colors.rose}
                      />
                    </View>
                    <Text style={[s.confirmTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
                      {eraseSteps[eraseStep.stage].title}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.confirmMessage,
                      { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                    ]}
                  >
                    {eraseSteps[eraseStep.stage].message}
                  </Text>
                </ScrollView>
                <View
                  style={[
                    s.confirmActions,
                    privacyConfirmationLayout.stackActions && s.confirmActionsStacked,
                  ]}
                >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={eraseSteps[eraseStep.stage].cancelLabel}
                      accessibilityState={{ disabled: localDataOperationBusy }}
                      disabled={localDataOperationBusy}
                      onPress={cancelEraseFlow}
                      style={({ pressed }) => [
                        s.confirmCancelBtn,
                        privacyConfirmationLayout.stackActions && s.confirmActionStacked,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          opacity: localDataOperationBusy
                            ? 0.55
                            : pressed
                              ? 0.72
                              : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.confirmCancelText,
                          { color: colors.foreground, fontFamily: "Inter_800ExtraBold" },
                        ]}
                      >
                        {eraseSteps[eraseStep.stage].cancelLabel}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={eraseSteps[eraseStep.stage].confirmLabel}
                      accessibilityState={{
                        disabled:
                          localDataOperationBusy || eraseTransitionBlocked,
                      }}
                      disabled={localDataOperationBusy || eraseTransitionBlocked}
                      onPress={advanceEraseFlow}
                      style={({ pressed }) => [
                        s.confirmPrimaryBtn,
                        privacyConfirmationLayout.stackActions && s.confirmActionStacked,
                        {
                          backgroundColor: colors.rose,
                          opacity: localDataOperationBusy || eraseTransitionBlocked ? 0.6 : pressed ? 0.84 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.confirmPrimaryText,
                          { color: colors.brandNavy, fontFamily: "Inter_800ExtraBold" },
                        ]}
                      >
                        {eraseSteps[eraseStep.stage].confirmLabel}
                      </Text>
                    </Pressable>
                </View>
              </>
            ) : null}
          </ModalSheetPressable>
        </ModalBackdropPressable>
      </Modal>
      <Modal visible={launchEditorOpen} transparent animationType={reducedMotion ? "none" : "slide"} onRequestClose={() => setLaunchEditorOpen(false)}>
        <ModalBackdropPressable style={s.modalBackdrop} onPress={() => setLaunchEditorOpen(false)}>
          <ModalSheetPressable
            visible={launchEditorOpen}
            onRequestClose={() => setLaunchEditorOpen(false)}
            closeAccessibilityLabel="Close launch support profile editor"
            style={[s.launchModal, { backgroundColor: colors.card, paddingBottom: modalSheetBottomPadding }]}
          >
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalEyebrow, { color: colors.copper, fontFamily: "Inter_800ExtraBold" }]}>
                  Launch profile
                </Text>
                <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Support readiness</Text>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.modalScroll}>
              <ProfileInput
                label="Support email"
                value={launchDraft.supportEmail}
                placeholder="help@woofwatcher.app"
                colors={colors}
                keyboardType="email-address"
                onChangeText={(value) => updateLaunchDraft("supportEmail", value)}
              />
              <ProfileInput
                label="Privacy policy URL"
                value={launchDraft.privacyPolicyUrl}
                placeholder="https://woofwatcher.app/privacy"
                colors={colors}
                keyboardType="url"
                onChangeText={(value) => updateLaunchDraft("privacyPolicyUrl", value)}
              />
              <ProfileInput
                label="Terms URL"
                value={launchDraft.termsUrl}
                placeholder="https://woofwatcher.app/terms"
                colors={colors}
                keyboardType="url"
                onChangeText={(value) => updateLaunchDraft("termsUrl", value)}
              />
              <View style={s.policyStack}>
                <PolicyToggle
                  label="Refund and subscription policy approved"
                  value={launchDraft.refundPolicyApproved}
                  colors={colors}
                  onPress={() => updateLaunchDraft("refundPolicyApproved", !launchDraft.refundPolicyApproved)}
                />
                <PolicyToggle
                  label="Veterinary boundary approved"
                  value={launchDraft.veterinaryBoundaryApproved}
                  colors={colors}
                  onPress={() => updateLaunchDraft("veterinaryBoundaryApproved", !launchDraft.veterinaryBoundaryApproved)}
                />
                <PolicyToggle
                  label="Deletion escalation approved"
                  value={launchDraft.accountDeletionEscalationApproved}
                  colors={colors}
                  onPress={() =>
                    updateLaunchDraft("accountDeletionEscalationApproved", !launchDraft.accountDeletionEscalationApproved)
                  }
                />
                <PolicyToggle
                  label="Incident response owner approved"
                  value={launchDraft.incidentResponseApproved}
                  colors={colors}
                  onPress={() => updateLaunchDraft("incidentResponseApproved", !launchDraft.incidentResponseApproved)}
                />
              </View>
              <Text style={[s.modalBoundary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                This is a local owner checklist. It does not claim legal, store, or provider approval until those approvals are actually complete.
              </Text>
            </ScrollView>
            <View style={s.modalActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save launch support profile draft"
                onPress={() => saveLaunchSupportProfile("local-draft")}
                style={({ pressed }) => [
                  s.modalSecondaryBtn,
                  { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Text style={[s.modalSecondaryText, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                  Save draft
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save owner reviewed launch support profile"
                onPress={() => saveLaunchSupportProfile("owner-reviewed")}
                style={({ pressed }) => [
                  s.modalPrimaryBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 },
                ]}
              >
                <Text style={[s.modalPrimaryText, { color: colors.primaryForeground, fontFamily: "Inter_800ExtraBold" }]}>Owner-reviewed</Text>
              </Pressable>
            </View>
          </ModalSheetPressable>
        </ModalBackdropPressable>
      </Modal>
    </View>
  );
}

function StatCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[s.statTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[s.statValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
    </View>
  );
}

function SafetyRow({
  section,
  colors,
}: {
  section: SafetySectionLike;
  colors: ReturnType<typeof useColors>;
}) {
  const tone = statusColor(section.status, colors);
  return (
    <View style={[s.safetyRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[s.safetyIcon, { backgroundColor: tone + "16" }]}>
        <Ionicons name={statusIcon(section.status)} size={18} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.safetyTop}>
          <Text style={[s.safetyTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{section.title}</Text>
          <Text style={[s.statusPill, { color: tone, fontFamily: "Inter_700Bold" }]}>{section.status.replace("_", " ")}</Text>
        </View>
        <Text style={[s.safetyDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{section.detail}</Text>
        <Text style={[s.safetyAction, { color: tone, fontFamily: "Inter_700Bold" }]}>{section.action}</Text>
      </View>
    </View>
  );
}

function AttachmentQueueRow({
  row,
  colors,
}: {
  row: AttachmentReviewRow;
  colors: ReturnType<typeof useColors>;
}) {
  const tone = attachmentStatusColor(row.status, colors);
  return (
    <View style={[s.queueRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[s.queueIcon, { backgroundColor: tone + "16" }]}>
        <Ionicons name={attachmentIcon(row.kind)} size={17} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.queueTop}>
          <Text style={[s.queueTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{row.label}</Text>
          <Text style={[s.queueCount, { color: tone, fontFamily: "Inter_700Bold" }]}>
            {row.count} {row.count === 1 ? "file" : "files"}
          </Text>
        </View>
        <Text style={[s.queueStatus, { color: tone, fontFamily: "Inter_700Bold" }]}>{row.statusLabel}</Text>
        <Text style={[s.queueDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {row.detail}
        </Text>
        {row.sampleFileNames.length > 0 ? (
          <Text numberOfLines={1} style={[s.queueFiles, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            {row.sampleFileNames.join(", ")}
          </Text>
        ) : null}
        <Text style={[s.queueAction, { color: tone, fontFamily: "Inter_700Bold" }]}>{row.actionLabel}</Text>
      </View>
    </View>
  );
}

function ProfileInput({
  label,
  value,
  placeholder,
  keyboardType,
  colors,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType: "default" | "email-address" | "url";
  colors: ReturnType<typeof useColors>;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={s.profileInputGroup}>
      <Text style={[s.profileInputLabel, { color: colors.mutedForeground, fontFamily: "Inter_800ExtraBold" }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        style={[
          s.profileInput,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
            fontFamily: "Inter_700Bold",
          },
        ]}
      />
    </View>
  );
}

function PolicyToggle({
  label,
  value,
  colors,
  onPress,
}: {
  label: string;
  value: boolean;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={value}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.policyToggle,
        {
          backgroundColor: value ? colors.sage + "18" : colors.background,
          borderColor: value ? colors.sage + "66" : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={[s.policyCheck, { backgroundColor: value ? colors.sage : colors.card, borderColor: value ? colors.sage : colors.border }]}>
        <Ionicons
          name={value ? "checkmark" : "ellipse-outline"}
          size={15}
          color={value
            ? colors.isDark
              ? colors.brandNavy
              : colors.destructiveForeground
            : colors.mutedForeground}
        />
      </View>
      <Text style={[s.policyLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderRadius: 26, padding: 22, minHeight: 230, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroCloseButton: {
    width: MIN_MOBILE_TOUCH_TARGET,
    height: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroTitle: { color: "#FFFFFF", fontSize: 33, letterSpacing: 0 },
  heroSub: { color: "rgba(255,255,255,0.84)", fontSize: 15, lineHeight: 22, marginTop: 10 },
  privacyBoard: { marginTop: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statTile: { flexBasis: "45%", flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 15 },
  statValue: { fontSize: 24 },
  statLabel: { fontSize: 11.5, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.6 },
  queueSummary: { fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  queueStack: { gap: 10 },
  queueRow: { flexDirection: "row", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14 },
  queueIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  queueTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  queueTitle: { flex: 1, fontSize: 14.5 },
  queueCount: { fontSize: 11.5, textTransform: "uppercase" },
  queueStatus: { fontSize: 11.5, marginTop: 4, textTransform: "uppercase" },
  queueDetail: { fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  queueFiles: { fontSize: 11.5, marginTop: 6 },
  queueAction: { fontSize: 12, marginTop: 8 },
  emptyQueue: { fontSize: 12.5, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryBtn: { flex: 1.2, height: 52, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#FFFFFF", fontSize: 14 },
  secondaryBtn: { flex: 1, height: 52, borderRadius: 17, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryText: { fontSize: 13.5 },
  legalRow: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legalRowTitle: { fontSize: 13 },
  legalRowSub: { fontSize: 11, marginTop: 1 },
  sectionStack: { gap: 10 },
  supportVerdict: { fontSize: 14, lineHeight: 18, marginBottom: 5 },
  launchProfilePanel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  launchProfileEyebrow: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6 },
  launchProfileStatus: { fontSize: 14.5, marginTop: 4 },
  launchProfileDetail: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  profileEditBtn: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  profileEditText: { fontSize: 12 },
  supportBlockers: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 5,
    marginTop: 12,
  },
  supportBlockerText: { fontSize: 12, lineHeight: 17 },
  supportActionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  supportProofBtn: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  supportProofText: { fontSize: 13 },
  supportShareBtn: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  supportShareText: { color: "#FFFFFF", fontSize: 13 },
  safetyRow: { flexDirection: "row", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14 },
  safetyIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  safetyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  safetyTitle: { flex: 1, fontSize: 14.5 },
  statusPill: { fontSize: 10.5, textTransform: "uppercase" },
  safetyDetail: { fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  safetyAction: { fontSize: 12, marginTop: 8 },
  noticeBoard: { marginTop: 14 },
  noticeContent: { flexDirection: "row", gap: 10 },
  noticeTitle: { fontSize: 14, marginBottom: 5 },
  noticeLine: { fontSize: 12.5, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8, 26, 42, 0.42)",
  },
  confirmSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  confirmHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  confirmIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: { flex: 1, fontSize: 20, lineHeight: 25 },
  confirmScroll: { flexShrink: 1, minHeight: 0 },
  confirmScrollContent: { paddingBottom: 2 },
  confirmMessage: { fontSize: 13.5, lineHeight: 20, marginTop: 12 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  confirmActionsStacked: { flexDirection: "column" },
  confirmActionStacked: { flex: 0, width: "100%" },
  confirmCancelBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  confirmCancelText: { fontSize: 13 },
  confirmPrimaryBtn: {
    flex: 1.2,
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 0,
  },
  confirmPrimaryText: { fontSize: 13 },
  launchModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "88%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(120, 132, 146, 0.35)",
    marginBottom: 16,
  },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  modalEyebrow: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6 },
  modalTitle: { fontSize: 26, letterSpacing: 0 },
  modalScroll: { paddingTop: 16, paddingBottom: 14 },
  profileInputGroup: { marginBottom: 12 },
  profileInputLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 },
  profileInput: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 13.5 },
  policyStack: { gap: 9, marginTop: 2 },
  policyToggle: { minHeight: 50, borderRadius: 15, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  policyCheck: { width: 25, height: 25, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  policyLabel: { flex: 1, fontSize: 13, lineHeight: 18 },
  modalBoundary: { fontSize: 12.5, lineHeight: 18, marginTop: 14 },
  modalActions: { flexDirection: "row", gap: 10, paddingTop: 8 },
  modalSecondaryBtn: { flex: 1, minHeight: 50, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  modalSecondaryText: { fontSize: 13 },
  modalPrimaryBtn: { flex: 1.2, minHeight: 50, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  modalPrimaryText: { color: "#FFFFFF", fontSize: 13 },
});
