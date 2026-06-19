import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardCard, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { LivingPhoenixRoom, type PhoenixRoomStat } from "@/components/LivingPhoenixRoom";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useColors } from "@/hooks/useColors";
import {
  evaluateCareTwinRuntimeQaScenario,
  listCareTwinRuntimeQaScenarios,
  type CareTwinRuntimeQaResult,
} from "@/lib/careTwinAssets";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

function formatSlug(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function energyForScenario(result: CareTwinRuntimeQaResult): number {
  switch (result.actualNeed) {
    case "rest":
      return 42;
    case "health":
      return 48;
    case "comfort":
      return 55;
    case "activity":
      return 76;
    case "hunger":
      return 64;
    case "hydration":
      return 68;
    default:
      return 82;
  }
}

function iconForNeed(need: CareTwinRuntimeQaResult["actualNeed"]): PixelIconName {
  switch (need) {
    case "activity":
      return "walk";
    case "hunger":
      return "meal";
    case "hydration":
      return "bile";
    case "rest":
      return "clock";
    case "comfort":
      return "heart";
    case "health":
      return "health";
    default:
      return "bond";
  }
}

function readoutsFor(result: CareTwinRuntimeQaResult): PhoenixRoomStat[] {
  const energy = energyForScenario(result);
  return [
    {
      label: "Sprite",
      value: formatSlug(result.actualAction),
      icon: iconForNeed(result.actualNeed),
      progress: result.readiness.spriteReady ? 100 : 0,
    },
    {
      label: "Room",
      value: formatSlug(result.actualRoomVariant),
      icon: "heart",
      progress: result.readiness.roomReady ? 100 : 0,
    },
    {
      label: "Energy",
      value: `${energy}%`,
      icon: "energy",
      progress: energy,
    },
    {
      label: "Need",
      value: formatSlug(result.actualNeed),
      icon: iconForNeed(result.actualNeed),
      progress: result.readiness.layeredReady ? 100 : 50,
    },
  ];
}

function QaBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <View style={[s.badge, { backgroundColor: `${tone}18`, borderColor: `${tone}55` }]}>
      <Text style={[s.badgeText, { color: tone, fontFamily: "Inter_700Bold" }]}>{label}</Text>
    </View>
  );
}

export default function CareTwinQaScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scenarios = useMemo(
    () => listCareTwinRuntimeQaScenarios().map(evaluateCareTwinRuntimeQaScenario),
    [],
  );
  const readyCount = scenarios.filter((result) => result.readiness.layeredReady).length;
  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const bottomInset = Platform.OS === "web" ? 32 : insets.bottom + 18;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[s.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={[s.content, { paddingTop: topInset + 14, paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          kicker="Native QA"
          title="Care Twin State Lab"
          subtitle="Open this route on iOS and Android to review every production Phoenix room state without manually editing care history."
          back
          onBack={() => router.back()}
        />

        <BoardCard style={s.summaryCard}>
          <View style={s.summaryTop}>
            <View style={[s.summaryIcon, { backgroundColor: `${colors.sage}18` }]}>
              <PixelIcon name="heart" size={34} />
            </View>
            <View style={s.summaryCopy}>
              <Text style={[s.summaryTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
                One care twin. Twelve states.
              </Text>
              <Text style={[s.summaryText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Verify sprite action, dogless room, stage crop, phone-size readability, and non-diagnostic tone.
              </Text>
            </View>
          </View>
          <View style={s.summaryGrid}>
            <QaBadge label={`${readyCount}/${scenarios.length} layered`} tone={readyCount === scenarios.length ? colors.sage : colors.amber} />
            <QaBadge label="No fake diagnosis" tone={colors.copper} />
            <QaBadge label="Phone-size review" tone={colors.primary} />
          </View>
        </BoardCard>

        <BoardSectionHeader title="Device Review Matrix" action={`${scenarios.length} scenes`} />

        {scenarios.map((result, index) => {
          const energy = energyForScenario(result);
          const missing = result.readiness.missing.join(", ");

          return (
            <BoardCard key={result.scenario.id} style={s.scenarioCard}>
              <View style={s.scenarioHeader}>
                <View style={s.scenarioTitleRow}>
                  <View style={[s.indexBubble, { backgroundColor: colors.brandNavy }]}>
                    <Text style={[s.indexText, { fontFamily: DISPLAY_SEMI }]}>{index + 1}</Text>
                  </View>
                  <View style={s.scenarioTitleCopy}>
                    <Text style={[s.scenarioTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
                      {result.scenario.label}
                    </Text>
                    <Text style={[s.scenarioSub, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {formatSlug(result.actualAction)} in {formatSlug(result.actualRoomVariant)}
                    </Text>
                  </View>
                </View>
                <QaBadge
                  label={result.readiness.layeredReady ? "Ready" : "Missing"}
                  tone={result.readiness.layeredReady ? colors.sage : colors.rose}
                />
              </View>

              <View style={s.stageFrame} testID={`care-twin-qa-stage-${result.scenario.id}`}>
                <LivingPhoenixRoom
                  mood={result.scenario.motion.avatarMood}
                  motion={result.scenario.motion}
                  speech={result.scenario.motion.speech}
                  energy={energy}
                  presenceLabel="Native QA mode"
                  nextLabel={result.plan.recommendedActionLabel}
                  statusReadouts={readoutsFor(result)}
                />
              </View>

              <View style={s.metaGrid}>
                <MetaItem icon="game-controller-outline" label="Sprite" value={formatSlug(result.actualAction)} />
                <MetaItem icon="home-outline" label="Room" value={formatSlug(result.actualRoomVariant)} />
                <MetaItem icon="locate-outline" label="Zone" value={formatSlug(result.actualZone)} />
                <MetaItem icon="pulse-outline" label="Need" value={formatSlug(result.actualNeed)} />
              </View>

              <View style={[s.promptBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                <Text style={[s.promptLabel, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>
                  QA prompt
                </Text>
                <Text style={[s.promptText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {result.scenario.nativeQaPrompt}
                </Text>
              </View>

              {missing ? (
                <Text style={[s.missingText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>
                  Missing: {missing}
                </Text>
              ) : (
                <Text style={[s.readyText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Layered room and sprite assets are registered for this state.
                </Text>
              )}
            </BoardCard>
          );
        })}
      </ScrollView>
    </>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View style={[s.metaItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Ionicons name={icon} size={14} color={colors.copper} />
      <Text style={[s.metaLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{label}</Text>
      <Text style={[s.metaValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  summaryCard: {
    gap: 14,
  },
  summaryTop: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
  },
  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 19,
    letterSpacing: 0,
  },
  summaryText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0,
  },
  scenarioCard: {
    gap: 13,
  },
  scenarioHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  scenarioTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  indexBubble: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    color: "#FFF9EF",
    fontSize: 14,
  },
  scenarioTitleCopy: {
    flex: 1,
  },
  scenarioTitle: {
    fontSize: 17,
    letterSpacing: 0,
  },
  scenarioSub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  stageFrame: {
    minHeight: 310,
    overflow: "hidden",
    borderRadius: 14,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: {
    flexGrow: 1,
    minWidth: "46%",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 12,
    lineHeight: 16,
  },
  promptBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  promptLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 19,
  },
  missingText: {
    fontSize: 12,
    lineHeight: 17,
  },
  readyText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
