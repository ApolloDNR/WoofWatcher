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
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import {
  derivePhoenixStatus,
  getGreeting,
  Mood,
} from "@/lib/phoenixStatus";

const HERO_IMAGES: Record<Mood, any> = {
  happy: require("@/assets/phoenix/phoenix-happy.png"),
  excited: require("@/assets/phoenix/phoenix-excited.png"),
  calm: require("@/assets/phoenix/phoenix-calm.png"),
  anxious: require("@/assets/phoenix/phoenix-anxious.png"),
  unwell: require("@/assets/phoenix/phoenix-unwell.png"),
};

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
  { key: "zoomies", icon: "bolt", label: "Zoomies", type: "mood", title: "Zoomies", mood: "excited" },
  { key: "win", icon: "star", label: "Training", type: "training", title: "Training win" },
  { key: "anxious", icon: "sad", label: "Anxious", type: "mood", title: "Anxious moment", mood: "anxious" },
  { key: "vomit", icon: "vomit", label: "Vomit", type: "vomit", title: "Vomit", severity: "watch" },
  { key: "alone", icon: "house", label: "Alone", type: "alone", title: "Alone time" },
];

export default function PhoenixScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addEntry } = useCare();
  const { width } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const now = Date.now();

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const greeting = useMemo(() => getGreeting(now), [now]);
  const caregiver = state.caregivers[0]?.name ?? "friend";

  const bedtimeLogged = useMemo(
    () =>
      state.entries.some((e) => {
        const d = new Date(e.occurredAt);
        const t = new Date(now);
        const sameDay =
          d.getFullYear() === t.getFullYear() &&
          d.getMonth() === t.getMonth() &&
          d.getDate() === t.getDate();
        return (
          sameDay &&
          e.type === "treat" &&
          /snack|bedtime/i.test(e.title)
        );
      }),
    [state.entries, now],
  );

  // Mount fade-in
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [fade]);

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
  const tileW = (width - H_PAD * 2 - GAP * 3) / 4;

  const c = status.counts;
  const pulse = [
    { icon: "bowl" as PulseIconName, label: "Meals", value: `${c.meals.done}/${c.meals.target}`, sub: c.meals.done >= c.meals.target ? "Done" : "To go" },
    { icon: "paw" as PulseIconName, label: "Walks", value: `${c.walks.done}/${c.walks.target}`, sub: c.walkMinutes > 0 ? `${c.walkMinutes} min` : "Let's go" },
    { icon: "drop" as PulseIconName, label: "Potty", value: `${c.potty.done}/${c.potty.target}`, sub: c.potty.done > 0 ? "Good" : "—" },
    { icon: "star" as PulseIconName, label: "Training", value: `${c.training}`, sub: c.training > 0 ? "Great job!" : "—" },
    { icon: "heart" as PulseIconName, label: "Health", value: c.healthAlert ? "Watch" : "Good", sub: c.healthAlert ? "1 alert" : "No alerts" },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: topInset + 12,
          paddingBottom: Platform.OS === "web" ? 130 : 130,
          paddingHorizontal: H_PAD,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade }}>
          {/* Greeting */}
          <View style={s.greeting}>
            <Text style={[s.greetingTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
              {greeting.text}, {caregiver}! {greeting.emoji}
            </Text>
            <Text style={[s.greetingSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {state.profile.name} is ready for an adventure.
            </Text>
          </View>

          {/* Painted hero card */}
          <View style={[s.heroCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.heroImageWrap}>
              <Image source={HERO_IMAGES[status.mood]} style={s.heroImage} resizeMode="cover" />
              <LinearGradient
                colors={["transparent", "rgba(20,30,24,0.06)", "rgba(20,30,24,0.55)"]}
                locations={[0, 0.55, 1]}
                style={s.heroScrim}
              />

              {/* Name chip */}
              <Pressable
                onPress={() => router.push("/plans")}
                style={[s.nameChip, { backgroundColor: "rgba(255,255,255,0.92)" }]}
              >
                <Text style={[s.nameChipText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {state.profile.name}
                </Text>
                <Ionicons name="chevron-down" size={15} color={colors.mutedForeground} />
              </Pressable>

              {/* Speech bubble */}
              <View style={[s.speechBubble, { backgroundColor: "rgba(255,255,255,0.95)" }]}>
                <Text style={[s.speechText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {status.meta.speech}
                </Text>
              </View>

              {/* Mood + energy panel */}
              <View style={[s.statsPanel, { backgroundColor: "rgba(255,255,255,0.92)" }]}>
                <View style={s.moodBlock}>
                  <Text style={s.moodEmoji}>{status.meta.emoji}</Text>
                  <View>
                    <Text style={[s.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Mood</Text>
                    <Text style={[s.moodValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{status.meta.label}</Text>
                  </View>
                </View>
                <View style={s.energyBlock}>
                  <View style={s.energyHeader}>
                    <Text style={[s.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Energy</Text>
                    <Text style={[s.energyPct, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{status.energy}%</Text>
                  </View>
                  <View style={[s.energyTrack, { backgroundColor: colors.border }]}>
                    <LinearGradient
                      colors={[colors.sage, colors.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[s.energyFill, { width: `${status.energy}%` }]}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Next up row */}
            <Pressable
              onPress={() => router.push("/plans")}
              style={({ pressed }) => [s.nextUpRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[s.nextUpIcon, { backgroundColor: colors.sage + "1A" }]}>
                <PulseIcon name="paw" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.nextUpLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Next up</Text>
                <Text style={[s.nextUpValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {status.nextRoutine
                    ? `${status.nextRoutine.label}${status.minutesUntilNext != null && status.minutesUntilNext <= 180 ? ` in ${status.minutesUntilNext} min` : ""} · ${status.nextRoutine.time}`
                    : "All caught up for today"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Today's Pulse */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Today's Pulse</Text>
            <Pressable onPress={() => router.push("/plans")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>View full day</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.pulseRow}
          >
            {pulse.map((p) => (
              <View key={p.label} style={[s.pulseCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
                <PulseIcon name={p.icon} size={34} />
                <Text style={[s.pulseLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{p.label}</Text>
                <Text style={[s.pulseValue, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>{p.value}</Text>
                <Text style={[s.pulseSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{p.sub}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Quick Log */}
          <View style={[s.sectionHeader, { marginTop: 24 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Quick Log</Text>
            <Pressable onPress={() => router.push("/log")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>See all logs</Text>
            </Pressable>
          </View>
          <View style={s.quickGrid}>
            {QUICK_LOG.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => logQuick(item)}
                style={({ pressed }) => [
                  s.quickTile,
                  {
                    width: tileW,
                    backgroundColor: colors.card,
                    shadowColor: colors.primary,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
              >
                <View style={[s.quickIconWrap, { backgroundColor: PULSE_COLORS[item.icon] + "18" }]}>
                  <PulseIcon name={item.icon} size={26} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[s.quickLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Bedtime snack banner */}
          {!bedtimeLogged && (
            <View style={s.bannerWrap}>
              <LinearGradient
                colors={["#E9DEF7", "#F0E8FA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.banner}
              >
                <Image source={HERO_IMAGES.happy} style={s.bannerAvatar} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.bannerText, { color: "#4A3A6B", fontFamily: "Inter_500Medium" }]}>
                    A bedtime snack helps {state.profile.name} feel great in the mornings.
                  </Text>
                </View>
                <Pressable
                  onPress={logBedtimeSnack}
                  style={({ pressed }) => [s.bannerBtn, { backgroundColor: "#7E5BC2", opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={[s.bannerBtnText, { fontFamily: "Inter_700Bold" }]}>Log snack</Text>
                </Pressable>
              </LinearGradient>
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

  greeting: { marginBottom: 18 },
  greetingTitle: { fontSize: 26, letterSpacing: -0.6, lineHeight: 32 },
  greetingSub: { fontSize: 15, marginTop: 4 },

  heroCard: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 28,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  heroImageWrap: { height: 380, position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },

  nameChip: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  nameChipText: { fontSize: 16, letterSpacing: -0.3 },

  speechBubble: {
    position: "absolute",
    top: 16,
    right: 16,
    maxWidth: "58%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  speechText: { fontSize: 13.5, lineHeight: 19 },

  statsPanel: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    gap: 14,
  },
  moodBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  moodEmoji: { fontSize: 30 },
  statLabel: { fontSize: 11, letterSpacing: 0.3 },
  moodValue: { fontSize: 16, marginTop: 1 },
  energyBlock: { flex: 1 },
  energyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 },
  energyPct: { fontSize: 16 },
  energyTrack: { height: 8, borderRadius: 8, overflow: "hidden" },
  energyFill: { height: "100%", borderRadius: 8 },

  nextUpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nextUpIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextUpLabel: { fontSize: 12, letterSpacing: 0.3 },
  nextUpValue: { fontSize: 15, marginTop: 1 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 19, letterSpacing: -0.4 },
  sectionLink: { fontSize: 14 },

  pulseRow: { gap: 12, paddingRight: 4, paddingBottom: 4 },
  pulseCard: {
    width: 104,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  pulseLabel: { fontSize: 12, marginTop: 10 },
  pulseValue: { fontSize: 20, marginTop: 4, letterSpacing: -0.3 },
  pulseSub: { fontSize: 11, marginTop: 2 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  quickTile: {
    aspectRatio: 0.92,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  quickIconWrap: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12 },

  bannerWrap: { marginTop: 26 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
  },
  bannerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff" },
  bannerText: { fontSize: 13.5, lineHeight: 19 },
  bannerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  bannerBtnText: { color: "#fff", fontSize: 13.5 },

  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  toastText: { color: "#fff", fontSize: 14 },
});
