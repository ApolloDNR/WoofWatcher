import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  deriveCareReminderCenter,
  deriveHealthWatch,
  deriveMedicationAdherence,
  deriveWeightTrend,
  getRecordDueStatus,
  normalizeCareEventType,
  summarizeRecordVault,
} from "@workspace/care-domain";

import {
  BoardActionButton,
  BoardCard,
  BoardMetricTile,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
} from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { CARE_TWIN_ROOM_VARIANT_ASSETS, getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import {
  buildHealthReviewPacketShareText,
  deriveBileWatchStatus,
  deriveHealthReviewPacket,
  type HealthReviewPacketAction,
} from "@/lib/healthReviewPacket";
import {
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { resolvePetName } from "@/lib/petIdentity";
import { pixelImageStyle, stageImageFill } from "@/lib/pixelRendering";
import { shareTextPayload } from "@/lib/shareText";
import { buildTrendWindow } from "@/lib/trendsChart";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const HEALTH_WATCH_STAGE_ROOM = CARE_TWIN_ROOM_VARIANT_ASSETS.healthWatch.source;
const HEALTH_WATCH_STAGE_SPRITE = getCareTwinSpriteAsset("health-watch");
const HEALTH_WATCH_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["health-watch"];

type HealthTab = "health" | "bile";

function HealthHeaderAction({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={MOBILE_INLINE_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [
        s.healthHeaderAction,
        {
          backgroundColor: pressed ? colors.secondary : colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[s.healthHeaderActionText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function entryText(entry: { title?: string; note?: string; details?: { [key: string]: unknown } }): string {
  const details = entry.details
    ? Object.values(entry.details)
        .filter((value): value is string => typeof value === "string")
        .join(" ")
    : "";
  return `${entry.title ?? ""} ${entry.note ?? ""} ${details}`.toLowerCase();
}

function isYellowBile(entry: { type: string; title?: string; note?: string; details?: { [key: string]: unknown } }): boolean {
  const type = normalizeCareEventType(entry.type, entry.details);
  const text = entryText(entry);
  return type === "vomit" && (text.includes("bile") || (text.includes("yellow") && text.includes("vomit")));
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3600000;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "None logged";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusActionLabel(type: string): string {
  if (type === "walk") return "Log activity";
  if (type === "meal") return "Log appetite";
  if (type === "potty") return "Log potty";
  if (type === "water") return "Log water";
  if (type === "mood") return "Log energy";
  return "Log details";
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function signedChange(value: number, unit: string): string {
  return `${value > 0 ? "+" : ""}${value} ${unit}`;
}

// Reminder Center kinds -> pixel icon chips (same truth Calendar's Reminder
// Center derives; only the soonest candidate surfaces on Health).
const REMINDER_KIND_ICON: Record<string, PixelIconName> = {
  medication: "medication",
  routine: "clock",
  record: "note",
  grooming: "heart",
};

/**
 * Mockup-board Health Summary row: pixel icon chip + ink label + muted real
 * value + chevron. Every row routes to the screen that owns the real detail,
 * and every value is either logged data or an honest "Not on file".
 */
function HealthSummaryRow({
  icon,
  label,
  value,
  detail,
  accessory,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: PixelIconName;
  label: string;
  value: string;
  detail?: string;
  accessory?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const colors = useColors();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      scaleTo={0.97}
      style={[s.summaryRow, { backgroundColor: colors.background, borderColor: colors.border }]}
    >
      <View style={[s.summaryRowIcon, { backgroundColor: colors.sageSoft }]}>
        <PixelIcon name={icon} size={22} />
      </View>
      <View style={s.summaryRowText}>
        <Text numberOfLines={1} style={[s.summaryRowLabel, { color: colors.ink, fontFamily: "Inter_700Bold" }]}>
          {label}
        </Text>
        {detail ? (
          // 2 lines: the empty-state instructions ("Add a vet visit record to
          // the vault") are squeezed by the right-aligned value and clipped
          // the destination word off on one line. Short details stay 1 line.
          <Text numberOfLines={2} style={[s.summaryRowDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {accessory}
      <Text numberOfLines={1} style={[s.summaryRowValue, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
        {value}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
    </PressScale>
  );
}

export default function HealthScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const now = Date.now();
  const healthWeek = useMemo(() => buildTrendWindow("week", now), [now]);
  const recentHealthEntries = useMemo(
    () =>
      state.entries.filter((entry) => {
        const eventTime = new Date(entry.occurredAt).getTime();
        return (
          Number.isFinite(eventTime) &&
          eventTime >= healthWeek.start &&
          eventTime <= now
        );
      }),
    [healthWeek.start, now, state.entries],
  );
  const scrollRef = useRef<ScrollView>(null);
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const requestedTab: HealthTab = tabParam === "bile" ? "bile" : "health";
  const [activeTab, setActiveTab] = useState<HealthTab>(() => requestedTab);
  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const isWebRoutePreview = (Platform.OS as string) === "web";
  const routeHorizontalPadding = 16;

  const healthWatch = useMemo(
    // petName keeps pattern next steps ("... or <dog> seems painful ...")
    // on the renamed dog instead of a hardcoded "Phoenix".
    () =>
      deriveHealthWatch({
        entries: state.entries,
        routines: state.routines,
        now,
        petName: state.profile.name,
      }),
    [state.entries, state.routines, state.profile.name, now],
  );

  const bileEntries = useMemo(
    () =>
      recentHealthEntries
        .filter(isYellowBile)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [recentHealthEntries],
  );

  // Mockup-board Overview data: every value below is derived from persisted
  // household state (routines, entries, records, diet profile) - nothing is
  // invented, and each absent value renders an honest "Not on file".
  const careReminderCenter = useMemo(
    () =>
      deriveCareReminderCenter({
        routines: state.routines,
        entries: state.entries,
        records: state.records,
        caregivers: state.caregivers,
        now,
        limit: 3,
      }),
    [state.routines, state.entries, state.records, state.caregivers, now],
  );
  const nextReminder = careReminderCenter.items[0] ?? null;

  const weightTrend = useMemo(
    () =>
      deriveWeightTrend({
        entries: state.entries,
        profile: state.profile,
        goals: state.goals,
        now,
        lookbackDays: 90,
        limit: 8,
        petName: state.profile.name,
      }),
    [state.entries, state.profile, state.goals, now],
  );
  const weightOnFile = weightTrend.currentWeight > 0;
  const weightValue = weightOnFile ? `${weightTrend.currentWeight} ${weightTrend.unit}` : "Not on file";
  const weightDetail = !weightOnFile
    ? "Log a weigh-in to start the trend"
    : weightTrend.totalWeighIns >= 2 && weightTrend.changeFromPrevious !== 0
      ? `${signedChange(weightTrend.changeFromPrevious, weightTrend.unit)} since previous weigh-in`
      : weightTrend.latest
        ? `Logged ${shortDate(weightTrend.latest.occurredAt)}`
        : "Profile weight - no weigh-ins in 90 days";
  const sparkWeights = weightTrend.items.map((item) => item.weight);
  const sparkMin = sparkWeights.length ? Math.min(...sparkWeights) : 0;
  const sparkMax = sparkWeights.length ? Math.max(...sparkWeights) : 0;
  const sparkRange = Math.max(0.1, sparkMax - sparkMin);

  const medicationAdherence = useMemo(
    () => deriveMedicationAdherence({ entries: state.entries, routines: state.routines, now }),
    [state.entries, state.routines, now],
  );

  const recordVault = useMemo(() => summarizeRecordVault(state.records), [state.records]);
  const vaccineSection = recordVault.sections.find((section) => section.kind === "vaccine");
  const vetSection = recordVault.sections.find((section) => section.kind === "vet");
  const vaccineCount = vaccineSection?.count ?? 0;
  const expiredVaccineCount = useMemo(
    () =>
      (vaccineSection?.records ?? []).filter(
        (record) => getRecordDueStatus(record, now).status === "expired",
      ).length,
    [vaccineSection, now],
  );
  // "Last vet visit" reads straight from the vet section of the record vault:
  // the most recent dated visit that is not in the future, else the filed
  // record's title, else "None on file". No date is ever synthesized.
  const lastVetVisit = useMemo(() => {
    const vetRecords = vetSection?.records ?? [];
    if (!vetRecords.length) return null;
    const dated = vetRecords
      .map((record) => ({ record, status: getRecordDueStatus(record, now) }))
      .filter((item) => Boolean(item.status.date) && (item.status.daysUntil ?? 1) <= 0)
      .sort((a, b) => (b.status.daysUntil ?? 0) - (a.status.daysUntil ?? 0));
    if (dated[0]) {
      return { value: dated[0].status.date ?? dated[0].record.due ?? "", detail: dated[0].record.title };
    }
    const first = vetRecords[0];
    return { value: first.due?.trim() || first.title, detail: first.due?.trim() ? first.title : "Visit record on file" };
  }, [vetSection, now]);

  const sensitivitiesOnFile = (state.dietProfile.sensitivities ?? "").trim();

  const mealGaps = useMemo(() => {
    const meals = state.entries
      .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "meal")
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    let longest = 0;
    for (let i = 1; i < meals.length; i += 1) {
      longest = Math.max(longest, hoursBetween(meals[i - 1].occurredAt, meals[i].occurredAt));
    }
    return longest;
  }, [state.entries]);

  const bileTrend = useMemo(() => {
    return healthWeek.buckets.map((bucket) => {
      const count = bileEntries.filter((entry) => {
        const eventTime = new Date(entry.occurredAt).getTime();
        return eventTime >= bucket.start && eventTime < bucket.end;
      }).length;
      return {
        label: bucket.label.slice(0, 1),
        count,
      };
    });
  }, [bileEntries, healthWeek.buckets]);

  const healthRhythm = useMemo(() => {
    return healthWeek.buckets.map((bucket) => {
      const dayEntries = recentHealthEntries.filter((entry) => {
        const eventTime = new Date(entry.occurredAt).getTime();
        return eventTime >= bucket.start && eventTime < bucket.end;
      });
      const careLogs = dayEntries.filter((entry) =>
        ["meal", "walk", "potty", "water", "medication", "training"].includes(
          normalizeCareEventType(entry.type, entry.details),
        ),
      ).length;
      const watchSignals = dayEntries.filter((entry) =>
        ["vomit", "symptom", "incident"].includes(normalizeCareEventType(entry.type, entry.details)),
      ).length;
      // Days with zero logs stay neutral: no data should never render as a
      // full green "all good" bar.
      const hasData = dayEntries.length > 0;
      const value = hasData ? Math.max(0.18, Math.min(1, 0.34 + careLogs * 0.1 - watchSignals * 0.18)) : 0;

      return {
        label: bucket.label.slice(0, 1),
        value,
        hasData,
        tone: !hasData
          ? colors.muted
          : watchSignals
            ? (watchSignals > 1 ? colors.rose : colors.amber)
            : colors.sage,
      };
    });
  }, [
    colors.amber,
    colors.muted,
    colors.rose,
    colors.sage,
    healthWeek.buckets,
    recentHealthEntries,
  ]);

  const bileStatus = deriveBileWatchStatus({
    vomit7: healthWatch.counts.vomit7,
    recentYellowBileCount: bileEntries.length,
    signals: healthWatch.signals,
  });
  const bileTone =
    bileStatus === "Review" ? colors.rose : bileStatus === "Watch" ? colors.amber : colors.sage;
  // Health Watch is intentionally qualitative. A made-up 0-100 "health
  // score" would imply clinical precision the owner-entered logs cannot
  // support. The snapshot instead shows the factual number of days with care
  // evidence in the current 7-day window alongside the bounded status.
  const hasHealthSignalData =
    recentHealthEntries.length > 0 ||
    healthWatch.signals.length > 0 ||
    healthWatch.redFlags.length > 0;
  const loggedDays7 = healthRhythm.filter((day) => day.hasData).length;
  const logCoveragePercent = Math.round((loggedDays7 / 7) * 100);
  const statusTone = !hasHealthSignalData
    ? colors.mutedForeground
    : healthWatch.status === "good"
      ? colors.sage
      : healthWatch.status === "watch"
        ? colors.amber
        : colors.rose;
  const heroTitle = !hasHealthSignalData
    ? "No health logs yet"
    : healthWatch.status === "good"
      ? "Stable right now"
      : healthWatch.status === "alert"
        ? "Review needed"
        : "Worth watching";
  const heroCopy = !hasHealthSignalData
    ? "No logs yet - meals, potty, energy, and notes build the picture from your first log."
    : healthWatch.status === "good"
      ? "No active Health Watch signals are showing in the current window."
      : healthWatch.summary;
  const statusMedallionLabel = !hasHealthSignalData
    ? "READY"
    : healthWatch.status === "good"
      ? "GOOD"
      : healthWatch.status === "watch"
        ? "WATCH"
        : "REVIEW";
  const statusSupportCopy = !hasHealthSignalData
    ? "Health Watch starts with your first log."
    : healthWatch.status === "good"
      ? "You're on a roll. Keep the daily rhythm steady and share patterns when they matter."
      : healthWatch.status === "alert"
        ? "Consider sharing these observations with your vet, especially if patterns repeat."
        : "Pattern noticed. Keep logging food, stool, vomiting, energy, and timing.";
  const reviewCopy =
    healthWatch.status === "good"
      ? "Keep logging meals, stool, vomiting, energy, and medication so future changes are easy to review."
      : "Capture timing, food context, energy, stool detail, and repeat events before sharing with your vet.";

  const isBileTab = activeTab === "bile";
  const heroBubbleTitle = isBileTab
    ? bileStatus === "Low Risk"
      ? "Bile looks calm."
      : "Watching bile gently."
    : !hasHealthSignalData
      ? "Ready when you are."
      : healthWatch.status === "good"
        ? "Feeling steady."
        : "Let's take it easy.";
  const heroBubbleCopy = isBileTab
    ? "Bile Watch records patterns calmly."
    : "Health Watch records patterns calmly.";
  const snapshotTitle = isBileTab ? "Bile Snapshot" : "Health Snapshot";
  const heroStatusKicker = isBileTab ? "BILE STATUS" : "CARE STATUS";
  const heroPanelTitle = isBileTab
    ? bileStatus === "Review"
      ? "Bile worth review"
      : bileStatus === "Watch"
        ? "Bile worth watching"
        : "Bile looks low risk"
    : heroTitle;
  const heroPanelCopy = isBileTab
    ? "Yellow bile events are tracked as calm owner notes, not diagnoses."
    : heroCopy;

  const healthRows: {
    label: string;
    status: string;
    detail: string;
    icon: PixelIconName;
    tone: string;
    routeType: string;
    actionLabel: string;
  }[] = [
    {
      label: "Activity",
      status: "Good",
      detail: "Active daily",
      icon: "walk",
      tone: colors.sage,
      routeType: "walk",
      actionLabel: statusActionLabel("walk"),
    },
    {
      label: "Appetite",
      status: healthWatch.counts.appetiteWatch7 ? "Watch" : "Good",
      detail: healthWatch.counts.appetiteWatch7 ? `${healthWatch.counts.appetiteWatch7} reduced meals` : "Eating well",
      icon: "meal",
      tone: healthWatch.counts.appetiteWatch7 ? colors.amber : colors.sage,
      routeType: "meal",
      actionLabel: statusActionLabel("meal"),
    },
    {
      label: "Stool",
      status: healthWatch.counts.stoolWatch7 ? "Watch" : "Normal",
      detail: healthWatch.counts.stoolWatch7 ? `${healthWatch.counts.stoolWatch7} review logs` : "Solid and healthy",
      icon: "poo",
      tone: healthWatch.counts.stoolWatch7 ? colors.amber : colors.sage,
      routeType: "potty",
      actionLabel: statusActionLabel("potty"),
    },
    {
      label: "Hydration",
      status: "Good",
      detail: "Well hydrated",
      icon: "bile",
      tone: colors.blueSignal,
      routeType: "water",
      actionLabel: statusActionLabel("water"),
    },
    {
      label: "Energy",
      status: healthWatch.status === "good" ? "Good" : "Watch",
      detail: healthWatch.status === "good" ? "High and playful" : "Worth watching",
      icon: "energy",
      tone: healthWatch.status === "good" ? colors.sage : colors.amber,
      routeType: "mood",
      actionLabel: statusActionLabel("mood"),
    },
    {
      label: "Vomiting",
      status: healthWatch.counts.vomit7 ? "Watch" : "None",
      detail: healthWatch.counts.vomit7 ? `${healthWatch.counts.vomit7} in 7 days` : "No logs",
      icon: "vomit",
      tone: healthWatch.counts.vomit7 ? colors.amber : colors.sage,
      routeType: "symptom",
      actionLabel: statusActionLabel("symptom"),
    },
  ];
  // Zero-data honesty for the signal rows: "Active daily" / "Eating well"
  // are observations, and nothing has been observed before the first log.
  const displayHealthRows = hasHealthSignalData
    ? healthRows
    : healthRows.map((row) => ({
        ...row,
        status: "No logs",
        detail: "Starts with your first log",
        tone: colors.mutedForeground,
      }));
  const healthReviewPacket = deriveHealthReviewPacket({
    dogName: resolvePetName(state.profile.name),
    healthStatus: healthWatch.status,
    healthSummary: healthWatch.summary,
    healthCounts: {
      vomit7: healthWatch.counts.vomit7,
      appetiteWatch7: healthWatch.counts.appetiteWatch7,
      stoolWatch7: healthWatch.counts.stoolWatch7,
      anxiety7: healthWatch.counts.anxiety7,
    },
    redFlagCount: healthWatch.redFlags.length,
    bileStatus,
    lastYellowBileLabel: formatDateTime(bileEntries[0]?.occurredAt),
    longestFoodGapLabel: mealGaps ? `${mealGaps.toFixed(1)} hours` : "Needs more meal logs",
    bedtimeSnackLabel: state.dietProfile.bedtimeSnack || "Not set",
  });

  function openHealthReviewAction(action: HealthReviewPacketAction): void {
    if (action.route.startsWith("/log?")) {
      router.push(action.route as never);
      return;
    }
    if (action.route === "/woofguide") {
      router.push({ pathname: "/woofguide", params: action.params ?? {} } as never);
      return;
    }
    router.push(action.route);
  }

  function openHealthStatusRoute(type: string): void {
    router.push(`/log?type=${type}&detail=1&intent=${Date.now()}` as never);
  }

  async function shareHealthReviewPacket(): Promise<void> {
    await shareTextPayload({
      message: buildHealthReviewPacketShareText(healthReviewPacket, {
        dogName: resolvePetName(state.profile.name),
        generatedAtIso: new Date(now).toISOString(),
      }),
      title: "WoofWatcher Health Review Packet",
    });
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={s.container}
        contentContainerStyle={{
          paddingTop: getRouteTopPadding({
            platform: Platform.OS,
            topInset: insets.top,
            surface: "tabbed",
          }),
          paddingBottom: bottomPadding,
          paddingHorizontal: routeHorizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          kicker="Health"
          title="Health Watch"
          subtitle="Owner notes. No diagnosis."
          back
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          actionIcon="folder-open-outline"
          actionLabel="Open Records from Health Watch"
          onAction={() => router.push("/records")}
          plain
          style={s.routeHeaderCompact}
        />

        <View style={[s.tabRail, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { key: "health" as const, label: "Health" },
            { key: "bile" as const, label: "Bile Watch" },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${tab.label}`}
                aria-selected={active}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  s.tabPill,
                  {
                    // primary/primaryForeground is the app's selected-segment
                    // pair (Log filters, Calendar chips, Records med filters):
                    // it stays readable in dark mode, where brandNavy matches
                    // the navy card rail and made the active pill invisible.
                    backgroundColor: active ? colors.primary : "transparent",
                    borderColor: active ? colors.primary : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    s.tabText,
                    {
                      color: active ? colors.primaryForeground : colors.navy,
                      fontFamily: active ? "Inter_700Bold" : "Inter_600SemiBold",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isBileTab ? (
          <BoardCard style={s.bileCard} enter={0}>
            <View style={s.sectionTop}>
              <BoardSectionHeader title="Bile Watch" style={s.boardSectionTop} />
              <BoardPill label={bileStatus} icon="water-outline" tone={bileTone} />
            </View>

            <View style={[s.bilePanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[s.bileMedallion, { backgroundColor: bileTone + "16", borderColor: bileTone + "55" }]}>
                <PixelIcon name="bile" size={34} />
                <Text style={[s.bileMedallionText, { color: bileTone, fontFamily: "Inter_700Bold" }]}>
                  {bileStatus}
                </Text>
              </View>
              <View style={s.bileTrendArea}>
                <Text style={[s.bileTrendTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  7-day bile log
                </Text>
                <Text style={[s.bileTrendCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Yellow bile events are tracked as owner notes, not diagnoses.
                </Text>
                <View style={s.bileBars}>
                  {bileTrend.map((day, index) => {
                    const active = day.count > 0;
                    return (
                      <View key={`${day.label}-${index}`} style={s.bileBarColumn}>
                        <View
                          style={[
                            s.bileBar,
                            {
                              height: active ? Math.min(34, 14 + day.count * 8) : 8,
                              backgroundColor: active ? bileTone : colors.sage + "33",
                              borderColor: active ? bileTone : colors.border,
                            },
                          ]}
                        />
                        <Text style={[s.bileBarLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                          {day.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={s.metricGrid}>
              <BoardMetricTile
                icon="bile"
                label="Last yellow bile event"
                value={formatDateTime(bileEntries[0]?.occurredAt)}
                tone={bileTone}
                style={s.metricHalf}
              />
              <BoardMetricTile
                icon="meal"
                label="Longest food gap"
                value={mealGaps ? `${mealGaps.toFixed(1)} hours` : "Needs more meal logs"}
                tone={colors.copper}
                style={s.metricHalf}
              />
              <BoardMetricTile
                icon="treat"
                label="Bedtime snack proof"
                value={state.dietProfile.bedtimeSnack || "Not set"}
                tone={colors.amber}
                style={s.metricHalf}
              />
              <BoardMetricTile
                icon="vomit"
                label="7-day trend"
                value={`${healthWatch.counts.vomit7} vomit logs`}
                tone={colors.rose}
                style={s.metricHalf}
              />
            </View>
          </BoardCard>
        ) : null}

        <BoardCard style={s.heroCard}>
          <ImageBackground
            accessible={false}
            source={HEALTH_WATCH_STAGE_ROOM}
            resizeMode="cover"
            imageStyle={[stageImageFill, s.healthStageImage, pixelImageStyle]}
            style={s.healthStage}
          >
            <View style={s.healthStageShade} />
            <View style={s.healthStageTop}>
              <View style={s.healthStageBubble}>
                <Text style={[s.healthStageBubbleTitle, { color: colors.brandNavy, fontFamily: DISPLAY_SEMI }]}>
                  {heroBubbleTitle}
                </Text>
                <Text style={[s.healthStageBubbleCopy, { color: colors.brandNavy, fontFamily: "Inter_700Bold" }]}>
                  {heroBubbleCopy}
                </Text>
                <View style={s.healthStageBubbleTail} />
              </View>
              <View style={[s.healthStageChip, { backgroundColor: colors.sageSoft, borderColor: colors.sage + "55" }]}>
                <PixelIcon name="health" size={16} />
                <Text style={[s.healthStageChipText, { color: colors.forest, fontFamily: "Inter_700Bold" }]}>
                  {statusMedallionLabel}
                </Text>
              </View>
            </View>
            <View pointerEvents="none" style={s.healthStageSprite}>
              <View style={s.healthStageSpriteShadow} />
              <SpriteSheetPlayer
                asset={HEALTH_WATCH_STAGE_SPRITE}
                track={HEALTH_WATCH_STAGE_TRACK}
                width={104}
                height={104}
                testID="health-watch-pixel-sprite"
              />
            </View>
          </ImageBackground>

          <View style={[s.healthHeroPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <BoardSectionHeader
              title={snapshotTitle}
              style={s.healthSnapshotHeader}
              accessory={
                <HealthHeaderAction
                  label="7-day view"
                  accessibilityLabel="Show Health 7-day rhythm"
                  onPress={() => {
                    setActiveTab("health");
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  }}
                />
              }
            />
            <View style={s.healthHeroStatusRow}>
              <View style={[s.healthScoreToken, { backgroundColor: statusTone + "14", borderColor: statusTone + "66" }]}>
                <Text style={[s.healthScoreValue, { color: statusTone, fontFamily: DISPLAY }]}>{loggedDays7}/7</Text>
                <Text style={[s.healthScoreLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Days logged
                </Text>
              </View>

              <View style={s.healthHeroCopyStack}>
                <Text style={[s.heroLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>{heroStatusKicker}</Text>
                <Text style={[s.heroTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>{heroPanelTitle}</Text>
                <Text style={[s.heroCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {heroPanelCopy}
                </Text>
                <View style={[s.statusScoreTrack, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <View style={[s.statusScoreFill, { width: `${logCoveragePercent}%`, backgroundColor: statusTone }]} />
                </View>
                <Text style={[s.statusSupportCopy, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {statusSupportCopy}
                </Text>
              </View>
            </View>

            {activeTab === "health" ? (
              <>
                <View style={[s.healthRhythmPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={s.healthRhythmHeader}>
                    <Text style={[s.healthRhythmTitle, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                      7-day rhythm
                    </Text>
                    <Text style={[s.healthRhythmMeta, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                      Owner log signal
                    </Text>
                  </View>
                  <View style={s.healthRhythmBars}>
                    {healthRhythm.map((day, index) => (
                      <View key={`${day.label}-${index}`} style={s.healthRhythmColumn}>
                        <View
                          style={[
                            s.healthRhythmBar,
                            {
                              height: day.hasData ? 8 + Math.round(day.value * 22) : 8,
                              backgroundColor: day.tone,
                              borderColor: day.hasData ? day.tone : colors.border,
                            },
                          ]}
                        />
                        <Text style={[s.healthRhythmLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                          {day.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={s.healthSignalList}>
                  {displayHealthRows.slice(0, 4).map((row) => (
                    <PressScale
                      key={row.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.label}. ${row.status}. ${row.detail}. ${row.actionLabel}`}
                      onPress={() => openHealthStatusRoute(row.routeType)}
                      scaleTo={0.97}
                      style={[
                        s.healthSignalRow,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={[s.statusIcon, { backgroundColor: row.tone + "16" }]}>
                        <PixelIcon name={row.icon} size={24} />
                      </View>
                      <View style={s.healthSignalCopy}>
                        <View style={s.healthSignalTitleLine}>
                          <Text style={[s.healthSignalTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
                            {row.label}
                          </Text>
                          <Text style={[s.healthSignalStatus, { color: row.tone, fontFamily: DISPLAY_SEMI }]}>{row.status}</Text>
                        </View>
                        <Text style={[s.healthSignalDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {row.detail}
                        </Text>
                      </View>
                      <View style={[s.healthSignalActionPill, { backgroundColor: row.tone + "10", borderColor: row.tone + "44" }]}>
                        <Text style={[s.healthSignalAction, { color: row.tone, fontFamily: "Inter_800ExtraBold" }]}>
                          Log
                        </Text>
                        <Text style={[s.healthSignalActionArrow, { color: row.tone, fontFamily: "Inter_800ExtraBold" }]}>
                          {">"}
                        </Text>
                      </View>
                    </PressScale>
                  ))}
                </View>
              </>
            ) : null}
          </View>

          <View style={s.healthActionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log a health note"
              onPress={() => openHealthStatusRoute("note")}
              style={({ pressed }) => [
                s.heroActionPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[s.heroActionPrimaryText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Log health note</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open health records"
              onPress={() => router.push("/records")}
              style={({ pressed }) => [
                s.heroActionSecondary,
                {
                  backgroundColor: pressed ? colors.secondary : colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[s.heroActionSecondaryText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Records
              </Text>
            </Pressable>
          </View>
        </BoardCard>

        {!isBileTab ? (
          <>
            {/* Mockup-board rhythm: Next reminder -> Health summary ->
                Medications. Every row is real persisted data or an honest
                empty state; nothing here is decorative or invented. */}
            <BoardCard style={s.summaryCard} enter={1}>
              <BoardSectionHeader
                title="Next reminder"
                accessory={
                  nextReminder ? (
                    <BoardPill
                      label={
                        nextReminder.daysUntil != null
                          ? nextReminder.daysUntil <= 0
                            ? "Now"
                            : `In ${nextReminder.daysUntil}d`
                          : nextReminder.time || "Review"
                      }
                      tone={
                        nextReminder.urgency === "alert"
                          ? colors.rose
                          : nextReminder.urgency === "watch"
                            ? colors.amber
                            : colors.sage
                      }
                    />
                  ) : undefined
                }
              />
              {nextReminder ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Next reminder: ${nextReminder.label}. ${nextReminder.detail} Opens Plans.`}
                  accessibilityHint="Opens the reminder center on the Plans tab."
                  onPress={() => router.push("/calendar")}
                  scaleTo={0.97}
                  style={[s.summaryRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <View style={[s.summaryRowIcon, { backgroundColor: colors.sageSoft }]}>
                    <PixelIcon name={REMINDER_KIND_ICON[nextReminder.kind] ?? "clock"} size={22} />
                  </View>
                  <View style={s.summaryRowText}>
                    <Text numberOfLines={1} style={[s.summaryRowLabel, { color: colors.ink, fontFamily: "Inter_700Bold" }]}>
                      {nextReminder.label}
                    </Text>
                    <Text numberOfLines={2} style={[s.summaryRowDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {nextReminder.detail}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </PressScale>
              ) : (
                <View style={[s.summaryEmpty, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.summaryEmptyTitle, { color: colors.ink, fontFamily: DISPLAY_SEMI }]}>
                    No reminders set
                  </Text>
                  <Text style={[s.summaryEmptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    Medication schedules, routines, and record renewals surface here once they exist.
                  </Text>
                  <BoardActionButton
                    label="Add in Plans"
                    icon="add"
                    variant="soft"
                    accessibilityLabel="Add a reminder from the Plans tab"
                    onPress={() => router.push("/calendar")}
                    style={s.summaryEmptyAction}
                  />
                </View>
              )}
            </BoardCard>

            <BoardCard style={s.summaryCard} enter={2}>
              <BoardSectionHeader title="Health summary" />
              <View style={s.summaryList}>
                <HealthSummaryRow
                  icon="health"
                  label="Weight"
                  value={weightValue}
                  detail={weightDetail}
                  accessory={
                    weightTrend.items.length >= 2 ? (
                      <View style={s.summarySpark} accessibilityLabel={`Weight trend across ${weightTrend.totalWeighIns} logged weigh-ins`}>
                        {weightTrend.items.map((item, index) => (
                          <View
                            key={`${item.id}-${index}`}
                            style={[
                              s.summarySparkBar,
                              {
                                backgroundColor: colors.sage,
                                height: 6 + Math.round(((item.weight - sparkMin) / sparkRange) * 12),
                              },
                            ]}
                          />
                        ))}
                      </View>
                    ) : undefined
                  }
                  onPress={() => router.push("/records")}
                  accessibilityLabel={`Weight. ${weightValue}. ${weightDetail}. Opens the weight trend in Records.`}
                />
                <HealthSummaryRow
                  icon="note"
                  label="Last vet visit"
                  value={lastVetVisit ? lastVetVisit.value : "None on file"}
                  detail={lastVetVisit ? lastVetVisit.detail : "Add a vet visit record to the vault"}
                  onPress={() => router.push("/records")}
                  accessibilityLabel={`Last vet visit. ${lastVetVisit ? `${lastVetVisit.detail}, ${lastVetVisit.value}` : "None on file"}. Opens Records.`}
                />
                <HealthSummaryRow
                  icon="medication"
                  label="Vaccinations"
                  value={vaccineCount > 0 ? `${vaccineCount} filed` : "None filed"}
                  detail={
                    expiredVaccineCount > 0
                      ? `${expiredVaccineCount} expired - worth review`
                      : vaccineCount > 0
                        ? "In the record vault"
                        : "Add vaccine records to the vault"
                  }
                  onPress={() => router.push("/records")}
                  accessibilityLabel={`Vaccinations. ${vaccineCount > 0 ? `${vaccineCount} filed` : "None filed"}${expiredVaccineCount > 0 ? `, ${expiredVaccineCount} expired` : ""}. Opens Records.`}
                />
                <HealthSummaryRow
                  icon="meal"
                  label="Sensitivities"
                  value={sensitivitiesOnFile || "Not on file"}
                  detail={sensitivitiesOnFile ? "Owner notes, not a diagnosis" : "Add in the diet profile"}
                  onPress={() => router.push("/more")}
                  accessibilityLabel={`Sensitivities. ${sensitivitiesOnFile || "Not on file"}. Opens the diet profile in More.`}
                />
              </View>
            </BoardCard>

            <BoardCard style={s.summaryCard} enter={3}>
              <BoardSectionHeader
                title="Medications"
                accessory={
                  <BoardPill
                    label={
                      medicationAdherence.total > 0
                        ? `${medicationAdherence.takenCount}/${medicationAdherence.total} today`
                        : "None on file"
                    }
                    tone={
                      medicationAdherence.total === 0
                        ? colors.mutedForeground
                        : medicationAdherence.missedCount > 0
                          ? colors.rose
                          : medicationAdherence.dueCount > 0
                            ? colors.amber
                            : colors.sage
                    }
                  />
                }
              />
              {medicationAdherence.total === 0 ? (
                <View style={[s.summaryEmpty, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.summaryEmptyTitle, { color: colors.ink, fontFamily: DISPLAY_SEMI }]}>
                    No medications on file
                  </Text>
                  <Text style={[s.summaryEmptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    Medication routines added in Plans show their schedule and next dose here.
                  </Text>
                  <BoardActionButton
                    label="Add medication routine"
                    icon="add"
                    variant="soft"
                    accessibilityLabel="Add a medication routine from the Plans tab"
                    onPress={() => router.push("/calendar")}
                    style={s.summaryEmptyAction}
                  />
                </View>
              ) : (
                <View style={s.summaryList}>
                  {medicationAdherence.items.slice(0, 4).map((item) => {
                    const medTone =
                      item.status === "taken"
                        ? colors.sage
                        : item.status === "missed"
                          ? colors.rose
                          : item.status === "due"
                            ? colors.amber
                            : colors.mutedForeground;
                    const medStatusLabel =
                      item.status === "taken"
                        ? "Taken"
                        : item.status === "missed"
                          ? "Missed"
                          : item.status === "due"
                            ? "Due now"
                            : "Upcoming";
                    return (
                      <PressScale
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.label}. ${item.dose}, ${item.time}. ${medStatusLabel}. Opens the medication plan in Records.`}
                        onPress={() => router.push("/records")}
                        scaleTo={0.97}
                        style={[s.summaryRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                      >
                        <View style={[s.summaryRowIcon, { backgroundColor: colors.sageSoft }]}>
                          <PixelIcon name="medication" size={22} />
                        </View>
                        <View style={s.summaryRowText}>
                          <Text numberOfLines={1} style={[s.summaryRowLabel, { color: colors.ink, fontFamily: "Inter_700Bold" }]}>
                            {item.label}
                          </Text>
                          <Text numberOfLines={1} style={[s.summaryRowDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                            {item.dose} - {item.time}
                          </Text>
                        </View>
                        <Text style={[s.summaryRowStatus, { color: medTone, fontFamily: "Inter_700Bold" }]}>
                          {medStatusLabel}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                      </PressScale>
                    );
                  })}
                  {medicationAdherence.next ? (
                    <Text style={[s.summaryFootnote, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      Next: {medicationAdherence.next.label} at {medicationAdherence.next.time}
                    </Text>
                  ) : null}
                </View>
              )}
            </BoardCard>
          </>
        ) : null}

        <BoardCard style={s.sectionCard}>
          <View style={s.reviewPacketTop}>
            <View style={s.reviewPacketTitleStack}>
              <BoardSectionHeader title="Review packet" style={s.boardSectionTop} />
              <Text style={[s.reviewPacketStatus, { color: statusTone, fontFamily: DISPLAY_SEMI }]}>
                {healthReviewPacket.statusLabel}
              </Text>
            </View>
            <BoardPill
              label={healthReviewPacket.languagePill}
              icon="medkit-outline"
              tone={
                healthReviewPacket.languagePill === "Review"
                  ? colors.rose
                  : healthReviewPacket.languagePill === "Pattern noticed"
                    ? colors.amber
                    : colors.sage
              }
            />
          </View>

          <Text style={[s.reviewPacketSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {healthReviewPacket.summary}
          </Text>

          <View style={s.reviewPromptStack}>
            {healthReviewPacket.prompts.slice(0, 2).map((prompt) => (
              <View key={prompt} style={[s.reviewPromptRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[s.reviewPromptBullet, { backgroundColor: colors.sage + "22", borderColor: colors.sage + "55" }]}>
                  <PixelIcon name="health" size={15} />
                </View>
                <Text style={[s.reviewPromptText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {prompt}
                </Text>
              </View>
            ))}
          </View>

          <View style={[s.reviewChecklistPanel, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[s.reviewChecklistTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
              Vet-share checklist
            </Text>
            {healthReviewPacket.vetShareChecklist.slice(0, 3).map((item) => (
              <View key={item} style={s.reviewChecklistRow}>
                <Text style={[s.reviewChecklistMark, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>+</Text>
                <Text style={[s.reviewChecklistText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>

          <View style={[s.reviewPacketBoundary, { backgroundColor: colors.background, borderColor: colors.sage + "55" }]}>
            <PixelIcon name="health" size={20} />
            <Text style={[s.reviewPacketBoundaryText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {healthReviewPacket.boundary}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share health review"
            onPress={shareHealthReviewPacket}
            style={({ pressed }) => [
              s.reviewPacketShare,
              {
                backgroundColor: pressed ? colors.secondary : colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[s.reviewPacketShareText, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>
              Share review
            </Text>
          </Pressable>

          <View style={s.reviewPacketActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={healthReviewPacket.primaryAction.label}
              onPress={() => openHealthReviewAction(healthReviewPacket.primaryAction)}
              style={({ pressed }) => [
                s.reviewPacketPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[s.reviewPacketPrimaryText, { fontFamily: "Inter_700Bold" }]}>
                {healthReviewPacket.primaryAction.label}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Draft vet questions"
              onPress={() => openHealthReviewAction(healthReviewPacket.secondaryAction)}
              style={({ pressed }) => [
                s.reviewPacketSecondary,
                {
                  backgroundColor: pressed ? colors.secondary : colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[s.reviewPacketSecondaryText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Draft vet questions
              </Text>
            </Pressable>
          </View>
        </BoardCard>

        <BoardCard style={s.sectionCard}>
          <BoardSectionHeader
            title="Pattern Board"
            accessory={
              healthWatch.patterns.length ? (
                <HealthHeaderAction
                  label="Owner notes"
                  accessibilityLabel="Open health owner notes"
                  onPress={() => openHealthStatusRoute("note")}
                />
              ) : undefined
            }
          />
          <View style={[s.reviewPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[s.reviewTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
              {healthWatch.status === "good" ? "Care rhythm looks steady" : "Next best review step"}
            </Text>
            <Text style={[s.reviewCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {reviewCopy}
            </Text>
          </View>
          {healthWatch.patterns.slice(0, 4).map((pattern) => (
            <View key={pattern.kind} style={[s.patternRow, { borderTopColor: colors.border }]}>
              <View style={s.patternTitleRow}>
                <Text style={[s.patternTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {pattern.label}
                </Text>
                <BoardPill
                  label={pattern.status === "good" ? "Steady" : pattern.status === "alert" ? "Review" : "Watch"}
                  tone={pattern.status === "alert" ? colors.rose : pattern.status === "watch" ? colors.amber : colors.sage}
                />
              </View>
              <Text style={[s.patternCopy, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {pattern.evidence}
              </Text>
              <Text style={[s.patternStep, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>
                {pattern.nextStep}
              </Text>
            </View>
          ))}
        </BoardCard>

        <View style={[s.boundaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.boundaryLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>CARE BOUNDARY</Text>
          <Text style={[s.boundary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {healthWatch.vetBoundary} Not veterinary advice.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  routeHeaderCompact: {
    marginBottom: 10,
  },
  tabRail: {
    flexDirection: "row",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginBottom: 10,
  },
  tabPill: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 12.5 },

  heroCard: {
    padding: 8,
    marginBottom: 10,
  },
  // Radius rhythm: nested panels, rows, and buttons inside the 20-radius
  // BoardCards sit on the shared 12 chip radius (the BoardMetricTile norm)
  // instead of the old 8px one-off; the pixel look stays in the art and
  // borders.
  healthStage: {
    minHeight: 168,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(8,26,42,0.42)",
    overflow: "hidden",
    padding: 9,
    marginBottom: 8,
  },
  healthStageImage: {
    borderRadius: 12,
  },
  healthStageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,26,42,0.08)",
  },
  healthStageTop: {
    position: "relative",
    zIndex: 5,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  healthStageBubble: {
    maxWidth: "58%",
    minHeight: 46,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: "#081A2A",
    backgroundColor: "rgba(255,249,239,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  healthStageBubbleTitle: {
    fontSize: 12.5,
    lineHeight: 15,
  },
  healthStageBubbleCopy: {
    fontSize: 9.5,
    lineHeight: 12,
    marginTop: 3,
  },
  healthStageBubbleTail: {
    position: "absolute",
    right: 20,
    bottom: -8,
    width: 14,
    height: 14,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#081A2A",
    backgroundColor: "rgba(255,249,239,0.95)",
    transform: [{ rotate: "-45deg" }],
  },
  // Mockup parity: the stage status chip is a soft sage pill (sageSoft fill,
  // forest text), never a dark navy HUD element.
  healthStageChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  healthStageChipText: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  healthStageSprite: {
    position: "absolute",
    zIndex: 4,
    // Proportional offset keeps the sleeping sprite centered on the green
    // dog bed baked right-of-center in the stage art at any card width.
    right: "24%",
    bottom: 8,
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  healthStageSpriteShadow: {
    position: "absolute",
    bottom: 12,
    width: 72,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(8,26,42,0.28)",
  },
  healthHeroPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    gap: 11,
  },
  healthHeroStatusRow: {
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
  },
  healthScoreToken: {
    width: 78,
    minHeight: 84,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  healthScoreValue: {
    fontSize: 30,
    lineHeight: 33,
  },
  healthScoreLabel: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.1,
    textAlign: "center",
    textTransform: "uppercase",
  },
  healthHeroCopyStack: {
    flex: 1,
    minWidth: 0,
  },
  statusScoreTrack: {
    height: 9,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 9,
  },
  statusScoreFill: {
    height: "100%",
    borderRadius: 999,
  },
  statusSupportCopy: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  healthRhythmPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginTop: 7,
  },
  healthRhythmHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  // Parchment strip: quiet sage caps labels over cream, ink values below.
  healthRhythmTitle: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  healthRhythmMeta: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  healthRhythmBars: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    marginTop: 7,
  },
  healthRhythmColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  healthRhythmBar: {
    width: "100%",
    minHeight: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  healthRhythmLabel: {
    fontSize: 9.5,
  },
  heroTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, minWidth: 0 },
  heroLabel: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  heroTitle: { color: "#FFF9EF", fontSize: 24, lineHeight: 27, marginTop: 1 },
  heroCopy: { color: "rgba(255,249,239,0.72)", fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  scoreBadge: {
    width: 62,
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
  },
  scoreValue: { fontSize: 24, lineHeight: 27 },
  scoreLabel: { fontSize: 9, letterSpacing: 0.5, marginTop: 1 },
  healthActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  heroActionPrimary: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActionPrimaryText: { color: "#FFFFFF", fontSize: 13 },
  heroActionSecondary: {
    minWidth: 92,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  heroActionSecondaryText: { color: "#FFF9EF", fontSize: 13 },

  sectionCard: { marginTop: 10 },
  bileCard: { marginBottom: 10 },

  // Mockup-board Overview cards: Next reminder / Health summary /
  // Medications. Cream rows on parchment cards - no dark strips.
  summaryCard: { marginTop: 10 },
  summaryList: {
    gap: 6,
  },
  summaryRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  summaryRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRowText: {
    flex: 1,
    minWidth: 0,
  },
  summaryRowLabel: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  summaryRowDetail: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  summaryRowValue: {
    maxWidth: "38%",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
  },
  summaryRowStatus: {
    fontSize: 11,
    lineHeight: 14,
  },
  summarySpark: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 18,
  },
  summarySparkBar: {
    width: 4,
    borderRadius: 2,
  },
  summaryEmpty: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "flex-start",
    gap: 4,
  },
  summaryEmptyTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  summaryEmptyCopy: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  summaryEmptyAction: {
    alignSelf: "flex-start",
    marginTop: 6,
  },
  summaryFootnote: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  healthSnapshotHeader: {
    marginBottom: 8,
    paddingBottom: 6,
  },
  healthStatusSummary: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  healthStatusCopy: {
    flex: 1,
    minWidth: 0,
  },
  healthStatusTitle: {
    fontSize: 17,
    lineHeight: 20,
    marginTop: 1,
  },
  healthStatusBody: {
    fontSize: 11.2,
    lineHeight: 15,
    marginTop: 3,
  },
  sectionTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 2 },
  boardSectionTop: { flex: 1, marginBottom: 0 },
  healthHeaderAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  healthHeaderActionText: {
    fontSize: 11.5,
  },
  reviewPacketTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewPacketTitleStack: {
    flex: 1,
    minWidth: 0,
  },
  reviewPacketStatus: {
    fontSize: 17,
    lineHeight: 21,
    marginTop: -4,
  },
  reviewPacketSummary: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 9,
  },
  reviewPromptStack: {
    gap: 7,
    marginTop: 7,
  },
  reviewPromptRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewPromptBullet: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPromptText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
  },
  reviewChecklistPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 9,
    marginTop: 9,
  },
  reviewChecklistTitle: {
    fontSize: 13,
    lineHeight: 17,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  reviewChecklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingVertical: 3,
  },
  reviewChecklistMark: {
    width: 14,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  reviewChecklistText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.8,
    lineHeight: 17,
  },
  reviewPacketBoundary: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewPacketBoundaryText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
  },
  reviewPacketShare: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
    paddingHorizontal: 10,
  },
  reviewPacketShareText: {
    fontSize: 13,
    textAlign: "center",
  },
  reviewPacketActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
  },
  reviewPacketPrimary: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  reviewPacketPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
  },
  reviewPacketSecondary: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  reviewPacketSecondaryText: {
    fontSize: 13,
    textAlign: "center",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  metricHalf: {
    flexGrow: 1,
    flexBasis: "47.5%",
    minHeight: 74,
  },

  bilePanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
  },
  bileMedallion: {
    width: 82,
    minHeight: 92,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  bileMedallionText: { fontSize: 11, textTransform: "uppercase" },
  bileTrendArea: { flex: 1, minWidth: 0 },
  bileTrendTitle: { fontSize: 15 },
  bileTrendCopy: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  bileBars: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: 9,
  },
  bileBarColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  bileBar: {
    width: "100%",
    minHeight: 8,
    borderWidth: 1,
    borderRadius: 3,
  },
  bileBarLabel: { fontSize: 9.5 },

  healthSignalList: {
    gap: 6,
    marginTop: 7,
  },
  healthSignalRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusIcon: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  healthSignalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  healthSignalTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  healthSignalTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    lineHeight: 16,
  },
  healthSignalStatus: {
    maxWidth: 72,
    fontSize: 12,
    lineHeight: 15,
    textAlign: "right",
  },
  healthSignalDetail: {
    fontSize: 11,
    lineHeight: 14,
  },
  healthSignalActionPill: {
    width: 52,
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  healthSignalAction: {
    flex: 1,
    minWidth: 0,
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  healthSignalActionArrow: {
    fontSize: 14,
    lineHeight: 16,
  },

  reviewPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 2,
  },
  reviewTitle: { fontSize: 16, lineHeight: 20 },
  reviewCopy: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  patternRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  patternTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  patternTitle: { flex: 1, fontSize: 14 },
  patternCopy: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  patternStep: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  boundaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  boundaryLabel: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  boundary: { fontSize: 12, lineHeight: 18, marginTop: 5 },
});
