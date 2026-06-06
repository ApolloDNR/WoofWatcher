import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare } from "@/context/CareContext";
import { useAvatar } from "@/context/AvatarContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { AnimatedAvatar } from "@/components/AnimatedAvatar";
import Svg, { Circle } from "react-native-svg";
import { computeCareStreak, computeDayProgress, derivePhoenixStatus, getGreeting } from "@/lib/phoenixStatus";

const BRAND_MARK = require("@/assets/brand/mark.png");

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

interface QuickLogItem {
  key: string;
  icon: PulseIconName;
  label: string;
  type: string;
  title: string;
  mood?: string;
  severity?: string;
}

const QUICK_LOG: QuickLogItem[] = [
  { key: "meal", icon: "bowl", label: "Meal", type: "meal", title: "Meal" },
  { key: "treat", icon: "bone", label: "Treat", type: "treat", title: "Treat" },
  { key: "walk", icon: "paw", label: "Walk", type: "walk", title: "Walk" },
  { key: "potty", icon: "drop", label: "Potty", type: "potty", title: "Potty break" },
  { key: "play", icon: "candy", label: "Play", type: "play", title: "Play session" },
  { key: "win", icon: "star", label: "Training", type: "training", title: "Training win" },
  { key: "zoomies", icon: "bolt", label: "Zoomies", type: "mood", title: "Zoomies", mood: "excited" },
  { key: "anxious", icon: "sad", label: "Anxious", type: "mood", title: "Anxious moment", mood: "anxious" },
  { key: "vomit", icon: "vomit", label: "Vomit", type: "vomit", title: "Vomit", severity: "watch" },
  { key: "alone", icon: "house", label: "Alone", type: "alone", title: "Alone time" },
];

const TYPE_ICON: Record<string, PulseIconName> = {
  meal: "bowl",
  treat: "bone",
  walk: "paw",
  potty: "drop",
  pee: "drop",
  poop: "drop",
  play: "candy",
  training: "star",
  vomit: "vomit",
  alone: "house",
  mood: "heart",
};

function ProgressRing({ progress, color, track }: { progress: number; color: string; track: string }) {
  const size = 52;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </Svg>
      <Text style={{ position: "absolute", fontFamily: "Fredoka_700Bold", fontSize: 13, color }}>
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
}

