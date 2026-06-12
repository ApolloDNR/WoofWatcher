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

import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { WoofWatcherLogo } from "@/components/brand/WoofWatcherLogo";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";

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
  { key: "water", icon: "bile", label: "Water", type: "water", title: "Fresh water" },
  { key: "pee", icon: "pee", label: "Pee", type: "potty", title: "Pee break" },
  { key: "training", icon: "training", label: "Training", type: "training", title: "Training win" },
  { key: "treat", icon: "treat", label: "Treat", type: "treat", title: "Treat" },
  { key: "play", icon: "play", label: "Play", type: "play", title: "Play session" },
];

function routineIcon(type: string): PixelIconName {
  const t = normalizeCareEventType(type);
  if (t === "walk") return "walk";
  if (t === "meal") return "meal";
  if (t === "training") return "training";
  if (t === "potty" || t === "pee") return "pee";
  if (t === "medication") return "medication";
  if (t === "play") return "play";
  if (t === "treat") return "treat";
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
  const timeLabel = useMemo(
    () =>
      new Date(now).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    [now],
  );

  // ---- Stat cards -------------------------------------------------------
  const happyMap: Record<string, { word: string; icon: PixelIconName }> = {
    happy: { word: "Great", icon: "mood_great" },
    excited: { word: "Great", icon: "mood_great" },
    calm: { word: "Good", icon: "mood_good" },
    anxious: { word: "Okay", icon: "mood_okay" },
    unwell: { word: "Low", icon: "mood_rough" },
  };
  const happiness = happyMap[status.mood] ?? happyMap.calm;
  const meals = status.counts.meals;
  const fed = meals.target > 0 ? meals.done >= meals.target : true;
  const bond = status.mood === "unwell" ? "Okay" : "Strong";

  const stats: { label: string; icon: PixelIconName; value: string }[] = [
    { label: "Happiness", icon: happiness.icon, value: happiness.word },
    { label: "Energy", icon: "energy", value: `${status.energy}%` },
    { label: "Hunger", icon: "hunger", value: fed ? "Good" : "Hungry" },
    { label: "Bond", icon: "bond", value: bond },
  ];

  // ---- Next up ----------------------------------------------------------
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

  // ---- Watch cards ------------------------------------------------------
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

  // ---- Toast ------------------------------------------------------------
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

  // ---- Mount fade -------------------------------------------------------
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 450,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [fade]);

  const navy = colors.navy;
  const green = colors.sage;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: topInset + 6,
          paddingBottom: 140,
          paddingHorizontal: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade }}>
          {/* Header */}
          <View style={s.header}>
            <Pressable
              onPress={() => router.push("/more")}
              hitSlop={10}
              style={s.hamburger}
            >
              <Ionicons name="menu" size={24} color={navy} />
            </Pressable>
            <View style={s.logoWrap}>
              <WoofWatcherLogo size={24} wordmarkSize={20} />
            </View>
            <View style={s.hamburger} />
          </View>
          <Text
            style={[s.tagline, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
          >
            Real care. Pixel heart.
          </Text>

          {/* Hero scene */}
          <View style={s.heroWrap}>
            <Image source={HERO} style={s.heroImg} resizeMode="cover" />
          </View>

          {/* Presence card */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${petName} is with ${caregiver}`}
            onPress={() => router.push("/more")}
            style={({ pressed }) => [
              s.presenceCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: navy,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <View style={[s.presenceAvatar, { backgroundColor: colors.copper }]}>
              <Text style={[s.presenceInitial, { fontFamily: "Inter_700Bold" }]}>
                {caregiver.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.presenceTitle, { color: navy, fontFamily: "Inter_700Bold" }]}>
                {petName} is with {caregiver}
              </Text>
              <Text
                style={[s.presenceSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              >
                At home · {timeLabel}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>

          {/* Stat cards */}
          <View style={s.statRow}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[s.statLabel, { color: navy, fontFamily: "Inter_600SemiBold" }]}>
                  {stat.label}
                </Text>
                <PixelIcon name={stat.icon} size={30} style={{ marginVertical: 4 }} />
                <Text style={[s.statValue, { color: green, fontFamily: "Inter_700Bold" }]}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Next Up + Quick Log */}
          <View style={s.twoCol}>
            <View
              style={[s.col, s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[s.cardTitle, { color: navy, fontFamily: "Inter_700Bold" }]}>Next Up</Text>
              {nextUp.map((row, i) => (
                <View
                  key={`${row.label}-${i}`}
                  style={[
                    s.nextRow,
                    i < nextUp.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <PixelIcon name={row.icon} size={20} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={[s.nextLabel, { color: navy, fontFamily: "Inter_600SemiBold" }]}
                    >
                      {row.label}
                    </Text>
                    <Text
                      style={[s.nextTime, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                    >
                      {row.time}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} />
                </View>
              ))}
            </View>

            <View
              style={[s.col, s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[s.cardTitle, { color: navy, fontFamily: "Inter_700Bold" }]}>Quick Log</Text>
              <View style={s.quickGrid}>
                {QUICK_LOG.map((item) => (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Log ${item.label}`}
                    onPress={() => logQuick(item)}
                    style={({ pressed }) => [s.quickTile, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <View style={[s.quickTileBox, { backgroundColor: colors.secondary }]}>
                      <PixelIcon name={item.icon} size={24} />
                    </View>
                    <Text style={[s.quickLabel, { color: navy, fontFamily: "Inter_500Medium" }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Watch cards */}
          <View style={s.watchRow}>
            {[
              { title: "Health Watch", icon: "health" as PixelIconName, data: health, route: "/health" },
              { title: "Bile Watch", icon: "bile" as PixelIconName, data: bile, route: "/health" },
              { title: "Alone Time", icon: "clock" as PixelIconName, data: alone, route: "/log" },
            ].map((w) => (
              <Pressable
                key={w.title}
                onPress={() => router.push(w.route as never)}
                style={({ pressed }) => [
                  s.watchCard,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text style={[s.watchTitle, { color: navy, fontFamily: "Inter_600SemiBold" }]}>
                  {w.title}
                </Text>
                <View style={s.watchStatusRow}>
                  <PixelIcon name={w.icon} size={18} />
                  <Text
                    numberOfLines={1}
                    style={[s.watchStatus, { color: w.data.color, fontFamily: "Inter_700Bold" }]}
                  >
                    {w.data.status}
                  </Text>
                </View>
                <Text
                  numberOfLines={2}
                  style={[s.watchSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                >
                  {w.data.sub}
                </Text>
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
              backgroundColor: navy,
              opacity: toastOpacity,
              bottom: insets.bottom + 96,
            },
          ]}
        >
          <Text style={[s.toastText, { fontFamily: "Inter_600SemiBold" }]}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hamburger: { width: 28, alignItems: "flex-start" },
  logoWrap: { flex: 1, alignItems: "center" },
  tagline: { textAlign: "center", fontSize: 12, marginTop: 4, letterSpacing: 0.3 },

  heroWrap: {
    marginTop: 14,
    borderRadius: 22,
    overflow: "hidden",
    width: "100%",
    aspectRatio: HERO_RATIO,
  },
  heroImg: { width: "100%", height: "100%" },

  presenceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: -26,
    marginHorizontal: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  presenceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceInitial: { color: "#FFFFFF", fontSize: 17 },
  presenceTitle: { fontSize: 15 },
  presenceSub: { fontSize: 12.5, marginTop: 2 },

  statRow: { flexDirection: "row", gap: 9, marginTop: 16 },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 13.5 },

  twoCol: { flexDirection: "row", gap: 12, marginTop: 14, alignItems: "stretch" },
  col: { flex: 1 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 15, marginBottom: 8 },

  nextRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9 },
  nextLabel: { fontSize: 12.5 },
  nextTime: { fontSize: 11, marginTop: 1 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  quickTile: { width: "30%", alignItems: "center", gap: 4 },
  quickTileBox: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 10 },

  watchRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  watchCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12 },
  watchTitle: { fontSize: 11.5 },
  watchStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  watchStatus: { fontSize: 12.5, flexShrink: 1 },
  watchSub: { fontSize: 10, marginTop: 5, lineHeight: 13 },

  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  toastText: { color: "#FFFFFF", fontSize: 13 },
});
