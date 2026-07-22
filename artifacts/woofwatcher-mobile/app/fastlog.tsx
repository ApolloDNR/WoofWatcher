import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalizeCareEventType, type CareEventType } from "@workspace/care-domain";

import { BoardCard } from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useCare, type Entry } from "@/context/CareContext";
import { careXpForEntry } from "@/lib/careCareer";
import { useColors } from "@/hooks/useColors";
import { MIN_MOBILE_TOUCH_TARGET, MOBILE_INLINE_HIT_SLOP } from "@/lib/mobileLayout";
import {
  buildQuickLogEntry,
  findRecentQuickLogDuplicate,
  getQuickLogPolicy,
  QUICK_LOG_DEDUPE_WINDOW_MS,
} from "@/lib/quickLogEntry";
import { MEAL_OUTCOME_UPDATE_OPTIONS } from "@/lib/mealOutcomeUpdate";
import { buildWalkSessionStartEntry, findOpenWalkSession } from "@/lib/walkSession";

/**
 * Fast-log sheet from Apollo's FINAL mock boards: a light parchment moment
 * with six cream tiles ("What would you like to log?"), the freshest real
 * logs with green outcome checks inside a cream board card, and one forest
 * pill into the full Log. Warm parchment, ink text, no dark HUD chrome -
 * exactly like the board art.
 */

interface FastLogTile {
  key: string;
  icon: PixelIconName;
  label: string;
  type: CareEventType;
  title: string;
  forceDetail?: boolean;
}

const FAST_LOG_TILES: FastLogTile[] = [
  { key: "meal", icon: "meal", label: "Meal", type: "meal", title: "Meal" },
  { key: "potty", icon: "pee", label: "Potty", type: "potty", title: "Potty" },
  { key: "walk", icon: "walk", label: "Walk", type: "walk", title: "Walk" },
  { key: "meds", icon: "medication", label: "Meds", type: "medication", title: "Medication" },
  { key: "water", icon: "bile", label: "Water", type: "water", title: "Fresh water" },
  { key: "note", icon: "note", label: "Note", type: "note", title: "Care note", forceDetail: true },
];

function tileIconFor(type: string): PixelIconName {
  const t = normalizeCareEventType(type);
  if (t === "meal") return "meal";
  if (t === "potty") return "pee";
  if (t === "walk") return "walk";
  if (t === "medication") return "medication";
  if (t === "water") return "bile";
  if (t === "training") return "training";
  if (t === "play") return "play";
  if (t === "treat") return "treat";
  return "note";
}

function shortTime(iso: string, now: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Logged";
  const sameDay = date.toDateString() === new Date(now).toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function detailString(details: unknown, key: string): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const value = (details as Record<string, unknown>)[key];
  return value == null ? "" : String(value);
}

/** Honest outcome chip text from what the log actually recorded. */
function outcomeLabel(entry: {
  type: string;
  details?: unknown;
  durationMinutes?: number;
}): string {
  const type = normalizeCareEventType(entry.type);
  if (type === "meal") {
    const completion = detailString(entry.details, "mealCompletion");
    if (completion === "grazing") return "Grazing";
    if (completion === "served") return "Served";
    // Reuse the real outcome labels so complete/most/partial/skipped never drift.
    const option = MEAL_OUTCOME_UPDATE_OPTIONS.find((o) => o.id === completion);
    if (option) return option.label;
  }
  if (type === "medication") {
    const outcome = detailString(entry.details, "medicationOutcome");
    if (outcome === "taken") return "Given";
    if (outcome) return outcome;
  }
  if (type === "potty") {
    const result =
      detailString(entry.details, "pottyOutcome") || detailString(entry.details, "pottyResult");
    if (result) return result.charAt(0).toUpperCase() + result.slice(1);
  }
  if (entry.durationMinutes && entry.durationMinutes > 0) {
    return `${entry.durationMinutes} min`;
  }
  return "Saved";
}

