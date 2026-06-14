import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deriveHealthWatch, normalizeCareEventType } from "@workspace/care-domain";

import {
  BoardCard,
  BoardMetricTile,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
  CareRow,
} from "@/components/board/BoardPrimitives";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

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

export default function HealthScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const now = Date.now();

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

  const bileStatus =
    healthWatch.status === "alert"
      ? "Review"
      : bileEntries.length || healthWatch.counts.vomit7
        ? "Watch"
        : "Low Risk";
  const bileTone =
    bileStatus === "Review" ? colors.rose : bileStatus === "Watch" ? colors.amber : colors.sage;

  const rows: { label: string; value: string; icon: PixelIconName }[] = [
    { label: "Activity", value: `${healthWatch.counts.anxiety7} watch signals`, icon: "walk" },
    { label: "Appetite", value: `${healthWatch.counts.appetiteWatch7} reduced meals`, icon: "meal" },
    { label: "Stool", value: `${healthWatch.counts.stoolWatch7} review logs`, icon: "pee" },
    { label: "Vomiting", value: `${healthWatch.counts.vomit7} in 7 days`, icon: "vomit" },
    { label: "Hydration", value: "Review water logs in Records", icon: "bile" },
    { label: "Energy", value: healthWatch.status === "good" ? "No current alert" : "Worth watching", icon: "energy" },
    { label: "Weight", value: state.profile.weight.current ? `${state.profile.weight.current} ${state.profile.weight.unit}` : "No baseline", icon: "health" },
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
          kicker="Health"
          title="Health Watch"
          subtitle="Calm pattern tracking for appetite, bile, energy, weight, and vet-ready notes."
          icon="medkit-outline"
          actionIcon="folder-open-outline"
          actionLabel="Open Records from Health Watch"
          onAction={() => router.push("/records")}
        />

        <BoardCard style={s.heroCard}>
          <View style={[s.heroIcon, { backgroundColor: bileTone + "18" }]}>
            <PixelIcon name={healthWatch.status === "good" ? "health" : "bile"} size={36} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              Pattern noticed
            </Text>
            <Text style={[s.heroTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
              {healthWatch.status === "good" ? "No active health watch signals" : healthWatch.summary}
            </Text>
            <Text style={[s.heroCopy, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Worth watching. Consider sharing repeat patterns with your vet. Not veterinary advice.
            </Text>
          </View>
        </BoardCard>

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
            />
            <BoardMetricTile
              icon="meal"
              label="Longest food gap"
              value={mealGaps ? `${mealGaps.toFixed(1)} hours` : "Needs more meal logs"}
              tone={colors.copper}
            />
            <BoardMetricTile
              icon="bone"
              label="Bedtime snack proof"
              value={state.dietProfile.bedtimeSnack || "Not set"}
              tone={colors.amber}
            />
            <BoardMetricTile
              icon="vomit"
              label="7-day trend"
              value={`${healthWatch.counts.vomit7} vomit logs`}
              tone={colors.rose}
            />
          </View>
        </BoardCard>

        <BoardCard style={s.sectionCard}>
          <BoardSectionHeader title="Overview" />
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[s.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <CareRow icon={row.icon} title={row.label} detail={row.value} />
            </View>
          ))}
        </BoardCard>

        <BoardCard style={s.sectionCard}>
          <BoardSectionHeader title="Trends" />
          {healthWatch.patterns.slice(0, 4).map((pattern) => (
            <View key={pattern.kind} style={[s.patternRow, { borderTopColor: colors.border }]}>
              <Text style={[s.patternTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {pattern.label}
              </Text>
              <Text style={[s.patternCopy, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {pattern.evidence}
              </Text>
              <Text style={[s.patternStep, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
                {pattern.nextStep}
              </Text>
            </View>
          ))}
        </BoardCard>

        <Text style={[s.boundary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {healthWatch.vetBoundary} Not veterinary advice.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  heroCard: { flexDirection: "row", gap: 14 },
  heroIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  heroLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0 },
  heroTitle: { fontSize: 20, lineHeight: 24, marginTop: 3 },
  heroCopy: { fontSize: 13, lineHeight: 19, marginTop: 7 },
  sectionCard: { marginTop: 14 },
  sectionTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 2 },
  boardSectionTop: { flex: 1, marginBottom: 0 },
  metricGrid: { gap: 9 },
  row: { paddingVertical: 2 },
  patternRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  patternTitle: { fontSize: 14 },
  patternCopy: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  patternStep: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  boundary: { fontSize: 12, lineHeight: 18, marginTop: 14, paddingHorizontal: 4 },
});
