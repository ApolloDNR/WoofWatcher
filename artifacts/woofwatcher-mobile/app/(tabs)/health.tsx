import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type HealthTab = "health" | "bile";

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

export default function HealthScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const now = Date.now();
  const [activeTab, setActiveTab] = useState<HealthTab>("health");

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
  const reviewCopy =
    healthWatch.status === "good"
      ? "Keep logging meals, stool, vomiting, energy, and medication so future changes are easy to review."
      : "Capture timing, food context, energy, stool detail, and repeat events before sharing with your vet.";

  const healthRows: { label: string; status: string; detail: string; icon: PixelIconName; tone: string }[] = [
    { label: "Activity", status: "Good", detail: "Active daily", icon: "walk", tone: colors.sage },
    {
      label: "Appetite",
      status: healthWatch.counts.appetiteWatch7 ? "Watch" : "Good",
      detail: healthWatch.counts.appetiteWatch7 ? `${healthWatch.counts.appetiteWatch7} reduced meals` : "Eating well",
      icon: "meal",
      tone: healthWatch.counts.appetiteWatch7 ? colors.amber : colors.sage,
    },
    {
      label: "Stool",
      status: healthWatch.counts.stoolWatch7 ? "Watch" : "Normal",
      detail: healthWatch.counts.stoolWatch7 ? `${healthWatch.counts.stoolWatch7} review logs` : "Solid and healthy",
      icon: "poo",
      tone: healthWatch.counts.stoolWatch7 ? colors.amber : colors.sage,
    },
    { label: "Hydration", status: "Good", detail: "Well hydrated", icon: "bile", tone: colors.blueSignal },
    {
      label: "Energy",
      status: healthWatch.status === "good" ? "Good" : "Watch",
      detail: healthWatch.status === "good" ? "High and playful" : "Worth watching",
      icon: "energy",
      tone: healthWatch.status === "good" ? colors.sage : colors.amber,
    },
    {
      label: "Vomiting",
      status: healthWatch.counts.vomit7 ? "Watch" : "None",
      detail: healthWatch.counts.vomit7 ? `${healthWatch.counts.vomit7} in 7 days` : "No logs",
      icon: "vomit",
      tone: healthWatch.counts.vomit7 ? colors.amber : colors.sage,
    },
  ];

  const topMetrics = [
    {
      icon: "health" as PixelIconName,
      label: "Health score",
      value: `${score}`,
      detail: "Pattern snapshot",
      tone: scoreTone,
    },
    {
      icon: "bile" as PixelIconName,
      label: "Bile risk",
      value: bileStatus,
      detail: bileEntries[0] ? `Last: ${formatDateTime(bileEntries[0].occurredAt)}` : "No yellow bile logged",
      tone: bileTone,
    },
    {
      icon: "meal" as PixelIconName,
      label: "Food gap",
      value: mealGaps ? `${mealGaps.toFixed(1)}h` : "Learning",
      detail: mealGaps ? "Longest meal gap" : "Needs more meal logs",
      tone: colors.copper,
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: (Platform.OS === "web" ? 24 : insets.top) + 8,
          paddingBottom: 128,
          paddingHorizontal: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          title="Health Watch"
          centered
          plain
          actionIcon="folder-open-outline"
          actionLabel="Open Records from Health Watch"
          onAction={() => router.push("/records")}
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

        <BoardCard tone="navy" style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={[s.heroIcon, { backgroundColor: scoreTone + "22", borderColor: scoreTone + "66" }]}>
              <PixelIcon name={healthWatch.status === "good" ? "health" : "bile"} size={38} />
            </View>
            <View style={s.heroText}>
              <Text style={[s.heroLabel, { color: colors.amber, fontFamily: DISPLAY_SEMI }]}>PHOENIX HEALTH</Text>
              <Text style={[s.heroTitle, { fontFamily: DISPLAY }]}>{heroTitle}</Text>
              <Text style={[s.heroCopy, { fontFamily: "Inter_500Medium" }]}>{heroCopy}</Text>
            </View>
            <View style={[s.scoreBadge, { backgroundColor: scoreTone + "20", borderColor: scoreTone + "66" }]}>
              <Text style={[s.scoreValue, { color: colors.ivory, fontFamily: DISPLAY }]}>{score}</Text>
              <Text style={[s.scoreLabel, { color: "rgba(255,249,239,0.72)", fontFamily: "Inter_700Bold" }]}>
                SCORE
              </Text>
            </View>
          </View>

          <View style={s.heroSignalRail}>
            <View style={[s.heroSignal, { borderColor: colors.sage + "40" }]}>
              <Text style={[s.heroSignalLabel, { color: "rgba(255,249,239,0.62)", fontFamily: "Inter_700Bold" }]}>
                Appetite
              </Text>
              <Text style={[s.heroSignalValue, { color: colors.ivory, fontFamily: "Inter_700Bold" }]}>
                {healthWatch.counts.appetiteWatch7 ? "Watch" : "Good"}
              </Text>
            </View>
            <View style={[s.heroSignal, { borderColor: bileTone + "55" }]}>
              <Text style={[s.heroSignalLabel, { color: "rgba(255,249,239,0.62)", fontFamily: "Inter_700Bold" }]}>
                Bile
              </Text>
              <Text style={[s.heroSignalValue, { color: colors.ivory, fontFamily: "Inter_700Bold" }]}>
                {bileStatus}
              </Text>
            </View>
            <View style={[s.heroSignal, { borderColor: colors.copper + "55" }]}>
              <Text style={[s.heroSignalLabel, { color: "rgba(255,249,239,0.62)", fontFamily: "Inter_700Bold" }]}>
                Vet share
              </Text>
              <Text style={[s.heroSignalValue, { color: colors.ivory, fontFamily: "Inter_700Bold" }]}>
                Ready
              </Text>
            </View>
          </View>

          <View style={s.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log a health note"
              onPress={() => router.push({ pathname: "/log", params: { type: "symptom" } })}
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
                  backgroundColor: pressed ? "rgba(255,249,239,0.16)" : "rgba(255,249,239,0.09)",
                  borderColor: "rgba(255,249,239,0.18)",
                },
              ]}
            >
              <Text style={[s.heroActionSecondaryText, { fontFamily: "Inter_700Bold" }]}>Records</Text>
            </Pressable>
          </View>
        </BoardCard>

        <View style={s.metricGridTop}>
          {topMetrics.map((metric) => (
            <BoardMetricTile
              key={metric.label}
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              tone={metric.tone}
              style={s.topMetricTile}
            />
          ))}
        </View>

        {activeTab === "bile" ? (
          <BoardCard style={s.sectionCard}>
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

        <BoardCard style={s.sectionCard}>
          <BoardSectionHeader title="Health Snapshot" action="7-day view" />
          <View style={s.statusGrid}>
            {healthRows.map((row) => (
              <View
                key={row.label}
                style={[s.statusCard, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <View style={[s.statusIcon, { backgroundColor: row.tone + "16" }]}>
                  <PixelIcon name={row.icon} size={24} />
                </View>
                <Text style={[s.statusLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                  {row.label}
                </Text>
                <Text style={[s.statusValue, { color: row.tone, fontFamily: DISPLAY_SEMI }]}>{row.status}</Text>
                <Text style={[s.statusDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {row.detail}
                </Text>
              </View>
            ))}
          </View>
        </BoardCard>

        {activeTab === "health" ? (
          <BoardCard style={s.sectionCard}>
            <View style={s.sectionTop}>
              <BoardSectionHeader title="Bile Watch" style={s.boardSectionTop} />
              <BoardPill label={bileStatus} icon="water-outline" tone={bileTone} />
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
            </View>
          </BoardCard>
        ) : null}

        <BoardCard style={s.sectionCard}>
          <BoardSectionHeader title="Pattern Board" action={healthWatch.patterns.length ? "Owner notes" : undefined} />
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
  tabRail: {
    flexDirection: "row",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  tabPill: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 12.5 },

  heroCard: {
    padding: 12,
    marginBottom: 12,
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
  heroSignalRail: {
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  heroSignal: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: "rgba(255,249,239,0.07)",
  },
  heroSignalLabel: { fontSize: 9.5, textTransform: "uppercase" },
  heroSignalValue: { fontSize: 12.5, marginTop: 3 },
  heroActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  heroActionPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActionPrimaryText: { color: "#FFFFFF", fontSize: 13 },
  heroActionSecondary: {
    minWidth: 92,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  heroActionSecondaryText: { color: "#FFF9EF", fontSize: 13 },

  metricGridTop: {
    gap: 9,
    marginBottom: 2,
  },
  topMetricTile: {
    minHeight: 64,
  },
  sectionCard: { marginTop: 14 },
  sectionTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 2 },
  boardSectionTop: { flex: 1, marginBottom: 0 },
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

  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  statusCard: {
    flexGrow: 1,
    flexBasis: "47.5%",
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  statusLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.2 },
  statusValue: { fontSize: 17, lineHeight: 20, marginTop: 2 },
  statusDetail: { fontSize: 11.5, lineHeight: 15, marginTop: 3 },

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