function relativeTime(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PhoenixScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addEntry } = useCare();
  const { getAvatarSource } = useAvatar();
  const { width } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const now = Date.now();

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const greeting = useMemo(() => getGreeting(now), [now]);
  const careStreak = useMemo(() => computeCareStreak(state, now), [state, now]);
  const dayProgress = useMemo(() => computeDayProgress(status), [status]);
  const caregiver = state.caregivers[0]?.name ?? "friend";
  const dateLabel = useMemo(
    () =>
      new Date(now).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [now],
  );

  const recent = useMemo(
    () =>
      [...state.entries]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 4),
    [state.entries],
  );

  const caregiverColor = (name: string) => {
    const palette = [colors.primary, colors.copper, colors.sage, colors.amber];
    const idx = state.caregivers.findIndex((c) => c.name === name);
    return palette[(idx >= 0 ? idx : 0) % palette.length];
  };

  const bedtimeLogged = useMemo(
    () =>
      state.entries.some((e) => {
        const d = new Date(e.occurredAt);
        const t = new Date(now);
        const sameDay =
          d.getFullYear() === t.getFullYear() &&
          d.getMonth() === t.getMonth() &&
          d.getDate() === t.getDate();
        return sameDay && e.type === "treat" && /snack|bedtime/i.test(e.title);
      }),
    [state.entries, now],
  );

  // Mount fade-in
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 460,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(slide, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [fade, slide]);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: Platform.OS !== "web" }).start(
        () => setToast(null),
      );
    }, 1500);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const logQuick = (item: QuickLogItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addEntry({
      type: item.type,
      title: item.title,
      caregiver,
      occurredAt: new Date().toISOString(),
      ...(item.mood ? { mood: item.mood } : {}),
      ...(item.severity ? { severity: item.severity } : {}),
    });
    showToast(`${item.label} logged`);
  };

  const logBedtimeSnack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addEntry({
      type: "treat",
      title: "Bedtime snack",
      caregiver,
      occurredAt: new Date().toISOString(),
    });
    showToast("Bedtime snack logged");
  };

  const H_PAD = 20;
  const GAP = 10;
  const colW = (width - H_PAD * 2 - GAP * 4) / 5;

  const c = status.counts;
  const pulse = [
    { icon: "bowl" as PulseIconName, label: "Meals", value: `${c.meals.done}/${c.meals.target}` },
    { icon: "paw" as PulseIconName, label: "Walks", value: `${c.walks.done}/${c.walks.target}` },
    { icon: "drop" as PulseIconName, label: "Potty", value: `${c.potty.done}/${c.potty.target}` },
    { icon: "star" as PulseIconName, label: "Training", value: `${c.training}` },
    { icon: "heart" as PulseIconName, label: "Health", value: c.healthAlert ? "!" : "✓" },
  ];

  const healthOk = !c.healthAlert;
  const appetiteOk = c.meals.done >= c.meals.target;
  const healthStats = [
    { label: "Energy", value: `${status.energy}%` },
    { label: "Weight", value: `${state.profile.weight.current} ${state.profile.weight.unit}` },
    { label: "Appetite", value: appetiteOk ? "Good" : "Low" },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: topInset + 8,
          paddingBottom: 130,
          paddingHorizontal: H_PAD,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* Branded header */}
          <View style={s.brandRow}>
            <View style={s.brandLeft}>
              <View style={[s.brandMarkWrap, { backgroundColor: colors.primary + "12" }]}>
                <Image source={BRAND_MARK} style={s.brandMark} resizeMode="contain" />
              </View>
              <Text style={[s.brandName, { color: colors.primary, fontFamily: DISPLAY }]}>
                WoofWatcher
              </Text>
            </View>
            <View style={[s.datePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
              <Text style={[s.datePillText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                {dateLabel}
              </Text>
            </View>
          </View>

          {/* Greeting */}
          <View style={s.greeting}>
            <Text style={[s.greetingTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
              {greeting.text}, {caregiver} {greeting.emoji}
            </Text>
            <Text style={[s.greetingSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {state.profile.name} is ready for an adventure.
            </Text>
          </View>

          {/* Living hero card */}
          <View style={[s.heroCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.heroImageWrap}>
              <AnimatedAvatar mood={status.mood} speech={status.meta.speech} />

              <LinearGradient
                colors={["rgba(20,30,24,0.10)", "transparent", "rgba(20,30,24,0.58)"]}
                locations={[0, 0.45, 1]}
                style={s.heroScrim}
                pointerEvents="none"
              />

              <Pressable onPress={() => router.push("/more")} style={s.nameChip}>
                <Text style={[s.nameChipText, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {state.profile.name}
                </Text>
                <Ionicons name="chevron-down" size={15} color={colors.mutedForeground} />
              </Pressable>

              <Pressable
                onPress={() => router.push("/portrait")}
                style={({ pressed }) => [s.portraitBtn, { opacity: pressed ? 0.7 : 1 }]}
                hitSlop={8}
              >
                <Ionicons name="color-palette" size={18} color={colors.primary} />
              </Pressable>

              {/* Bottom overlay: mood headline + energy */}
              <View style={s.heroFooter} pointerEvents="none">
                <View style={s.moodRow}>
                  <Text style={s.moodEmoji}>{status.meta.emoji}</Text>
                  <Text style={[s.moodValue, { fontFamily: DISPLAY }]}>{status.meta.label}</Text>
                  <View style={s.energyChip}>
                    <Ionicons name="flash" size={13} color="#FFFFFF" />
                    <Text style={[s.energyChipText, { fontFamily: "Inter_700Bold" }]}>{status.energy}%</Text>
                  </View>
                </View>
                <View style={s.energyTrack}>
                  <LinearGradient
                    colors={["#FFFFFF", "#E7F0E9"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.energyFill, { width: `${status.energy}%` }]}
                  />
                </View>
              </View>
            </View>

            {/* Next up row */}
            <Pressable
              onPress={() => router.push("/calendar")}
              style={({ pressed }) => [s.nextUpRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[s.nextUpIcon, { backgroundColor: colors.sage + "18" }]}>
                <PulseIcon name="paw" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.nextUpLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NEXT UP</Text>
                <Text style={[s.nextUpValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {status.nextRoutine
                    ? `${status.nextRoutine.label}${status.minutesUntilNext != null && status.minutesUntilNext <= 180 ? ` in ${status.minutesUntilNext} min` : ""} · ${status.nextRoutine.time}`
                    : "All caught up for today"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Care streak + day progress strip */}
          <View style={[s.statStrip, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.statStreak}>
              <View style={[s.streakBadge, { backgroundColor: colors.copper + "16" }]}>
                <Ionicons name="flame" size={22} color={colors.copper} />
              </View>
              <View>
                <Text style={[s.statBig, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {careStreak} {careStreak === 1 ? "day" : "days"}
                </Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Care streak
                </Text>
              </View>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statProgress}>
              <View style={{ flex: 1 }}>
                <Text style={[s.statBig, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {dayProgress >= 1 ? "All done" : "Today"}
                </Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Routines complete
                </Text>
              </View>
              <ProgressRing progress={dayProgress} color={colors.sage} track={colors.border} />
            </View>
          </View>

          {/* Today's Pulse — 5-card row */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Today's Pulse</Text>
            <Pressable onPress={() => router.push("/calendar")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Full day</Text>
            </Pressable>
          </View>
          <View style={[s.pulseRow, { gap: GAP }]}>
            {pulse.map((p) => {
              const tint = PULSE_COLORS[p.icon];
              return (
                <View
                  key={p.label}
                  style={[s.pulseCard, { width: colW, backgroundColor: colors.card, shadowColor: colors.primary }]}
                >
                  <View style={[s.pulseIconWrap, { backgroundColor: tint + "1A" }]}>
                    <PulseIcon name={p.icon} size={18} />
                  </View>
                  <Text style={[s.pulseValue, { color: colors.foreground, fontFamily: DISPLAY }]}>{p.value}</Text>
                  <Text numberOfLines={1} style={[s.pulseLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {p.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Quick Log — 5-col grid */}
          <View style={[s.sectionHeader, { marginTop: 26 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Quick Log</Text>
            <Pressable onPress={() => router.push("/log")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>See all</Text>
            </Pressable>
          </View>
          <View style={[s.quickGrid, { gap: GAP }]}>
            {QUICK_LOG.map((item) => {
              const tint = PULSE_COLORS[item.icon];
              return (
                <Pressable
                  key={item.key}
                  onPress={() => logQuick(item)}
                  style={({ pressed }) => [
                    s.quickTile,
                    { width: colW, transform: [{ scale: pressed ? 0.92 : 1 }] },
                  ]}
                >
                  <View style={[s.quickIconWrap, { backgroundColor: tint + "18" }]}>
                    <PulseIcon name={item.icon} size={26} />
                  </View>
                  <Text numberOfLines={1} style={[s.quickLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Handoff timeline */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Handoff</Text>
            <Pressable onPress={() => router.push("/log")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>View all</Text>
            </Pressable>
          </View>
          <View style={[s.handoffCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {recent.length === 0 ? (
              <Text style={[s.handoffEmpty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No activity logged yet today.
              </Text>
            ) : (
              recent.map((e, i) => {
                const cg = caregiverColor(e.caregiver);
                return (
                  <View
                    key={e.id}
                    style={[s.handoffRow, i < recent.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    <View style={[s.handoffAvatar, { backgroundColor: cg + "1A" }]}>
                      <Text style={[s.handoffInitial, { color: cg, fontFamily: "Inter_700Bold" }]}>
                        {(e.caregiver || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={[s.handoffIconWrap, { backgroundColor: PULSE_COLORS[TYPE_ICON[e.type] ?? "paw"] + "16" }]}>
                      <PulseIcon name={TYPE_ICON[e.type] ?? "paw"} size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[s.handoffTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {e.title}
                      </Text>
                      <Text style={[s.handoffMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {e.caregiver} · {relativeTime(e.occurredAt, now)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Health Watch */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Health Watch</Text>
            <Pressable onPress={() => router.push("/records")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Details</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push("/records")}
            style={({ pressed }) => [s.healthCard, { backgroundColor: colors.card, shadowColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={s.healthHeader}>
              <View style={[s.healthIconWrap, { backgroundColor: (healthOk ? colors.sage : colors.copper) + "1A" }]}>
                <Ionicons name={healthOk ? "heart" : "alert-circle"} size={20} color={healthOk ? colors.sage : colors.copper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.healthTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {healthOk ? "All looking good" : "Keep an eye out"}
                </Text>
                <Text style={[s.healthSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {healthOk ? "No alerts to review today" : "A tummy alert was logged today"}
                </Text>
              </View>
              <View style={[s.healthPill, { backgroundColor: (healthOk ? colors.sage : colors.copper) + "16" }]}>
                <Text style={[s.healthPillText, { color: healthOk ? colors.sage : colors.copper, fontFamily: "Inter_700Bold" }]}>
                  {healthOk ? "Good" : "Watch"}
                </Text>
              </View>
            </View>
            <View style={[s.healthStatsRow, { borderTopColor: colors.border }]}>
              {healthStats.map((h, i) => (
                <View key={h.label} style={[s.healthStat, i < healthStats.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[s.healthStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{h.value}</Text>
                  <Text style={[s.healthStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{h.label}</Text>
                </View>
              ))}
            </View>
          </Pressable>

          {/* Bedtime snack nudge — soft lavender */}
          {!bedtimeLogged && (
            <View style={[s.banner, { backgroundColor: "#EDE9F6", borderColor: "#DCD2EF" }]}>
              <Image source={getAvatarSource("happy")} style={s.bannerAvatar} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[s.bannerText, { color: "#3B2E63", fontFamily: "Inter_500Medium" }]}>
                  A bedtime snack helps {state.profile.name} feel great in the mornings.
                </Text>
              </View>
              <Pressable
                onPress={logBedtimeSnack}
                style={({ pressed }) => [s.bannerBtn, { borderColor: "#8B6FD0", opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[s.bannerBtnText, { color: "#6A4FB5", fontFamily: "Inter_700Bold" }]}>Log snack</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Toast */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toast,
            { bottom: (Platform.OS === "web" ? 100 : insets.bottom + 96), opacity: toastOpacity, backgroundColor: colors.foreground },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.sage} />
          <Text style={[s.toastText, { fontFamily: "Inter_600SemiBold" }]}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMarkWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brandMark: { width: 26, height: 26 },
  brandName: { fontSize: 21, letterSpacing: -0.2 },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  datePillText: { fontSize: 12.5 },

  greeting: { marginBottom: 18 },
  greetingTitle: { fontSize: 26, letterSpacing: -0.3, lineHeight: 32 },
  greetingSub: { fontSize: 15, marginTop: 4 },

  heroCard: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 26,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 7,
  },
  heroImageWrap: {
    width: "100%",
    aspectRatio: 0.96,
    position: "relative",
    backgroundColor: "#CFE3EF",
  },
  heroScrim: { ...StyleSheet.absoluteFillObject },
  nameChip: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  nameChipText: { fontSize: 15.5 },
  portraitBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  heroFooter: { position: "absolute", left: 16, right: 16, bottom: 14 },
  moodRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  moodEmoji: { fontSize: 22 },
  moodValue: { fontSize: 19, color: "#FFFFFF", flex: 1 },
  energyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 11,
  },
  energyChipText: { fontSize: 12.5, color: "#FFFFFF" },
  energyTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  energyFill: { height: "100%", borderRadius: 4 },

  nextUpRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  nextUpIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextUpLabel: { fontSize: 11, letterSpacing: 0.8 },
  nextUpValue: { fontSize: 15.5, marginTop: 2 },

  statStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    padding: 16,
    marginBottom: 26,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  statStreak: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  streakBadge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statDivider: { width: 1, height: 40, marginHorizontal: 14 },
  statProgress: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  statBig: { fontSize: 18, letterSpacing: -0.2 },
  statLabel: { fontSize: 12.5, marginTop: 1 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 20, letterSpacing: -0.2 },
  sectionLink: { fontSize: 14 },

  pulseRow: { flexDirection: "row", justifyContent: "space-between" },
  pulseCard: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  pulseIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  pulseValue: { fontSize: 16, letterSpacing: -0.3 },
  pulseLabel: { fontSize: 10.5, marginTop: 1 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  quickTile: { alignItems: "center" },
  quickIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  quickLabel: { fontSize: 11.5 },

  handoffCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  handoffEmpty: { fontSize: 14, paddingVertical: 18, textAlign: "center" },
  handoffRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13 },
  handoffAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  handoffInitial: { fontSize: 14 },
  handoffIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  handoffTitle: { fontSize: 15 },
  handoffMeta: { fontSize: 12.5, marginTop: 1 },

  healthCard: {
    borderRadius: 22,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  healthHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  healthIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  healthTitle: { fontSize: 16 },
  healthSub: { fontSize: 13, marginTop: 2 },
  healthPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  healthPillText: { fontSize: 13 },
  healthStatsRow: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  healthStat: { flex: 1, alignItems: "center" },
  healthStatValue: { fontSize: 17 },
  healthStatLabel: { fontSize: 12, marginTop: 2 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    padding: 14,
    marginTop: 26,
    borderWidth: 1,
  },
  bannerAvatar: { width: 46, height: 46, borderRadius: 14 },
  bannerText: { fontSize: 13.5, lineHeight: 19 },
  bannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1.5,
  },
  bannerBtnText: { fontSize: 13.5 },

  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  toastText: { color: "#FFFFFF", fontSize: 14 },
});
