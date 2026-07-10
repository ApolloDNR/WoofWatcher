import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deriveHealthWatch, normalizeCareEventType } from "@workspace/care-domain";

import {
  BoardCard,
  BoardMetricTile,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
} from "@/components/board/BoardPrimitives";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { CARE_TWIN_ROOM_VARIANT_ASSETS, getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import {
  buildHealthReviewPacketShareText,
  deriveHealthReviewPacket,
  type HealthReviewPacketAction,
} from "@/lib/healthReviewPacket";
import {
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { resolvePetName } from "@/lib/petIdentity";
import { pixelImageStyle } from "@/lib/pixelRendering";
import { shareTextPayload } from "@/lib/shareText";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const HEALTH_WATCH_STAGE_ROOM = CARE_TWIN_ROOM_VARIANT_ASSETS.healthWatch.source;
const HEALTH_WATCH_STAGE_SPRITE = getCareTwinSpriteAsset("health-watch");
const HEALTH_WATCH_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["health-watch"];

type HealthTab = "health" | "bile";

function HealthHeaderAction({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={MOBILE_INLINE_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [
        s.healthHeaderAction,
        {
          backgroundColor: pressed ? colors.secondary : colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[s.healthHeaderActionText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function entryText(entry: { title?: string; note?: string; details?: { [key: string]: unknown } }): string {
  const details = entry.details
    ? Object.values(entry.details)
        .filter((value): value is string => typeof value === "string")
        .join(" ")
    : "";
  return `${entry.title ?? ""} ${entry.note ?? ""} ${details}`.toLowerCase();
}

function isYellowBile(entry: { type: string; title?: string; note?: string; details?: { [key: string]: unknown } }): boolean {
  const type = normalizeCareEventType(entry.type, entry.details);
  const text = entryText(entry);
  return type === "vomit" && (text.includes("bile") || (text.includes("yellow") && text.includes("vomit")));
}

function daysBetween(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 86400000;
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3600000;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "None logged";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sameCalendarDay(iso: string, date: Date): boolean {
  const event = new Date(iso);
  return (
    event.getFullYear() === date.getFullYear() &&
    event.getMonth() === date.getMonth() &&
    event.getDate() === date.getDate()
  );
}

function clampScore(value: number): number {
  return Math.max(52, Math.min(98, Math.round(value)));
}

function healthScore(input: {
  status: "good" | "watch" | "alert";
  vomit7: number;
  appetiteWatch7: number;
  stoolWatch7: number;
  anxiety7: number;
  redFlags: number;
}): number {
  const base = input.status === "good" ? 94 : input.status === "watch" ? 84 : 72;
  const penalty =
    input.vomit7 * 5 +
    input.appetiteWatch7 * 4 +
    input.stoolWatch7 * 5 +
    input.anxiety7 * 3 +
    input.redFlags * 10;
  return clampScore(base - penalty);
}

function statusActionLabel(type: string): string {
  if (type === "walk") return "Log activity";
  if (type === "meal") return "Log appetite";
  if (type === "potty") return "Log potty";
  if (type === "water") return "Log water";
  if (type === "mood") return "Log energy";
  return "Log details";
}

export default function HealthScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const now = Date.now();
  const scrollRef = useRef<ScrollView>(null);
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const requestedTab: HealthTab = tabParam === "bile" ? "bile" : "health";
  const [activeTab, setActiveTab] = useState<HealthTab>(() => requestedTab);
  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const isWebRoutePreview = (Platform.OS as string) === "web";
  const routeHorizontalPadding = 16;

  const healthWatch = useMemo(
    () => deriveHealthWatch({ entries: state.entries, routines: state.routines, now }),
    [state.entries, state.routines, now],
  );

  const bileEntries = useMemo(
    () =>
      state.entries
        .filter((entry) => daysBetween(entry.occurredAt, now) <= 7 && isYellowBile(entry))
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [state.entries, now],
  );

  const mealGaps = useMemo(() => {
    const meals = state.entries
      .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "meal")
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    let longest = 0;
    for (let i = 1; i < meals.length; i += 1) {
      longest = Math.max(longest, hoursBetween(meals[i - 1].occurredAt, meals[i].occurredAt));
    }
    return longest;
  }, [state.entries]);

  const bileTrend = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const count = bileEntries.filter((entry) => sameCalendarDay(entry.occurredAt, date)).length;
      return {
        label: formatter.format(date).slice(0, 1),
        count,
      };
    });
  }, [bileEntries, now]);

  const healthRhythm = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const dayEntries = state.entries.filter((entry) => sameCalendarDay(entry.occurredAt, date));
      const careLogs = dayEntries.filter((entry) =>
        ["meal", "walk", "potty", "water", "medication", "training"].includes(
          normalizeCareEventType(entry.type, entry.details),
        ),
      ).length;
      const watchSignals = dayEntries.filter((entry) =>
        ["vomit", "symptom", "incident"].includes(normalizeCareEventType(entry.type, entry.details)),
      ).length;
      // Days with zero logs stay neutral: no data should never render as a
      // full green "all good" bar.
      const hasData = dayEntries.length > 0;
      const value = hasData ? Math.max(0.18, Math.min(1, 0.34 + careLogs * 0.1 - watchSignals * 0.18)) : 0;

      return {
        label: formatter.format(date).slice(0, 1),
        value,
        hasData,
        tone: !hasData
          ? colors.muted
          : watchSignals
            ? (watchSignals > 1 ? colors.rose : colors.amber)
            : colors.sage,
      };
    });
  }, [colors.amber, colors.muted, colors.rose, colors.sage, now, state.entries]);

  const bileStatus =
    healthWatch.status === "alert"
      ? "Review"
      : bileEntries.length || healthWatch.counts.vomit7
        ? "Watch"
        : "Low Risk";
  const bileTone =
    bileStatus === "Review" ? colors.rose : bileStatus === "Watch" ? colors.amber : colors.sage;
  const score = healthScore({
    status: healthWatch.status,
    vomit7: healthWatch.counts.vomit7,
    appetiteWatch7: healthWatch.counts.appetiteWatch7,
    stoolWatch7: healthWatch.counts.stoolWatch7,
    anxiety7: healthWatch.counts.anxiety7,
    redFlags: healthWatch.redFlags.length,
  });
  const scoreTone = score >= 88 ? colors.sage : score >= 76 ? colors.amber : colors.rose;
  const heroTitle =
    healthWatch.status === "good"
      ? "Stable right now"
      : healthWatch.status === "alert"
        ? "Review needed"
        : "Worth watching";
  const heroCopy =
    healthWatch.status === "good"
      ? "No active Health Watch signals are showing in the current window."
      : healthWatch.summary;
  const statusMedallionLabel = score >= 88 ? "GOOD" : score >= 76 ? "WATCH" : "REVIEW";
  const statusSupportCopy =
    healthWatch.status === "good"
      ? "You're on a roll. Keep the daily rhythm steady and share patterns when they matter."
      : healthWatch.status === "alert"
        ? "Consider sharing these observations with your vet, especially if patterns repeat."
        : "Pattern noticed. Keep logging food, stool, vomiting, energy, and timing.";
  const reviewCopy =
    healthWatch.status === "good"
      ? "Keep logging meals, stool, vomiting, energy, and medication so future changes are easy to review."
      : "Capture timing, food context, energy, stool detail, and repeat events before sharing with your vet.";

  const isBileTab = activeTab === "bile";
  const heroBubbleTitle = isBileTab
    ? bileStatus === "Low Risk"
      ? "Bile looks calm."
      : "Watching bile gently."
    : healthWatch.status === "good"
      ? "Feeling steady."
      : "Let's take it easy.";
  const heroBubbleCopy = isBileTab
    ? "Bile Watch records patterns calmly."
    : "Health Watch records patterns calmly.";
  const snapshotTitle = isBileTab ? "Bile Snapshot" : "Health Snapshot";
  const heroStatusKicker = isBileTab ? "BILE STATUS" : "CARE STATUS";
  const heroPanelTitle = isBileTab
    ? bileStatus === "Review"
      ? "Bile worth review"
      : bileStatus === "Watch"
        ? "Bile worth watching"
        : "Bile looks low risk"
    : heroTitle;
  const heroPanelCopy = isBileTab
    ? "Yellow bile events are tracked as calm owner notes, not diagnoses."
    : heroCopy;

  const healthRows: {
    label: string;
    status: string;
    detail: string;
    icon: PixelIconName;
    tone: string;
    routeType: string;
    actionLabel: string;
  }[] = [
    {
      label: "Activity",
      status: "Good",
      detail: "Active daily",
      icon: "walk",
      tone: colors.sage,
      routeType: "walk",
      actionLabel: statusActionLabel("walk"),
    },
    {
      label: "Appetite",
      status: healthWatch.counts.appetiteWatch7 ? "Watch" : "Good",
      detail: healthWatch.counts.appetiteWatch7 ? `${healthWatch.counts.appetiteWatch7} reduced meals` : "Eating well",
      icon: "meal",
      tone: healthWatch.counts.appetiteWatch7 ? colors.amber : colors.sage,
      routeType: "meal",
      actionLabel: statusActionLabel("meal"),
    },
    {
      label: "Stool",
      status: healthWatch.counts.stoolWatch7 ? "Watch" : "Normal",
      detail: healthWatch.counts.stoolWatch7 ? `${healthWatch.counts.stoolWatch7} review logs` : "Solid and healthy",
      icon: "poo",
      tone: healthWatch.counts.stoolWatch7 ? colors.amber : colors.sage,
      routeType: "potty",
      actionLabel: statusActionLabel("potty"),
    },
    {
      label: "Hydration",
      status: "Good",
      detail: "Well hydrated",
      icon: "bile",
      tone: colors.blueSignal,
      routeType: "water",
      actionLabel: statusActionLabel("water"),
    },
    {
      label: "Energy",
      status: healthWatch.status === "good" ? "Good" : "Watch",
      detail: healthWatch.status === "good" ? "High and playful" : "Worth watching",
      icon: "energy",
      tone: healthWatch.status === "good" ? colors.sage : colors.amber,
      routeType: "mood",
      actionLabel: statusActionLabel("mood"),
    },
    {
      label: "Vomiting",
      status: healthWatch.counts.vomit7 ? "Watch" : "None",
      detail: healthWatch.counts.vomit7 ? `${healthWatch.counts.vomit7} in 7 days` : "No logs",
      icon: "vomit",
      tone: healthWatch.counts.vomit7 ? colors.amber : colors.sage,
      routeType: "symptom",
      actionLabel: statusActionLabel("symptom"),
    },
  ];
  const healthReviewPacket = deriveHealthReviewPacket({
    dogName: resolvePetName(state.profile.name),
    healthStatus: healthWatch.status,
    healthSummary: healthWatch.summary,
    healthCounts: {
      vomit7: healthWatch.counts.vomit7,
      appetiteWatch7: healthWatch.counts.appetiteWatch7,
      stoolWatch7: healthWatch.counts.stoolWatch7,
      anxiety7: healthWatch.counts.anxiety7,
    },
    redFlagCount: healthWatch.redFlags.length,
    bileStatus,
    lastYellowBileLabel: formatDateTime(bileEntries[0]?.occurredAt),
    longestFoodGapLabel: mealGaps ? `${mealGaps.toFixed(1)} hours` : "Needs more meal logs",
    bedtimeSnackLabel: state.dietProfile.bedtimeSnack || "Not set",
  });

  function openHealthReviewAction(action: HealthReviewPacketAction): void {
    if (action.route.startsWith("/log?")) {
      router.push(action.route as never);
      return;
    }
    if (action.route === "/woofguide") {
      router.push({ pathname: "/woofguide", params: action.params ?? {} } as never);
      return;
    }
    router.push(action.route);
  }

  function openHealthStatusRoute(type: string): void {
    router.push(`/log?type=${type}&detail=1&intent=${Date.now()}` as never);
  }

  async function shareHealthReviewPacket(): Promise<void> {
    await shareTextPayload({
      message: buildHealthReviewPacketShareText(healthReviewPacket, {
        dogName: resolvePetName(state.profile.name),
        generatedAtIso: new Date(now).toISOString(),
      }),
      title: "WoofWatcher Health Review Packet",
    });
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={s.container}
        contentContainerStyle={{
          paddingTop: getRouteTopPadding({
            platform: Platform.OS,
            topInset: insets.top,
            surface: "tabbed",
          }),
          paddingBottom: bottomPadding,
          paddingHorizontal: routeHorizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          kicker="Health"
          title="Health Watch"
          subtitle="Owner notes. No diagnosis."
          icon="heart-outline"
          actionIcon="folder-open-outline"
          actionLabel="Open Records from Health Watch"
          onAction={() => router.push("/records")}
          plain
          style={s.routeHeaderCompact}
        />

        <View style={[s.tabRail, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { key: "health" as const, label: "Health" },
            { key: "bile" as const, label: "Bile Watch" },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${tab.label}`}
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  s.tabPill,
                  {
                    backgroundColor: active ? colors.brandNavy : "transparent",
                    borderColor: active ? colors.brandNavy : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    s.tabText,
                    {
                      color: active ? colors.ivory : colors.navy,
                      fontFamily: active ? "Inter_700Bold" : "Inter_600SemiBold",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isBileTab ? (
          <BoardCard style={s.bileCard}>
            <View style={s.sectionTop}>
              <BoardSectionHeader title="Bile Watch" style={s.boardSectionTop} />
              <BoardPill label={bileStatus} icon="water-outline" tone={bileTone} />
            </View>

            <View style={[s.bilePanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[s.bileMedallion, { backgroundColor: bileTone + "16", borderColor: bileTone + "55" }]}>
                <PixelIcon name="bile" size={34} />
                <Text style={[s.bileMedallionText, { color: bileTone, fontFamily: "Inter_700Bold" }]}>
                  {bileStatus}
                </Text>
              </View>
              <View style={s.bileTrendArea}>
                <Text style={[s.bileTrendTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  7-day bile log
                </Text>
                <Text style={[s.bileTrendCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Yellow bile events are tracked as owner notes, not diagnoses.
                </Text>
                <View style={s.bileBars}>
                  {bileTrend.map((day, index) => {
                    const active = day.count > 0;
                    return (
                      <View key={`${day.label}-${index}`} style={s.bileBarColumn}>
                        <View
                          style={[
                            s.bileBar,
                            {
                              height: active ? Math.min(34, 14 + day.count * 8) : 8,
                              backgroundColor: active ? bileTone : colors.sage + "33",
                              borderColor: active ? bileTone : colors.border,
                            },
                          ]}
                        />
                        <Text style={[s.bileBarLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                          {day.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={s.metricGrid}>
              <BoardMetricTile
                icon="bile"
                label="Last yellow bile event"
                value={formatDateTime(bileEntries[0]?.occurredAt)}
                tone={bileTone}
                style={s.metricHalf}
              />
              <BoardMetricTile
                icon="meal"
                label="Longest food gap"
                value={mealGaps ? `${mealGaps.toFixed(1)} hours` : "Needs more meal logs"}
                tone={colors.copper}
                style={s.metricHalf}
              />
              <BoardMetricTile
                icon="treat"
                label="Bedtime snack proof"
                value={state.dietProfile.bedtimeSnack || "Not set"}
                tone={colors.amber}
                style={s.metricHalf}
              />
              <BoardMetricTile
                icon="vomit"
                label="7-day trend"
                value={`${healthWatch.counts.vomit7} vomit logs`}
                tone={colors.rose}
                style={s.metricHalf}
              />
            </View>
          </BoardCard>
        ) : null}

        <BoardCard style={s.heroCard}>
          <ImageBackground
            source={HEALTH_WATCH_STAGE_ROOM}
            resizeMode="cover"
            imageStyle={[s.healthStageImage, pixelImageStyle]}
            style={s.healthStage}
          >
            <View style={s.healthStageShade} />
            <View style={s.healthStageTop}>
              <View style={s.healthStageBubble}>
                <Text style={[s.healthStageBubbleTitle, { color: colors.brandNavy, fontFamily: DISPLAY_SEMI }]}>
                  {heroBubbleTitle}
                </Text>
                <Text style={[s.healthStageBubbleCopy, { color: colors.brandNavy, fontFamily: "Inter_700Bold" }]}>
                  {heroBubbleCopy}
                </Text>
                <View style={s.healthStageBubbleTail} />
              </View>
              <View style={[s.healthStageChip, { backgroundColor: colors.brandNavy + "DD", borderColor: colors.ivory + "55" }]}>
                <PixelIcon name="health" size={16} />
                <Text style={[s.healthStageChipText, { color: colors.ivory, fontFamily: "Inter_700Bold" }]}>
                  {statusMedallionLabel}
                </Text>
              </View>
            </View>
            <View pointerEvents="none" style={s.healthStageSprite}>
              <View style={s.healthStageSpriteShadow} />
              <SpriteSheetPlayer
                asset={HEALTH_WATCH_STAGE_SPRITE}
                track={HEALTH_WATCH_STAGE_TRACK}
                width={104}
                height={104}
                testID="health-watch-pixel-sprite"
              />
            </View>
          </ImageBackground>

          <View style={[s.healthHeroPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <BoardSectionHeader
              title={snapshotTitle}
              style={s.healthSnapshotHeader}
              accessory={
                <HealthHeaderAction
                  label="7-day view"
                  accessibilityLabel="Show Health 7-day rhythm"
                  onPress={() => {
                    setActiveTab("health");
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  }}
                />
              }
            />
            <View style={s.healthHeroStatusRow}>
              <View style={[s.healthScoreToken, { backgroundColor: scoreTone + "14", borderColor: scoreTone + "66" }]}>
                <Text style={[s.healthScoreValue, { color: scoreTone, fontFamily: DISPLAY }]}>{score}</Text>
                <Text style={[s.healthScoreLabel, { color: colors.mutedForeground, fontFamily: "Inter_800ExtraBold" }]}>
                  Health score
                </Text>
              </View>

              <View style={s.healthHeroCopyStack}>
                <Text style={[s.heroLabel, { color: colors.copper, fontFamily: DISPLAY_SEMI }]}>{heroStatusKicker}</Text>
                <Text style={[s.heroTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>{heroPanelTitle}</Text>
                <Text style={[s.heroCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {heroPanelCopy}
                </Text>
                <View style={[s.statusScoreTrack, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <View style={[s.statusScoreFill, { width: `${score}%`, backgroundColor: scoreTone }]} />
                </View>
                <Text style={[s.statusSupportCopy, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {statusSupportCopy}
                </Text>
              </View>
            </View>

            {activeTab === "health" ? (
              <>
                <View style={[s.healthRhythmPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={s.healthRhythmHeader}>
                    <Text style={[s.healthRhythmTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                      7-day rhythm
                    </Text>
                    <Text style={[s.healthRhythmMeta, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                      Owner log signal
                    </Text>
                  </View>
                  <View style={s.healthRhythmBars}>
                    {healthRhythm.map((day, index) => (
                      <View key={`${day.label}-${index}`} style={s.healthRhythmColumn}>
                        <View
                          style={[
                            s.healthRhythmBar,
                            {
                              height: day.hasData ? 8 + Math.round(day.value * 22) : 8,
                              backgroundColor: day.tone,
                              borderColor: day.hasData ? day.tone : colors.border,
                            },
                          ]}
                        />
                        <Text style={[s.healthRhythmLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                          {day.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={s.healthSignalList}>
                  {healthRows.slice(0, 4).map((row) => (
                    <Pressable
                      key={row.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.label}. ${row.status}. ${row.detail}. ${row.actionLabel}`}
                      onPress={() => openHealthStatusRoute(row.routeType)}
                      style={({ pressed }) => [
                        s.healthSignalRow,
                        {
                          backgroundColor: pressed ? row.tone + "10" : colors.background,
                          borderColor: pressed ? row.tone + "77" : colors.border,
                        },
                      ]}
                    >
                      <View style={[s.statusIcon, { backgroundColor: row.tone + "16" }]}>
                        <PixelIcon name={row.icon} size={24} />
                      </View>
                      <View style={s.healthSignalCopy}>
                        <View style={s.healthSignalTitleLine}>
                          <Text style={[s.healthSignalTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                            {row.label}
                          </Text>
                          <Text style={[s.healthSignalStatus, { color: row.tone, fontFamily: DISPLAY_SEMI }]}>{row.status}</Text>
                        </View>
                        <Text style={[s.healthSignalDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {row.detail}
                        </Text>
                      </View>
                      <View style={[s.healthSignalActionPill, { backgroundColor: row.tone + "10", borderColor: row.tone + "44" }]}>
                        <Text style={[s.healthSignalAction, { color: row.tone, fontFamily: "Inter_800ExtraBold" }]}>
                          Log
                        </Text>
                        <Text style={[s.healthSignalActionArrow, { color: row.tone, fontFamily: "Inter_800ExtraBold" }]}>
                          {">"}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>

          <View style={s.healthActionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log a health note"
              onPress={() => openHealthStatusRoute("note")}
              style={({ pressed }) => [
                s.heroActionPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[s.heroActionPrimaryText, { fontFamily: "Inter_700Bold" }]}>Log health note</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open health records"
              onPress={() => router.push("/records")}
              style={({ pressed }) => [
                s.heroActionSecondary,
                {
                  backgroundColor: pressed ? colors.secondary : colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[s.heroActionSecondaryText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Records
              </Text>
            </Pressable>
          </View>
        </BoardCard>

        <BoardCard style={s.sectionCard}>
          <View style={s.reviewPacketTop}>
            <View style={s.reviewPacketTitleStack}>
              <BoardSectionHeader title="Review packet" style={s.boardSectionTop} />
              <Text style={[s.reviewPacketStatus, { color: scoreTone, fontFamily: DISPLAY_SEMI }]}>
                {healthReviewPacket.statusLabel}
              </Text>
            </View>
            <BoardPill
              label={healthReviewPacket.languagePill}
              icon="medkit-outline"
              tone={
                healthReviewPacket.languagePill === "Review"
                  ? colors.rose
                  : healthReviewPacket.languagePill === "Pattern noticed"
                    ? colors.amber
                    : colors.sage
              }
            />
          </View>

          <Text style={[s.reviewPacketSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {healthReviewPacket.summary}
          </Text>

          <View style={s.reviewPromptStack}>
            {healthReviewPacket.prompts.slice(0, 2).map((prompt) => (
              <View key={prompt} style={[s.reviewPromptRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[s.reviewPromptBullet, { backgroundColor: colors.sage + "22", borderColor: colors.sage + "55" }]}>
                  <PixelIcon name="health" size={15} />
                </View>
                <Text style={[s.reviewPromptText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {prompt}
                </Text>
              </View>
            ))}
          </View>

          <View style={[s.reviewChecklistPanel, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[s.reviewChecklistTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
              Vet-share checklist
            </Text>
            {healthReviewPacket.vetShareChecklist.slice(0, 3).map((item) => (
              <View key={item} style={s.reviewChecklistRow}>
                <Text style={[s.reviewChecklistMark, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>+</Text>
                <Text style={[s.reviewChecklistText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>

          <View style={[s.reviewPacketBoundary, { backgroundColor: colors.background, borderColor: colors.sage + "55" }]}>
            <PixelIcon name="health" size={20} />
            <Text style={[s.reviewPacketBoundaryText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {healthReviewPacket.boundary}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share health review"
            onPress={shareHealthReviewPacket}
            style={({ pressed }) => [
              s.reviewPacketShare,
              {
                backgroundColor: pressed ? colors.secondary : colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[s.reviewPacketShareText, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
              Share review
            </Text>
          </Pressable>

          <View style={s.reviewPacketActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={healthReviewPacket.primaryAction.label}
              onPress={() => openHealthReviewAction(healthReviewPacket.primaryAction)}
              style={({ pressed }) => [
                s.reviewPacketPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[s.reviewPacketPrimaryText, { fontFamily: "Inter_700Bold" }]}>
                {healthReviewPacket.primaryAction.label}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Draft vet questions"
              onPress={() => openHealthReviewAction(healthReviewPacket.secondaryAction)}
              style={({ pressed }) => [
                s.reviewPacketSecondary,
                {
                  backgroundColor: pressed ? colors.secondary : colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[s.reviewPacketSecondaryText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Draft vet questions
              </Text>
            </Pressable>
          </View>
        </BoardCard>

        <BoardCard style={s.sectionCard}>
          <BoardSectionHeader
            title="Pattern Board"
            accessory={
              healthWatch.patterns.length ? (
                <HealthHeaderAction
                  label="Owner notes"
                  accessibilityLabel="Open health owner notes"
                  onPress={() => openHealthStatusRoute("note")}
                />
              ) : undefined
            }
          />
          <View style={[s.reviewPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[s.reviewTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
              {healthWatch.status === "good" ? "Care rhythm looks steady" : "Next best review step"}
            </Text>
            <Text style={[s.reviewCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {reviewCopy}
            </Text>
          </View>
          {healthWatch.patterns.slice(0, 4).map((pattern) => (
            <View key={pattern.kind} style={[s.patternRow, { borderTopColor: colors.border }]}>
              <View style={s.patternTitleRow}>
                <Text style={[s.patternTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {pattern.label}
                </Text>
                <BoardPill
                  label={pattern.status === "good" ? "Steady" : pattern.status === "alert" ? "Review" : "Watch"}
                  tone={pattern.status === "alert" ? colors.rose : pattern.status === "watch" ? colors.amber : colors.sage}
                />
              </View>
              <Text style={[s.patternCopy, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {pattern.evidence}
              </Text>
              <Text style={[s.patternStep, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
                {pattern.nextStep}
              </Text>
            </View>
          ))}
        </BoardCard>

        <View style={[s.boundaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.boundaryLabel, { color: colors.copper, fontFamily: DISPLAY_SEMI }]}>CARE BOUNDARY</Text>
          <Text style={[s.boundary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {healthWatch.vetBoundary} Not veterinary advice.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  routeHeaderCompact: {
    marginBottom: 10,
  },
  tabRail: {
    flexDirection: "row",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginBottom: 10,
  },
  tabPill: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 12.5 },

  heroCard: {
    padding: 8,
    marginBottom: 10,
  },
  healthStage: {
    minHeight: 168,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(8,26,42,0.42)",
    overflow: "hidden",
    padding: 9,
    marginBottom: 8,
  },
  healthStageImage: {
    borderRadius: 8,
  },
  healthStageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,26,42,0.08)",
  },
  healthStageTop: {
    position: "relative",
    zIndex: 5,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  healthStageBubble: {
    maxWidth: "58%",
    minHeight: 46,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: "#081A2A",
    backgroundColor: "rgba(255,249,239,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  healthStageBubbleTitle: {
    fontSize: 12.5,
    lineHeight: 15,
  },
  healthStageBubbleCopy: {
    fontSize: 9.5,
    lineHeight: 12,
    marginTop: 3,
  },
  healthStageBubbleTail: {
    position: "absolute",
    right: 20,
    bottom: -8,
    width: 14,
    height: 14,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#081A2A",
    backgroundColor: "rgba(255,249,239,0.95)",
    transform: [{ rotate: "-45deg" }],
  },
  healthStageChip: {
    minHeight: 34,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  healthStageChipText: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  healthStageSprite: {
    position: "absolute",
    zIndex: 4,
    // Proportional offset keeps the sleeping sprite centered on the green
    // dog bed baked right-of-center in the stage art at any card width.
    right: "24%",
    bottom: 8,
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  healthStageSpriteShadow: {
    position: "absolute",
    bottom: 12,
    width: 72,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(8,26,42,0.28)",
  },
  healthHeroPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 11,
    gap: 11,
  },
  healthHeroStatusRow: {
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
  },
  healthScoreToken: {
    width: 78,
    minHeight: 84,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  healthScoreValue: {
    fontSize: 30,
    lineHeight: 33,
  },
  healthScoreLabel: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  healthHeroCopyStack: {
    flex: 1,
    minWidth: 0,
  },
  statusScoreTrack: {
    height: 9,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 9,
  },
  statusScoreFill: {
    height: "100%",
    borderRadius: 999,
  },
  statusSupportCopy: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  healthRhythmPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 7,
  },
  healthRhythmHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  healthRhythmTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  healthRhythmMeta: {
    fontSize: 10.5,
    textTransform: "uppercase",
  },
  healthRhythmBars: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    marginTop: 7,
  },
  healthRhythmColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  healthRhythmBar: {
    width: "100%",
    minHeight: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  healthRhythmLabel: {
    fontSize: 9.5,
  },
  heroTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, minWidth: 0 },
  heroLabel: { fontSize: 10.5, letterSpacing: 0.4 },
  heroTitle: { color: "#FFF9EF", fontSize: 24, lineHeight: 27, marginTop: 1 },
  heroCopy: { color: "rgba(255,249,239,0.72)", fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  scoreBadge: {
    width: 62,
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
  },
  scoreValue: { fontSize: 24, lineHeight: 27 },
  scoreLabel: { fontSize: 9, letterSpacing: 0.5, marginTop: 1 },
  healthActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  heroActionPrimary: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActionPrimaryText: { color: "#FFFFFF", fontSize: 13 },
  heroActionSecondary: {
    minWidth: 92,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  heroActionSecondaryText: { color: "#FFF9EF", fontSize: 13 },

  sectionCard: { marginTop: 10 },
  bileCard: { marginBottom: 10 },
  healthSnapshotHeader: {
    marginBottom: 8,
    paddingBottom: 6,
  },
  healthStatusSummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  healthStatusCopy: {
    flex: 1,
    minWidth: 0,
  },
  healthStatusTitle: {
    fontSize: 17,
    lineHeight: 20,
    marginTop: 1,
  },
  healthStatusBody: {
    fontSize: 11.2,
    lineHeight: 15,
    marginTop: 3,
  },
  sectionTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 2 },
  boardSectionTop: { flex: 1, marginBottom: 0 },
  healthHeaderAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  healthHeaderActionText: {
    fontSize: 11.5,
  },
  reviewPacketTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewPacketTitleStack: {
    flex: 1,
    minWidth: 0,
  },
  reviewPacketStatus: {
    fontSize: 17,
    lineHeight: 21,
    marginTop: -4,
  },
  reviewPacketSummary: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 9,
  },
  reviewPromptStack: {
    gap: 7,
    marginTop: 7,
  },
  reviewPromptRow: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewPromptBullet: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPromptText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
  },
  reviewChecklistPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 9,
    marginTop: 9,
  },
  reviewChecklistTitle: {
    fontSize: 13,
    lineHeight: 17,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  reviewChecklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingVertical: 3,
  },
  reviewChecklistMark: {
    width: 14,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  reviewChecklistText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.8,
    lineHeight: 17,
  },
  reviewPacketBoundary: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewPacketBoundaryText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
  },
  reviewPacketShare: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
    paddingHorizontal: 10,
  },
  reviewPacketShareText: {
    fontSize: 13,
    textAlign: "center",
  },
  reviewPacketActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
  },
  reviewPacketPrimary: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  reviewPacketPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
  },
  reviewPacketSecondary: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  reviewPacketSecondaryText: {
    fontSize: 13,
    textAlign: "center",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  metricHalf: {
    flexGrow: 1,
    flexBasis: "47.5%",
    minHeight: 74,
  },

  bilePanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
  },
  bileMedallion: {
    width: 82,
    minHeight: 92,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  bileMedallionText: { fontSize: 11, textTransform: "uppercase" },
  bileTrendArea: { flex: 1, minWidth: 0 },
  bileTrendTitle: { fontSize: 15 },
  bileTrendCopy: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  bileBars: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: 9,
  },
  bileBarColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  bileBar: {
    width: "100%",
    minHeight: 8,
    borderWidth: 1,
    borderRadius: 3,
  },
  bileBarLabel: { fontSize: 9.5 },

  healthSignalList: {
    gap: 6,
    marginTop: 7,
  },
  healthSignalRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusIcon: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  healthSignalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  healthSignalTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  healthSignalTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    lineHeight: 16,
  },
  healthSignalStatus: {
    maxWidth: 72,
    fontSize: 12,
    lineHeight: 15,
    textAlign: "right",
  },
  healthSignalDetail: {
    fontSize: 11,
    lineHeight: 14,
  },
  healthSignalActionPill: {
    width: 52,
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  healthSignalAction: {
    flex: 1,
    minWidth: 0,
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  healthSignalActionArrow: {
    fontSize: 14,
    lineHeight: 16,
  },

  reviewPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 2,
  },
  reviewTitle: { fontSize: 16, lineHeight: 20 },
  reviewCopy: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  patternRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  patternTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  patternTitle: { flex: 1, fontSize: 14 },
  patternCopy: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  patternStep: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  boundaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  boundaryLabel: { fontSize: 10.5, letterSpacing: 0.5 },
  boundary: { fontSize: 12, lineHeight: 18, marginTop: 5 },
});
