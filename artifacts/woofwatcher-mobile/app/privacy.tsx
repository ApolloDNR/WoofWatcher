import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
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
import { useGetMe } from "@workspace/api-client-react";
import { useAvatar } from "@/context/AvatarContext";
import { useCare, type LaunchSupportProfile } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { BoardCard, BoardPill, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import {
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  MOBILE_INLINE_HIT_SLOP,
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
import { resolvePetName } from "@/lib/petIdentity";
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

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

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

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, careMutationsBlocked, updateCareDoc, eraseAllLocalData } = useCare();
  const { clearAvatarSet, resetAvatarConfig } = useAvatar();
  // Launch-ops cards (support runbook, launch gates) are owner tooling and
  // stay out of store production builds.
  const ownerOps = isOwnerOpsBuild();
  const [launchEditorOpen, setLaunchEditorOpen] = useState(false);
  const [launchDraft, setLaunchDraft] = useState<LaunchSupportProfile>(state.launchSupportProfile);
  const me = useGetMe();
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
    surface: "standalone",
  });
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
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

  const shareExport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fresh = buildPrivacyExportBundle(state, context, Date.now());
    void shareTextPayload({
      title: `WoofWatcher care export - ${fresh.dogName}`,
      message: serializePrivacyExportBundle(fresh),
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
    router.push("/legal" as never);
  };

  // Themed two-step delete-all confirmation: the native confirm()/alert()
  // fallback read as browser chrome on web, so the flow now runs in the
  // app's own board-style sheet on every platform. Semantics are unchanged:
  // two explicit confirmations, then a completion notice after the wipe.
  const [eraseStage, setEraseStage] = useState<
    "confirm" | "confirm-final" | "done" | null
  >(null);
  const [erasing, setErasing] = useState(false);

  const eraseSteps = {
    confirm: {
      title: "Delete all data on this device?",
      message: `This permanently removes every log, routine, record, memory, report, and avatar for ${resolvePetName(state.profile.name)} from this device. WoofWatcher keeps no copy anywhere else. Export first if you want a backup.`,
      confirmLabel: "Delete everything",
      cancelLabel: "Cancel",
    },
    "confirm-final": {
      title: "This cannot be undone",
      message: "Delete all WoofWatcher data from this device now?",
      confirmLabel: "Yes, delete it all",
      cancelLabel: "Keep my data",
    },
    done: {
      title: "All data deleted",
      message: "WoofWatcher has been reset to a fresh household on this device.",
    },
  } as const;

  const confirmEraseAllLocalData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEraseStage("confirm");
  };

  const cancelEraseFlow = () => {
    if (erasing) return;
    setEraseStage(null);
  };

  const advanceEraseFlow = () => {
    if (eraseStage === "confirm") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setEraseStage("confirm-final");
      return;
    }
    if (eraseStage === "confirm-final") {
      if (erasing) return;
      setErasing(true);
      // The avatar contexts hold hydrated in-memory state, so the wipe
      // must reset them too or the custom twin would survive on screen
      // (and a later Studio save would re-persist deleted data).
      // Never leave the owner stuck on "erasing" with no verdict: even if an
      // avatar reset rejects, the care-data wipe already ran, so land on
      // "done" rather than hanging silently.
      void Promise.all([eraseAllLocalData(), clearAvatarSet(), resetAvatarConfig()])
        .catch(() => {})
        .then(() => {
          setErasing(false);
          setEraseStage("done");
        });
      return;
    }
    setEraseStage(null);
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        // 16 matches the tab screens' shared side gutter (Home/Log/Records
        // all use 16), so modal routes stop sitting 4px narrower.
        contentContainerStyle={{ paddingTop: topPadding, paddingHorizontal: 16, paddingBottom: bottomPadding }}
      >
        <LinearGradient
          colors={[colors.midnight, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTop}>
            <View style={s.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" />
            </View>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/more"))}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close Privacy and Safety"
            >
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.82)" />
            </Pressable>
          </View>
          <Text style={[s.heroTitle, { fontFamily: DISPLAY }]}>Privacy & Safety</Text>
          <Text style={[s.heroSub, { fontFamily: "Inter_500Medium" }]}>
            {ownerOps
              ? "Export care data, prepare deletion requests, and review the rules that keep AI, documents, and payments gated."
              : "Your household's care data lives on this device. Export it, read the policy, or delete everything at any time."}
          </Text>
        </LinearGradient>

        <BoardCard enter={0} style={s.privacyBoard}>
          <BoardSectionHeader
            title="Export summary"
            accessory={<BoardPill label="Local bundle" tone={colors.sage} />}
          />
          <View style={s.statsGrid}>
            <StatCard label="Logs" value={String(bundle.counts.entries)} colors={colors} />
            <StatCard label="Records" value={String(bundle.counts.records)} colors={colors} />
            <StatCard label="Reports" value={String(bundle.counts.reportArtifacts)} colors={colors} />
            <StatCard label="Files" value={String(bundle.counts.localAttachments)} colors={colors} />
          </View>
        </BoardCard>

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

        <View style={s.actionRow}>
          <Pressable
            onPress={shareExport}
            accessibilityRole="button"
            accessibilityLabel="Export WoofWatcher care data"
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="download-outline" size={18} color="#FFFFFF" />
            <Text style={[s.primaryText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Export care data</Text>
          </Pressable>
          {/* The email-based "Deletion request" only makes sense once a
              provider account exists. In the local-first build there is no
              server copy, so the on-device "Delete all data" below is the
              real, complete deletion path - keep this owner-gated. */}
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
            Every care log lives only on this device. Read the full privacy
            policy and terms, or erase everything in one step.
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
            accessibilityRole="button"
            accessibilityLabel="Delete all WoofWatcher data on this device"
            style={({ pressed }) => [
              s.legalRow,
              { borderColor: colors.rose + "55", backgroundColor: pressed ? colors.rose + "14" : colors.background },
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
        visible={eraseStage !== null}
        transparent
        animationType="fade"
        onRequestClose={cancelEraseFlow}
      >
        <Pressable
          style={s.modalBackdrop}
          onPress={eraseStage === "done" ? advanceEraseFlow : cancelEraseFlow}
          accessibilityRole="button"
          accessibilityLabel="Dismiss delete confirmation"
        >
          <Pressable
            style={[
              s.confirmSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(modalSheetBottomPadding, 18),
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={s.modalHandle} />
            {eraseStage ? (
              <>
                <View style={s.confirmHeader}>
                  <View
                    style={[
                      s.confirmIcon,
                      {
                        backgroundColor:
                          eraseStage === "done" ? colors.sage + "16" : colors.rose + "14",
                      },
                    ]}
                  >
                    <Ionicons
                      name={eraseStage === "done" ? "checkmark-circle-outline" : "trash-bin-outline"}
                      size={20}
                      color={eraseStage === "done" ? colors.sage : colors.rose}
                    />
                  </View>
                  <Text style={[s.confirmTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
                    {eraseSteps[eraseStage].title}
                  </Text>
                </View>
                <Text
                  style={[
                    s.confirmMessage,
                    { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {eraseSteps[eraseStage].message}
                </Text>
                {eraseStage === "done" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close data deletion notice"
                    onPress={advanceEraseFlow}
                    style={({ pressed }) => [
                      s.confirmPrimaryBtn,
                      s.confirmDoneBtn,
                      { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 },
                    ]}
                  >
                    <Text style={[s.confirmPrimaryText, { color: colors.primaryForeground, fontFamily: "Inter_800ExtraBold" }]}>
                      Done
                    </Text>
                  </Pressable>
                ) : (
                  <View style={s.confirmActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={eraseSteps[eraseStage].cancelLabel}
                      disabled={erasing}
                      onPress={cancelEraseFlow}
                      style={({ pressed }) => [
                        s.confirmCancelBtn,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          opacity: pressed ? 0.72 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.confirmCancelText,
                          { color: colors.foreground, fontFamily: "Inter_800ExtraBold" },
                        ]}
                      >
                        {eraseSteps[eraseStage].cancelLabel}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={eraseSteps[eraseStage].confirmLabel}
                      disabled={erasing}
                      onPress={advanceEraseFlow}
                      style={({ pressed }) => [
                        s.confirmPrimaryBtn,
                        {
                          backgroundColor: colors.rose,
                          opacity: erasing ? 0.6 : pressed ? 0.84 : 1,
                        },
                      ]}
                    >
                      <Text style={[s.confirmPrimaryText, { fontFamily: "Inter_800ExtraBold" }]}>
                        {erasing ? "Deleting..." : eraseSteps[eraseStage].confirmLabel}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={launchEditorOpen} transparent animationType="slide" onRequestClose={() => setLaunchEditorOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setLaunchEditorOpen(false)}>
          <Pressable
            style={[s.launchModal, { backgroundColor: colors.card, paddingBottom: modalSheetBottomPadding }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View>
                <Text style={[s.modalEyebrow, { color: colors.copper, fontFamily: "Inter_800ExtraBold" }]}>
                  Launch profile
                </Text>
                <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Support readiness</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close launch support profile editor"
                hitSlop={MOBILE_INLINE_HIT_SLOP}
                onPress={() => setLaunchEditorOpen(false)}
              >
                <Ionicons name="close" size={23} color={colors.mutedForeground} />
              </Pressable>
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
          </Pressable>
        </Pressable>
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
        <Ionicons name={value ? "checkmark" : "ellipse-outline"} size={15} color={value ? "#FFFFFF" : colors.mutedForeground} />
      </View>
      <Text style={[s.policyLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderRadius: 26, padding: 22, minHeight: 230, justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
    minHeight: 38,
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
    minHeight: 46,
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
    minHeight: 46,
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
  confirmMessage: { fontSize: 13.5, lineHeight: 20, marginTop: 12 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 18 },
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
  confirmPrimaryText: { color: "#FFFFFF", fontSize: 13 },
  confirmDoneBtn: { flex: 0, marginTop: 18 },
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
