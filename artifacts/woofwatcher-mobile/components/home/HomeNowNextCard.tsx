import { Ionicons } from "@expo/vector-icons";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  BoardActionButton,
  BoardCard,
  BoardPill,
  BoardSectionHeader,
} from "@/components/board/BoardPrimitives";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import {
  getAccessibleLayoutMetrics,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";

export type HomeNowItemKind =
  | "meal-outcome"
  | "walk-session"
  | "alone-session";

export interface HomeNowItem {
  id: string;
  kind: HomeNowItemKind;
  label: string;
  detail: string;
  icon: PixelIconName;
  actionLabel: string;
}

export interface HomeNextItem {
  id: string;
  label: string;
  detail: string;
  icon: PixelIconName;
  actionLabel: string;
  statusLabel: string;
}

export interface HomeNowNextCardProps {
  nowItems: readonly HomeNowItem[];
  nextItem: HomeNextItem | null;
  hasConfiguredRoutines: boolean;
  remainingCount: number;
  onOpenNow: (item: HomeNowItem) => void;
  onStartNext: (item: HomeNextItem) => void;
  onSnoozeNext: (item: HomeNextItem) => void;
  onOpenPlan: () => void;
}

export function HomeNowNextCard({
  nowItems,
  nextItem,
  hasConfiguredRoutines,
  remainingCount,
  onOpenNow,
  onStartNext,
  onSnoozeNext,
  onOpenPlan,
}: HomeNowNextCardProps) {
  const colors = useColors();
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale } = useWebQaFontScale(runtimeFontScale);
  const layout = getAccessibleLayoutMetrics({
    platform: Platform.OS,
    fontScale,
  });

  return (
    <BoardCard>
      <BoardSectionHeader
        title="Now & Next"
        accessory={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Plan"
            onPress={onOpenPlan}
            style={({ pressed }) => [
              s.planLink,
              { minHeight: layout.controlMinHeight },
              { opacity: pressed ? 0.62 : 1 },
            ]}
          >
            <Text
              style={[
                s.planLinkText,
                { color: colors.forest, fontFamily: "Inter_700Bold" },
              ]}
            >
              Plan
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.forest} />
          </Pressable>
        }
      />

      {nowItems.length ? (
        <View style={s.nowList}>
          {nowItems.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.actionLabel} ${item.label}. ${item.detail}`}
              onPress={() => onOpenNow(item)}
              style={({ pressed }) => [
                s.nowRow,
                layout.stackStatusRows && s.nowRowReflow,
                {
                  minHeight: Math.max(72, layout.controlMinHeight),
                  backgroundColor: pressed
                    ? colors.secondary
                    : colors.amberSoft,
                  borderColor: colors.amber + "66",
                },
              ]}
            >
              <View
                style={[
                  s.iconBox,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <PixelIcon name={item.icon} size={24} />
              </View>
              <View style={s.copy}>
                <Text
                  style={[
                    s.eyebrow,
                    { color: colors.amber, fontFamily: "Inter_800ExtraBold" },
                  ]}
                >
                  NOW
                </Text>
                <Text
                  style={[
                    s.title,
                    {
                      color: colors.foreground,
                      fontFamily: "Fredoka_600SemiBold",
                    },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    s.detail,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {item.detail}
                </Text>
              </View>
              <Text
                style={[
                  s.rowAction,
                  layout.stackStatusRows && s.rowActionReflow,
                  { color: colors.forest, fontFamily: "Inter_700Bold" },
                ]}
              >
                {item.actionLabel}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View
          style={[
            s.calmNow,
            layout.stackStatusRows && s.calmNowReflow,
            { minHeight: layout.controlMinHeight },
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={colors.mutedForeground}
          />
          <Text
            style={[
              s.calmNowText,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              },
            ]}
          >
            No open care loop. Log care when it happens.
          </Text>
        </View>
      )}

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {nextItem ? (
        <View
          style={[
            s.nextRow,
            layout.stackStatusRows && s.nextRowReflow,
            { minHeight: layout.controlMinHeight },
          ]}
        >
          <View
            style={[
              s.iconBox,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <PixelIcon name={nextItem.icon} size={26} />
          </View>
          <View style={s.copy}>
            <View style={s.nextMetaRow}>
              <Text
                style={[
                  s.eyebrow,
                  { color: colors.sage, fontFamily: "Inter_800ExtraBold" },
                ]}
              >
                NEXT
              </Text>
              <BoardPill label={nextItem.statusLabel} tone={colors.sage} />
            </View>
            <Text
              style={[
                s.title,
                {
                  color: colors.foreground,
                  fontFamily: "Fredoka_600SemiBold",
                },
              ]}
            >
              {nextItem.label}
            </Text>
            <Text
              style={[
                s.detail,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {nextItem.detail}
            </Text>
          </View>
          <View
            style={[
              s.nextActions,
              layout.stackStatusRows && s.nextActionsReflow,
            ]}
          >
            <BoardActionButton
              label={nextItem.actionLabel}
              accessibilityLabel={`${nextItem.actionLabel} ${nextItem.label}`}
              onPress={() => onStartNext(nextItem)}
              compact
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Snooze ${nextItem.label} for 30 minutes`}
              onPress={() => onSnoozeNext(nextItem)}
              style={({ pressed }) => [
                s.snoozeButton,
                {
                  minHeight: layout.controlMinHeight,
                  backgroundColor: pressed
                    ? colors.muted
                    : colors.secondary,
                },
              ]}
            >
              <Text
                style={[
                  s.snoozeText,
                  { color: colors.navy, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Snooze
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View
          style={[
            s.emptyNext,
            layout.stackStatusRows && s.emptyNextReflow,
            { minHeight: layout.controlMinHeight },
          ]}
        >
          <View style={s.copy}>
            <Text
              style={[
                s.title,
                {
                  color: colors.foreground,
                  fontFamily: "Fredoka_600SemiBold",
                },
              ]}
            >
              {hasConfiguredRoutines
                ? "No routine due next"
                : "Add a routine"}
            </Text>
            <Text
              style={[
                s.detail,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {hasConfiguredRoutines
                ? "Scheduled care is currently snoozed. Open Plan to review it."
                : "No care time is configured. Add the real time and caregiver in Plan."}
            </Text>
          </View>
          <BoardActionButton
            label={hasConfiguredRoutines ? "Open Plan" : "Add routine"}
            accessibilityLabel={
              hasConfiguredRoutines ? "Open Plan" : "Add a routine in Plan"
            }
            onPress={onOpenPlan}
            compact
          />
        </View>
      )}

      {remainingCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${remainingCount} more ${remainingCount === 1 ? "routine" : "routines"} in Plan`}
          onPress={onOpenPlan}
          style={({ pressed }) => [
            s.moreRow,
            { minHeight: layout.controlMinHeight },
            { opacity: pressed ? 0.62 : 1 },
          ]}
        >
          <Text
            style={[
              s.moreText,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
          >
            {remainingCount} more in Plan
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.mutedForeground}
          />
        </Pressable>
      ) : null}
    </BoardCard>
  );
}

const s = StyleSheet.create({
  planLink: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  planLinkText: { fontSize: 12 },
  nowList: { gap: 8 },
  nowRow: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 15,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nowRowReflow: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  rowActionReflow: {
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  calmNow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calmNowReflow: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  calmNowText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, letterSpacing: 1.15 },
  title: { fontSize: 16.5, lineHeight: 21, marginTop: 2 },
  detail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  rowAction: { fontSize: 12 },
  divider: { height: 1, marginVertical: 12 },
  nextRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextRowReflow: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  nextMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
  },
  nextActions: { alignItems: "stretch", gap: 4 },
  nextActionsReflow: {
    width: "100%",
    gap: 8,
  },
  snoozeButton: {
    minHeight: 32,
    borderRadius: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  snoozeText: { fontSize: 11 },
  emptyNext: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyNextReflow: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  moreRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  moreText: { fontSize: 12 },
});
