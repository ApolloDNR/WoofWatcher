import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deriveCareIntelligence, normalizeCareEventType, type CareEventDetails } from "@workspace/care-domain";

import {
  BoardCard,
  BoardSectionHeader,
  CareRow,
  QuickActionTile,
  StatusMeter,
} from "@/components/board/BoardPrimitives";
import {
  LivingPhoenixRoom,
  type PhoenixRoomReaction,
  type PhoenixRoomStat,
} from "@/components/LivingPhoenixRoom";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { WoofWatcherLogo } from "@/components/brand/WoofWatcherLogo";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import { deriveAvatarMotion } from "@/lib/avatarMotion";
import { derivePhoenixStatus, type Mood } from "@/lib/phoenixStatus";

const HERO_RATIO = 1.05;

interface QuickItem {
  key: string;
  icon: PixelIconName;
  label: string;
  type: string;
  title: string;
  mood?: string;
  severity?: string;
  route?: "/log";
}

const HOME_QUICK_LOG: QuickItem[] = [
  { key: "meal", icon: "meal", label: "Meal", type: "meal", title: "Meal" },
  { key: "walk", icon: "walk", label: "Walk", type: "walk", title: "Walk" },
  { key: "pee", icon: "pee", label: "Pee", type: "potty", title: "Potty - Pee" },
  { key: "water", icon: "bile", label: "Water", type: "water", title: "Fresh water" },
  { key: "training", icon: "training", label: "Training", type: "training", title: "Training win" },
  { key: "treat", icon: "treat", label: "Treat", type: "treat", title: "Treat" },
  { key: "play", icon: "play", label: "Play", type: "play", title: "Play session" },
  { key: "more", icon: "note", label: "More", type: "note", title: "Open quick log", route: "/log" },
];

const SPEECH_BY_MOOD: Record<Mood, string> = {
  happy: "Good morning!\nWalk time soon?\nI'm ready!",
  excited: "Good morning!\nWalk time soon?\nI'm ready!",
  calm: "Good morning!\nWalk time soon?\nI'm ready!",
  anxious: "Stay close today.\nA calm plan helps.",
  unwell: "Tummy feels off.\nLet's watch gently.",
};

const MOOD_ICON: Record<Mood, PixelIconName> = {
  happy: "mood_great",
  excited: "mood_great",
  calm: "mood_good",
  anxious: "mood_meh",
  unwell: "mood_rough",
};

function completionLabel(done: number, target: number): string {
  if (!target) return `${done}`;
  return `${Math.min(done, target)}/${target}`;
}

function routineIcon(type: string): PixelIconName {
  const t = normalizeCareEventType(type);
  if (t === "walk") return "walk";
  if (t === "meal") return "meal";
  if (t === "training") return "training";
  if (t === "potty") return "pee";
  if (t === "medication") return "medication";
  if (t === "play") return "play";
  if (t === "treat") return "treat";
  if (t === "water") return "bile";
  if (t === "vomit") return "bile";
  return "clock";
}

