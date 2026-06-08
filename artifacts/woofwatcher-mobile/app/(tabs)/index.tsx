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
import { WoofWatcherLogo } from "@/components/brand/WoofWatcherLogo";
import Svg, { Circle } from "react-native-svg";
import { deriveOnboardingStatus, normalizeCareEventType, type CareEventType } from "@workspace/care-domain";
import { computeCareStreak, computeDayProgress, derivePhoenixStatus, getGreeting } from "@/lib/phoenixStatus";
import { deriveTodayCommand } from "@/lib/todayCommand";
import { relativeTime } from "@/lib/time";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

interface QuickLogItem {
  key: string;
  icon: PulseIconName;
  label: string;
  type: CareEventType;
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
  meal: "bowl", treat: "bone", walk: "paw", potty: "drop", pee: "drop",
  poop: "drop", play: "candy", training: "star", vomit: "vomit", alone: "house",
  mood: "heart", weight: "scale", meds: "pill", medication: "pill", symptom: "vomit",
};

function ProgressRing({ progress, color, track }: { progress: number; color: string; track: string }) {
  const size = 54;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      </Svg>
      <Text style={{ position: "absolute", fontFamily: "Fredoka_700Bold", fontSize: 13, color }}>
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
}

export default function PhoenixScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addEntry, refresh, isSyncing } = useCare();
  const { getAvatarSource } = useAvatar();
  const { width } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const todayCommand = useMemo(() => deriveTodayCommand(state, now), [state, now]);
  const greeting = useMemo(() => getGreeting(now), [now]);
  const careStreak = useMemo(() => computeCareStreak(state, now), [state, now]);
  const dayProgress = useMemo(() => computeDayProgress(status), [status]);
  const caregiver = state.caregivers[0]?.name ?? "friend";
  const commandTint =
    todayCommand.primaryAction.urgency === "alert"
      ? colors.copper
      : todayCommand.primaryAction.urgency === "watch"
        ? colors.amber
        : colors.primary;

  const dateLabel = useMemo(
    () => new Date(now).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    [now],
  );

  // Smart: types logged in the last 45 minutes
  const recentlyLogged = useMemo(() => {
    const cutoff = now - 45 * 60 * 1000;
    return new Set(
      state.entries
        .filter((e) => new Date(e.occurredAt).getTime() > cutoff)
        .map((e) => normalizeCareEventType(e.type, e.details)),
    );
  }, [state.entries, now]);

  const recent = useMemo(
    () => [...state.entries].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 4),
    [state.entries],
  );

  const caregiverColor = (name: string) => {
    const palette = [colors.primary, colors.copper, colors.sage, colors.amber];
    const idx = state.caregivers.findIndex((c) => c.name === name);
    return palette[(idx >= 0 ? idx : 0) % palette.length];
  };

  const bedtimeLogged = useMemo(
    () => state.entries.some((e) => {
      const d = new Date(e.occurredAt);
      const t = new Date(now);
      const sameDay = d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
      return sameDay && normalizeCareEventType(e.type, e.details) === "treat" && /snack|bedtime/i.test(e.title);
    }),
    [state.entries, now],
  );

  const weightDisplay = useMemo(() => {
    const w = state.profile.weight;
    if (!w.current || w.current === 0) return "—";
    return `${w.current} ${w.unit}`;
  }, [state.profile.weight]);

  // Weight trend: compare most recent two weight logs
  const weightTrend = useMemo(() => {
    const logs = state.entries
      .filter((e) => normalizeCareEventType(e.type, e.details) === "weight" && e.amount)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    if (logs.length < 2) return null;
    const latest = parseFloat(logs[0].amount as string);
    const prev = parseFloat(logs[1].amount as string);
    if (Number.isNaN(latest) || Number.isNaN(prev) || latest === prev) return null;
    return latest < prev ? "down" : "up";
  }, [state.entries]);

  // Mount fade-in
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slide, { toValue: 0, friction: 7, tension: 50, useNativeDriver: Platform.OS !== "web" }),
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
      Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: Platform.OS !== "web" }).start(() => setToast(null));
    }, 1500);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const logQuick = (item: QuickLogItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addEntry({
      type: normalizeCareEventType(item.type), title: item.title, caregiver,
      occurredAt: new Date().toISOString(),
      ...(item.mood ? { mood: item.mood } : {}),
      ...(item.severity ? { severity: item.severity } : {}),
    });
    showToast(`${item.label} logged`);
  };

  const logBedtimeSnack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addEntry({ type: "treat", title: "Bedtime snack", caregiver, occurredAt: new Date().toISOString() });
    showToast("Bedtime snack logged");
  };

  const openCommand = () => {
    Haptics.selectionAsync();
    if (todayCommand.primaryAction.kind === "sync") {
      refresh();
    }

    switch (todayCommand.primaryAction.route) {
      case "/calendar":
        router.push("/calendar");
        break;
      case "/records":
        router.push("/records");
        break;
      case "/woofguide":
        router.push("/woofguide");
        break;
      case "/more":
        router.push("/more");
        break;
      case "/log":
      default:
        router.push("/log");
        break;
    }
  };

  const H_PAD = 20;
  const GAP = 10;
  const colW = (width - H_PAD * 2 - GAP * 4) / 5;

  const c = status.counts;
  const pulse = [
    { icon: "bowl" as PulseIconName, label: "Meals", value: `${c.meals.done}/${c.meals.target}`, done: c.meals.done >= c.meals.target },
    { icon: "paw" as PulseIconName, label: "Walks", value: `${c.walks.done}/${c.walks.target}`, done: c.walks.done >= c.walks.target },
    { icon: "drop" as PulseIconName, label: "Potty", value: `${c.potty.done}/${c.potty.target}`, done: c.potty.done >= c.potty.target },
    { icon: "star" as PulseIconName, label: "Training", value: `${c.training}`, done: c.training > 0 },
    { icon: "heart" as PulseIconName, label: "Health", value: c.healthAlert ? "!" : "✓", done: !c.healthAlert },
  ];

  const healthOk = !c.healthAlert;
  const appetiteOk = c.meals.done >= c.meals.target;
  const healthStats = [
    { label: "Energy", value: `${status.energy}%`, tint: colors.primary },
    {
      label: "Weight",
      value: weightDisplay,
      tint: colors.copper,
      suffix: weightTrend === "down" ? "↓" : weightTrend === "up" ? "↑" : undefined,
      suffixColor: weightTrend === "down" ? colors.sage : colors.amber,
    },
    { label: "Appetite", value: appetiteOk ? "Good" : "Low", tint: appetiteOk ? colors.sage : colors.amber },
  ];

  const onboarding = useMemo(
    () =>
      deriveOnboardingStatus({
        profile: state.profile,
        dietProfile: state.dietProfile,
        routines: state.routines,
        caregivers: state.caregivers,
      }),
    [state.profile, state.dietProfile, state.routines, state.caregivers],
  );
  const setupStep = onboarding.nextStep;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 130, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>

          {/* Branded header */}
          <View style={s.brandRow}>
            <WoofWatcherLogo size={30} wordmarkSize={21} />
            <View style={[s.datePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
              <Text style={[s.datePillText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{dateLabel}</Text>
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

          {/* Onboarding nudge */}
          {setupStep && (
            <Pressable
              onPress={() => router.push(setupStep.route)}
              style={({ pressed }) => [s.onboardCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "28", opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={[s.onboardIcon, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="paw" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.onboardTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{setupStep.title}</Text>
                <Text style={[s.onboardSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {setupStep.detail}
                </Text>
                <Text style={[s.onboardProgress, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                  {onboarding.completedCount}/{onboarding.totalCount} setup steps complete
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          )}

          {/* Today command */}
          <Pressable
            onPress={openCommand}
            style={({ pressed }) => [
              s.commandCard,
              {
                backgroundColor: colors.card,
                borderColor: commandTint + "30",
                shadowColor: commandTint,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={s.commandTop}>
              <View style={[s.commandIconWrap, { backgroundColor: commandTint + "18" }]}>
                <PulseIcon name={todayCommand.primaryAction.icon} size={28} color={commandTint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.commandEyebrow, { color: commandTint, fontFamily: "Inter_700Bold" }]}>
                  NEXT BEST MOVE
                </Text>
                <Text style={[s.commandTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {todayCommand.primaryAction.kind === "sync" && isSyncing
                    ? "Syncing care logs"
                    : todayCommand.primaryAction.label}
                </Text>
                <Text style={[s.commandDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {todayCommand.primaryAction.detail}
                </Text>
              </View>
              <View style={[s.commandArrow, { backgroundColor: commandTint + "16" }]}>
                <Ionicons name="arrow-forward" size={18} color={commandTint} />
              </View>
            </View>

            <View style={[s.commandMetaRow, { borderTopColor: colors.border }]}>
              <View style={s.commandMetaItem}>
                <Text style={[s.commandMetaLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Health</Text>
                <Text numberOfLines={1} style={[s.commandMetaValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {todayCommand.health.label}
                </Text>
              </View>
              <View style={[s.commandMetaDivider, { backgroundColor: colors.border }]} />
              <View style={s.commandMetaItem}>
                <Text style={[s.commandMetaLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Handoff</Text>
                <Text numberOfLines={1} style={[s.commandMetaValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {todayCommand.handoff.caregiver ?? "Ready"}
                </Text>
              </View>
              <View style={[s.commandMetaDivider, { backgroundColor: colors.border }]} />
              <View style={s.commandMetaItem}>
                <Text style={[s.commandMetaLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Sync</Text>
                <Text numberOfLines={1} style={[s.commandMetaValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {isSyncing ? "Syncing" : todayCommand.sync.label}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Living hero card */}
          <View style={[s.heroCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.heroImageWrap}>
              <AnimatedAvatar mood={status.mood} speech={status.meta.speech} />
              <LinearGradient
                colors={["rgba(20,30,24,0.08)", "transparent", "rgba(10,20,16,0.65)"]}
                locations={[0, 0.42, 1]}
                style={s.heroScrim}
                pointerEvents="none"
              />
              <Pressable onPress={() => router.push("/more")} style={s.nameChip}>
                <Text style={[s.nameChipText, { color: colors.foreground, fontFamily: DISPLAY }]}>{state.profile.name}</Text>
                <Ionicons name="chevron-down" size={15} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={() => router.push("/portrait")}
                style={({ pressed }) => [s.portraitBtn, { opacity: pressed ? 0.7 : 1 }]}
                hitSlop={8}
              >
                <Ionicons name="color-palette" size={18} color={colors.primary} />
              </Pressable>
              <View style={s.heroFooter} pointerEvents="none">
                <View style={s.moodRow}>
                  <Text style={s.moodEmoji}>{status.meta.emoji}</Text>
                  <Text style={[s.moodValue, { fontFamily: DISPLAY }]}>{status.meta.label}</Text>
                  <View style={s.energyChip}>
                    <Ionicons name="flash" size={12} color="#FFFFFF" />
                    <Text style={[s.energyChipText, { fontFamily: "Inter_700Bold" }]}>{status.energy}%</Text>
                  </View>
                </View>
                <View style={s.energyTrack}>
                  <LinearGradient colors={["#FFFFFF", "#D8EEE2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[s.energyFill, { width: `${status.energy}%` }]} />
                </View>
              </View>
            </View>

            {/* Next up row */}
            <Pressable onPress={() => router.push("/calendar")} style={({ pressed }) => [s.nextUpRow, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={[s.nextUpIcon, { backgroundColor: colors.sage + "16" }]}>
                <PulseIcon name="paw" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.nextUpLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NEXT UP</Text>
                <Text style={[s.nextUpValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {status.nextRoutine
                    ? `${status.nextRoutine.label}${status.minutesUntilNext != null && status.minutesUntilNext <= 180 ? ` in ${status.minutesUntilNext} min` : ""} · ${status.nextRoutine.time}`
                    : "All caught up for today ✓"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Care streak + day progress */}
          <View style={[s.statStrip, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.statStreak}>
              <LinearGradient colors={[colors.copper + "30", colors.copper + "10"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.streakBadge}>
                <Ionicons name="flame" size={22} color={colors.copper} />
              </LinearGradient>
              <View>
                <Text style={[s.statBig, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {careStreak} {careStreak === 1 ? "day" : "days"}
                </Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Care streak</Text>
              </View>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statProgress}>
              <View style={{ flex: 1 }}>
                <Text style={[s.statBig, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {dayProgress >= 1 ? "All done" : "Today"}
                </Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {dayProgress >= 1 ? "Routines complete ✓" : "Routines in progress"}
                </Text>
              </View>
              <ProgressRing progress={dayProgress} color={dayProgress >= 1 ? colors.sage : colors.primary} track={colors.border} />
            </View>
          </View>

          {/* Today's Pulse */}
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
                <View key={p.label} style={[s.pulseCard, { width: colW, backgroundColor: colors.card, shadowColor: tint }]}>
                  {p.done && (
                    <View style={[s.pulseDoneDot, { backgroundColor: colors.sage }]} />
                  )}
                  <View style={[s.pulseIconWrap, { backgroundColor: tint + "18" }]}>
                    <PulseIcon name={p.icon} size={18} />
                  </View>
                  <Text style={[s.pulseValue, { color: p.done ? colors.sage : colors.foreground, fontFamily: DISPLAY }]}>{p.value}</Text>
                  <Text numberOfLines={1} style={[s.pulseLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{p.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Quick Log */}
          <View style={[s.sectionHeader, { marginTop: 26 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Quick Log</Text>
            <Pressable onPress={() => router.push("/log")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>See all</Text>
            </Pressable>
          </View>
          <View style={[s.quickGrid, { gap: GAP }]}>
            {QUICK_LOG.map((item) => {
              const tint = PULSE_COLORS[item.icon];
              const isRecent = recentlyLogged.has(item.type);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => logQuick(item)}
                  style={({ pressed }) => [
                    s.quickTile,
                    { width: colW, transform: [{ scale: pressed ? 0.88 : 1 }] },
                  ]}
                >
                  <View style={{ position: "relative" }}>
                    <View style={[s.quickIconWrap, { backgroundColor: isRecent ? tint + "28" : tint + "16" }]}>
                      <PulseIcon name={item.icon} size={26} color={isRecent ? tint : undefined} />
                    </View>
                    {isRecent && (
                      <View style={[s.recentDot, { backgroundColor: colors.sage, borderColor: colors.background }]} />
                    )}
                  </View>
                  <Text numberOfLines={1} style={[s.quickLabel, { color: isRecent ? colors.foreground : colors.mutedForeground, fontFamily: isRecent ? "Inter_700Bold" : "Inter_600SemiBold" }]}>
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
              <View style={s.handoffEmptyWrap}>
                <Ionicons name="clipboard-outline" size={28} color={colors.mutedForeground} />
                <Text style={[s.handoffEmpty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No activity logged yet. Use Quick Log above.
                </Text>
              </View>
            ) : (
              recent.map((e, i) => {
                const cg = caregiverColor(e.caregiver);
                const icon = TYPE_ICON[normalizeCareEventType(e.type, e.details)] ?? "paw";
                const timeStr = new Date(e.occurredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                return (
                  <View key={e.id} style={[s.handoffRow, i < recent.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[s.handoffAvatar, { backgroundColor: cg + "18" }]}>
                      <Text style={[s.handoffInitial, { color: cg, fontFamily: "Inter_700Bold" }]}>
                        {(e.caregiver || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={[s.handoffIconWrap, { backgroundColor: PULSE_COLORS[icon] + "14" }]}>
                      <PulseIcon name={icon} size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[s.handoffTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{e.title}</Text>
                      <Text style={[s.handoffMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {e.caregiver} · {timeStr}
                      </Text>
                    </View>
                    <Text style={[s.handoffRelTime, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {relativeTime(e.occurredAt, now)}
                    </Text>
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
              <View style={[s.healthIconWrap, { backgroundColor: (healthOk ? colors.sage : colors.copper) + "18" }]}>
                <Ionicons name={healthOk ? "heart" : "alert-circle"} size={20} color={healthOk ? colors.sage : colors.copper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.healthTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {healthOk ? "All looking good" : "Keep an eye out"}
                </Text>
                <Text style={[s.healthSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {healthOk ? "No alerts today" : "A tummy alert was logged"}
                </Text>
              </View>
              <View style={[s.healthPill, { backgroundColor: (healthOk ? colors.sage : colors.copper) + "14" }]}>
                <Text style={[s.healthPillText, { color: healthOk ? colors.sage : colors.copper, fontFamily: "Inter_700Bold" }]}>
                  {healthOk ? "Good" : "Watch"}
                </Text>
              </View>
            </View>
            <View style={[s.healthStatsRow, { borderTopColor: colors.border }]}>
              {healthStats.map((h, i) => (
                <View key={h.label} style={[s.healthStat, i < healthStats.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <View style={s.healthStatValueRow}>
                    <Text style={[s.healthStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{h.value}</Text>
                    {h.suffix && (
                      <Text style={[s.healthStatArrow, { color: h.suffixColor }]}>{h.suffix}</Text>
                    )}
                  </View>
                  <Text style={[s.healthStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{h.label}</Text>
                </View>
              ))}
            </View>
          </Pressable>

          {/* Bedtime snack nudge */}
          {!bedtimeLogged && (
            <View style={[s.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Image source={getAvatarSource("happy")} style={s.bannerAvatar} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[s.bannerTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  Bedtime snack?
                </Text>
                <Text style={[s.bannerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Helps {state.profile.name} feel great in the mornings.
                </Text>
              </View>
              <Pressable
                onPress={logBedtimeSnack}
                style={({ pressed }) => [s.bannerBtn, { backgroundColor: colors.primary + "16", borderColor: colors.primary + "30", opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[s.bannerBtnText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>Log</Text>
              </Pressable>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* Toast */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[s.toast, { bottom: (Platform.OS === "web" ? 100 : insets.bottom + 96), opacity: toastOpacity, backgroundColor: colors.foreground }]}
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
  datePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
  datePillText: { fontSize: 12.5 },

  greeting: { marginBottom: 18 },
  greetingTitle: { fontSize: 26, letterSpacing: -0.3, lineHeight: 32 },
  greetingSub: { fontSize: 15, marginTop: 4 },

  onboardCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 14, marginBottom: 16, borderWidth: 1 },
  onboardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  onboardTitle: { fontSize: 15 },
  onboardSub: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  onboardProgress: { fontSize: 11.5, marginTop: 7, letterSpacing: 0 },

  commandCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  commandTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  commandIconWrap: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  commandEyebrow: { fontSize: 10.5, letterSpacing: 0, marginBottom: 3 },
  commandTitle: { fontSize: 18, lineHeight: 23 },
  commandDetail: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  commandArrow: { width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  commandMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 15, paddingTop: 13, borderTopWidth: 1 },
  commandMetaItem: { flex: 1, minWidth: 0 },
  commandMetaLabel: { fontSize: 11, marginBottom: 2 },
  commandMetaValue: { fontSize: 12.5 },
  commandMetaDivider: { width: 1, height: 28, marginHorizontal: 10 },

  heroCard: { borderRadius: 28, overflow: "hidden", marginBottom: 20, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 7 },
  heroImageWrap: { width: "100%", aspectRatio: 0.96, position: "relative", backgroundColor: "#CFE3EF" },
  heroScrim: { ...StyleSheet.absoluteFillObject },
  nameChip: {
    position: "absolute", top: 14, left: 14,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 14,
    shadowColor: "#0F1F33", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  nameChipText: { fontSize: 15.5 },
  portraitBtn: {
    position: "absolute", top: 14, right: 14,
    width: 40, height: 40, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#0F1F33", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  heroFooter: { position: "absolute", left: 16, right: 16, bottom: 14 },
  moodRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  moodEmoji: { fontSize: 22 },
  moodValue: { fontSize: 19, color: "#FFFFFF", flex: 1 },
  energyChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 11 },
  energyChipText: { fontSize: 12, color: "#FFFFFF" },
  energyTrack: { height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden" },
  energyFill: { height: "100%", borderRadius: 4 },
  nextUpRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  nextUpIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextUpLabel: { fontSize: 10.5, letterSpacing: 0.8 },
  nextUpValue: { fontSize: 15, marginTop: 2 },

  statStrip: { flexDirection: "row", alignItems: "center", borderRadius: 22, padding: 16, marginBottom: 24, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3 },
  statStreak: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  streakBadge: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  statDivider: { width: 1, height: 40, marginHorizontal: 14 },
  statProgress: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  statBig: { fontSize: 18, letterSpacing: -0.2 },
  statLabel: { fontSize: 12, marginTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 20, letterSpacing: -0.2 },
  sectionLink: { fontSize: 14 },

  pulseRow: { flexDirection: "row", justifyContent: "space-between" },
  pulseCard: {
    borderRadius: 18, paddingVertical: 13, paddingHorizontal: 4, alignItems: "center",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2,
    position: "relative",
  },
  pulseDoneDot: { position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: 4 },
  pulseIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  pulseValue: { fontSize: 16, letterSpacing: -0.3 },
  pulseLabel: { fontSize: 10, marginTop: 2 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
  quickTile: { alignItems: "center" },
  quickIconWrap: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  quickLabel: { fontSize: 11.5 },
  recentDot: { position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },

  handoffCard: { borderRadius: 22, paddingHorizontal: 16, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  handoffEmptyWrap: { paddingVertical: 24, alignItems: "center", gap: 10 },
  handoffEmpty: { fontSize: 14, textAlign: "center" },
  handoffRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13 },
  handoffAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  handoffInitial: { fontSize: 14 },
  handoffIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  handoffTitle: { fontSize: 15 },
  handoffMeta: { fontSize: 12, marginTop: 1 },
  handoffRelTime: { fontSize: 12 },

  healthCard: { borderRadius: 22, padding: 16, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  healthHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  healthIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  healthTitle: { fontSize: 16 },
  healthSub: { fontSize: 13, marginTop: 2 },
  healthPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  healthPillText: { fontSize: 13 },
  healthStatsRow: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  healthStat: { flex: 1, alignItems: "center" },
  healthStatValueRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  healthStatValue: { fontSize: 17 },
  healthStatArrow: { fontSize: 14, fontFamily: "Inter_700Bold" },
  healthStatLabel: { fontSize: 12, marginTop: 2 },

  banner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, padding: 14, marginTop: 24, borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 1 },
  bannerAvatar: { width: 44, height: 44, borderRadius: 14 },
  bannerTitle: { fontSize: 14.5 },
  bannerText: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  bannerBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 13, borderWidth: 1.5 },
  bannerBtnText: { fontSize: 14 },

  toast: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  toastText: { color: "#FFFFFF", fontSize: 14 },
});
