import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe } from "@workspace/api-client-react";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { BoardCard, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { getRouteTopPadding, getStandaloneRouteBottomPadding, MOBILE_INLINE_HIT_SLOP } from "@/lib/mobileLayout";
import {
  buildAccountDeletionRequest,
  buildPrivacyExportBundle,
  deriveAccountSafetyPlan,
  serializePrivacyExportBundle,
  type AccountSafetySection,
  type AccountSafetyStatus,
} from "@/lib/privacySafety";
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
  const { state } = useCare();
  const me = useGetMe();
  const context = useMemo(
    () => ({
      userId: me.data?.user?.id ?? null,
      householdId: me.data?.household?.id ?? null,
      householdName: me.data?.household?.name ?? null,
    }),
    [me.data?.household?.id, me.data?.household?.name, me.data?.user?.id],
  );

  const plan = useMemo(
    () =>
      deriveAccountSafetyPlan({
        state,
        aiProviderConfigured: false,
        storageProviderConfigured: false,
        accountDeletionEnabled: false,
        paymentsEnabled: false,
      }),
    [state],
  );

  const bundle = useMemo(() => buildPrivacyExportBundle(state, context), [state, context]);
  const supportPlan = useMemo(
    () =>
      deriveSupportRunbookPlan({
        supportEmail: null,
        privacyPolicyUrl: null,
        termsUrl: null,
        refundPolicyApproved: false,
        veterinaryBoundaryApproved: false,
        accountDeletionEscalationApproved: false,
        incidentResponseApproved: false,
      }),
    [],
  );
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

  const shareExport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fresh = buildPrivacyExportBundle(state, context, Date.now());
    Share.share({
      title: `WoofWatcher care export - ${fresh.dogName}`,
      message: serializePrivacyExportBundle(fresh),
    }).catch(() => Alert.alert("Export unavailable", "The device share sheet could not open."));
  };

  const shareDeletionRequest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const request = buildAccountDeletionRequest(state, context, Date.now());
    Share.share({
      title: request.subject,
      message: `${request.subject}\n\n${request.body}`,
    }).catch(() => Alert.alert("Deletion request", request.body));
  };

  const shareSupportRunbook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = buildSupportRunbookShareText(supportPlan, {
      appName: "WoofWatcher",
      generatedAtIso: new Date().toISOString(),
    });
    Share.share({
      title: "WoofWatcher Support Runbook",
      message,
    }).catch(() => Alert.alert("Support runbook", message));
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Privacy & Safety" }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topPadding, paddingHorizontal: 20, paddingBottom: bottomPadding }}
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
              onPress={() => router.back()}
              hitSlop={MOBILE_INLINE_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close Privacy and Safety"
            >
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.82)" />
            </Pressable>
          </View>
          <Text style={[s.heroTitle, { fontFamily: DISPLAY }]}>Privacy & Safety</Text>
          <Text style={[s.heroSub, { fontFamily: "Inter_500Medium" }]}>
            Export care data, prepare deletion requests, and review the rules that keep AI, documents, and payments gated.
          </Text>
        </LinearGradient>

        <BoardCard style={s.privacyBoard}>
          <BoardSectionHeader title="Export summary" action="Local bundle" />
          <View style={s.statsGrid}>
            <StatCard label="Logs" value={String(bundle.counts.entries)} colors={colors} />
            <StatCard label="Records" value={String(bundle.counts.records)} colors={colors} />
            <StatCard label="Reports" value={String(bundle.counts.reportArtifacts)} colors={colors} />
            <StatCard label="Files" value={String(bundle.counts.localAttachments)} colors={colors} />
          </View>
        </BoardCard>

        <BoardCard style={s.privacyBoard}>
          <BoardSectionHeader title="Attachment queue" action={`${bundle.storage.attachmentQueue.total} files`} />
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
            <Text style={[s.primaryText, { fontFamily: "Inter_700Bold" }]}>Export care data</Text>
          </Pressable>
          <Pressable
            onPress={shareDeletionRequest}
            accessibilityRole="button"
            accessibilityLabel="Prepare account deletion request"
            style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons name="trash-outline" size={17} color={colors.rose} />
            <Text style={[s.secondaryText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>Deletion request</Text>
          </Pressable>
        </View>

        <BoardCard style={s.privacyBoard}>
          <BoardSectionHeader title="Support runbook" action="Launch gate" />
          <Text style={[s.supportVerdict, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
            {supportPlan.verdictLabel}
          </Text>
          <Text style={[s.queueSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {supportPlan.summary}
          </Text>
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
        </BoardCard>

        <BoardCard style={s.privacyBoard}>
          <BoardSectionHeader title="Launch safety gates" action={`${sections.length} gates`} />
          <View style={s.sectionStack}>
            {sections.map((section) => (
              <SafetyRow key={section.title} section={section} colors={colors} />
            ))}
          </View>
        </BoardCard>

        <BoardCard style={[s.noticeBoard, { backgroundColor: colors.amber + "14", borderColor: colors.amber + "45" }]}>
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
      </ScrollView>
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
  statTile: { width: "48.5%", borderRadius: 16, borderWidth: 1, padding: 15 },
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
  sectionStack: { gap: 10 },
  supportVerdict: { fontSize: 14, lineHeight: 18, marginBottom: 5 },
  supportBlockers: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 5,
    marginTop: 12,
  },
  supportBlockerText: { fontSize: 12, lineHeight: 17 },
  supportShareBtn: {
    marginTop: 12,
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
});
