import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";

import {
  BoardCard,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
  ModalBackdropPressable,
  ModalSheetPressable,
} from "@/components/board/BoardPrimitives";
import { useCare } from "@/context/CareContext";
import { useLocalDataReset } from "@/context/LocalDataResetContext";
import { useColors } from "@/hooks/useColors";
import {
  buildConsumerCareExport,
  serializeConsumerCareExport,
} from "@/lib/consumerCareExport";
import {
  activateDeliberateConfirmation,
  createDeliberateConfirmationLatch,
  DELIBERATE_CONFIRMATION_TRANSITION_MS,
  getDeliberateConfirmationDelay,
  resetDeliberateConfirmation,
  transitionDeliberateConfirmation,
  trySettleDeliberateConfirmation,
} from "@/lib/deliberateConfirmation";
import {
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import { derivePrivacyConfirmationLayout } from "@/lib/privacyConfirmationLayout";
import { getPrivacyDataTruthCopy } from "@/lib/privacyDataTruth";
import { shareTextPayload } from "@/lib/shareText";
import { notifyDialog } from "@/lib/confirmDialog";

type EraseStage = "confirm" | "confirm-final";
type EraseStep = Readonly<{ stage: EraseStage }>;

export interface ConsumerPrivacyDataScreenProps {
  onBack: () => void;
  onOpenLegal: (document: "privacy" | "terms") => void;
}

export default function ConsumerPrivacyDataScreen({
  onBack,
  onOpenLegal,
}: ConsumerPrivacyDataScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { height: viewportHeight, fontScale } = useWindowDimensions();
  const { state } = useCare();
  const { operationState, runExport, runReset } = useLocalDataReset();
  const truth = useMemo(() => getPrivacyDataTruthCopy(false), []);
  const exportBundle = useMemo(() => buildConsumerCareExport(state), [state]);
  const mountedRef = useRef(true);
  const exportInFlightRef = useRef(false);
  const eraseLatchRef = useRef(
    createDeliberateConfirmationLatch<EraseStep>(
      DELIBERATE_CONFIRMATION_TRANSITION_MS,
    ),
  );
  const [eraseStep, setEraseStep] = useState<EraseStep | null>(null);
  const [eraseActivationEpoch, setEraseActivationEpoch] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resetDeliberateConfirmation(eraseLatchRef.current);
    };
  }, []);

  const localOperationBusy =
    operationState.status === "exporting" ||
    operationState.status === "deleting";
  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const modalBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const confirmationLayout = derivePrivacyConfirmationLayout({
    viewportHeight,
    topInset: insets.top,
    fontScale,
  });

  const shareExport = () => {
    if (localOperationBusy || exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const operation = runExport(
      () => {
        const fresh = buildConsumerCareExport(state, Date.now());
        return Object.freeze({
          title: `WoofWatcher care export - ${fresh.dogName}`,
          message: serializeConsumerCareExport(fresh),
        });
      },
      async (payload) => {
        const outcome = await shareTextPayload(payload, {
          notifyOnFailure: false,
        });
        if (outcome === "failed") {
          throw new Error("Care export sharing failed.");
        }
      },
    );

    void operation
      .catch(() => {
        if (!mountedRef.current) return;
        notifyDialog(
          "Export not shared",
          "WoofWatcher could not share this care export. Your data was not changed. Try again.",
        );
      })
      .finally(() => {
        exportInFlightRef.current = false;
      });
  };

  const openEraseFlow = () => {
    if (localOperationBusy) return;
    const firstStep: EraseStep = { stage: "confirm" };
    if (
      !activateDeliberateConfirmation(
        eraseLatchRef.current,
        firstStep,
        Date.now(),
      )
    ) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => {},
    );
    setEraseStep(firstStep);
  };

  const cancelEraseFlow = () => {
    if (localOperationBusy) return;
    resetDeliberateConfirmation(eraseLatchRef.current);
    setEraseStep(null);
  };

  const advanceEraseFlow = () => {
    if (!eraseStep || localOperationBusy) return;
    const settledAt = Date.now();
    if (
      !trySettleDeliberateConfirmation(
        eraseLatchRef.current,
        eraseStep,
        settledAt,
      )
    ) {
      return;
    }

    if (eraseStep.stage === "confirm") {
      const finalStep: EraseStep = { stage: "confirm-final" };
      transitionDeliberateConfirmation(
        eraseLatchRef.current,
        finalStep,
        settledAt,
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => {},
      );
      setEraseStep(finalStep);
      setEraseActivationEpoch((epoch) => epoch + 1);
      return;
    }

    resetDeliberateConfirmation(eraseLatchRef.current);
    setEraseStep(null);
    void runReset().catch(() => {
      if (!mountedRef.current) return;
      notifyDialog(
        "Deletion incomplete",
        "WoofWatcher could not remove every local data owner. Nothing hidden was marked as deleted; try again.",
      );
    });
  };

  const eraseTransitionDelay = eraseStep
    ? getDeliberateConfirmationDelay(
        eraseLatchRef.current,
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

  const operationMessage =
    operationState.status === "exporting"
      ? "Preparing your care export…"
      : operationState.status === "deleting"
        ? "Deleting local data…"
        : operationState.status === "failed"
          ? "The last local data action did not finish. You can safely retry."
          : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPadding, paddingBottom: bottomPadding },
        ]}
      >
        <BoardRouteHeader
          kicker="YOUR DATA"
          title="Privacy & data"
          subtitle="See what is stored, take a copy, or remove WoofWatcher data from this device."
          icon="shield-checkmark-outline"
          back
          onBack={onBack}
          backDisabled={localOperationBusy}
          plain
        />

        <BoardCard enter={0} style={styles.summaryCard}>
          <BoardSectionHeader
            title="Care export"
            accessory={<BoardPill label="JSON" tone={colors.sage} />}
          />
          <Text
            style={[
              styles.bodyCopy,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              },
            ]}
          >
            A readable copy of the care data currently open in this app. Photos,
            documents, and report files stay separate.
          </Text>
          <View style={styles.statsGrid}>
            <Stat
              label="Logs"
              value={exportBundle.counts.entries}
              colors={colors}
            />
            <Stat
              label="Records"
              value={exportBundle.counts.records}
              colors={colors}
            />
            <Stat
              label="Memories"
              value={exportBundle.counts.adventureMemories}
              colors={colors}
            />
            <Stat
              label="Reports"
              value={exportBundle.counts.reportArtifacts}
              colors={colors}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export WoofWatcher care data"
            accessibilityState={{ disabled: localOperationBusy }}
            disabled={localOperationBusy}
            onPress={shareExport}
            style={({ pressed }) => [
              styles.primaryAction,
              {
                backgroundColor: colors.primary,
                opacity: localOperationBusy ? 0.52 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <Ionicons
              name="download-outline"
              size={19}
              color={colors.primaryForeground}
            />
            <Text
              style={[
                styles.primaryActionText,
                {
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            >
              Export care data
            </Text>
          </Pressable>
        </BoardCard>

        <BoardCard enter={1} style={styles.controlCard}>
          <BoardSectionHeader
            title="Your controls"
            accessory={<BoardPill label="On device" tone={colors.copper} />}
          />
          <ControlRow
            icon="document-text-outline"
            title="Privacy policy & terms"
            detail="Plain-language rules for your household's data"
            tone={colors.forest}
            onPress={() => onOpenLegal("privacy")}
            colors={colors}
          />
          <ControlRow
            icon="trash-bin-outline"
            title="Delete data on this device"
            detail="Permanent. WoofWatcher returns to a fresh household."
            tone={colors.rose}
            disabled={localOperationBusy}
            onPress={openEraseFlow}
            colors={colors}
          />
        </BoardCard>

        <View
          accessible
          accessibilityLabel={`Privacy note. ${truth.rules}`}
          style={[
            styles.privacyNote,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Ionicons name="lock-closed" size={17} color={colors.sage} />
          <Text
            style={[
              styles.privacyNoteText,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              },
            ]}
          >
            {truth.rules}
          </Text>
        </View>

        {operationMessage ? (
          <View
            accessible
            accessibilityLiveRegion="polite"
            style={[
              styles.operationNotice,
              {
                borderColor: colors.border,
                backgroundColor: colors.secondary,
              },
            ]}
          >
            <Text
              style={[
                styles.operationText,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {operationMessage}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={eraseStep !== null}
        transparent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={cancelEraseFlow}
      >
        <ModalBackdropPressable
          style={styles.modalBackdrop}
          onPress={cancelEraseFlow}
        >
          <ModalSheetPressable
            visible={eraseStep !== null}
            onRequestClose={cancelEraseFlow}
            closeAccessibilityLabel="Cancel local data deletion"
            style={[
              styles.confirmSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(modalBottomPadding, 18),
                maxHeight: confirmationLayout.maxHeight,
              },
            ]}
          >
            {eraseStep ? (
              <>
                <ScrollView
                  style={styles.confirmScroll}
                  contentContainerStyle={styles.confirmScrollContent}
                  showsVerticalScrollIndicator
                >
                  <View
                    style={[
                      styles.confirmIcon,
                      { backgroundColor: colors.rose + "14" },
                    ]}
                  >
                    <Ionicons
                      name="trash-bin-outline"
                      size={22}
                      color={colors.rose}
                    />
                  </View>
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.confirmTitle,
                      { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
                    ]}
                  >
                    {truth.eraseSteps[eraseStep.stage].title}
                  </Text>
                  <Text
                    style={[
                      styles.confirmMessage,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {truth.eraseSteps[eraseStep.stage].message}
                  </Text>
                </ScrollView>
                <View
                  style={[
                    styles.confirmActions,
                    confirmationLayout.stackActions &&
                      styles.confirmActionsStacked,
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      truth.eraseSteps[eraseStep.stage].cancelLabel
                    }
                    disabled={localOperationBusy}
                    onPress={cancelEraseFlow}
                    style={({ pressed }) => [
                      styles.confirmButton,
                      confirmationLayout.stackActions &&
                        styles.confirmButtonStacked,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        opacity: pressed ? 0.74 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.confirmButtonText,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {truth.eraseSteps[eraseStep.stage].cancelLabel}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      truth.eraseSteps[eraseStep.stage].confirmLabel
                    }
                    accessibilityState={{
                      disabled:
                        localOperationBusy || eraseTransitionBlocked,
                    }}
                    disabled={localOperationBusy || eraseTransitionBlocked}
                    onPress={advanceEraseFlow}
                    style={({ pressed }) => [
                      styles.confirmButton,
                      confirmationLayout.stackActions &&
                        styles.confirmButtonStacked,
                      {
                        borderColor: colors.rose,
                        backgroundColor: colors.rose,
                        opacity:
                          localOperationBusy || eraseTransitionBlocked
                            ? 0.56
                            : pressed
                              ? 0.82
                              : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.confirmButtonText,
                        {
                          color: colors.brandNavy,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {truth.eraseSteps[eraseStep.stage].confirmLabel}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ModalSheetPressable>
        </ModalBackdropPressable>
      </Modal>
    </View>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[
        styles.stat,
        { borderColor: colors.border, backgroundColor: colors.background },
      ]}
    >
      <Text
        style={[
          styles.statValue,
          { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ControlRow({
  icon,
  title,
  detail,
  tone,
  disabled = false,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  tone: string;
  disabled?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlRow,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.secondary : colors.background,
          opacity: disabled ? 0.54 : 1,
        },
      ]}
    >
      <View style={[styles.controlIcon, { backgroundColor: tone + "14" }]}>
        <Ionicons name={icon} size={19} color={tone} />
      </View>
      <View style={styles.controlCopy}>
        <Text
          style={[
            styles.controlTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.controlDetail,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
            },
          ]}
        >
          {detail}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={17}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  summaryCard: { padding: 16 },
  controlCard: { padding: 14, gap: 9 },
  bodyCopy: { marginTop: 9, fontSize: 13, lineHeight: 19 },
  statsGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stat: {
    minWidth: "46%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  statValue: { fontSize: 22, lineHeight: 26 },
  statLabel: { marginTop: 2, fontSize: 11.5, lineHeight: 15 },
  primaryAction: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  primaryActionText: { fontSize: 14, lineHeight: 19, textAlign: "center" },
  controlRow: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  controlIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  controlCopy: { minWidth: 0, flex: 1 },
  controlTitle: { fontSize: 14, lineHeight: 18 },
  controlDetail: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  privacyNote: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  privacyNoteText: { minWidth: 0, flex: 1, fontSize: 11.5, lineHeight: 17 },
  operationNotice: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    justifyContent: "center",
  },
  operationText: { fontSize: 12.5, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3, 12, 22, 0.68)",
  },
  confirmSheet: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    borderWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  confirmScroll: { flexShrink: 1 },
  confirmScrollContent: { paddingBottom: 16 },
  confirmIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmTitle: { fontSize: 24, lineHeight: 29 },
  confirmMessage: { marginTop: 9, fontSize: 13, lineHeight: 20 },
  confirmActions: { flexDirection: "row", gap: 9, paddingBottom: 2 },
  confirmActionsStacked: { flexDirection: "column-reverse" },
  confirmButton: {
    minHeight: 52,
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonStacked: { width: "100%", flex: 0 },
  confirmButtonText: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
