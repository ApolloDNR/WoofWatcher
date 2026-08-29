import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  deriveCareTrends,
  deriveMoodTrend,
  normalizeCareEventType,
  selectSharedCareEvidence,
} from "@workspace/care-domain";

import {
  BoardCard,
  BoardRouteHeader,
  BoardSegmentTabs,
} from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { MIN_MOBILE_TOUCH_TARGET } from "@/lib/mobileLayout";
import { resolveConsumerPetName } from "@/lib/petIdentity";
import {
  bucketAverages,
  bucketCounts,
  bucketSums,
  buildTrendWindow,
  polylineLength,
  TREND_WINDOWS,
  type ChartPoint,
  type TrendBucket,
  type TrendSample,
  type TrendWindowKey,
} from "@/lib/trendsChart";

const DISPLAY_SEMI = "Fredoka_600SemiBold";
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

// Mood scores from deriveMoodTrend land on a 1..5 scale (unwell..happy).
const MOOD_MIN = 1;
const MOOD_MAX = 5;
const LINE_HEIGHT = 132;
const LINE_PAD = 16;
const BAR_HEIGHT = 118;

/** deriveMoodTrend uses a rolling now-based filter; give it a day of slack so
 *  it always covers the calendar window the chart buckets aggregate. */
function moodLookbackDays(key: TrendWindowKey): number {
  if (key === "day") return 2;
  if (key === "week") return 8;
  if (key === "month") return 31;
  return 366;
}

/** Quiet sage kicker — Inter 700, 9px, uppercase, wide tracking (mock spec). */
function Kicker({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text
      style={[
        styles.kicker,
        { color: colors.sage, fontFamily: "Inter_700Bold" },
      ]}
    >
      {text}
    </Text>
  );
}

function AxisLabels({
  buckets,
  labelStride,
}: {
  buckets: TrendBucket[];
  labelStride: number;
}) {
  const colors = useColors();
  // Month buckets are ~12px wide, so a 2-digit "Jun 20" tick would clip to an
  // ambiguous "2.." inside its own cell. For dense axes we let the label overflow
  // its cell instead of truncating: first/last labels hug the chart edges so they
  // never spill past it, and the rest center on their tick over the empty
  // neighbour cells (only every Nth cell carries a label).
  const dense = buckets.length > 14;
  const lastIndex = buckets.length - 1;
  return (
    <View style={[styles.axisRow, dense && styles.axisRowDense]}>
      {buckets.map((bucket, i) => {
        const show = i % labelStride === 0 || i === lastIndex;
        if (!show) return <View key={i} style={styles.axisCell} />;
        const label = (
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            style={[
              styles.axisText,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {bucket.label}
          </Text>
        );
        if (!dense) {
          return (
            <View key={i} style={styles.axisCell}>
              {label}
            </View>
          );
        }
        const anchorStyle =
          i === 0
            ? styles.axisLabelStart
            : i === lastIndex
              ? styles.axisLabelEnd
              : styles.axisLabelCenter;
        return (
          <View key={i} style={styles.axisCell}>
            <View
              style={[styles.axisLabelAnchor, anchorStyle]}
              pointerEvents="none"
            >
              {label}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ChartEmpty({ message, height }: { message: string; height: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.emptyWrap,
        { minHeight: height, borderColor: colors.border },
      ]}
    >
      <Ionicons
        name="sparkles-outline"
        size={18}
        color={colors.mutedForeground}
      />
      <Text
        style={[
          styles.emptyText,
          { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

function AnimatedBar({
  targetHeight,
  color,
  index,
  reduced,
}: {
  targetHeight: number;
  color: string;
  index: number;
  reduced: boolean;
}) {
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      grow.value = 1;
      return;
    }
    grow.value = 0;
    grow.value = withDelay(
      Math.min(index, 18) * 36,
      withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }),
    );
  }, [targetHeight, reduced, index, grow]);
  const style = useAnimatedStyle(() => ({
    height: (targetHeight > 0 ? Math.max(targetHeight, 3) : 0) * grow.value,
  }));
  return (
    <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
  );
}

function MetricBarChart({
  values,
  buckets,
  labelStride,
  color,
  accessibilityLabel,
}: {
  values: number[];
  buckets: TrendBucket[];
  labelStride: number;
  color: string;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const max = Math.max(1, ...values);
  const dense = buckets.length > 14;
  const cellPad = dense ? 1.5 : 4;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.barsRow, { height: BAR_HEIGHT }]}>
        {values.map((value, i) => (
          <View
            key={i}
            style={[styles.barCell, { paddingHorizontal: cellPad }]}
          >
            <AnimatedBar
              targetHeight={(value / max) * BAR_HEIGHT}
              color={color}
              index={i}
              reduced={reduced}
            />
          </View>
        ))}
      </View>
      <View style={[styles.baseline, { backgroundColor: colors.border }]} />
      <AxisLabels buckets={buckets} labelStride={labelStride} />
    </View>
  );
}

function MoodLineChart({
  averages,
  buckets,
  labelStride,
  accessibilityLabel,
}: {
  averages: (number | null)[];
  buckets: TrendBucket[];
  labelStride: number;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const plotH = LINE_HEIGHT - LINE_PAD * 2;
  const n = buckets.length;

  const points = useMemo<ChartPoint[]>(() => {
    if (width <= 0 || n === 0) return [];
    const step = width / n;
    const result: ChartPoint[] = [];
    averages.forEach((value, i) => {
      if (value == null) return;
      const clamped = Math.max(MOOD_MIN, Math.min(MOOD_MAX, value));
      const x = (i + 0.5) * step;
      const y =
        LINE_PAD + (1 - (clamped - MOOD_MIN) / (MOOD_MAX - MOOD_MIN)) * plotH;
      result.push({ x, y });
    });
    return result;
  }, [averages, width, n, plotH]);

  const pointsStr = points
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const length = useMemo(() => polylineLength(points), [pointsStr]); // eslint-disable-line react-hooks/exhaustive-deps
  const draw = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withTiming(1, {
      duration: 700,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [pointsStr, reduced, draw]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - draw.value),
  }));

  const gridYs = [LINE_PAD, LINE_PAD + plotH / 2, LINE_PAD + plotH];

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ height: LINE_HEIGHT }} onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={LINE_HEIGHT}>
            {gridYs.map((y, i) => (
              <Line
                key={i}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {points.length >= 2 ? (
              <AnimatedPolyline
                points={pointsStr}
                fill="none"
                stroke={colors.forest}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={length}
                animatedProps={animatedProps}
              />
            ) : null}
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={4}
                fill={colors.forest}
                stroke={colors.card}
                strokeWidth={1.5}
              />
            ))}
          </Svg>
        ) : null}
      </View>
      <AxisLabels buckets={buckets} labelStride={labelStride} />
    </View>
  );
}

