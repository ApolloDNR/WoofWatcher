import { Ionicons } from "@expo/vector-icons";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalizeCareEventType } from "@workspace/care-domain";

import {
  BoardCard,
  BoardSectionHeader,
  CareRow,
  PixelSpeechBubble,
  QuickActionTile,
  StatusMeter,
} from "@/components/board/BoardPrimitives";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { WoofWatcherLogo } from "@/components/brand/WoofWatcherLogo";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { derivePhoenixStatus, type Mood } from "@/lib/phoenixStatus";

const HERO = require("@/assets/board/hero.png");
const HERO_RATIO = 1050 / 786;

interface QuickItem {
  key: string;
  icon: PixelIconName;
  label: string;
  type: string;
  title: string;
  mood?: string;
  severity?: string;
}

const QUICK_LOG: QuickItem[] = [
  { key: "meal", icon: "meal", label: "Meal", type: "meal", title: "Meal" },
  { key: "walk", icon: "walk", label: "Walk", type: "walk", title: "Walk" },
  { key: "potty", icon: "pee", label: "Potty", type: "potty", title: "Potty break" },
  { key: "water", icon: "bile", label: "Water", type: "water", title: "Fresh water" },
  { key: "training", icon: "training", label: "Training", type: "training", title: "Training win" },
  { key: "bile", icon: "bile", label: "Bile", type: "vomit", title: "Bile watch note", severity: "watch" },
  { key: "note", icon: "note", label: "Note", type: "note", title: "Care note" },
  { key: "treat", icon: "treat", label: "Treat", type: "treat", title: "Treat" },
  { key: "play", icon: "play", label: "Play", type: "play", title: "Play session" },
];

