import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalizeCareEventType, type CareEventType } from "@workspace/care-domain";

import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useCare, type Entry } from "@/context/CareContext";
import { careXpForEntry } from "@/lib/careCareer";
import { MIN_MOBILE_TOUCH_TARGET, MOBILE_INLINE_HIT_SLOP } from "@/lib/mobileLayout";
import { buildQuickLogEntry, getQuickLogPolicy } from "@/lib/quickLogEntry";
import { buildWalkSessionStartEntry, findOpenWalkSession } from "@/lib/walkSession";

/**
 * Fast-log sheet from the mock boards: a dark full-screen moment with six
 * white tiles ("What would you like to log?"), the freshest real logs with
 * green outcome checks, and one door into the full Log. The palette is a
 * constant night-forest surface in both color schemes, exactly like the
 * board art.
 */
const SHEET_BG = "#32362B";
const SHEET_SECTION = "#2A2E24";
const SHEET_ROW = "#3A3E32";
const SHEET_CLOSE = "#454A3C";
const TILE_BG = "#FBF6E7";
const TILE_BORDER = "#E7DFC9";
const TILE_INK = "#26221C";
const CREAM = "#F7F1E1";
const CREAM_MUTED = "rgba(247,241,225,0.62)";
const CHECK_GREEN = "#5F8C5A";
const OUTCOME_AMBER = "#D8B26A";
const BUTTON_FOREST = "#4A6741";

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
    if (completion === "ate-all") return "Ate all";
    if (completion === "ate-most") return "Ate most";
    if (completion === "ate-some") return "Ate some";
    if (completion === "refused") return "Refused";
    if (completion === "grazing") return "Grazing";
    if (completion === "served") return "Served";
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

  const close = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)" as never);
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
      addEntry(buildWalkSessionStartEntry({ caregiver, now: Date.now() }) as Omit<Entry, "id">);
      flashLogged(tile.key);
      return;
    }
    const role = state.caregivers.find((person) => person.name === caregiver)?.role;
    const entry = buildQuickLogEntry(
      { type: tile.type, title: tile.title },
      state,
      { caregiver, caregiverRole: role, now: Date.now() },
    );
    addEntry(entry);
    flashLogged(tile.key);
  };

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 14) }]}>
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
          style={({ pressed }) => [s.closeButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="close" size={20} color={CREAM} />
        </Pressable>

        <Text style={[s.title, { fontFamily: "Fredoka_600SemiBold" }]}>
          What would you like{"\n"}to log?
        </Text>

        <View style={s.tileGrid}>
          {FAST_LOG_TILES.map((tile) => (
            <Pressable
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
              style={({ pressed }) => [
                s.tile,
                { transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
            >
              {justLogged === tile.key ? (
                <View style={s.tileLoggedBadge}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              ) : null}
              <PixelIcon name={tile.icon} size={34} />
              <Text style={[s.tileLabel, { fontFamily: "Inter_600SemiBold" }]}>{tile.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.recentSection}>
          <Text style={[s.recentTitle, { fontFamily: "Inter_700Bold" }]}>Recent</Text>
          {recent.length ? (
            recent.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={`Open recent log: ${entry.title}. ${outcomeLabel(entry)}.`}
                onPress={() =>
                  router.replace(`/log?entry=${encodeURIComponent(entry.id)}` as never)
                }
                style={({ pressed }) => [s.recentRow, { opacity: pressed ? 0.75 : 1 }]}
              >
                <View style={s.recentIcon}>
                  <PixelIcon name={tileIconFor(entry.type)} size={20} />
                </View>
                <View style={s.recentCopy}>
                  <Text numberOfLines={1} style={[s.recentName, { fontFamily: "Inter_600SemiBold" }]}>
                    {entry.title.split(" - ")[0]}
                  </Text>
                  <Text numberOfLines={1} style={[s.recentMeta, { fontFamily: "Inter_500Medium" }]}>
                    {shortTime(entry.occurredAt, Date.now())} · {entry.caregiver}
                  </Text>
                </View>
                <Text numberOfLines={1} style={[s.recentOutcome, { fontFamily: "Inter_600SemiBold" }]}>
                  {outcomeLabel(entry)}
                </Text>
                <View style={s.recentCheck}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={[s.recentEmpty, { fontFamily: "Inter_500Medium" }]}>
              No care logged yet. Tap a tile above and it appears here instantly.
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View full log"
          onPress={() => router.replace("/log" as never)}
          style={({ pressed }) => [s.fullLogButton, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[s.fullLogText, { fontFamily: "Inter_700Bold" }]}>View Full Log</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SHEET_BG,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: SHEET_CLOSE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: CREAM,
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
  tile: {
    width: "31.5%",
    aspectRatio: 0.92,
    borderRadius: 20,
    backgroundColor: TILE_BG,
    borderWidth: 1,
    borderColor: TILE_BORDER,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tileLabel: {
    color: TILE_INK,
    fontSize: 13,
  },
  tileLoggedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: CHECK_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  recentSection: {
    backgroundColor: SHEET_SECTION,
    borderRadius: 22,
    padding: 14,
    marginBottom: 18,
  },
  recentTitle: {
    color: CREAM,
    fontSize: 13.5,
    marginBottom: 10,
    marginLeft: 2,
  },
  recentRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SHEET_ROW,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 8,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(247,241,225,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentCopy: {
    flex: 1,
    minWidth: 0,
  },
  recentName: {
    color: CREAM,
    fontSize: 13.5,
  },
  recentMeta: {
    color: CREAM_MUTED,
    fontSize: 11,
    marginTop: 1,
  },
  recentOutcome: {
    color: OUTCOME_AMBER,
    fontSize: 11,
    maxWidth: 74,
  },
  recentCheck: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: CHECK_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  recentEmpty: {
    color: CREAM_MUTED,
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: 4,
  },
  fullLogButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: BUTTON_FOREST,
    alignItems: "center",
    justifyContent: "center",
  },
  fullLogText: {
    color: CREAM,
    fontSize: 14.5,
  },
});
