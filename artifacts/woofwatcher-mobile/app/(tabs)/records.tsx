import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useCare, Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

const HEALTH_ICON: Record<string, PulseIconName> = {
  vomit: "vomit",
  symptom: "vomit",
  health: "heart",
  vet: "heart",
  mood: "sad",
  alone: "house",
  medication: "drop",
  meds: "drop",
};

const MOOD_META: Record<string, { label: string; score: number; tone: "good" | "watch" | "alert" }> = {
  happy: { label: "Happy", score: 5, tone: "good" },
  excited: { label: "Excited", score: 4, tone: "good" },
  calm: { label: "Calm", score: 4, tone: "good" },
  anxious: { label: "Anxious", score: 2, tone: "watch" },
  unwell: { label: "Unwell", score: 1, tone: "alert" },
};

const PERIODS = [
  { key: 7, label: "Week" },
  { key: 30, label: "Month" },
  { key: 90, label: "Quarter" },
] as const;

function daysBetween(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 86400000;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relativeDay(iso: string, now: number): string {
  const d = Math.floor(daysBetween(iso, now));
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return shortDate(iso);
}

export default function RecordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const { width } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const now = Date.now();

  const current = state.profile.weight.current;
  const unit = state.profile.weight.unit;

  const [period, setPeriod] = useState<number>(30);

  // ---- Weight trend (prefer real weight logs, fall back to gentle synthesis) ----
  const goalWeight = useMemo(() => {
    const g = state.goals.find((x) => x.category === "weight");
    const m = g?.target.match(/(\d+(\.\d+)?)/);
    const parsed = m ? parseFloat(m[1]) : NaN;
    return Number.isFinite(parsed) ? parsed : Math.round(current) + 2;
  }, [state.goals, current]);

  const { series, labels, isRealWeight } = useMemo(() => {
    const real = state.entries
      .filter((e) => e.type === "weight" && e.amount && !Number.isNaN(parseFloat(e.amount)))
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
      .slice(-8);
    if (real.length >= 2) {
      return {
        series: real.map((e) => parseFloat(e.amount as string)),
        labels: real.map((e, i) => (i === real.length - 1 ? "Now" : shortDate(e.occurredAt))),
        isRealWeight: true,
      };
    }
    const n = 7;
    const start = current - 1.6;
    const wobble = [0, 0.25, -0.15, 0.35, 0.1, 0.4, 0];
    const arr: number[] = [];
    for (let i = 0; i < n; i++) {
      const base = start + (current - start) * (i / (n - 1));
      arr.push(Math.round((base + (i < n - 1 ? wobble[i] : 0)) * 10) / 10);
    }
    arr[n - 1] = current;
    return {
      series: arr,
      labels: arr.map((_, i) => (i === n - 1 ? "Now" : `${n - 1 - i}w`)),
      isRealWeight: false,
    };
  }, [state.entries, current]);

  // ---- Mood distribution (last 30 days) ----
  const moodStats = useMemo(() => {
    const recent = state.entries.filter(
      (e) => e.mood && MOOD_META[e.mood] && daysBetween(e.occurredAt, now) <= 30,
    );
    const counts: Record<string, number> = {};
    let total = 0;
    let scoreSum = 0;
    for (const e of recent) {
      counts[e.mood as string] = (counts[e.mood as string] ?? 0) + 1;
      total += 1;
      scoreSum += MOOD_META[e.mood as string].score;
    }
    const avg = total ? scoreSum / total : 0;
    const bars = Object.keys(MOOD_META)
      .map((k) => ({ key: k, ...MOOD_META[k], count: counts[k] ?? 0 }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count);
    return { total, avg, bars };
  }, [state.entries, now]);

  // ---- Incident lookback ----
  const incidents = useMemo(
    () =>
      state.entries
        .filter((e) => e.type === "vomit" || e.type === "symptom")
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [state.entries],
  );
  const incident7 = incidents.filter((e) => daysBetween(e.occurredAt, now) <= 7).length;
  const incident30 = incidents.filter((e) => daysBetween(e.occurredAt, now) <= 30).length;
  const incident90 = incidents.filter((e) => daysBetween(e.occurredAt, now) <= 90).length;

  // ---- Progress report (period-scoped, computed from real logs) ----
  const report = useMemo(() => {
    const within = state.entries.filter((e) => daysBetween(e.occurredAt, now) <= period);
    const count = (types: string[]) => within.filter((e) => types.includes(e.type)).length;
    const walkMinutes = within
      .filter((e) => e.type === "walk")
      .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
    const byCaregiver: Record<string, number> = {};
    for (const e of within) {
      if (e.caregiver) byCaregiver[e.caregiver] = (byCaregiver[e.caregiver] ?? 0) + 1;
    }
    const topCaregiver = Object.entries(byCaregiver).sort((a, b) => b[1] - a[1])[0];
    return {
      total: within.length,
      meals: count(["meal"]),
      walks: count(["walk"]),
      walkMinutes,
      play: count(["play", "training"]),
      potty: count(["potty"]),
      treats: count(["treat"]),
      incidents: count(["vomit", "symptom"]),
      topCaregiver: topCaregiver ? { name: topCaregiver[0], count: topCaregiver[1] } : null,
    };
  }, [state.entries, period, now]);

  const dietHistory = useMemo(
    () =>
      state.entries
        .filter((e) => e.type === "meal" && e.note)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 4),
    [state.entries],
  );

  const vetRecords = useMemo(
    () => state.records.filter((r) => ["vet", "vaccine", "weight", "medication"].includes(r.type)),
    [state.records],
  );

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Month";

  const shareReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const lines = [
      `WOOFWATCHER PROGRESS REPORT — Last ${period} days`,
      `${state.profile.name} (${state.profile.breed})`,
      "",
      `Total entries logged: ${report.total}`,
      `Meals: ${report.meals}`,
      `Walks: ${report.walks} (${report.walkMinutes} min)`,
      `Play & training: ${report.play}`,
      `Potty breaks: ${report.potty}`,
      `Treats: ${report.treats}`,
      `Health incidents: ${report.incidents}`,
      report.topCaregiver ? `Most active caregiver: ${report.topCaregiver.name} (${report.topCaregiver.count})` : "",
      "",
      `Current weight: ${current} ${unit} (goal ${goalWeight} ${unit})`,
      moodStats.total ? `Mood average: ${moodStats.avg.toFixed(1)}/5 over ${moodStats.total} check-ins` : "",
      "",
      "Shared from WoofWatcher — patterns for caregiver & vet review.",
    ]
      .filter(Boolean)
      .join("\n");
    Share.share({ message: lines, title: `${state.profile.name} — ${periodLabel} report` }).catch(() =>
      Alert.alert("Progress report", lines),
    );
  };

  // Mount animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [fade, slide]);

  // Chart geometry
  const H_PAD = 20;
  const cardPad = 18;
  const chartW = width - H_PAD * 2 - cardPad * 2;
  const chartH = 140;
  const padL = 6;
  const padR = 6;
  const padT = 12;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const allVals = [...series, goalWeight];
  const minV = Math.min(...allVals) - 0.6;
  const maxV = Math.max(...allVals) + 0.6;
  const xAt = (i: number) => padL + (i / Math.max(1, series.length - 1)) * plotW;
  const yAt = (v: number) => padT + (1 - (v - minV) / (maxV - minV || 1)) * plotH;
  const linePath = series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  const goalY = yAt(goalWeight);
  const remaining = Math.max(0, goalWeight - current);
  const maxBar = Math.max(1, ...moodStats.bars.map((b) => b.count));
  const incidentMax = Math.max(1, incident7, incident30, incident90);

  const reportStats: { icon: PulseIconName; label: string; value: string }[] = [
    { icon: "bowl", label: "Meals", value: String(report.meals) },
    { icon: "paw", label: "Walks", value: `${report.walks} · ${report.walkMinutes}m` },
    { icon: "candy", label: "Play & train", value: String(report.play) },
    { icon: "drop", label: "Potty", value: String(report.potty) },
    { icon: "bone", label: "Treats", value: String(report.treats) },
    { icon: "vomit", label: "Incidents", value: String(report.incidents) },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 130, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* Header */}
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: colors.primary + "14" }]}>
              <Ionicons name="folder-open" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.foreground, fontFamily: DISPLAY }]}>Records</Text>
              <Text style={[s.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {state.profile.name}'s file cabinet — trends, incidents & reports
              </Text>
            </View>
          </View>

          {/* Weight trend */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Weight Trend</Text>
            <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
              {remaining > 0 ? `${remaining.toFixed(1)} ${unit} to go` : "Goal reached"}
            </Text>
          </View>
          <View style={[s.chartCard, { backgroundColor: colors.card, shadowColor: colors.primary, padding: cardPad }]}>
            <View style={s.chartTopRow}>
              <View>
                <Text style={[s.chartBig, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {current}
                  <Text style={[s.chartUnit, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}> {unit}</Text>
                </Text>
                <Text style={[s.chartCaption, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {isRealWeight ? "From logged weigh-ins" : "Current weight"}
                </Text>
              </View>
              <View style={[s.goalPill, { backgroundColor: colors.sage + "16" }]}>
                <Ionicons name="flag" size={13} color={colors.sage} />
                <Text style={[s.goalPillText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Goal {goalWeight} {unit}
                </Text>
              </View>
            </View>

            <Svg width={chartW} height={chartH}>
              <Defs>
                <SvgGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.sage} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={colors.sage} stopOpacity={0.02} />
                </SvgGradient>
              </Defs>
              <Line x1={padL} y1={goalY} x2={padL + plotW} y2={goalY} stroke={colors.sage} strokeWidth={1.5} strokeDasharray="5 5" opacity={0.55} />
              <Path d={areaPath} fill="url(#weightFill)" />
              <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              {series.map((v, i) => {
                const last = i === series.length - 1;
                return (
                  <Circle key={i} cx={xAt(i)} cy={yAt(v)} r={last ? 5.5 : 3} fill={last ? colors.copper : colors.card} stroke={last ? colors.card : colors.primary} strokeWidth={last ? 2.5 : 2} />
                );
              })}
              {labels.map((lbl, i) => (
                <SvgText key={`l${i}`} x={xAt(i)} y={chartH - 8} fill={colors.mutedForeground} fontSize={10} fontFamily="Inter_500Medium" textAnchor="middle">
                  {lbl}
                </SvgText>
              ))}
            </Svg>
            <Text style={[s.chartNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {isRealWeight ? "Log weight from the Log tab to extend this trend." : "Gentle, vet-guided pacing — slow and steady. 🦴"}
            </Text>
          </View>

          {/* Mood trend */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Mood Trend</Text>
            {moodStats.total > 0 && (
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
                {moodStats.avg.toFixed(1)}/5 avg
              </Text>
            )}
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {moodStats.bars.length === 0 ? (
              <Text style={[s.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No mood check-ins yet. Log a mood to see trends. 🐶
              </Text>
            ) : (
              moodStats.bars.map((b) => {
                const tone = b.tone === "alert" ? colors.rose : b.tone === "watch" ? colors.amber : colors.sage;
                return (
                  <View key={b.key} style={s.moodRow}>
                    <Text style={[s.moodLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{b.label}</Text>
                    <View style={[s.moodTrack, { backgroundColor: colors.background }]}>
                      <View style={[s.moodFill, { backgroundColor: tone, width: `${(b.count / maxBar) * 100}%` }]} />
                    </View>
                    <Text style={[s.moodCount, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{b.count}</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Incident lookback */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Incident Lookback</Text>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.incidentRow}>
              {[
                { label: "7 days", value: incident7 },
                { label: "30 days", value: incident30 },
                { label: "90 days", value: incident90 },
              ].map((b, i) => (
                <View key={b.label} style={[s.incidentCol, i < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.incidentValue, { color: b.value > 0 ? colors.rose : colors.sage, fontFamily: DISPLAY }]}>{b.value}</Text>
                  <Text style={[s.incidentLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{b.label}</Text>
                  <View style={[s.incidentBarTrack, { backgroundColor: colors.background }]}>
                    <View style={[s.incidentBarFill, { backgroundColor: b.value > 0 ? colors.rose : colors.sage, width: `${(b.value / incidentMax) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            {incidents.slice(0, 4).map((e, i) => (
              <View key={e.id} style={[s.row, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[s.rowIconWrap, { backgroundColor: PULSE_COLORS[HEALTH_ICON[e.type] ?? "vomit"] + "16" }]}>
                  <PulseIcon name={HEALTH_ICON[e.type] ?? "vomit"} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{e.title}</Text>
                  <Text style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {e.caregiver} · {relativeDay(e.occurredAt, now)}
                  </Text>
                </View>
                {e.severity && e.severity !== "normal" && (
                  <View style={[s.sevBadge, { backgroundColor: (e.severity === "alert" ? colors.rose : colors.amber) + "1A" }]}>
                    <Text style={[s.sevText, { color: e.severity === "alert" ? colors.rose : colors.amber, fontFamily: "Inter_700Bold" }]}>{e.severity}</Text>
                  </View>
                )}
              </View>
            ))}
            {incidents.length === 0 && (
              <Text style={[s.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No incidents logged. Tail wags all around. 🐕
              </Text>
            )}
          </View>

          {/* Progress report */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Progress Report</Text>
            <Pressable onPress={shareReport} hitSlop={8} style={s.shareInline}>
              <Ionicons name="share-outline" size={15} color={colors.copper} />
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Share</Text>
            </Pressable>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={[s.segRow, { backgroundColor: colors.background }]}>
              {PERIODS.map((p) => {
                const active = period === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPeriod(p.key);
                    }}
                    style={[s.segPill, active && { backgroundColor: colors.card, shadowColor: colors.primary }]}
                  >
                    <Text style={[s.segText, { color: active ? colors.foreground : colors.mutedForeground, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium" }]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={s.reportGrid}>
              {reportStats.map((r) => (
                <View key={r.label} style={[s.reportCell, { backgroundColor: colors.background }]}>
                  <View style={[s.reportIcon, { backgroundColor: PULSE_COLORS[r.icon] + "16" }]}>
                    <PulseIcon name={r.icon} size={16} />
                  </View>
                  <Text style={[s.reportValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{r.value}</Text>
                  <Text style={[s.reportLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{r.label}</Text>
                </View>
              ))}
            </View>
            {report.topCaregiver && (
              <View style={[s.topCaregiver, { backgroundColor: colors.sage + "12" }]}>
                <Ionicons name="ribbon" size={16} color={colors.sage} />
                <Text style={[s.topCaregiverText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  <Text style={{ fontFamily: "Inter_700Bold" }}>{report.topCaregiver.name}</Text> logged the most this {periodLabel.toLowerCase()} ({report.topCaregiver.count})
                </Text>
              </View>
            )}
          </View>

          {/* Diet folder */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Diet on File</Text>
            <Pressable onPress={() => router.push("/more")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Edit</Text>
            </Pressable>
          </View>
          <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.dietHead}>
              <View style={[s.rowIconWrap, { backgroundColor: colors.copper + "16" }]}>
                <PulseIcon name="bowl" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{state.dietProfile.primaryFood}</Text>
                <Text style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {state.dietProfile.normalPortion} · {state.dietProfile.mealSchedule}
                </Text>
              </View>
            </View>
            {dietHistory.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={[s.subHeading, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>RECENT MEAL NOTES</Text>
                {dietHistory.map((e) => (
                  <View key={e.id} style={s.dietNoteRow}>
                    <View style={[s.dot, { backgroundColor: colors.copper }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowNote, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{e.note}</Text>
                      <Text style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{relativeDay(e.occurredAt, now)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Vet & records cabinet */}
          {vetRecords.length > 0 && (
            <>
              <View style={[s.sectionHeader, { marginTop: 28 }]}>
                <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Vet & Documents</Text>
              </View>
              <View style={[s.padCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
                {vetRecords.map((r, i) => (
                  <View key={r.id} style={[s.row, i < vetRecords.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[s.rowIconWrap, { backgroundColor: colors.sage + "16" }]}>
                      <Ionicons name={r.type === "vaccine" ? "shield-checkmark" : r.type === "vet" ? "medkit" : "document-text"} size={19} color={colors.sage} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.title}</Text>
                      {r.note ? (
                        <Text numberOfLines={2} style={[s.rowNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.note}</Text>
                      ) : null}
                    </View>
                    <View style={[s.duePill, { backgroundColor: colors.background }]}>
                      <Text style={[s.dueText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{r.due}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Vet boundary */}
          <View style={[s.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.sage} />
            <Text style={[s.noticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{state.profile.vetBoundary}</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 20, letterSpacing: -0.2 },
  sectionLink: { fontSize: 14 },
  shareInline: { flexDirection: "row", alignItems: "center", gap: 4 },

  chartCard: {
    borderRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  chartTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  chartBig: { fontSize: 30, letterSpacing: -0.5 },
  chartUnit: { fontSize: 15 },
  chartCaption: { fontSize: 12.5, marginTop: 1 },
  goalPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13 },
  goalPillText: { fontSize: 12.5 },
  chartNote: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },

  padCard: {
    borderRadius: 22,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  empty: { fontSize: 14, paddingVertical: 16, textAlign: "center" },

  moodRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  moodLabel: { fontSize: 14, width: 64 },
  moodTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  moodFill: { height: "100%", borderRadius: 5 },
  moodCount: { fontSize: 13, width: 22, textAlign: "right" },

  incidentRow: { flexDirection: "row", marginBottom: 4 },
  incidentCol: { flex: 1, alignItems: "center", paddingHorizontal: 10, paddingBottom: 14 },
  incidentValue: { fontSize: 26, letterSpacing: -0.4 },
  incidentLabel: { fontSize: 12, marginTop: 1 },
  incidentBarTrack: { height: 5, borderRadius: 3, width: "70%", marginTop: 8, overflow: "hidden" },
  incidentBarFill: { height: "100%", borderRadius: 3 },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, flexShrink: 1 },
  rowNote: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  rowMeta: { fontSize: 12, marginTop: 4 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sevText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 },
  duePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  dueText: { fontSize: 11.5 },

  segRow: { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 16 },
  segPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  segText: { fontSize: 13.5 },
  reportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reportCell: { width: "31%", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  reportIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  reportValue: { fontSize: 18, letterSpacing: -0.3 },
  reportLabel: { fontSize: 11, marginTop: 2 },
  topCaregiver: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 14, padding: 12, marginTop: 14 },
  topCaregiverText: { flex: 1, fontSize: 13, lineHeight: 18 },

  dietHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 6 },
  subHeading: { fontSize: 11, letterSpacing: 0.6, marginTop: 10, marginBottom: 4 },
  dietNoteRow: { flexDirection: "row", gap: 10, paddingVertical: 7, alignItems: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },

  notice: { flexDirection: "row", gap: 10, borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 24 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
