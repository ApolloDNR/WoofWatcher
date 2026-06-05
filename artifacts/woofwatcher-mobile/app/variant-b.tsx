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
import { derivePhoenixStatus, getGreeting, Mood } from "@/lib/phoenixStatus";

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

export default function VariantB() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addEntry } = useCare();
  const { width } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
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
        return sameDay && e.type === "treat" && /snack|bedtime/i.test(e.title);
      }),
    [state.entries, now],
  );

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: Platform.OS !== "web" }).start();
  }, [fade]);

  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: Platform.OS !== "web" }).start(() =>
        setToast(null),
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
    addEntry({ type: "treat", title: "Bedtime snack", caregiver, occurredAt: new Date().toISOString() });
    showToast("Bedtime snack logged");
  };

  const H_PAD = 20;
  const GAP = 12;
  const tileW = (width - H_PAD * 2 - GAP * 3) / 4;
  const gridCardW = (width - H_PAD * 2 - GAP) / 2;

  const c = status.counts;
  // Featured metric: Walks. Remaining four shown in a 2x2 grid.
  const feature = {
    icon: "paw" as PulseIconName,
    value: `${c.walks.done}/${c.walks.target}`,
    sub: c.walkMinutes > 0 ? `${c.walkMinutes} minutes walked today` : "No walks logged yet",
  };
  const gridStats = [
    { icon: "bowl" as PulseIconName, label: "Meals", value: `${c.meals.done}/${c.meals.target}`, sub: c.meals.done >= c.meals.target ? "All done" : "On track" },
    { icon: "drop" as PulseIconName, label: "Potty", value: `${c.potty.done}/${c.potty.target}`, sub: c.potty.done > 0 ? "Good" : "—" },
    { icon: "star" as PulseIconName, label: "Training", value: `${c.training}`, sub: c.training > 0 ? "Nice work" : "—" },
    { icon: "heart" as PulseIconName, label: "Health", value: c.healthAlert ? "Watch" : "Good", sub: c.healthAlert ? "1 alert" : "No alerts" },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: topInset + 12, paddingBottom: 48, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade }}>
          {/* Greeting */}
          <View style={s.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.greetingTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {greeting.text}, {caregiver} {greeting.emoji}
              </Text>
              <Text style={[s.greetingSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {state.profile.name} is ready for an adventure.
              </Text>
            </View>
          </View>

          {/* Painted hero card — compact, bolder */}
          <View style={[s.heroCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.heroImageWrap}>
              <Image source={HERO_IMAGES[status.mood]} style={s.heroImage} resizeMode="cover" />
              <LinearGradient
                colors={["transparent", "rgba(20,30,24,0.08)", "rgba(20,30,24,0.62)"]}
                locations={[0, 0.5, 1]}
                style={s.heroScrim}
              />

              <Pressable onPress={() => router.push("/plans")} style={s.nameChip}>
                <Text style={[s.nameChipText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {state.profile.name}
                </Text>
                <Ionicons name="chevron-down" size={15} color={colors.mutedForeground} />
              </Pressable>

              <View style={s.speechBubble}>
                <Text style={[s.speechText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {status.meta.speech}
                </Text>
              </View>

              {/* Bottom overlay: mood headline + energy */}
              <View style={s.heroFooter}>
                <View style={s.moodRow}>
                  <Text style={s.moodEmoji}>{status.meta.emoji}</Text>
                  <Text style={[s.moodValue, { fontFamily: "Inter_700Bold" }]}>{status.meta.label}</Text>
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

            <Pressable
              onPress={() => router.push("/plans")}
              style={({ pressed }) => [s.nextUpRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[s.nextUpIcon, { backgroundColor: colors.sage + "18" }]}>
                <PulseIcon name="paw" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.nextUpLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>NEXT UP</Text>
                <Text style={[s.nextUpValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {status.nextRoutine
                    ? `${status.nextRoutine.label}${status.minutesUntilNext != null && status.minutesUntilNext <= 180 ? ` in ${status.minutesUntilNext} min` : ""} · ${status.nextRoutine.time}`
                    : "All caught up for today"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Today's Pulse — featured card + 2x2 grid */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Today's Pulse</Text>
            <Pressable onPress={() => router.push("/plans")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Full day</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.push("/plans")} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
            <LinearGradient
              colors={[colors.primary, colors.sage]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.featureCard}
            >
              <View style={s.featureIcon}>
                <PulseIcon name={feature.icon} size={30} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.featureLabel, { fontFamily: "Inter_600SemiBold" }]}>WALKS</Text>
                <Text style={[s.featureSub, { fontFamily: "Inter_400Regular" }]}>{feature.sub}</Text>
              </View>
              <Text style={[s.featureValue, { fontFamily: "Inter_700Bold" }]}>{feature.value}</Text>
            </LinearGradient>
          </Pressable>

          <View style={[s.statGrid, { gap: GAP }]}>
            {gridStats.map((p) => (
              <View
                key={p.label}
                style={[s.statCard, { width: gridCardW, backgroundColor: colors.card, shadowColor: colors.primary }]}
              >
                <View style={[s.statIconWrap, { backgroundColor: PULSE_COLORS[p.icon] + "18" }]}>
                  <PulseIcon name={p.icon} size={22} />
                </View>
                <Text style={[s.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{p.value}</Text>
                <Text style={[s.statLabelText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{p.label}</Text>
                <Text style={[s.statSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{p.sub}</Text>
              </View>
            ))}
          </View>

          {/* Quick Log — bold tactile tiles */}
          <View style={[s.sectionHeader, { marginTop: 26 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Quick Log</Text>
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
                    { width: tileW, backgroundColor: tint + "14", transform: [{ scale: pressed ? 0.93 : 1 }] },
                  ]}
                >
                  <View style={[s.quickIconWrap, { backgroundColor: tint + "26" }]}>
                    <PulseIcon name={item.icon} size={26} />
                  </View>
                  <Text numberOfLines={1} style={[s.quickLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
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
                  style={({ pressed }) => [s.bannerBtn, { backgroundColor: "#7E5BC2", opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={[s.bannerBtnText, { fontFamily: "Inter_700Bold" }]}>Log snack</Text>
                </Pressable>
              </LinearGradient>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[s.toast, { bottom: insets.bottom + 36, opacity: toastOpacity, backgroundColor: colors.foreground }]}
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

  greetingRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  greetingTitle: { fontSize: 24, letterSpacing: -0.5, lineHeight: 30 },
  greetingSub: { fontSize: 15, marginTop: 4 },

  heroCard: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 28,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 7,
  },
  heroImageWrap: { height: 330, position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },

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
    backgroundColor: "rgba(255,255,255,0.92)",
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
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  speechText: { fontSize: 13.5, lineHeight: 19 },

  heroFooter: { position: "absolute", left: 18, right: 18, bottom: 16 },
  moodRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  moodEmoji: { fontSize: 26 },
  moodValue: { fontSize: 22, color: "#FFFFFF", letterSpacing: -0.4 },
  energyChip: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  energyChipText: { color: "#FFFFFF", fontSize: 13 },
  energyTrack: { height: 7, borderRadius: 7, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.3)" },
  energyFill: { height: "100%", borderRadius: 7 },

  nextUpRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  nextUpIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  nextUpLabel: { fontSize: 10, letterSpacing: 0.6 },
  nextUpValue: { fontSize: 15, marginTop: 2 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 19, letterSpacing: -0.4 },
  sectionLink: { fontSize: 14 },

  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 22,
    marginBottom: 12,
    shadowColor: "#2E5846",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  featureLabel: { fontSize: 12, letterSpacing: 1, color: "rgba(255,255,255,0.85)" },
  featureSub: { fontSize: 13, color: "rgba(255,255,255,0.92)", marginTop: 3 },
  featureValue: { fontSize: 30, color: "#FFFFFF", letterSpacing: -0.5 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  statCard: {
    borderRadius: 20,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statValue: { fontSize: 24, letterSpacing: -0.5 },
  statLabelText: { fontSize: 14, marginTop: 4 },
  statSub: { fontSize: 12, marginTop: 2 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", rowGap: 12 },
  quickTile: {
    aspectRatio: 0.94,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickIconWrap: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12 },

  bannerWrap: { marginTop: 26 },
  banner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 22 },
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