function formatDuration(min: number): string {
  if (min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function isToday(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function detailValue(details: unknown, key: string): unknown {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  return (details as Record<string, unknown>)[key];
}

function careDetails(details: unknown): CareEventDetails {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  return details as CareEventDetails;
}

function isPendingMealLog(entry: { type: string; details?: unknown }): boolean {
  const details = careDetails(entry.details);
  if (normalizeCareEventType(entry.type, details) !== "meal") return false;
  const completion = String(detailValue(entry.details, "mealCompletion") ?? "");
  const lifecycle = String(detailValue(entry.details, "mealLifecycle") ?? "");
  return lifecycle === "outcome-pending" || completion === "served" || completion === "grazing";
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addEntry } = useCare();
  const { avatarConfig, hasConfiguredAvatar } = useAvatar();

  const topInset = Platform.OS === "web" ? 18 : insets.top;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const avatarMotion = useMemo(
    () =>
      deriveAvatarMotion({
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
        energy: status.energy,
      }),
    [state.entries, state.routines, state.caregivers, now, status.energy],
  );
  const careIntelligence = useMemo(
    () =>
      deriveCareIntelligence({
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
      }),
    [state.entries, state.routines, state.caregivers, now],
  );

  const petName =
    state.profile.name && state.profile.name !== "My Dog"
      ? state.profile.name
      : "Phoenix";
  const avatarTemplate = useMemo(
    () => getAvatarTemplate(avatarConfig.templateId),
    [avatarConfig.templateId],
  );
  const caregiver = state.caregivers[0]?.name ?? "Emma";
  const timeLabel = useMemo(() => shortTime(new Date(now).toISOString()), [now]);

  const meals = status.counts.meals;
  const fed = meals.target > 0 ? meals.done >= meals.target : true;
  const bondLabel = status.mood === "unwell" ? "Okay" : "Strong";
  const hydrationScore = 72;
  const hungerScore = fed ? 86 : 42;
  const hungerLabel = fed ? "Good" : "Hungry";
  const bondScore = status.mood === "anxious" ? 70 : 92;
  const moodIcon = MOOD_ICON[status.mood];

  const pendingMeal = useMemo(
    () =>
      [...state.entries]
        .filter((entry) => isToday(entry.occurredAt, now) && isPendingMealLog(entry))
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0] ?? null,
    [state.entries, now],
  );

  const nextUp = useMemo(() => {
    if (pendingMeal) {
      const label = pendingMeal.title.split(" - ")[0] || "Meal";
      return [
        {
          label: `${label} served`,
          time: "Outcome pending",
          icon: "meal" as PixelIconName,
        },
      ];
    }
    if (state.routines.length) {
      return state.routines.slice(0, 3).map((r) => ({
        label: r.label,
        time: r.time,
        icon: routineIcon(r.type),
      }));
    }
    return [
      { label: `Walk with ${caregiver}`, time: "5:30 PM", icon: "walk" as PixelIconName },
      { label: "Dinner", time: "7:00 PM", icon: "meal" as PixelIconName },
      { label: "Training", time: "6:30 PM", icon: "training" as PixelIconName },
    ];
  }, [pendingMeal, state.routines, caregiver]);

  const nextPrimary = nextUp[0];
  const nextCount = Math.max(nextUp.length, 1);
  const nextMeta =
    pendingMeal
      ? "Open meal"
      : status.minutesUntilNext !== null
      ? `In ${formatDuration(status.minutesUntilNext)}`
      : nextPrimary?.time ?? "Ready";
  const nextDetail =
    pendingMeal
      ? "Outcome pending - update when Phoenix finishes"
      : status.minutesUntilNext !== null
      ? `${nextMeta} - ${nextPrimary?.time ?? "Scheduled"}`
      : nextPrimary?.time ?? "Ready when you are";

  const health = status.counts.healthAlert
    ? { status: "Needs Watch", sub: "Recent symptom logged", color: colors.amber }
    : { status: "Stable", sub: "All good right now", color: colors.sage };

  const bileCount = useMemo(
    () =>
      state.entries.filter((e) => {
        if (!isToday(e.occurredAt, now)) return false;
        const t = normalizeCareEventType(e.type, e.details);
        return t === "vomit" || t === "symptom" || /bile/i.test(e.title);
      }).length,
    [state.entries, now],
  );
  const bile =
    bileCount === 0
      ? { status: "Low Risk", sub: "Everything looks good", color: colors.sage }
      : { status: "Watch", sub: `${bileCount} flagged today`, color: colors.amber };

  const roomStats = useMemo<PhoenixRoomStat[]>(
    () => [
      {
        label: "Mood",
        value: status.meta.label,
        icon: moodIcon,
        tone: status.mood === "unwell" ? colors.rose : status.mood === "anxious" ? colors.amber : colors.sage,
        progress: status.mood === "unwell" ? 44 : status.mood === "anxious" ? 62 : 92,
      },
      {
        label: "Energy",
        value: `${status.energy}%`,
        icon: "energy",
        tone: colors.sage,
        progress: status.energy,
      },
      {
        label: "Hunger",
        value: hungerLabel,
        icon: "hunger",
        tone: fed ? colors.sage : colors.copper,
        progress: hungerScore,
      },
      {
        label: "Hydration",
        value: "Good",
        icon: "bile",
        tone: colors.blueSignal,
        progress: hydrationScore,
      },
      {
        label: "Bond",
        value: bondLabel,
        icon: "heart",
        tone: colors.rose,
        progress: bondScore,
      },
    ],
    [
      bondLabel,
      bondScore,
      colors.amber,
      colors.blueSignal,
      colors.copper,
      colors.rose,
      colors.sage,
      fed,
      hungerLabel,
      hungerScore,
      hydrationScore,
      moodIcon,
      status.energy,
      status.meta.label,
      status.mood,
    ],
  );

  const aloneMinutes = useMemo(
    () =>
      state.entries
        .filter(
          (e) =>
            isToday(e.occurredAt, now) &&
            normalizeCareEventType(e.type, e.details) === "alone",
        )
        .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0),
    [state.entries, now],
  );
  const alone = {
    status: aloneMinutes > 0 ? formatDuration(aloneMinutes) : "0m",
    sub: aloneMinutes > 0 ? "Time alone today" : "None logged today",
    color: colors.copper,
  };

  const recentActivity = useMemo(
    () =>
      [...state.entries]
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
        .slice(0, 3)
        .map((entry) => ({
          title: entry.title,
          time: shortTime(entry.occurredAt),
          icon: routineIcon(entry.type),
          caregiver: entry.caregiver,
        })),
    [state.entries],
  );

  const careProgress = careIntelligence.score;
  const questLine = careIntelligence.title;

  const statusTiles = [
    { label: "Happiness", value: status.meta.label, icon: moodIcon, tone: colors.amber },
    { label: "Energy", value: `${status.energy}%`, icon: "energy" as PixelIconName, tone: colors.sage },
    { label: "Hunger", value: hungerLabel, icon: "hunger" as PixelIconName, tone: fed ? colors.sage : colors.copper },
    { label: "Bond", value: bondLabel, icon: "heart" as PixelIconName, tone: colors.rose },
  ];

  const [toast, setToast] = useState<string | null>(null);
  const [roomReaction, setRoomReaction] = useState<PhoenixRoomReaction | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: Platform.OS !== "web",
      }).start(() => setToast(null));
    }, 1400);
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const logQuick = (item: QuickItem) => {
    if (item.route) {
      router.push(item.route);
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    addEntry({
      type: item.type,
      title: item.title,
      caregiver,
      occurredAt: new Date().toISOString(),
      mood: item.mood,
      severity: item.severity,
    });
    setRoomReaction({
      id: Date.now(),
      icon: item.icon,
      label: `${item.label} logged`,
      detail: avatarMotion.cue === "health-watch" ? "Health context updated." : "Phoenix reacts in the room.",
      tone: item.type === "vomit" || item.severity === "alert" ? colors.rose : colors.brandNavy,
    });
    showToast(`${item.title} logged`);
  };

  const tapPhoenixRoom = () => {
    setRoomReaction({
      id: Date.now(),
      icon: "heart",
      label: "Phoenix barked",
      detail: "She heard you.",
      tone: colors.brandNavy,
      spriteAction: "bark-loop",
    });
    showToast(avatarMotion.line);
  };

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 450,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [fade]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: topInset + 8,
          paddingBottom: 142,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade }}>
          <View style={s.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open More"
              onPress={() => router.push("/more")}
              hitSlop={10}
              style={[s.headerButton, { borderColor: "transparent", backgroundColor: "transparent" }]}
            >
              <Ionicons name="menu" size={27} color={colors.navy} />
            </Pressable>
            <View style={s.logoWrap}>
              <WoofWatcherLogo size={39} wordmarkSize={30} />
              <Text style={[s.logoSub, { color: colors.navy, fontFamily: "Inter_600SemiBold" }]}>
                Real care. Pixel heart.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Health Watch"
              onPress={() => router.push("/health")}
              hitSlop={10}
              style={[s.headerButton, { borderColor: "transparent", backgroundColor: "transparent" }]}
            >
              <Ionicons name="notifications-outline" size={23} color={colors.navy} />
              <View style={[s.badge, { backgroundColor: colors.rose }]}>
                <Text style={[s.badgeText, { fontFamily: "Inter_700Bold" }]}>3</Text>
              </View>
            </Pressable>
          </View>

          <BoardCard padded={false} style={s.heroCard}>
            <View style={[s.heroConsoleHeader, { backgroundColor: colors.ivory, borderBottomColor: colors.border }]}>
              <View style={s.heroConsoleTitleRow}>
                <PixelIcon name="heart" size={22} />
                <View style={s.heroConsoleCopy}>
                  <Text style={[s.heroConsoleKicker, { color: colors.copper, fontFamily: "Fredoka_600SemiBold" }]}>
                    PHOENIX HOME
                  </Text>
                  <Text numberOfLines={1} style={[s.heroConsoleTitle, { color: colors.navy, fontFamily: "Fredoka_700Bold" }]}>
                    Live care twin
                  </Text>
                </View>
              </View>
              <View style={[s.heroConsoleBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[s.heroConsoleBadgeText, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                  {avatarMotion.label}
                </Text>
              </View>
            </View>
            <View style={s.heroWrap}>
              <LivingPhoenixRoom
                mood={avatarMotion.avatarMood}
                motion={avatarMotion}
                speech={avatarMotion.speech || SPEECH_BY_MOOD[status.mood]}
                energy={status.energy}
                presenceLabel={`${petName} with ${caregiver}`}
                nextLabel={avatarMotion.label}
                reaction={roomReaction}
                statusReadouts={roomStats}
                onPress={tapPhoenixRoom}
              />
            </View>
          </BoardCard>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${petName} is with ${caregiver}`}
            onPress={() => router.push("/more")}
            style={[s.presencePanel, { backgroundColor: colors.ivory, borderColor: colors.border }]}
          >
            <View style={[s.presenceAvatar, { backgroundColor: colors.copper }]}>
              <Text style={[s.presenceInitial, { fontFamily: "Inter_700Bold" }]}>
                {caregiver.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.presenceCopy}>
              <Text style={[s.presenceText, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                {petName} is with {caregiver}
              </Text>
              <Text style={[s.presenceSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                At home - {timeLabel}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.navy} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open Avatar Studio. ${avatarTemplate.label} care twin ${hasConfiguredAvatar ? "configured" : "ready to customize"}`}
            onPress={() => router.push("/portrait")}
            style={[s.avatarIdentityBar, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[s.avatarIdentityIcon, { backgroundColor: colors.secondary }]}>
              <PixelIcon name="heart" size={22} />
            </View>
            <View style={s.avatarIdentityCopy}>
              <Text style={[s.avatarIdentityTitle, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                {avatarTemplate.label} care twin
              </Text>
              <Text style={[s.avatarIdentitySub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {avatarConfig.scanAssisted ? "Scan-assisted traits saved" : "Template ready - customize Phoenix"}
              </Text>
            </View>
            <Ionicons name="color-palette-outline" size={18} color={colors.navy} />
          </Pressable>

          <View style={s.statusTiles}>
            {statusTiles.map((tile) => (
              <View
                key={tile.label}
                style={[s.statusTile, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[s.statusTileIcon, { backgroundColor: tile.tone + "16" }]}>
                  <PixelIcon name={tile.icon} size={29} />
                </View>
                <Text style={[s.statusTileLabel, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                  {tile.label}
                </Text>
                <Text style={[s.statusTileValue, { color: tile.tone, fontFamily: "Inter_700Bold" }]}>
                  {tile.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={s.homeSplit}>
            <BoardCard style={[s.nextCard, s.homeSplitCard]}>
              <BoardSectionHeader title="Next Up" action={`1 of ${nextCount}`} />
              {nextUp.slice(0, 3).map((item, index) => (
                <CareRow
                  key={`${item.label}-${item.time}-${index}`}
                  icon={item.icon}
                  title={item.label}
                  detail={index === 0 ? nextDetail : item.time}
                  meta={index === 0 && pendingMeal ? "Update" : index === 0 ? "Start" : ""}
                  onPress={() => router.push(pendingMeal ? "/log?type=meal" : "/calendar")}
                />
              ))}
            </BoardCard>

            <BoardCard style={[s.quickHomeCard, s.homeSplitCard]}>
              <BoardSectionHeader title="Quick Log" action="Open" />
              <View style={s.homeQuickGrid}>
                {HOME_QUICK_LOG.map((item) => (
                  <QuickActionTile
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    accessibilityLabel={item.route ? "Open Quick Log" : `Log ${item.label}`}
                    onPress={() => logQuick(item)}
                    accent={colors.secondary}
                    style={s.homeQuickTile}
                    iconSize={25}
                    labelStyle={s.homeQuickText}
                  />
                ))}
              </View>
            </BoardCard>
          </View>

          <View style={s.cardGrid}>
            <BoardCard style={s.gridCard}>
              <BoardSectionHeader title="Today at a glance" />
              <View style={s.todayGrid}>
                <View style={s.todayMetric}>
                  <PixelIcon name="walk" size={26} />
                  <Text style={[s.metricValue, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                    {status.counts.walkMinutes}m
                  </Text>
                  <Text style={[s.metricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    Activity
                  </Text>
                </View>
                <View style={s.todayMetric}>
                  <PixelIcon name="meal" size={26} />
                  <Text style={[s.metricValue, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                    {completionLabel(meals.done, meals.target || 2)}
                  </Text>
                  <Text style={[s.metricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    Meals
                  </Text>
                </View>
                <View style={s.todayMetric}>
                  <PixelIcon name="pee" size={26} />
                  <Text style={[s.metricValue, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                    {completionLabel(status.counts.potty.done, status.counts.potty.target || 3)}
                  </Text>
                  <Text style={[s.metricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    Potty
                  </Text>
                </View>
              </View>
            </BoardCard>

            <BoardCard style={s.gridCard}>
              <BoardSectionHeader title="Recent activity" action="View all" />
              {recentActivity.length ? (
                recentActivity.map((entry) => (
                  <CareRow
                    key={`${entry.title}-${entry.time}`}
                    icon={entry.icon}
                    title={entry.title}
                    detail={entry.caregiver}
                    meta={entry.time}
                  />
                ))
              ) : (
                <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  No care logs yet today.
                </Text>
              )}
            </BoardCard>
          </View>

          <View style={s.watchRow}>
            {[
              { title: "Health Watch", icon: "health" as PixelIconName, data: health, route: "/health" },
              { title: "Bile Watch", icon: "bile" as PixelIconName, data: bile, route: "/health" },
              { title: "Alone Time", icon: "clock" as PixelIconName, data: alone, route: "/log" },
            ].map((w) => (
              <Pressable
                key={w.title}
                accessibilityRole="button"
                accessibilityLabel={`${w.title}. ${w.data.status}`}
                onPress={() => router.push(w.route as never)}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.72 : 1 }]}
              >
                <BoardCard style={s.watchCard}>
                  <PixelIcon name={w.icon} size={24} />
                  <Text style={[s.watchTitle, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                    {w.title}
                  </Text>
                  <Text style={[s.watchStatus, { color: w.data.color, fontFamily: "Inter_700Bold" }]}>
                    {w.data.status}
                  </Text>
                  <Text style={[s.watchSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {w.data.sub}
                  </Text>
                </BoardCard>
              </Pressable>
            ))}
          </View>

          <BoardCard tone="navy" style={s.questCard}>
            <View style={s.questTop}>
              <View>
                <Text style={[s.questKicker, { color: colors.amber, fontFamily: "Fredoka_600SemiBold" }]}>
                  Care quest
                </Text>
                <Text style={[s.questTitle, { fontFamily: "Fredoka_700Bold" }]}>
                  {questLine}
                </Text>
                <Text style={[s.questSub, { fontFamily: "Inter_600SemiBold" }]}>
                  {careIntelligence.subtitle}
                </Text>
              </View>
              <View style={s.questBadge}>
                <PixelIcon name="heart" size={30} />
              </View>
            </View>
            <View style={s.questProofGrid}>
              {careIntelligence.metrics.slice(0, 3).map((metric) => (
                <View key={metric.label} style={s.questProofTile}>
                  <Text style={[s.questProofValue, { fontFamily: "Fredoka_700Bold" }]}>{metric.value}</Text>
                  <Text style={[s.questProofLabel, { fontFamily: "Inter_700Bold" }]}>{metric.label}</Text>
                </View>
              ))}
            </View>
            <View style={s.questMeterWrap}>
              {Array.from({ length: 10 }).map((_, index) => {
                const active = index < Math.round(careProgress / 10);
                return (
                  <View
                    key={`quest-${index}`}
                    style={[
                      s.questPip,
                      {
                        backgroundColor: active ? colors.sage : "rgba(255,249,239,0.18)",
                        borderColor: active ? colors.sage : "rgba(255,249,239,0.26)",
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View style={s.questMetaRow}>
              <Text style={[s.questMeta, { fontFamily: "Inter_700Bold" }]}>
                {careIntelligence.score}% Care IQ
              </Text>
              <Text style={[s.questMeta, { fontFamily: "Inter_600SemiBold" }]}>
                {careIntelligence.confidenceScore}% log confidence
              </Text>
            </View>
          </BoardCard>

          <BoardCard style={s.statusCard}>
            <BoardSectionHeader title="Phoenix status" action="View full report" />
            <View style={s.meterStack}>
              <StatusMeter
                label="Energy"
                icon="energy"
                value={status.energy}
                valueLabel={`${status.energy}%`}
                tone={colors.sage}
              />
              <StatusMeter
                label="Hunger"
                icon="hunger"
                value={hungerScore}
                valueLabel={fed ? "Full" : "Hungry"}
                tone={fed ? colors.sage : colors.copper}
              />
              <StatusMeter
                label="Hydration"
                icon="bile"
                value={hydrationScore}
                valueLabel="Good"
                tone={colors.blueSignal}
              />
              <StatusMeter
                label="Bile Risk"
                icon="bile"
                value={bileCount ? 46 : 82}
                valueLabel={bile.status}
                tone={bile.color}
              />
              <StatusMeter
                label="Bond"
                icon="bond"
                value={bondScore}
                valueLabel={bondLabel}
                tone={colors.sage}
              />
            </View>
          </BoardCard>
        </Animated.View>
      </ScrollView>

      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toast,
            {
              backgroundColor: colors.brandNavy,
              opacity: toastOpacity,
              bottom: insets.bottom + 96,
            },
          ]}
        >
          <Text style={[s.toastText, { fontFamily: "Inter_700Bold" }]}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#FFFFFF", fontSize: 10 },
  logoWrap: { flex: 1, alignItems: "center", gap: 0 },
  logoSub: { fontSize: 11.5, marginTop: -1 },

  heroCard: {
    overflow: "hidden",
    marginBottom: 0,
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  heroConsoleHeader: {
    minHeight: 58,
    borderBottomWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heroConsoleTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  heroConsoleCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroConsoleKicker: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  heroConsoleTitle: {
    fontSize: 17,
    lineHeight: 20,
    marginTop: 1,
  },
  heroConsoleBadge: {
    maxWidth: 132,
    minHeight: 32,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  heroConsoleBadgeText: {
    fontSize: 11,
  },
  heroWrap: {
    width: "100%",
    aspectRatio: HERO_RATIO,
    position: "relative",
  },
  presencePanel: {
    width: "84%",
    alignSelf: "flex-start",
    marginTop: -30,
    marginLeft: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#081424",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  presenceAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceInitial: { color: "#FFFFFF", fontSize: 17 },
  presenceCopy: { flex: 1, minWidth: 0 },
  presenceText: { fontSize: 14 },
  presenceSub: { fontSize: 11, marginTop: 2 },
  avatarIdentityBar: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarIdentityIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIdentityCopy: { flex: 1, minWidth: 0 },
  avatarIdentityTitle: { fontSize: 13 },
  avatarIdentitySub: { fontSize: 11, marginTop: 1 },
  statusTiles: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  statusTile: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 9,
  },
  statusTileIcon: {
    width: 39,
    height: 39,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  statusTileLabel: { fontSize: 11, textAlign: "center" },
  statusTileValue: { fontSize: 13, marginTop: 3, textAlign: "center" },

  homeSplit: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
    marginBottom: 10,
  },
  homeSplitCard: {
    flex: 1,
    minWidth: 0,
  },
  nextCard: { marginTop: 0 },
  quickHomeCard: {
    minHeight: 188,
  },
  homeQuickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  homeQuickTile: {
    width: "48%",
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 5,
  },
  homeQuickText: {
    fontSize: 9.5,
    textAlign: "center",
  },
  questCard: {
    marginTop: 10,
    marginBottom: 10,
    padding: 14,
    overflow: "hidden",
  },
  questTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  questKicker: { fontSize: 11, textTransform: "uppercase" },
  questTitle: {
    color: "#FFF9EF",
    fontSize: 17,
    lineHeight: 21,
    marginTop: 2,
    maxWidth: 245,
  },
  questSub: {
    color: "rgba(255,249,239,0.78)",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 5,
    maxWidth: 245,
  },
  questBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,249,239,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,249,239,0.18)",
  },
  questProofGrid: {
    flexDirection: "row",
    gap: 7,
    marginTop: 13,
  },
  questProofTile: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,249,239,0.16)",
    backgroundColor: "rgba(255,249,239,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: "center",
  },
  questProofValue: {
    color: "#FFF9EF",
    fontSize: 16,
  },
  questProofLabel: {
    color: "rgba(255,249,239,0.68)",
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
    textTransform: "uppercase",
  },
  questMeterWrap: {
    flexDirection: "row",
    gap: 5,
    marginTop: 13,
  },
  questPip: {
    flex: 1,
    height: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  questMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 9,
  },
  questMeta: {
    color: "rgba(255,249,239,0.82)",
    fontSize: 11.5,
  },
  statusCard: { marginBottom: 10 },
  meterStack: { gap: 8 },
  cardGrid: { gap: 10, marginTop: 10 },
  gridCard: { minHeight: 124 },
  todayGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  todayMetric: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  metricValue: { fontSize: 17 },
  metricLabel: { fontSize: 10.5 },
  emptyText: { fontSize: 12, lineHeight: 18 },
  watchRow: { flexDirection: "row", gap: 9, marginTop: 10 },
  watchCard: { minHeight: 118, alignItems: "flex-start", gap: 4 },
  watchTitle: { fontSize: 11.5 },
  watchStatus: { fontSize: 12 },
  watchSub: { fontSize: 10.5, lineHeight: 14 },

  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  toastText: { color: "#FFFFFF", fontSize: 13 },
});
