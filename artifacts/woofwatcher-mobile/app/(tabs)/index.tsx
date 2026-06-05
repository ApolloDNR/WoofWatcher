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

const BRAND_MARK = require("@/assets/brand/mark.png");

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
  const { width } = useWindowDimensions();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const now = Date.now();

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const greeting = useMemo(() => getGreeting(now), [now]);
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
  const GAP = 12;
  const tileW = (width - H_PAD * 2 - GAP * 3) / 4;
  const gridCardW = (width - H_PAD * 2 - GAP) / 2;

  const c = status.counts;
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

  const appetiteOk = c.meals.done >= c.meals.target;
  const healthOk = !c.healthAlert;
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
        <Animated.View style={{ opacity: fade }}>
          {/* Branded header */}
          <View style={s.brandRow}>
            <View style={s.brandLeft}>
              <View style={[s.brandMarkWrap, { backgroundColor: colors.primary + "12" }]}>
                <Image source={BRAND_MARK} style={s.brandMark} resizeMode="contain" />
              </View>
              <Text style={[s.brandName, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
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
            <Text style={[s.greetingTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {greeting.text}, {caregiver} {greeting.emoji}
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

            {/* Next up row */}
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

          {/* Quick Log — tinted tactile tiles */}
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

          {/* Handoff timeline */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Handoff</Text>
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
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Health Watch</Text>
            <Pressable onPress={() => router.push("/health")} hitSlop={8}>
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Details</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push("/health")}
            style={({ pressed }) => [s.healthCard, { backgroundColor: colors.card, shadowColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={s.healthHeader}>
              <View style={[s.healthIconWrap, { backgroundColor: (healthOk ? colors.sage : colors.copper) + "1A" }]}>
                <Ionicons name={healthOk ? "heart" : "alert-circle"} size={20} color={healthOk ? colors.sage : colors.copper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.healthTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
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
                  <Text style={[s.healthStatValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{h.value}</Text>
                  <Text style={[s.healthStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{h.label}</Text>
                </View>
              ))}
            </View>
          </Pressable>

          {/* Bedtime snack banner — on-brand */}
          {!bedtimeLogged && (
            <View style={s.bannerWrap}>
              <LinearGradient
                colors={[colors.sage, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.banner}
              >
                <Image source={HERO_IMAGES.happy} style={s.bannerAvatar} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.bannerText, { color: "#FFFFFF", fontFamily: "Inter_500Medium" }]}>
                    A bedtime snack helps {state.profile.name} feel great in the mornings.
                  </Text>
                </View>
                <Pressable
                  onPress={logBedtimeSnack}
                  style={({ pressed }) => [s.bannerBtn, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={[s.bannerBtnText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>Log</Text>
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

  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMarkWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brandMark: { width: 26, height: 26 },
  brandName: { fontSize: 19, letterSpacing: -0.4 },
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
  greetingTitle: { fontSize: 25, letterSpacing: -0.6, lineHeight: 31 },
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

  handoffCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  handoffEmpty: { fontSize: 14, paddingVertical: 18, textAlign: "center" },
  handoffRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  handoffAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  handoffInitial: { fontSize: 14 },
  handoffIconWrap: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  handoffTitle: { fontSize: 14.5 },
  handoffMeta: { fontSize: 12.5, marginTop: 2 },

  healthCard: {
    borderRadius: 22,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  healthHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16 },
  healthIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  healthTitle: { fontSize: 15.5, letterSpacing: -0.3 },
  healthSub: { fontSize: 12.5, marginTop: 2 },
  healthPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  healthPillText: { fontSize: 12.5 },
  healthStatsRow: { flexDirection: "row", borderTopWidth: 1, paddingTop: 14 },
  healthStat: { flex: 1, alignItems: "center" },
  healthStatValue: { fontSize: 17, letterSpacing: -0.3 },
  healthStatLabel: { fontSize: 11.5, marginTop: 3, letterSpacing: 0.2 },

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
  bannerBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: "#FFFFFF" },
  bannerBtnText: { fontSize: 13.5 },

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
