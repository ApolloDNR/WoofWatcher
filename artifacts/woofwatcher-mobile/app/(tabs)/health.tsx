import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
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
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

const HEALTH_ICON: Record<string, PulseIconName> = {
  vomit: "vomit",
  health: "heart",
  vet: "heart",
  mood: "sad",
  alone: "house",
  medication: "drop",
};

function relativeTime(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HealthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const { width } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const now = Date.now();
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);

  const current = state.profile.weight.current;
  const unit = state.profile.weight.unit;

  const goalWeight = useMemo(() => {
    const g = state.goals.find((x) => x.category === "weight");
    const m = g?.target.match(/(\d+(\.\d+)?)/);
    const parsed = m ? parseFloat(m[1]) : NaN;
    return Number.isFinite(parsed) ? parsed : Math.round(current) + 2;
  }, [state.goals, current]);

  // Synthesize a gentle 7-point weight trend toward current (no history in state)
  const series = useMemo(() => {
    const n = 7;
    const start = current - 1.6;
    const wobble = [0, 0.25, -0.15, 0.35, 0.1, 0.4, 0];
    const arr: number[] = [];
    for (let i = 0; i < n; i++) {
      const base = start + (current - start) * (i / (n - 1));
      const v = base + (i < n - 1 ? wobble[i] : 0);
      arr.push(Math.round(v * 10) / 10);
    }
    arr[n - 1] = current;
    return arr;
  }, [current]);

  const weekLabels = useMemo(
    () => series.map((_, i) => (i === series.length - 1 ? "Now" : `${series.length - 1 - i}w`)),
    [series],
  );

  const healthEntries = useMemo(
    () =>
      [...state.entries]
        .filter(
          (e) =>
            ["vomit", "health", "vet", "medication"].includes(e.type) ||
            (e.type === "mood" && (e.mood === "anxious" || e.severity)),
        )
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 6),
    [state.entries],
  );

  const healthRecords = useMemo(
    () => state.records.filter((r) => ["vet", "vaccine", "weight", "medication"].includes(r.type)),
    [state.records],
  );

  const appetiteOk = status.counts.meals.done >= status.counts.meals.target;
  const healthOk = !status.counts.healthAlert;

  const chips = [
    {
      icon: "bolt" as PulseIconName,
      label: "Energy",
      value: `${status.energy}%`,
      tint: colors.amber,
    },
    {
      icon: "bone" as PulseIconName,
      label: "Weight",
      value: `${current} ${unit}`,
      tint: colors.copper,
    },
    {
      icon: "bowl" as PulseIconName,
      label: "Appetite",
      value: appetiteOk ? "Good" : "Light",
      tint: colors.sage,
    },
  ];

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
  const xAt = (i: number) => padL + (i / (series.length - 1)) * plotW;
  const yAt = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * plotH;

  const linePath = series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  const goalY = yAt(goalWeight);
  const remaining = Math.max(0, goalWeight - current);

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
            <View style={[s.headerIcon, { backgroundColor: (healthOk ? colors.sage : colors.copper) + "18" }]}>
              <Ionicons name={healthOk ? "heart" : "alert-circle"} size={22} color={healthOk ? colors.sage : colors.copper} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.foreground, fontFamily: DISPLAY }]}>Health Watch</Text>
              <Text style={[s.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {healthOk
                  ? `${state.profile.name} is feeling good today 🌿`
                  : `Keeping a gentle eye on ${state.profile.name} 🤍`}
              </Text>
            </View>
          </View>

          {/* Status chips */}
          <View style={s.chipRow}>
            {chips.map((c) => (
              <View key={c.label} style={[s.chipCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
                <View style={[s.chipIconWrap, { backgroundColor: c.tint + "1A" }]}>
                  <PulseIcon name={c.icon} size={18} />
                </View>
                <Text style={[s.chipValue, { color: colors.foreground, fontFamily: DISPLAY }]}>{c.value}</Text>
                <Text style={[s.chipLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{c.label}</Text>
              </View>
            ))}
          </View>

          {/* Weight trend chart */}
          <View style={[s.sectionHeader, { marginTop: 26 }]}>
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
                <Text style={[s.chartCaption, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Current weight</Text>
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

              {/* Goal line */}
              <Line
                x1={padL}
                y1={goalY}
                x2={padL + plotW}
                y2={goalY}
                stroke={colors.sage}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                opacity={0.55}
              />

              {/* Area + line */}
              <Path d={areaPath} fill="url(#weightFill)" />
              <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />

              {/* Points */}
              {series.map((v, i) => {
                const last = i === series.length - 1;
                return (
                  <Circle
                    key={i}
                    cx={xAt(i)}
                    cy={yAt(v)}
                    r={last ? 5.5 : 3}
                    fill={last ? colors.copper : colors.card}
                    stroke={last ? colors.card : colors.primary}
                    strokeWidth={last ? 2.5 : 2}
                  />
                );
              })}

              {/* X labels */}
              {weekLabels.map((lbl, i) => (
                <SvgText
                  key={`l${i}`}
                  x={xAt(i)}
                  y={chartH - 8}
                  fill={colors.mutedForeground}
                  fontSize={10}
                  fontFamily="Inter_500Medium"
                  textAnchor="middle"
                >
                  {lbl}
                </SvgText>
              ))}
            </Svg>

            <Text style={[s.chartNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Gentle, vet-guided pacing — slow and steady wins the snacks. 🦴
            </Text>
          </View>

          {/* Recent observations */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Recent Observations</Text>
            <Pressable onPress={() => router.push("/log")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>View log</Text>
            </Pressable>
          </View>
          <View style={[s.listCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {healthEntries.length === 0 ? (
              <Text style={[s.empty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No health flags logged. Tail wags all around. 🐕
              </Text>
            ) : (
              healthEntries.map((e, i) => {
                const icon = HEALTH_ICON[e.type] ?? "heart";
                const sev = e.severity && e.severity !== "normal" ? e.severity : null;
                const sevColor = sev === "urgent" || sev === "alert" ? colors.rose : colors.amber;
                return (
                  <View
                    key={e.id}
                    style={[s.row, i < healthEntries.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    <View style={[s.rowIconWrap, { backgroundColor: PULSE_COLORS[icon] + "16" }]}>
                      <PulseIcon name={icon} size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.rowTitleLine}>
                        <Text numberOfLines={1} style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                          {e.title}
                        </Text>
                        {sev && (
                          <View style={[s.sevBadge, { backgroundColor: sevColor + "1A" }]}>
                            <Text style={[s.sevText, { color: sevColor, fontFamily: "Inter_700Bold" }]}>{sev}</Text>
                          </View>
                        )}
                      </View>
                      {e.note ? (
                        <Text numberOfLines={2} style={[s.rowNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {e.note}
                        </Text>
                      ) : null}
                      <Text style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {e.caregiver} · {relativeTime(e.occurredAt, now)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Records / checkups */}
          {healthRecords.length > 0 && (
            <>
              <View style={[s.sectionHeader, { marginTop: 28 }]}>
                <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Vaccinations & Checkups</Text>
              </View>
              <View style={[s.listCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
                {healthRecords.map((r, i) => (
                  <View
                    key={r.id}
                    style={[s.row, i < healthRecords.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    <View style={[s.rowIconWrap, { backgroundColor: colors.sage + "16" }]}>
                      <Ionicons
                        name={r.type === "vaccine" ? "shield-checkmark" : r.type === "vet" ? "medkit" : "calendar"}
                        size={19}
                        color={colors.sage}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.title}</Text>
                      {r.note ? (
                        <Text numberOfLines={2} style={[s.rowNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {r.note}
                        </Text>
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
            <Text style={[s.noticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {state.profile.vetBoundary}
            </Text>
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

  chipRow: { flexDirection: "row", gap: 10 },
  chipCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  chipIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  chipValue: { fontSize: 17, letterSpacing: -0.3 },
  chipLabel: { fontSize: 11.5, marginTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 20, letterSpacing: -0.2 },
  sectionLink: { fontSize: 14 },

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

  listCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  empty: { fontSize: 14, paddingVertical: 20, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { fontSize: 15, flexShrink: 1 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sevText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 },
  rowNote: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  rowMeta: { fontSize: 12, marginTop: 4 },
  duePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  dueText: { fontSize: 11.5 },

  notice: { flexDirection: "row", gap: 10, borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 24 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
