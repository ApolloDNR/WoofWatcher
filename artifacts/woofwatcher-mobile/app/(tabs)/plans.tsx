import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare } from "@/context/CareContext";
import { useAvatar } from "@/context/AvatarContext";
import { useColors } from "@/hooks/useColors";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

const ROUTINE_ICON: Record<string, PulseIconName> = {
  meal: "bowl",
  walk: "paw",
  treat: "bone",
  play: "candy",
  training: "star",
  potty: "drop",
  note: "heart",
};

const CATEGORY_LABELS: Record<string, string> = {
  weight: "Weight",
  training: "Training",
  anxiety: "Anxiety",
  social: "Social",
  health: "Health",
  custom: "Custom",
};

function routineMinutes(time: string): number {
  const [clock, period] = time.split(" ");
  const [hStr, mStr] = clock.split(":");
  let h = parseInt(hStr, 10);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + parseInt(mStr || "0", 10);
}

export default function PlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const { routines, goals } = state;
  const { getAvatarSource } = useAvatar();

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const now = Date.now();
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);

  const nowMinutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => routineMinutes(a.time) - routineMinutes(b.time)),
    [routines],
  );

  const nextRoutineId = status.nextRoutine?.id ?? null;
  const doneCount = sortedRoutines.filter((r) => routineMinutes(r.time) <= nowMinutes).length;

  // Mount animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [fade, slide]);

  const dateLabel = new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const goalProgress = sortedRoutines.length > 0 ? doneCount / sortedRoutines.length : 0;

  const H_PAD = 20;

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
            <Pressable onPress={() => router.back()} hitSlop={10} style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.foreground, fontFamily: DISPLAY }]}>Today's Plan</Text>
              <Text style={[s.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{dateLabel}</Text>
            </View>
          </View>

          {/* Day progress card */}
          <View style={[s.progressCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.progressTop}>
              <View style={[s.progressIcon, { backgroundColor: colors.card, borderColor: colors.sage + "55", borderWidth: 2 }]}>
                <Image source={getAvatarSource(status.mood)} style={s.progressAvatarImg} resizeMode="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.progressTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {doneCount} of {sortedRoutines.length} routines done
                </Text>
                <Text style={[s.progressSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {status.nextRoutine ? `Next up: ${status.nextRoutine.label} at ${status.nextRoutine.time}` : "All wrapped up — nap time 😴"}
                </Text>
              </View>
            </View>
            <View style={[s.progressTrack, { backgroundColor: colors.background }]}>
              <View style={[s.progressFill, { width: `${Math.round(goalProgress * 100)}%`, backgroundColor: colors.sage }]} />
            </View>
          </View>

          {/* Routine timeline */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Daily Routine</Text>
          </View>
          <View style={s.timeline}>
            {sortedRoutines.map((r, i) => {
              const icon = ROUTINE_ICON[r.type] ?? "heart";
              const tint = PULSE_COLORS[icon];
              const isNext = r.id === nextRoutineId;
              const isDone = routineMinutes(r.time) <= nowMinutes && !isNext;
              const last = i === sortedRoutines.length - 1;
              return (
                <View key={r.id} style={s.timelineRow}>
                  {/* Rail */}
                  <View style={s.rail}>
                    <View
                      style={[
                        s.railDot,
                        {
                          backgroundColor: isNext ? colors.copper : isDone ? colors.sage : colors.card,
                          borderColor: isNext ? colors.copper : isDone ? colors.sage : colors.border,
                        },
                      ]}
                    >
                      {isDone && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                    </View>
                    {!last && <View style={[s.railLine, { backgroundColor: colors.border }]} />}
                  </View>

                  {/* Card */}
                  <View
                    style={[
                      s.routineCard,
                      {
                        backgroundColor: colors.card,
                        shadowColor: colors.primary,
                        borderWidth: isNext ? 1.5 : 0,
                        borderColor: isNext ? colors.copper + "55" : "transparent",
                      },
                    ]}
                  >
                    <View style={[s.routineIconWrap, { backgroundColor: tint + "16" }]}>
                      <PulseIcon name={icon} size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.routineTitleLine}>
                        <Text style={[s.routineLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.label}</Text>
                        {isNext && (
                          <View style={[s.nextBadge, { backgroundColor: colors.copper + "1A" }]}>
                            <Text style={[s.nextBadgeText, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>NEXT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.routineOwner, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{r.owner}</Text>
                      {r.note ? (
                        <Text numberOfLines={2} style={[s.routineNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.note}</Text>
                      ) : null}
                    </View>
                    <Text style={[s.routineTime, { color: isNext ? colors.copper : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{r.time}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Goals */}
          <View style={[s.sectionHeader, { marginTop: 22 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Care Goals</Text>
          </View>
          {goals.length === 0 ? (
            <View style={[s.empty, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
              <Ionicons name="flag-outline" size={32} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No goals set yet.</Text>
            </View>
          ) : (
            goals.map((g) => {
              const statusColor =
                g.status === "active" ? colors.sage : g.status === "paused" ? colors.amber : colors.mutedForeground;
              const catColor =
                g.category === "weight"
                  ? colors.copper
                  : g.category === "training"
                    ? colors.amber
                    : g.category === "social"
                      ? colors.sage
                      : g.category === "health"
                        ? colors.rose
                        : colors.mutedForeground;
              return (
                <View key={g.id} style={[s.goalCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
                  <View style={s.goalHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={s.goalTitleLine}>
                        <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[s.goalTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{g.title}</Text>
                      </View>
                    </View>
                    <View style={[s.catBadge, { backgroundColor: catColor + "16" }]}>
                      <Text style={[s.catText, { color: catColor, fontFamily: "Inter_700Bold" }]}>
                        {CATEGORY_LABELS[g.category] || g.category}
                      </Text>
                    </View>
                  </View>
                  <View style={[s.goalBody, { backgroundColor: colors.background }]}>
                    <Text style={[s.goalTarget, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{g.target}</Text>
                    {g.note ? <Text style={[s.goalNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{g.note}</Text> : null}
                  </View>
                  <View style={s.goalFooter}>
                    <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
                    <Text style={[s.goalDue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{g.due}</Text>
                  </View>
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },

  progressCard: {
    borderRadius: 24,
    padding: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  progressTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  progressIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  progressAvatarImg: { width: "100%", height: "100%", borderRadius: 13 },
  progressTitle: { fontSize: 16 },
  progressSub: { fontSize: 13, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { fontSize: 20, letterSpacing: -0.2 },

  timeline: {},
  timelineRow: { flexDirection: "row", gap: 12 },
  rail: { width: 24, alignItems: "center" },
  railDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 16 },
  railLine: { width: 2, flex: 1, marginVertical: 2 },
  routineCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  routineIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  routineTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  routineLabel: { fontSize: 15.5 },
  nextBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  nextBadgeText: { fontSize: 9.5, letterSpacing: 0.5 },
  routineOwner: { fontSize: 12.5, marginTop: 2 },
  routineNote: { fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  routineTime: { fontSize: 13.5 },

  goalCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  goalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  goalTitleLine: { flexDirection: "row", alignItems: "center", gap: 9 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  goalTitle: { fontSize: 17, flexShrink: 1 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  catText: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  goalBody: { padding: 14, borderRadius: 14, marginBottom: 12 },
  goalTarget: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  goalNote: { fontSize: 13, lineHeight: 18 },
  goalFooter: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalDue: { fontSize: 13 },

  empty: {
    borderRadius: 22,
    padding: 40,
    alignItems: "center",
    gap: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  emptyText: { fontSize: 15 },
});