const SPEECH_BY_MOOD: Record<Mood, string> = {
  happy: "Great job! Phoenix is on track.",
  excited: "Walk time soon? I am ready!",
  calm: "Morning! Ready for a good day.",
  anxious: "Stay close today. A calm plan helps.",
  unwell: "Tummy feels off. Let's watch gently.",
};

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

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addEntry } = useCare();

  const topInset = Platform.OS === "web" ? 18 : insets.top;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);

  const petName =
    state.profile.name && state.profile.name !== "My Dog"
      ? state.profile.name
      : "Phoenix";
  const caregiver = state.caregivers[0]?.name ?? "Emma";
  const timeLabel = useMemo(() => shortTime(new Date(now).toISOString()), [now]);

  const meals = status.counts.meals;
  const fed = meals.target > 0 ? meals.done >= meals.target : true;
  const bondLabel = status.mood === "unwell" ? "Okay" : "Strong";
  const hydrationScore = 72;
  const hungerScore = fed ? 86 : 42;
  const bondScore = status.mood === "anxious" ? 70 : 92;

  const nextUp = useMemo(() => {
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
  }, [state.routines, caregiver]);

  const nextPrimary = nextUp[0];
  const nextMeta =
    status.minutesUntilNext !== null
      ? `In ${formatDuration(status.minutesUntilNext)}`
      : nextPrimary?.time ?? "Ready";

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

  const [toast, setToast] = useState<string | null>(null);
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
    showToast(`${item.title} logged`);
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
              style={[s.headerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Ionicons name="menu" size={20} color={colors.navy} />
            </Pressable>
            <View style={s.logoWrap}>
              <WoofWatcherLogo size={25} wordmarkSize={20} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Health Watch"
              onPress={() => router.push("/health")}
              hitSlop={10}
              style={[s.headerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Ionicons name="notifications-outline" size={19} color={colors.navy} />
            </Pressable>
          </View>

          <View style={s.greetingRow}>
            <View>
              <Text style={[s.kicker, { color: colors.copper, fontFamily: "Fredoka_600SemiBold" }]}>
                Neo retro pet care
              </Text>
              <Text style={[s.greeting, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                Good morning, {caregiver}
              </Text>
            </View>
            <View style={[s.dateChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={13} color={colors.navy} />
              <Text style={[s.dateText, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                {timeLabel}
              </Text>
            </View>
          </View>

          <BoardCard padded={false} style={s.heroCard}>
            <View style={s.heroWrap}>
              <Image source={HERO} style={s.heroImg} resizeMode="cover" />
              <View style={s.heroLabel}>
                <Text style={[s.heroLabelText, { color: colors.navy, fontFamily: "Fredoka_700Bold" }]}>
                  Phoenix Home
                </Text>
              </View>
              <PixelSpeechBubble text={SPEECH_BY_MOOD[status.mood]} style={s.speech} />
              <View style={s.heroBottom}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${petName} is with ${caregiver}`}
                  onPress={() => router.push("/more")}
                  style={[s.presenceChip, { backgroundColor: colors.ivory, borderColor: colors.border }]}
                >
                  <View style={[s.presenceAvatar, { backgroundColor: colors.copper }]}>
                    <Text style={[s.presenceInitial, { fontFamily: "Inter_700Bold" }]}>
                      {caregiver.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={[s.presenceText, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                      With {caregiver}
                    </Text>
                    <Text style={[s.presenceSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Since {timeLabel}
                    </Text>
                  </View>
                </Pressable>
                <View style={[s.moodChip, { backgroundColor: colors.ivory, borderColor: colors.border }]}>
                  <PixelIcon name={status.mood === "unwell" ? "mood_rough" : "mood_great"} size={24} />
                  <View>
                    <Text style={[s.moodLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      Mood
                    </Text>
                    <Text style={[s.moodValue, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                      {status.meta.label}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </BoardCard>

          <BoardCard style={s.nextCard}>
            <BoardSectionHeader title="Next up" action="1 of 2 today" />
            <CareRow
              icon={nextPrimary?.icon ?? "walk"}
              title={nextPrimary?.label ?? `Walk with ${caregiver}`}
              detail={`${nextMeta} - ${nextPrimary?.time ?? "8:30 AM"}`}
              meta="Start"
              onPress={() => router.push("/calendar")}
            />
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

          <BoardCard>
            <BoardSectionHeader title="Quick actions" />
            <View style={s.quickGrid}>
              {QUICK_LOG.map((item) => (
                <QuickActionTile
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  accessibilityLabel={`Log ${item.label}`}
                  onPress={() => logQuick(item)}
                  accent={
                    item.type === "water" || item.key === "bile"
                      ? colors.blueSignal + "55"
                      : item.type === "training"
                        ? colors.accent
                        : colors.secondary
                  }
                />
              ))}
            </View>
          </BoardCard>

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
                    {meals.done}/{meals.target || 2}
                  </Text>
                  <Text style={[s.metricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    Meals
                  </Text>
                </View>
                <View style={s.todayMetric}>
                  <PixelIcon name="pee" size={26} />
                  <Text style={[s.metricValue, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>
                    {status.counts.potty.done}/{status.counts.potty.target || 3}
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

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: { flex: 1, alignItems: "center" },
  greetingRow: {
    marginTop: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  kicker: { fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  greeting: { fontSize: 21, lineHeight: 25, marginTop: 2 },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dateText: { fontSize: 11 },

  heroCard: { overflow: "hidden", marginBottom: 10 },
  heroWrap: {
    width: "100%",
    aspectRatio: HERO_RATIO,
    position: "relative",
  },
  heroImg: { width: "100%", height: "100%" },
  heroLabel: {
    position: "absolute",
    top: 12,
    left: 13,
    backgroundColor: "rgba(255,249,239,0.88)",
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  heroLabelText: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  speech: {
    position: "absolute",
    top: "18%",
    left: "9%",
  },
  heroBottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  presenceChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  presenceAvatar: {
    width: 31,
    height: 31,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceInitial: { color: "#FFFFFF", fontSize: 14 },
  presenceText: { fontSize: 12 },
  presenceSub: { fontSize: 10, marginTop: 1 },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  moodLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4 },
  moodValue: { fontSize: 12 },

  nextCard: { marginTop: 2, marginBottom: 10 },
  statusCard: { marginBottom: 10 },
  meterStack: { gap: 8 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 9,
  },
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
