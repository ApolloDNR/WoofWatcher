import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { BoardCard, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import {
  getAccessibleLayoutMetrics,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";

export interface HomeStorySummaryProps {
  storyLine: string | null;
  todayCount: number;
  todayXp: number;
  streakDays: number;
  onOpenStory: () => void;
  onOpenAdventure: () => void;
  onOpenHistory: () => void;
}

export function HomeStorySummary({
  storyLine,
  todayCount,
  todayXp,
  streakDays,
  onOpenStory,
  onOpenAdventure,
  onOpenHistory,
}: HomeStorySummaryProps) {
  const colors = useColors();
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale } = useWebQaFontScale(runtimeFontScale);
  const layout = getAccessibleLayoutMetrics({
    platform: Platform.OS,
    fontScale,
  });
  const honestLine =
    storyLine ??
    "No care moments logged yet. Add care when it happens and the story will begin.";

  return (
    <BoardCard>
      <BoardSectionHeader
        title="Today's story"
        action={todayCount > 0 ? `${todayCount} today` : "No moments yet"}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open Story. ${honestLine}`}
        onPress={onOpenStory}
        style={({ pressed }) => [
          s.storyRow,
          layout.stackStatusRows && s.storyRowReflow,
          { minHeight: layout.controlMinHeight, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Image
          source={require("@/assets/board/hero.png")}
          resizeMode="cover"
          style={[
            s.thumb,
            layout.stackStatusRows && s.thumbReflow,
            { borderColor: colors.border },
          ]}
        />
        <View style={s.copy}>
          <Text
            style={[
              s.storyLine,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {honestLine}
          </Text>
          <View style={s.chips}>
            {todayXp > 0 ? (
              <View style={[s.chip, { backgroundColor: colors.amberSoft }]}>
                <Text
                  style={[
                    s.chipText,
                    { color: colors.amber, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  +{todayXp} XP
                </Text>
              </View>
            ) : null}
            {streakDays >= 2 ? (
              <View style={[s.chip, { backgroundColor: colors.sageSoft }]}>
                <Text
                  style={[
                    s.chipText,
                    { color: colors.forest, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {streakDays}-day streak
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={17}
          color={colors.mutedForeground}
          style={layout.stackStatusRows ? s.storyChevronReflow : undefined}
        />
      </Pressable>

      <View
        style={[s.actions, layout.stackStatusRows && s.actionsReflow]}
      >
        {[
          {
            label: "Open Story",
            icon: "book-outline" as const,
            onPress: onOpenStory,
          },
          {
            label: "Adventure",
            icon: "map-outline" as const,
            onPress: onOpenAdventure,
          },
          {
            label: "History",
            icon: "time-outline" as const,
            onPress: onOpenHistory,
          },
        ].map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [
              s.action,
              layout.stackStatusRows && s.actionReflow,
              {
                minHeight: layout.controlMinHeight,
                backgroundColor: pressed ? colors.secondary : colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name={action.icon} size={17} color={colors.forest} />
            <Text
              numberOfLines={layout.actionLabelNumberOfLines}
              style={[
                s.actionText,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BoardCard>
  );
}

const s = StyleSheet.create({
  storyRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storyRowReflow: {
    alignItems: "stretch",
    flexDirection: "column",
    paddingVertical: 8,
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 17,
    borderWidth: 1,
  },
  thumbReflow: {
    width: "100%",
    height: 96,
  },
  storyChevronReflow: {
    alignSelf: "flex-end",
  },
  copy: { flex: 1, minWidth: 0 },
  storyLine: { fontSize: 14, lineHeight: 20 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 10.5 },
  actions: { flexDirection: "row", gap: 7, marginTop: 12 },
  actionsReflow: {
    flexWrap: "wrap",
  },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 7,
  },
  actionReflow: {
    flexBasis: "48%",
  },
  actionText: { fontSize: 11.5, textAlign: "center" },
});
