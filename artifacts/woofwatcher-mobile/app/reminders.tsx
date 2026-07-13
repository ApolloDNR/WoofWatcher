import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  deriveCareReminderCenter,
  type CareReminderItem,
  type CareReminderUrgency,
} from "@workspace/care-domain";

import {
  BoardActionButton,
  BoardCard,
  BoardRouteHeader,
  BoardSegmentTabs,
  BoardStatusPill,
  type BoardStatusPillTone,
} from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import {
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import { buildReminderNotificationPreferencesForCenter } from "@/lib/reminderNotificationPreferences";

const DISPLAY_SEMI = "Fredoka_600SemiBold";

type ReminderTab = "upcoming" | "past";
type SectionKey = "today" | "tomorrow" | "later" | "nodate";

// Reminder Center kinds -> pixel icon chips, mirroring Health's mapping so a
// medication reminder reads the same on both surfaces.
const KIND_ICON: Record<CareReminderItem["kind"], PixelIconName> = {
  routine: "clock",
  medication: "medication",
  record: "note",
  grooming: "heart",
};

const URGENCY_RANK: Record<CareReminderUrgency, number> = { alert: 0, watch: 1, info: 2 };

const SECTION_ORDER: { key: SectionKey; kicker: string }[] = [
  { key: "today", kicker: "TODAY" },
  { key: "tomorrow", kicker: "TOMORROW" },
  { key: "later", kicker: "LATER" },
  { key: "nodate", kicker: "NO DATE" },
];

/** Parse a "7:45 AM" style clock label into minutes-from-midnight. */
function parseTimeMinutes(time: string): number | null {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(time);
  if (!match) return null;
  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

/**
 * Honest day bucketing. daysUntil (0 = today, 1 = tomorrow, else later) is the
 * source of truth when the item carries one. Routine and today's medication
 * doses have no daysUntil but are derived against today's schedule, so they are
 * genuinely "today"; anything else without a date falls to a labelled "No date"
 * group rather than being invented into a day.
 */
function bucketFor(item: CareReminderItem): SectionKey {
  if (item.daysUntil != null && Number.isFinite(item.daysUntil)) {
    if (item.daysUntil <= 0) return "today";
    if (item.daysUntil === 1) return "tomorrow";
    return "later";
  }
  if (item.kind === "routine" || item.kind === "medication") return "today";
  return "nodate";
}

/** Sort key inside a section: routines by clock time, dated items by daysUntil. */
function whenSortValue(item: CareReminderItem): number {
  const minutes = item.time ? parseTimeMinutes(item.time) : null;
  if (minutes != null) return minutes;
  if (item.daysUntil != null && Number.isFinite(item.daysUntil)) return item.daysUntil * 1440;
  return Number.MAX_SAFE_INTEGER;
}

/** The prominent "when" line: real clock time, real day offset, or honest status. */
function whenLabel(item: CareReminderItem): string {
  if (item.time) return item.time;
  if (item.daysUntil != null && Number.isFinite(item.daysUntil)) {
    const days = item.daysUntil;
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `In ${days} days`;
  }
  return item.urgency === "alert" ? "Overdue" : "Due now";
}

function urgencyPill(urgency: CareReminderUrgency): { label: string; tone: BoardStatusPillTone } {
  if (urgency === "alert") return { label: "Due", tone: "due" };
  if (urgency === "watch") return { label: "Up Next", tone: "upNext" };
  return { label: "Upcoming", tone: "upcoming" };
}

export default function RemindersScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const now = Date.now();

  const [activeTab, setActiveTab] = useState<ReminderTab>("upcoming");

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "standalone",
  });
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const notificationPreferences = useMemo(
    () => buildReminderNotificationPreferencesForCenter(state.launchProviderProfile, state.reminderNotificationPreferences),
    [state.launchProviderProfile, state.reminderNotificationPreferences],
  );

  // Real reminder candidates only: routines, medications, record renewals, and
  // grooming derived from persisted household state. A generous limit keeps this
  // the full list rather than the trimmed Health/Plan previews.
  const reminderCenter = useMemo(
    () =>
      deriveCareReminderCenter({
        routines: state.routines,
        entries: state.entries,
        records: state.records,
        caregivers: state.caregivers,
        notificationPreferences,
        now,
        limit: 50,
      }),
    [state.routines, state.entries, state.records, state.caregivers, notificationPreferences, now],
  );

  const sections = useMemo(() => {
    const grouped = new Map<SectionKey, CareReminderItem[]>();
    for (const item of reminderCenter.items) {
      const key = bucketFor(item);
      const list = grouped.get(key);
      if (list) list.push(item);
      else grouped.set(key, [item]);
    }
    return SECTION_ORDER.map(({ key, kicker }) => {
      const items = (grouped.get(key) ?? []).slice().sort(
        (a, b) =>
          URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
          whenSortValue(a) - whenSortValue(b) ||
          a.label.localeCompare(b.label),
      );
      return { key, kicker, items };
    }).filter((section) => section.items.length > 0);
  }, [reminderCenter.items]);

  function openReminderSurface(item: CareReminderItem): void {
    // Route to the surface that actually owns the reminder's detail so no row
    // is a dead end: routines/grooming live on the Plan tab, medications and
    // record renewals live in Records.
    if (item.kind === "medication" || item.kind === "record") {
      router.push("/records");
      return;
    }
    router.push("/calendar");
  }

  function goBack(): void {
    if (router.canGoBack()) router.back();
    else router.replace("/health");
  }

  function urgencyTone(urgency: CareReminderUrgency): string {
    if (urgency === "alert") return colors.rose;
    if (urgency === "watch") return colors.amber;
    return colors.sage;
  }

  function renderRow(item: CareReminderItem, index: number): React.ReactNode {
    const tone = urgencyTone(item.urgency);
    const pill = urgencyPill(item.urgency);
    const when = whenLabel(item);
    return (
      <PressScale
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={`${when}. ${item.label}. ${item.detail} ${pill.label}.`}
        accessibilityHint={item.action}
        onPress={() => openReminderSurface(item)}
        scaleTo={0.97}
        style={[
          s.row,
          index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
        ]}
      >
        <View style={[s.rowIcon, { backgroundColor: tone + "16" }]}>
          <PixelIcon name={KIND_ICON[item.kind]} size={22} />
        </View>
        <View style={s.rowText}>
          <Text style={[s.rowWhen, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
            {when}
          </Text>
          <Text numberOfLines={1} style={[s.rowLabel, { color: colors.ink, fontFamily: "Inter_700Bold" }]}>
            {item.label}
          </Text>
          {item.detail ? (
            <Text numberOfLines={2} style={[s.rowDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {item.detail}
            </Text>
          ) : null}
        </View>
        <BoardStatusPill label={pill.label} tone={pill.tone} style={s.rowPill} />
      </PressScale>
    );
  }

  const showUpcoming = activeTab === "upcoming";
  const hasUpcoming = reminderCenter.items.length > 0;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          title="Reminders"
          subtitle="Routines, meds & records coming due"
          back
          onBack={goBack}
        />

        <BoardSegmentTabs
          segments={[
            { key: "upcoming" as const, label: "Upcoming" },
            { key: "past" as const, label: "Past" },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {showUpcoming ? (
          hasUpcoming ? (
            <>
              {sections.map((section, sectionIndex) => (
                <View key={section.key} style={s.section}>
                  <Text style={[s.kicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    {section.kicker}
                  </Text>
                  <BoardCard enter={sectionIndex} style={s.sectionCard}>
                    {section.items.map((item, index) => renderRow(item, index))}
                  </BoardCard>
                </View>
              ))}

              <BoardActionButton
                label="New Reminder"
                icon="add"
                variant="primary"
                accessibilityLabel="Create a new reminder in Plans"
                onPress={() => router.push("/calendar")}
                style={s.newButton}
              />

              <View style={[s.noticeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.noticeHead}>
                  <Ionicons name="notifications-off-outline" size={14} color={colors.sage} />
                  <Text style={[s.noticeKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    NOTIFICATIONS
                  </Text>
                </View>
                <Text style={[s.noticeCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {reminderCenter.notificationReadiness}
                </Text>
              </View>
            </>
          ) : (
            <BoardCard enter={0} style={s.emptyCard}>
              <View style={[s.emptyIcon, { backgroundColor: colors.sageSoft }]}>
                <PixelIcon name="clock" size={30} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.ink, fontFamily: DISPLAY_SEMI }]}>
                No reminders yet
              </Text>
              <Text style={[s.emptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Routines, medication schedules, and record renewals surface here as they come due. Add one to get started.
              </Text>
              <BoardActionButton
                label="New Reminder"
                icon="add"
                variant="primary"
                accessibilityLabel="Create a new reminder in Plans"
                onPress={() => router.push("/calendar")}
                style={s.emptyAction}
              />
            </BoardCard>
          )
        ) : (
          <BoardCard enter={0} style={s.emptyCard}>
            <View style={[s.emptyIcon, { backgroundColor: colors.sageSoft }]}>
              <PixelIcon name="note" size={30} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.ink, fontFamily: DISPLAY_SEMI }]}>
              Nothing here yet
            </Text>
            <Text style={[s.emptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Past reminders will appear here once reminders have come and gone.
            </Text>
          </BoardCard>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  section: {
    marginBottom: 14,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingVertical: 11,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowWhen: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowDetail: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowPill: {
    marginLeft: 4,
  },
  newButton: {
    marginTop: 2,
    marginBottom: 14,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  noticeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noticeKicker: {
    fontSize: 10,
    letterSpacing: 1,
  },
  noticeCopy: {
    fontSize: 12,
    lineHeight: 17,
  },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 30,
    paddingHorizontal: 22,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 17,
  },
  emptyCopy: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: 6,
    alignSelf: "stretch",
  },
});
