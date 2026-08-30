import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  BoardCard,
  BoardPill,
  BoardSectionHeader,
} from "@/components/board/BoardPrimitives";
import { useColors } from "@/hooks/useColors";
import {
  buildAvatarSpriteProductionQaSummary,
  buildAvatarSpriteProductionTemplateReview,
} from "@/lib/avatarSpriteProductionQa";
import type { AvatarTemplateId } from "@/lib/avatarStudio";
import { isOwnerOpsBuild } from "@/lib/buildChannel";
import {
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";

const DISPLAY = "Fredoka_700Bold";

export interface AvatarSpriteProductionPanelProps {
  templateId: AvatarTemplateId;
  onOpenSpriteQa: () => void;
}

export default function AvatarSpriteProductionPanel({
  templateId,
  onOpenSpriteQa,
}: AvatarSpriteProductionPanelProps) {
  if (!isOwnerOpsBuild()) return null;

  return (
    <OwnerAvatarSpriteProductionPanel
      templateId={templateId}
      onOpenSpriteQa={onOpenSpriteQa}
    />
  );
}

function OwnerAvatarSpriteProductionPanel({
  templateId,
  onOpenSpriteQa,
}: AvatarSpriteProductionPanelProps) {
  const colors = useColors();
  const summary = useMemo(() => buildAvatarSpriteProductionQaSummary(), []);
  const review = useMemo(
    () => buildAvatarSpriteProductionTemplateReview(templateId),
    [templateId],
  );

  const openQa = () => {
    Haptics.selectionAsync().catch(() => {});
    onOpenSpriteQa();
  };

  return (
    <BoardCard style={styles.card}>
      <BoardSectionHeader
        title="Sprite production review"
        accessory={
          <BoardPill label={review.proofStatusLabel} tone={colors.sage} />
        }
      />
      <View
        accessibilityLabel={`Avatar sprite production review for ${review.template.label}`}
        style={[
          styles.reviewPanel,
          {
            backgroundColor: colors.secondary,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.headline,
            { color: colors.foreground, fontFamily: DISPLAY },
          ]}
        >
          {review.headline}
        </Text>
        <Text
          style={[
            styles.copy,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_600SemiBold",
            },
          ]}
        >
          {review.template.nativeReviewPrompt}
        </Text>
        <View style={styles.metricGrid}>
          <Metric
            label="LIVE TEMPLATES"
            value={`${summary.liveTemplatePacks}/${summary.totalTemplates}`}
          />
          <Metric label="SPRITE SLOTS" value={summary.totalSpriteSlots} />
          <Metric label="BODY CLASS" value={review.template.bodyClass} />
        </View>
      </View>

      <View style={styles.actionList}>
        {review.template.actions.map((action) => (
          <View
            key={action.action}
            style={[
              styles.actionRow,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[styles.actionIcon, { backgroundColor: colors.ivory }]}
            >
              <Ionicons
                name={
                  action.action === "walk-loop"
                    ? "walk-outline"
                    : "pulse-outline"
                }
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.actionCopy}>
              <Text
                style={[
                  styles.actionTitle,
                  {
                    color: colors.foreground,
                    fontFamily: "Inter_800ExtraBold",
                  },
                ]}
              >
                {action.label}
              </Text>
              <Text
                style={[
                  styles.actionMeta,
                  { color: colors.sage, fontFamily: "Inter_700Bold" },
                ]}
              >
                {action.frameCount} frames | {action.fps} fps | {action.anchor}
              </Text>
              <Text
                style={[
                  styles.actionNotes,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {action.notes}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.checkList}>
        <Text
          style={[
            styles.checkTitle,
            { color: colors.sage, fontFamily: "Inter_700Bold" },
          ]}
        >
          Game-feel checks
        </Text>
        {review.gameFeelChecks.map((check) => (
          <View key={check} style={styles.checkRow}>
            <Ionicons
              name="checkmark-circle-outline"
              size={17}
              color={colors.sage}
            />
            <Text
              style={[
                styles.checkText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {check}
            </Text>
          </View>
        ))}
      </View>

      <Text
        style={[
          styles.boundary,
          {
            color: colors.mutedForeground,
            fontFamily: "Inter_600SemiBold",
          },
        ]}
      >
        {review.nativeProofStatus}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Avatar sprite production QA cockpit"
        accessibilityHint="Opens the focused native QA checklist for sprite gait and phone crop review."
        hitSlop={MOBILE_INLINE_HIT_SLOP}
        onPress={openQa}
        style={({ pressed }) => [
          styles.qaButton,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.qaButtonText,
            {
              color: colors.primaryForeground,
              fontFamily: "Inter_800ExtraBold",
            },
          ]}
        >
          Open sprite QA cockpit
        </Text>
        <Ionicons
          name="arrow-forward"
          size={17}
          color={colors.primaryForeground}
        />
      </Pressable>
    </BoardCard>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text
        style={[
          styles.metricValue,
          { color: colors.foreground, fontFamily: DISPLAY },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.metricKicker,
          { color: colors.sage, fontFamily: "Inter_700Bold" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  reviewPanel: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  headline: { fontSize: 19, lineHeight: 23 },
  copy: { fontSize: 12.5, lineHeight: 18 },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  metricCard: {
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
    justifyContent: "center",
  },
  metricValue: { fontSize: 17, lineHeight: 20 },
  metricKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  actionList: { gap: 8, marginTop: 12 },
  actionRow: {
    minHeight: Math.max(92, MIN_MOBILE_TOUCH_TARGET),
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    gap: 10,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1, minWidth: 0, gap: 3 },
  actionTitle: { fontSize: 12.5 },
  actionMeta: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  actionNotes: { fontSize: 11.5, lineHeight: 16 },
  checkList: { gap: 8, marginTop: 12 },
  checkTitle: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  checkText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  boundary: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 12,
  },
  qaButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  qaButtonText: { fontSize: 13 },
});
