import { Ionicons } from "@expo/vector-icons";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { BoardCard, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import type { CareEvidenceSnapshot, EvidenceLane } from "@/lib/careEvidence";
import {
  getAccessibleLayoutMetrics,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";

const LANE_ICONS: Record<EvidenceLane["id"], PixelIconName> = {
  mood: "heart",
  energy: "energy",
  appetite: "meal",
  hydration: "bile",
  stool: "poo",
  activity: "walk",
};

export interface HomeEvidenceCardProps {
  snapshot: CareEvidenceSnapshot;
  onOpenHealth: () => void;
}

export function HomeEvidenceCard({
  snapshot,
  onOpenHealth,
}: HomeEvidenceCardProps) {
  const colors = useColors();
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale } = useWebQaFontScale(runtimeFontScale);
  const layout = getAccessibleLayoutMetrics({
    platform: Platform.OS,
    fontScale,
  });
  const watch = snapshot.lanes.find((lane) => lane.status === "watch");
  const missing = snapshot.lanes.find((lane) => lane.status === "not-logged");
  const prompt = watch ?? missing ?? snapshot.lanes[0];
  const promptTone =
    prompt?.status === "watch" ? colors.amber : colors.mutedForeground;

  return (
    <BoardCard>
      <BoardSectionHeader
        title="Care evidence"
        action={`${snapshot.observedCount} of ${snapshot.totalCount}`}
      />
      <Text
        style={[
          s.summary,
          { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {snapshot.observedCount} of {snapshot.totalCount} observed in{" "}
        {snapshot.windowDays} days
      </Text>
      <Text
        style={[
          s.boundary,
          { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
        ]}
      >
        {"Logged observations only. Missing evidence is not a positive health result."}
      </Text>

      {prompt ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open Health. ${prompt.label}: ${prompt.detail}.`}
          accessibilityHint="Opens the complete care evidence and health review."
          onPress={onOpenHealth}
          style={({ pressed }) => [
            s.prompt,
            layout.stackStatusRows && s.promptReflow,
            {
              minHeight: layout.controlMinHeight,
              backgroundColor: pressed
                ? colors.secondary
                : prompt.status === "watch"
                  ? colors.amberSoft
                  : colors.background,
              borderColor:
                prompt.status === "watch" ? colors.amber + "66" : colors.border,
            },
          ]}
        >
          <View
            style={[
              s.iconBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <PixelIcon name={LANE_ICONS[prompt.id]} size={24} />
          </View>
          <View style={s.copy}>
            <Text
              style={[
                s.promptTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {prompt.label}: {prompt.detail}
            </Text>
            <Text
              style={[
                s.promptDetail,
                { color: promptTone, fontFamily: "Inter_500Medium" },
              ]}
            >
              {prompt.status === "watch"
                ? "Review the recorded observation in Health."
                : prompt.prompt}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.mutedForeground}
            style={layout.stackStatusRows ? s.promptChevronReflow : undefined}
          />
        </Pressable>
      ) : null}
    </BoardCard>
  );
}

const s = StyleSheet.create({
  summary: { fontSize: 17, lineHeight: 22 },
  boundary: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  prompt: {
    minHeight: 68,
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptReflow: {
    alignItems: "stretch",
    flexDirection: "column",
    paddingVertical: 12,
  },
  promptChevronReflow: {
    alignSelf: "flex-end",
  },
  iconBox: {
    width: MIN_MOBILE_TOUCH_TARGET,
    height: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  promptTitle: { fontSize: 13.5, lineHeight: 18 },
  promptDetail: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
});
