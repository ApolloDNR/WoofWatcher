import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { normalizeCareEventType } from "@workspace/care-domain";

import { BoardCard } from "@/components/board/BoardPrimitives";
import { QuickLogGrid } from "@/components/logging/QuickLogGrid";
import { useQuickLogController } from "@/components/logging/useQuickLogController";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import {
  createWebQaLayoutMarker,
  getAccessibleLayoutMetrics,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { MEAL_OUTCOME_UPDATE_OPTIONS } from "@/lib/mealOutcomeUpdate";

/**
 * Fast-log sheet from Apollo's FINAL mock boards: a light parchment moment
 * with six cream tiles ("What would you like to log?"), the freshest real
 * logs with green outcome checks inside a cream board card, and one forest
 * pill into the full Log. Warm parchment, ink text, no dark HUD chrome -
 * exactly like the board art.
 */

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
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale, qaFontScale } = useWebQaFontScale(runtimeFontScale);
  const reducedMotion = useReducedMotion();
  const fastLogLayout = getAccessibleLayoutMetrics({
    platform: Platform.OS,
    fontScale,
  });
  const { state } = useCare();
  const quickLog = useQuickLogController();

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
    new Animated.Value(animatesInternally && !reducedMotion ? 0 : 1),
  ).current;
  const dismissing = useRef(false);
  useEffect(() => {
    if (!animatesInternally || reducedMotion) {
      sheetProgress.setValue(1);
      return;
    }
    Animated.timing(sheetProgress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatesInternally, reducedMotion, sheetProgress]);

  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)" as never);
  };

  const close = () => {
    if (!animatesInternally || reducedMotion) {
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

  return (
    <Animated.View
      testID="qa-layout-fast-log"
      nativeID={createWebQaLayoutMarker(qaFontScale, fastLogLayout)}
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

        <QuickLogGrid
          controller={quickLog}
          variant="expanded"
          showFeedback
        />

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
                  fastLogLayout.stackStatusRows && s.recentRowReflow,
                  {
                    minHeight: fastLogLayout.controlMinHeight,
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
                    numberOfLines={fastLogLayout.stackStatusRows ? undefined : 1}
                    style={[s.recentName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                  >
                    {entry.title.split(" - ")[0]}
                  </Text>
                  <Text
                    numberOfLines={fastLogLayout.stackStatusRows ? undefined : 1}
                    style={[s.recentMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                  >
                    {shortTime(entry.occurredAt, Date.now())} · {entry.caregiver}
                  </Text>
                  {fastLogLayout.stackStatusRows ? (
                    <Text
                      style={[
                        s.recentOutcome,
                        s.recentOutcomeReflow,
                        { color: colors.amber, fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {outcomeLabel(entry)}
                    </Text>
                  ) : null}
                </View>
                {!fastLogLayout.stackStatusRows ? (
                  <Text
                    numberOfLines={1}
                    style={[s.recentOutcome, { color: colors.amber, fontFamily: "Inter_600SemiBold" }]}
                  >
                    {outcomeLabel(entry)}
                  </Text>
                ) : null}
                <View style={[s.recentCheck, { backgroundColor: colors.sage }]}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
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
  recentRowReflow: {
    alignItems: "flex-start",
    paddingVertical: 11,
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
  recentOutcomeReflow: {
    marginTop: 4,
    maxWidth: "100%",
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