export default function FastLogScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, addEntry } = useCare();
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const loggedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const caregiver = state.caregivers[0]?.name ?? "you";
  const openWalkSession = useMemo(() => findOpenWalkSession(state.entries), [state.entries]);

  const recent = useMemo(
    () =>
      [...state.entries]
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
        .slice(0, 4),
    [state.entries],
  );

  // The native stack animates this modal on iOS/Android, but on web the
  // route mounts as a single-frame hard cut - so the sheet runs its own
  // ~220ms fade/rise in, and eases back out before dismissing. Native keeps
  // its real modal transition and skips the double animation.
  const animatesInternally = Platform.OS === "web";
  const sheetProgress = useRef(
    new Animated.Value(animatesInternally ? 0 : 1),
  ).current;
  const dismissing = useRef(false);
  useEffect(() => {
    if (!animatesInternally) return;
    Animated.timing(sheetProgress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatesInternally, sheetProgress]);

  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)" as never);
  };

  const close = () => {
    if (!animatesInternally) {
      navigateBack();
      return;
    }
    if (dismissing.current) return;
    dismissing.current = true;
    Animated.timing(sheetProgress, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => navigateBack());
  };

  const flashLogged = (key: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setJustLogged(key);
    if (loggedTimer.current) clearTimeout(loggedTimer.current);
    loggedTimer.current = setTimeout(() => setJustLogged(null), 1600);
  };

  const openDetail = (tile: FastLogTile) => {
    router.replace(`/log?type=${tile.type}&detail=1&intent=${Date.now()}` as never);
  };

  // Double-tap safety: the ref catches a second press in the same tick
  // (before React state can update) and the shared window check dedupes
  // slower bounces against the saved timeline. One entry per intent; a
  // deliberate second log after the 1.5s window still saves.
  const recentQuickSave = useRef<{ type: string; at: number } | null>(null);
  const isDuplicateQuickTap = (type: string): boolean => {
    const prev = recentQuickSave.current;
    return Boolean(
      prev &&
        prev.type === type &&
        Date.now() - prev.at <= QUICK_LOG_DEDUPE_WINDOW_MS,
    );
  };

  const logTile = (tile: FastLogTile) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (tile.forceDetail) {
      openDetail(tile);
      return;
    }
    const policy = getQuickLogPolicy(tile.type);
    if (policy.tapBehavior === "detail-required") {
      openDetail(tile);
      return;
    }
    if (tile.type === "walk") {
      if (openWalkSession) {
        router.replace(
          (openWalkSession.id
            ? `/log?entry=${encodeURIComponent(openWalkSession.id)}`
            : `/log?type=walk&detail=1&intent=${Date.now()}`) as never,
        );
        return;
      }
      if (isDuplicateQuickTap("walk")) return;
      recentQuickSave.current = { type: "walk", at: Date.now() };
      addEntry(buildWalkSessionStartEntry({ caregiver, now: Date.now() }) as Omit<Entry, "id">);
      flashLogged(tile.key);
      return;
    }
    const now = Date.now();
    if (
      isDuplicateQuickTap(policy.type) ||
      findRecentQuickLogDuplicate(state.entries, tile.type, now)
    ) {
      return;
    }
    recentQuickSave.current = { type: policy.type, at: now };
    const role = state.caregivers.find((person) => person.name === caregiver)?.role;
    const entry = buildQuickLogEntry(
      { type: tile.type, title: tile.title },
      state,
      { caregiver, caregiverRole: role, now },
    );
    addEntry(entry);
    flashLogged(tile.key);
  };

  return (
    <Animated.View
      style={[
        s.root,
        {
          paddingTop: Math.max(insets.top, 14),
          // Web only (progress is pinned to 1 on native): the sheet warms
          // from the app's ivory field into the parchment surface while the
          // content rises, instead of cutting in a single frame.
          backgroundColor: sheetProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.ivory, colors.background],
          }),
        },
      ]}
    >
      <Animated.View
        style={[
          s.sheetBody,
          {
            opacity: sheetProgress,
            transform: [
              {
                translateY: sheetProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [26, 0],
                }),
              },
            ],
          },
        ]}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close quick log"
          hitSlop={MOBILE_INLINE_HIT_SLOP}
          onPress={close}
          style={({ pressed }) => [
            s.closeButton,
            {
              backgroundColor: pressed ? colors.secondary : colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="close" size={20} color={colors.foreground} />
        </Pressable>

        <Text style={[s.title, { color: colors.foreground, fontFamily: "Fredoka_700Bold" }]}>
          What would you like{"\n"}to log?
        </Text>

        <View style={s.tileGrid}>
          {FAST_LOG_TILES.map((tile) => (
            <PressScale
              key={tile.key}
              accessibilityRole="button"
              accessibilityLabel={`Log ${tile.label}`}
              accessibilityHint={
                tile.forceDetail || getQuickLogPolicy(tile.type).tapBehavior === "detail-required"
                  ? "Opens details before saving."
                  : "Saves a quick log. Long press opens details."
              }
              onPress={() => logTile(tile)}
              onLongPress={() => openDetail(tile)}
              scaleTo={0.94}
              haptic="none"
              containerStyle={s.tileLayout}
              style={[
                s.tile,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: colors.navy,
                },
              ]}
            >
              {justLogged === tile.key ? (
                <View style={[s.tileLoggedBadge, { backgroundColor: colors.sage }]}>
                  <Ionicons name="checkmark" size={13} color={colors.primaryForeground} />
                </View>
              ) : null}
              <PixelIcon name={tile.icon} size={34} />
              <Text style={[s.tileLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {tile.label}
              </Text>
            </PressScale>
          ))}
        </View>

        <BoardCard style={s.recentSection}>
          <Text style={[s.recentTitle, { color: colors.foreground, fontFamily: "Fredoka_600SemiBold" }]}>
            Recent
          </Text>
          {recent.length ? (
            recent.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={`Open recent log: ${entry.title}. ${outcomeLabel(entry)}.`}
                onPress={() =>
                  router.replace(`/log?entry=${encodeURIComponent(entry.id)}` as never)
                }
                style={({ pressed }) => [
                  s.recentRow,
                  {
                    backgroundColor: pressed ? colors.secondary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[s.recentIcon, { backgroundColor: colors.secondary }]}>
                  <PixelIcon name={tileIconFor(entry.type)} size={20} />
                </View>
                <View style={s.recentCopy}>
                  <Text
                    numberOfLines={1}
                    style={[s.recentName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                  >
                    {entry.title.split(" - ")[0]}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[s.recentMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                  >
                    {shortTime(entry.occurredAt, Date.now())} · {entry.caregiver}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[s.recentOutcome, { color: colors.amber, fontFamily: "Inter_600SemiBold" }]}
                >
                  {outcomeLabel(entry)}
                </Text>
                <View style={[s.recentCheck, { backgroundColor: colors.sage }]}>
                  <Ionicons name="checkmark" size={13} color={colors.primaryForeground} />
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={[s.recentEmpty, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              No care logged yet. Tap a tile above and it appears here instantly.
            </Text>
          )}
        </BoardCard>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View full log"
          onPress={() => router.replace("/log" as never)}
          style={({ pressed }) => [
            s.fullLogButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[s.fullLogText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
            View Full Log
          </Text>
        </Pressable>
      </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  sheetBody: {
    flex: 1,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 27,
    lineHeight: 34,
    marginBottom: 20,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 22,
  },
  tileLayout: {
    width: "31.5%",
  },
  tile: {
    width: "100%",
    aspectRatio: 0.92,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  tileLabel: {
    fontSize: 13,
  },
  tileLoggedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  recentSection: {
    marginBottom: 18,
    padding: 14,
  },
  recentTitle: {
    fontSize: 15,
    marginBottom: 10,
    marginLeft: 2,
  },
  recentRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 8,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  recentCopy: {
    flex: 1,
    minWidth: 0,
  },
  recentName: {
    fontSize: 13.5,
  },
  recentMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  recentOutcome: {
    fontSize: 11,
    maxWidth: 74,
  },
  recentCheck: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  recentEmpty: {
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: 4,
  },
  fullLogButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  fullLogText: {
    fontSize: 14.5,
  },
});