function ChartCard({
  enter,
  kicker,
  title,
  stat,
  statTone,
  children,
}: {
  enter: number;
  kicker: string;
  title: string;
  stat: string;
  statTone?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <BoardCard enter={enter} style={styles.card}>
      <View style={styles.chartHead}>
        <View style={styles.chartHeadText}>
          <Kicker text={kicker} />
          <Text
            style={[
              styles.chartTitle,
              { color: colors.foreground, fontFamily: DISPLAY_SEMI },
            ]}
          >
            {title}
          </Text>
        </View>
        <Text
          style={[
            styles.chartStat,
            {
              color: statTone ?? colors.mutedForeground,
              fontFamily: "Inter_700Bold",
            },
          ]}
        >
          {stat}
        </Text>
      </View>
      {children}
    </BoardCard>
  );
}

function signalToneColor(
  tone: string,
  colors: ReturnType<typeof useColors>,
): string {
  if (tone === "good") return colors.sage;
  if (tone === "watch") return colors.amber;
  if (tone === "alert") return colors.rose;
  return colors.blue;
}

export interface TrendsScreenProps {
  onBack: () => void;
  contentTopPadding?: number;
  contentBottomPadding?: number;
}

export default function TrendsScreen({
  onBack,
  contentTopPadding = 0,
  contentBottomPadding = 0,
}: TrendsScreenProps) {
  const colors = useColors();
  const { state } = useCare();
  const [windowKey, setWindowKey] = useState<TrendWindowKey>("week");
  const [showSignals, setShowSignals] = useState(false);

  const petName = resolveConsumerPetName(state.profile.name);

  // Stable `now` per window + entries so buckets/animations don't churn each render.
  const now = useMemo(() => Date.now(), [windowKey, state.entries]);
  const win = useMemo(() => buildTrendWindow(windowKey, now), [windowKey, now]);

  const { moodSamples, activitySamples, pottyTimes } = useMemo(() => {
    const mood: TrendSample[] = [];
    const activity: TrendSample[] = [];
    const potty: number[] = [];
    const sharedEntries = selectSharedCareEvidence(state.entries, now);

    const moodTrend = deriveMoodTrend({
      entries: sharedEntries,
      now,
      lookbackDays: moodLookbackDays(windowKey),
      limit: Number.MAX_SAFE_INTEGER,
      petName: state.profile.name,
    });
    for (const item of moodTrend.items) {
      const at = Date.parse(item.occurredAt);
      if (Number.isFinite(at)) mood.push({ at, value: item.score });
    }

    for (const entry of sharedEntries) {
      const at = Date.parse(entry.occurredAt);
      if (!Number.isFinite(at)) continue;
      const type = normalizeCareEventType(entry.type, entry.details);
      if (type === "walk" || type === "play" || type === "training") {
        const minutes =
          typeof entry.durationMinutes === "number" && entry.durationMinutes > 0
            ? entry.durationMinutes
            : 0;
        activity.push({ at, value: minutes });
      } else if (type === "potty") {
        potty.push(at);
      }
    }
    return { moodSamples: mood, activitySamples: activity, pottyTimes: potty };
  }, [state.entries, now, windowKey, state.profile.name]);

  const moodAverages = useMemo(
    () => bucketAverages(moodSamples, win.buckets),
    [moodSamples, win],
  );
  const activityValues = useMemo(
    () => bucketSums(activitySamples, win.buckets),
    [activitySamples, win],
  );
  const pottyValues = useMemo(
    () => bucketCounts(pottyTimes, win.buckets),
    [pottyTimes, win],
  );

  const inWindow = (at: number) => at >= win.start && at < win.end;
  const moodInWindow = moodSamples.filter((sample) => inWindow(sample.at));
  const moodAvg = moodInWindow.length
    ? moodInWindow.reduce((sum, sample) => sum + sample.value, 0) /
      moodInWindow.length
    : 0;
  const activityTotal = activityValues.reduce((sum, value) => sum + value, 0);
  const pottyTotal = pottyValues.reduce((sum, value) => sum + value, 0);
  const hasMood = moodInWindow.length > 0;
  // Gate charts on real logged quantity, not mere presence. An in-progress walk
  // is a 0-minute sample, so `activitySamples.some(inWindow)` would render a tall
  // empty plot (axis + "0 min", no bars). Requiring the completed total > 0 keeps
  // the chart honest and falls back to the ChartEmpty until there's something to
  // plot; potty follows the same completed-count guard for consistency.
  const hasActivity = activityTotal > 0;
  const hasPotty = pottyTotal > 0;
  const moodValues = moodAverages.filter(
    (value): value is number => value != null,
  );
  const moodLow = moodValues.length ? Math.min(...moodValues) : 0;
  const moodHigh = moodValues.length ? Math.max(...moodValues) : 0;
  const activePeriods = activityValues.filter((value) => value > 0).length;
  const peakActivity = Math.max(0, ...activityValues);
  const pottyPeriods = pottyValues.filter((value) => value > 0).length;
  const peakPotty = Math.max(0, ...pottyValues);
  const moodChartSummary = `Mood check-ins chart for ${win.rangeLabel}. Average ${moodAvg.toFixed(1)} out of 5 from ${moodInWindow.length} ${moodInWindow.length === 1 ? "check-in" : "check-ins"}; period averages range from ${moodLow.toFixed(1)} to ${moodHigh.toFixed(1)}.`;
  const activityChartSummary = `Active minutes chart for ${win.rangeLabel}. ${activityTotal} total minutes across ${activePeriods} active ${activePeriods === 1 ? "period" : "periods"}; peak ${peakActivity} minutes in one period.`;
  const pottyChartSummary = `Potty logs chart for ${win.rangeLabel}. ${pottyTotal} total ${pottyTotal === 1 ? "log" : "logs"} across ${pottyPeriods} ${pottyPeriods === 1 ? "period" : "periods"}; peak ${peakPotty} ${peakPotty === 1 ? "log" : "logs"} in one period.`;

  // The summary card is always a weekly digest (matches the mock label), so it
  // stays honest even when the charts are windowed to Day / Month / Year.
  const careTrends = useMemo(
    () => deriveCareTrends({ entries: state.entries, now, windowDays: 7 }),
    [state.entries, now],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingHorizontal: 16,
          paddingBottom: contentBottomPadding,
        }}
      >
        <BoardRouteHeader
          kicker={`${petName} · Insights`}
          title="Trends"
          subtitle={win.rangeLabel}
          back
          onBack={onBack}
        />

        <BoardSegmentTabs
          segments={TREND_WINDOWS}
          active={windowKey}
          onChange={setWindowKey}
        />

        <ChartCard
          enter={0}
          kicker="Mood Trend"
          title="Mood Check-ins"
          stat={hasMood ? `${moodAvg.toFixed(1)}/5` : "—"}
          statTone={hasMood ? colors.forest : undefined}
        >
          {hasMood ? (
            <MoodLineChart
              averages={moodAverages}
              buckets={win.buckets}
              labelStride={win.labelStride}
              accessibilityLabel={moodChartSummary}
            />
          ) : (
            <ChartEmpty
              message="No mood check-ins yet — they'll chart here."
              height={LINE_HEIGHT}
            />
          )}
        </ChartCard>

        <ChartCard
          enter={1}
          kicker="Activity"
          title="Active Minutes"
          stat={`${activityTotal} min`}
          statTone={hasActivity ? colors.forest : undefined}
        >
          {hasActivity ? (
            <MetricBarChart
              values={activityValues}
              buckets={win.buckets}
              labelStride={win.labelStride}
              color={colors.forest}
              accessibilityLabel={activityChartSummary}
            />
          ) : (
            <ChartEmpty
              message="No walks, play, or training logged yet — they'll chart here."
              height={BAR_HEIGHT}
            />
          )}
        </ChartCard>

        <ChartCard
          enter={2}
          kicker="Potty"
          title="Potty Logs"
          stat={`${pottyTotal} ${pottyTotal === 1 ? "log" : "logs"}`}
          statTone={hasPotty ? colors.meterSleep : undefined}
        >
          {hasPotty ? (
            <MetricBarChart
              values={pottyValues}
              buckets={win.buckets}
              labelStride={win.labelStride}
              color={colors.meterSleep}
              accessibilityLabel={pottyChartSummary}
            />
          ) : (
            <ChartEmpty
              message="No potty logs yet — they'll chart here."
              height={BAR_HEIGHT}
            />
          )}
        </ChartCard>

        <BoardCard enter={3} style={styles.card}>
          <Kicker text="This Week" />
          <Text
            style={[
              styles.summaryTitle,
              { color: colors.foreground, fontFamily: DISPLAY_SEMI },
            ]}
          >
            This Week&apos;s Summary
          </Text>
          <Text
            style={[
              styles.summaryBody,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {careTrends.summary}
          </Text>

          {careTrends.signals.length > 0 ? (
            <>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={
                  showSignals ? "Hide weekly signals" : "Show weekly signals"
                }
                aria-expanded={showSignals}
                onPress={() => setShowSignals((prev) => !prev)}
                haptic="light"
                containerStyle={styles.summaryToggleLayout}
                style={[
                  styles.summaryToggle,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.summaryToggleText,
                    { color: colors.forest, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {showSignals
                    ? "Hide signals"
                    : `View ${careTrends.signals.length} signal${careTrends.signals.length === 1 ? "" : "s"}`}
                </Text>
                <Ionicons
                  name={showSignals ? "chevron-up" : "chevron-forward"}
                  size={15}
                  color={colors.forest}
                />
              </PressScale>

              {showSignals ? (
                <View style={styles.signalList}>
                  {careTrends.signals.map((signal) => (
                    <View
                      key={signal.kind}
                      style={[styles.signalRow, { borderColor: colors.border }]}
                    >
                      <View
                        style={[
                          styles.signalDot,
                          {
                            backgroundColor: signalToneColor(
                              signal.tone,
                              colors,
                            ),
                          },
                        ]}
                      />
                      <View style={styles.signalText}>
                        <Text
                          style={[
                            styles.signalLabel,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {signal.label}
                        </Text>
                        <Text
                          style={[
                            styles.signalDetail,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {signal.detail}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text
              style={[
                styles.summaryHint,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {careTrends.nextStep}
            </Text>
          )}
        </BoardCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  card: {
    marginBottom: 14,
  },
  kicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    opacity: 0.85,
    marginBottom: 2,
  },
  chartHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  chartHeadText: {
    flexShrink: 1,
    minWidth: 0,
  },
  chartTitle: {
    fontSize: 17,
    lineHeight: 21,
  },
  chartStat: {
    fontSize: 14,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  barCell: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  baseline: {
    height: 1,
    marginTop: -1,
  },
  axisRow: {
    flexDirection: "row",
    marginTop: 7,
  },
  // Dense (month) axis labels are absolutely positioned, so the row needs an
  // explicit height to reserve their vertical space.
  axisRowDense: {
    minHeight: 18,
  },
  axisCell: {
    flex: 1,
    alignItems: "center",
  },
  axisText: {
    fontSize: 9.5,
    letterSpacing: 0.1,
  },
  // Overflow-safe anchors for the dense month axis (see AxisLabels): a wider box
  // than the cell so "Jun 20" renders in full instead of clipping.
  axisLabelAnchor: {
    position: "absolute",
    top: 0,
    width: 60,
  },
  axisLabelStart: {
    left: 0,
    alignItems: "flex-start",
  },
  axisLabelEnd: {
    right: 0,
    alignItems: "flex-end",
  },
  axisLabelCenter: {
    left: "50%",
    marginLeft: -30,
    alignItems: "center",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: "dashed",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: "center",
  },
  summaryTitle: {
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 6,
  },
  summaryBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  summaryHint: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
  },
  summaryToggleLayout: {
    alignSelf: "flex-start",
    marginTop: 12,
  },
  summaryToggle: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryToggleText: {
    fontSize: 12.5,
  },
  signalList: {
    marginTop: 12,
    gap: 8,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
  },
  signalDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginTop: 4,
  },
  signalText: {
    flex: 1,
    minWidth: 0,
  },
  signalLabel: {
    fontSize: 12.5,
  },
  signalDetail: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
});
