import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { BoardMedallion, hasMedallion } from "@/components/BoardMedallion";
import { PressScale } from "@/components/motion/GameFeel";
import { PixelIcon } from "@/components/PixelIcon";
import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import {
  getAccessibleLayoutMetrics,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import type { QuickLogAction } from "@/lib/quickLogPolicy";

import type { QuickLogController } from "./useQuickLogController";

interface QuickLogGridProps {
  controller: QuickLogController;
  variant: "compact" | "expanded";
  showFeedback?: boolean;
  showFailure?: boolean;
}

function actionHint(action: QuickLogAction) {
  if (action.detailRequired) return "Opens details before saving.";
  if (action.type === "walk") {
    return "Starts a walk session, or opens the active walk. Long press opens details.";
  }
  return "Saves the truthful quick log. Long press opens details.";
}

export function QuickLogGrid({
  controller,
  variant,
  showFeedback = false,
  showFailure = true,
}: QuickLogGridProps) {
  const colors = useColors();
  const compact = variant === "compact";
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale } = useWebQaFontScale(runtimeFontScale);
  const layout = getAccessibleLayoutMetrics({
    platform: Platform.OS,
    fontScale,
  });

  return (
    <View>
      <View style={[s.grid, compact ? s.compactGrid : s.expandedGrid]}>
        {controller.actions.map((action) => {
          const justLogged = controller.feedback?.action.key === action.key;
          return (
            <PressScale
              key={action.key}
              testID={`quick-log-action-${action.key}`}
              accessibilityRole="button"
              accessibilityLabel={
                action.detailRequired
                  ? `Add ${action.label} details`
                  : `Log ${action.label}`
              }
              accessibilityHint={actionHint(action)}
              disabled={controller.undoing}
              onPress={() => controller.press(action)}
              onLongPress={() => controller.openDetails(action)}
              scaleTo={0.94}
              haptic="none"
              containerStyle={
                [
                  compact ? s.compactTileLayout : s.expandedTileLayout,
                  { width: layout.quickActionWidth },
                ]
              }
              style={[
                compact ? s.compactTile : s.expandedTile,
                { minHeight: layout.quickActionMinHeight },
                !compact && {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: colors.navy,
                },
                controller.undoing && { opacity: 0.55 },
              ]}
            >
              {justLogged ? (
                <View
                  style={[
                    s.loggedBadge,
                    { backgroundColor: colors.sage },
                  ]}
                >
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              ) : null}
              {compact && hasMedallion(action.icon) ? (
                <BoardMedallion name={action.icon} size={52} />
              ) : compact ? (
                <View
                  style={[
                    s.compactIcon,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <PixelIcon name={action.icon} size={25} />
                </View>
              ) : (
                <PixelIcon name={action.icon} size={34} />
              )}
              <Text
                numberOfLines={layout.actionLabelNumberOfLines}
                style={[
                  compact ? s.compactLabel : s.expandedLabel,
                  {
                    color: compact ? colors.navy : colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {action.label}
              </Text>
            </PressScale>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          controller.aloneActive
            ? "Open active Alone Time return check-in"
            : "Start Alone Time"
        }
        accessibilityHint="Tracks when your dog is home alone and keeps a return check-in open."
        disabled={controller.undoing}
        onPress={controller.pressAlone}
        style={({ pressed }) => [
          s.aloneAction,
          {
            minHeight: layout.controlMinHeight,
            backgroundColor: pressed ? colors.secondary : colors.card,
            borderColor: controller.aloneActive
              ? colors.amber + "66"
              : colors.border,
            opacity: controller.undoing ? 0.55 : 1,
          },
        ]}
      >
        <View
          style={[
            s.aloneActionIcon,
            {
              backgroundColor: controller.aloneActive
                ? colors.amberSoft
                : colors.secondary,
            },
          ]}
        >
          <PixelIcon name="clock" size={21} />
        </View>
        <View style={s.aloneActionCopy}>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 13,
            }}
          >
            {controller.aloneActive
              ? "Alone Time active"
              : "Start Alone Time"}
          </Text>
          <Text
            numberOfLines={layout.stackStatusRows ? 2 : 1}
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 11,
            }}
          >
            {controller.aloneActive
              ? "Open the return check-in"
              : "Start a truthful away-time session"}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={17}
          color={colors.mutedForeground}
        />
      </Pressable>

      {showFeedback && controller.feedback ? (
        <View
          style={[
            s.feedback,
            {
              backgroundColor: colors.sage + "12",
              borderColor: colors.sage + "44",
            },
          ]}
        >
          <View style={s.feedbackCopy}>
            <Text
              style={[
                s.feedbackTitle,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            >
              {controller.feedback.message}
            </Text>
            <Text
              style={[
                s.feedbackDetail,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {controller.feedbackPersistenceCopy}
            </Text>
          </View>
          <View style={s.feedbackActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Undo ${controller.feedback.action.label}`}
              disabled={controller.undoing}
              onPress={() => void controller.undo()}
              style={[
                s.feedbackButton,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: controller.undoing ? 0.55 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_700Bold",
                }}
              >
                Undo
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add details to ${controller.feedback.action.label}`}
              disabled={controller.undoing}
              onPress={controller.openFeedbackDetails}
              style={[
                s.feedbackButton,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: controller.undoing ? 0.55 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                }}
              >
                Details
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showFailure && controller.failure ? (
        <View
          style={[
            s.failure,
            {
              backgroundColor: colors.amberSoft,
              borderColor: colors.amber + "55",
            },
          ]}
        >
          <Ionicons name="warning-outline" size={18} color={colors.amber} />
          <Text
            selectable
            style={[
              s.failureText,
              {
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
          >
            {controller.failure}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  compactGrid: {
    rowGap: 12,
    marginBottom: 12,
  },
  expandedGrid: {
    rowGap: 12,
    marginBottom: 12,
  },
  aloneAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  aloneActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aloneActionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compactTileLayout: {
    width: "31.5%",
  },
  expandedTileLayout: {
    width: "31.5%",
  },
  compactTile: {
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  expandedTile: {
    width: "100%",
    aspectRatio: 0.92,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  compactIcon: {
    width: 52,
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  compactLabel: {
    fontSize: 12,
  },
  expandedLabel: {
    fontSize: 13,
  },
  loggedBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  feedback: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  feedbackCopy: {
    gap: 3,
  },
  feedbackTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackDetail: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  feedbackActions: {
    flexDirection: "row",
    gap: 8,
  },
  feedbackButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  failure: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  failureText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
