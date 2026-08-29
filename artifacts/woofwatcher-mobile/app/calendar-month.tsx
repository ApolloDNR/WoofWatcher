import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Reanimated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { normalizeCareEventType } from "@workspace/care-domain";

import { BoardCard, BoardPill, BoardRouteHeader } from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useAppViewport } from "@/context/AppViewportContext";
import { useCare, type Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import {
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import {
  CALENDAR_MONTH_DAY_TARGET,
  getCalendarMonthGridLayout,
} from "@/lib/calendarMonthLayout";
import { resolveConsumerPetName } from "@/lib/petIdentity";
import {
  buildMonthView,
  dateKeyForYmd,
  dateKeyStamp,
  entriesForDayKey,
  dateKeyOf,
  parseDateKey,
  shiftMonth,
  WEEKDAY_LABELS,
  type MonthDayCell,
} from "@/lib/monthCalendar";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const TITLE_SERIF = "Fraunces_700Bold";

/**
 * Calendar (month) screen from Apollo's board: a `< May 2025 >` month header,
 * a Sunday-first week grid in a parchment card with the selected day as a
 * filled forest circle and today wearing a subtle ring, then the selected
 * day's timeline of real logged care - time, colored type icon, title, and a
 * colored left spine per type - plus a forest FAB into quick-add.
 *
 * Everything is derived from real state: day dots come from `state.entries`
 * (bucketed by local day) and, for today/future days, from whether any
 * `state.routines` are scheduled. The timeline is built purely from the real
 * entries logged on the selected day; nothing here is invented.
 */

// Mirrors calendar.tsx's routine type -> PixelIcon mapping so the two care
// surfaces stay visually consistent.
function routinePixelIcon(type: string): PixelIconName {
  const normalized = normalizeCareEventType(type);
  if (normalized === "meal") return "meal";
  if (normalized === "walk") return "walk";
  if (normalized === "training") return "training";
  if (normalized === "potty") return "pee";
  if (normalized === "treat") return "treat";
  if (normalized === "play") return "play";
  if (normalized === "medication") return "medication";
  if (normalized === "water") return "bile";
  if (normalized === "vomit") return "vomit";
  if (normalized === "note") return "note";
  return "clock";
}

// Colored left-spine tone per care type, tuned to the mock's timeline (Meal
// warm, Walk/Play green, Potty/Water blue, Nap/Mood purple) and drawn from the
// shared parchment/forest palette - no navy.
function typeTone(type: string, colors: ReturnType<typeof useColors>): string {
  switch (normalizeCareEventType(type)) {
    case "meal":
      return colors.meterHunger;
    case "treat":
      return colors.copper;
    case "water":
      return colors.meterAlone;
    case "walk":
      return colors.forest;
    case "potty":
      return colors.meterAlone;
    case "play":
      return colors.forestBright;
    case "training":
      return colors.amber;
    case "medication":
      return colors.rose;
    case "mood":
    case "alone":
      return colors.meterSleep;
    case "grooming":
      return colors.sage;
    case "vomit":
    case "symptom":
    case "incident":
      return colors.rose;
    case "weight":
      return colors.sage;
    default:
      return colors.sage;
  }
}

function clockLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function titleFor(entry: Entry): string {
  const clean = entry.title?.trim();
  if (clean) return clean;
  const type = normalizeCareEventType(entry.type);
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function CalendarMonthScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width: screenWidth } = useAppViewport();
  const { state } = useCare();
  const petName = resolveConsumerPetName(state.profile.name);
  const monthLayout = useMemo(
    () => getCalendarMonthGridLayout(screenWidth),
    [screenWidth],
  );

  // The quick-add FAB floats bottom-right (right: 20 + width 60 = 80px lane). On
  // short/narrow viewports the timeline header lands in that lane, so the
  // "N logged" pill hides behind the FAB. Inset the header's right edge past the
  // FAB lane on small screens so the pill always clears it; wide reference
  // screens (393) are unaffected and keep the pill hugging the card edge.
  const FAB_LANE = 20 + 60;
  const CONTENT_PADDING_H = 16;
  const pillFabClearance = screenWidth <= 360 ? FAB_LANE - CONTENT_PADDING_H + 8 : 0;

  const topPadding = getRouteTopPadding({ platform: Platform.OS, topInset: insets.top, surface: "standalone" });
  const bottomPadding = getStandaloneRouteBottomPadding({ platform: Platform.OS, bottomInset: insets.bottom });

  // "Now" is read once here and threaded into the pure month math so the lib
  // stays clock-free and deterministically testable.
  const now = useMemo(() => Date.now(), []);
  const todayKey = useMemo(() => dateKeyOf(new Date(now)), [now]);
  const todayStamp = useMemo(() => dateKeyStamp(todayKey), [todayKey]);

  const [view, setView] = useState(() => {
    const date = new Date(now);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const monthView = useMemo(
    () => buildMonthView({ year: view.year, month: view.month, todayKey, entries: state.entries }),
    [view.year, view.month, todayKey, state.entries],
  );

  const dayEntries = useMemo(
    () => entriesForDayKey(state.entries, selectedKey),
    [state.entries, selectedKey],
  );

  const hasRoutines = state.routines.length > 0;
  const monthKey = `${view.year}-${view.month}`;

  const goToMonth = useCallback(
    (delta: number) => {
      Haptics.selectionAsync();
      const next = shiftMonth(view.year, view.month, delta);
      setView(next);
      // Keep a sensible selection: land on today when stepping back into the
      // current month, otherwise select the 1st of the month now on screen.
      const todayParts = parseDateKey(todayKey);
      const isCurrentMonth = todayParts?.year === next.year && todayParts?.month === next.month;
      setSelectedKey(isCurrentMonth ? todayKey : dateKeyForYmd(next.year, next.month, 1));
    },
    [view.year, view.month, todayKey],
  );

  const selectDay = useCallback((cell: MonthDayCell) => {
    if (!cell.dateKey) return;
    Haptics.selectionAsync();
    setSelectedKey(cell.dateKey);
  }, []);

  const openEntry = useCallback(
    (id: string) => {
      Haptics.selectionAsync();
      router.push(`/log?entry=${encodeURIComponent(id)}` as never);
    },
    [router],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/calendar" as never);
  }, [router]);

  const selectedLabel = useMemo(() => {
    if (selectedKey === todayKey) return "Today";
    const parts = parseDateKey(selectedKey);
    if (!parts) return "Selected day";
    return new Date(parts.year, parts.month, parts.day).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [selectedKey, todayKey]);

  const selectedSubLabel = useMemo(() => {
    const parts = parseDateKey(selectedKey);
    if (!parts) return "";
    return new Date(parts.year, parts.month, parts.day).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedKey]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding + 80,
          paddingHorizontal: monthLayout.pageGutter,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader back onBack={goBack} title="Calendar" subtitle="Your dog's day, month by month" />

        {/* Month navigator: < May 2025 > */}
        <View style={s.monthNav}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            haptic="none"
            onPress={() => goToMonth(-1)}
            scaleTo={0.9}
            style={[s.navChip, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </PressScale>
          <Text style={[s.monthTitle, { color: colors.foreground, fontFamily: TITLE_SERIF }]}>
            {monthView.title}
          </Text>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Next month"
            haptic="none"
            onPress={() => goToMonth(1)}
            scaleTo={0.9}
            style={[s.navChip, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
          </PressScale>
        </View>

        {/* Week grid */}
        <BoardCard
          enter={0}
          padded={false}
          style={[s.gridCard, { paddingHorizontal: monthLayout.gridInset }]}
        >
          {monthLayout.requiresHorizontalScroll ? (
            <Text
              style={[
                s.compactGridHint,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Swipe horizontally to see all seven days
            </Text>
          ) : null}
          <ScrollView
            horizontal
            scrollEnabled={monthLayout.requiresHorizontalScroll}
            showsHorizontalScrollIndicator={monthLayout.requiresHorizontalScroll}
            bounces={false}
            style={s.monthGridViewport}
            contentContainerStyle={s.monthGridViewportContent}
          >
            <View style={[s.monthGrid, { width: monthLayout.gridWidth }]}>
              <View style={s.weekdayRow}>
                {WEEKDAY_LABELS.map((label, index) => (
                  <Text
                    key={`${label}-${index}`}
                    style={[
                      s.weekdayLabel,
                      {
                        width: monthLayout.cellSize,
                        color: colors.mutedForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                ))}
              </View>

              <Reanimated.View key={monthKey} entering={reduced ? undefined : FadeIn.duration(200)}>
                {monthView.weeks.map((week, weekIndex) => (
                  <View key={`week-${weekIndex}`} style={s.weekRow}>
                    {week.map((cell, dayIndex) => {
                      if (!cell.inMonth || cell.day === null || cell.dateKey === null) {
                        return (
                          <View
                            key={`blank-${weekIndex}-${dayIndex}`}
                            style={[s.dayCell, { width: monthLayout.cellSize }]}
                          />
                        );
                      }
                      const selected = cell.dateKey === selectedKey;
                      const stamp = dateKeyStamp(cell.dateKey);
                      const planDot =
                        hasRoutines && !cell.hasEntries && Number.isFinite(stamp) && stamp >= todayStamp;
                      const dotColor = cell.hasEntries ? colors.forest : planDot ? colors.sage : "transparent";
                      const numberColor = selected
                        ? colors.primaryForeground
                        : cell.isToday
                          ? colors.forest
                          : colors.foreground;
                      return (
                        <PressScale
                          key={cell.dateKey}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          aria-selected={selected}
                          accessibilityLabel={`${dayNarration(cell)}${cell.isToday ? ", today" : ""}${
                            cell.hasEntries
                              ? `, ${cell.entryCount} ${cell.entryCount === 1 ? "log" : "logs"}`
                              : planDot
                                ? ", routines scheduled"
                                : ""
                          }`}
                          haptic="none"
                          scaleTo={0.9}
                          onPress={() => selectDay(cell)}
                          containerStyle={[s.dayCell, { width: monthLayout.cellSize }]}
                          style={s.dayCellInner}
                        >
                          <View
                            style={[
                              s.dayCircle,
                              selected && { backgroundColor: colors.primary },
                              !selected && cell.isToday && { borderWidth: 1.5, borderColor: colors.primary },
                            ]}
                          >
                            <Text
                              style={[
                                s.dayNumber,
                                { color: numberColor, fontFamily: selected || cell.isToday ? "Inter_700Bold" : "Inter_600SemiBold" },
                              ]}
                            >
                              {cell.day}
                            </Text>
                          </View>
                          <View style={[s.dayDot, { backgroundColor: dotColor }]} />
                        </PressScale>
                      );
                    })}
                  </View>
                ))}
              </Reanimated.View>
            </View>
          </ScrollView>
        </BoardCard>

        {/* Selected day timeline */}
        <BoardCard enter={1} style={s.timelineCard}>
          <View style={[s.timelineHeader, pillFabClearance ? { paddingRight: pillFabClearance } : null]}>
            <View style={s.timelineHeaderCopy}>
              <Text style={[s.timelineEyebrow, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                {selectedSubLabel}
              </Text>
              <Text style={[s.timelineTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {selectedLabel}
              </Text>
            </View>
            <BoardPill
              label={dayEntries.length ? `${dayEntries.length} logged` : "No logs"}
              tone={dayEntries.length ? colors.forest : colors.mutedForeground}
            />
          </View>

          <Reanimated.View key={selectedKey} entering={reduced ? undefined : FadeInDown.duration(220)}>
            {dayEntries.length === 0 ? (
              <View style={[s.emptyState, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <PixelIcon name="clock" size={30} />
                <Text style={[s.emptyTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  Nothing logged on this day yet
                </Text>
                <Text style={[s.emptyBody, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {selectedKey === todayKey
                    ? `Tap the + to log ${petName}'s first moment today.`
                    : "Real meals, walks, and potties you log will show up here."}
                </Text>
              </View>
            ) : (
              <View style={s.timelineList}>
                {dayEntries.map((entry, index) => {
                  const tone = typeTone(entry.type, colors);
                  return (
                    <PressScale
                      key={entry.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${clockLabel(entry.occurredAt)} ${titleFor(entry)}. Opens the log detail.`}
                      haptic="none"
                      scaleTo={0.98}
                      onPress={() => openEntry(entry.id)}
                      style={[
                        s.timelineRow,
                        index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                      ]}
                    >
                      <View style={[s.spine, { backgroundColor: tone }]} />
                      <Text style={[s.rowTime, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                        {clockLabel(entry.occurredAt)}
                      </Text>
                      <View style={[s.rowIcon, { backgroundColor: tone + "1F", borderColor: tone + "3A" }]}>
                        <PixelIcon name={routinePixelIcon(entry.type)} size={20} />
                      </View>
                      <View style={s.rowCopy}>
                        <Text
                          numberOfLines={1}
                          style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                        >
                          {titleFor(entry)}
                        </Text>
                        {entry.caregiver ? (
                          <Text
                            numberOfLines={1}
                            style={[s.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                          >
                            Logged by {entry.caregiver}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </PressScale>
                  );
                })}
              </View>
            )}
          </Reanimated.View>
        </BoardCard>
      </ScrollView>

      {/* Forest quick-add FAB */}
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Quick add a log"
        hitSlop={MOBILE_INLINE_HIT_SLOP}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/fastlog" as never);
        }}
        scaleTo={0.9}
        containerStyle={[s.fabContainer, { bottom: insets.bottom + 20 }]}
        style={[s.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
      >
        <Ionicons name="add" size={30} color={colors.primaryForeground} />
      </PressScale>
    </View>
  );
}

function dayNarration(cell: MonthDayCell): string {
  const parts = cell.dateKey ? parseDateKey(cell.dateKey) : null;
  if (!parts) return `Day ${cell.day ?? ""}`;
  return new Date(parts.year, parts.month, parts.day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    marginTop: 2,
  },
  navChip: {
    width: MIN_MOBILE_TOUCH_TARGET,
    height: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    lineHeight: 28,
  },

  gridCard: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  compactGridHint: {
    marginBottom: 8,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
  },
  monthGridViewport: {
    width: "100%",
  },
  monthGridViewportContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  monthGrid: {
    alignSelf: "center",
    flexDirection: "column",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayLabel: {
    textAlign: "center",
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    minWidth: CALENDAR_MONTH_DAY_TARGET,
    height: CALENDAR_MONTH_DAY_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellInner: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 14,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },

  timelineCard: {
    marginBottom: 12,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  timelineHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  timelineEyebrow: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  timelineTitle: {
    fontSize: 19,
    lineHeight: 24,
    marginTop: 2,
  },
  timelineList: {
    marginTop: 2,
  },
  timelineRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
  },
  spine: {
    width: 4,
    height: 38,
    borderRadius: 2,
  },
  rowTime: {
    width: 62,
    fontSize: 12.5,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
  },
  rowMeta: {
    fontSize: 11.5,
    marginTop: 1,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
  },

  fabContainer: {
    position: "absolute",
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
