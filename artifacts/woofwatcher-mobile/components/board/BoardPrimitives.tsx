import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import {
  enterUp,
  MeterPip,
  PressScale,
  SPRING,
} from "@/components/motion/GameFeel";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useColors } from "@/hooks/useColors";
import { hapticSelect } from "@/lib/haptics";
import {
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const SEGMENT_VISUAL_HEIGHT = 36;
// Storybook mockup: big warm serif route titles, sans everywhere else.
const TITLE_SERIF = "Fraunces_700Bold";
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQaReturnToCockpitRoute(qaSurface: string | undefined): string {
  return qaSurface
    ? `/care-twin-qa?qaSurface=${encodeURIComponent(qaSurface)}`
    : "/care-twin-qa";
}

export function BoardRouteHeader({
  kicker,
  title,
  subtitle,
  icon,
  back,
  onBack,
  actionIcon,
  actionLabel,
  onAction,
  actionDisabled,
  style,
  centered,
  plain,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  icon?: IoniconName;
  back?: boolean;
  onBack?: () => void;
  actionIcon?: IoniconName;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
  centered?: boolean;
  plain?: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const qaParams = useLocalSearchParams<{
    qaReturn?: string | string[];
    qaSurface?: string | string[];
    qaTitle?: string | string[];
  }>();
  const qaReturn = firstParam(qaParams.qaReturn);
  const qaSurface = firstParam(qaParams.qaSurface);
  const qaTitle = firstParam(qaParams.qaTitle);
  const showQaReturn = qaReturn === "care-twin-qa";

  return (
    <>
      <View
        style={[
          styles.routeHeader,
          centered && styles.routeHeaderCentered,
          style,
        ]}
      >
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => {
              hapticSelect();
              onBack?.();
            }}
            style={({ pressed }) => [
              styles.routeIconButton,
              plain && styles.routeIconButtonPlain,
              {
                backgroundColor: plain
                  ? "transparent"
                  : pressed
                    ? colors.secondary
                    : colors.card,
                borderColor: plain ? "transparent" : colors.border,
              },
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={plain ? 24 : 20}
              color={colors.foreground}
            />
          </Pressable>
        ) : icon ? (
          <View
            style={[
              styles.routeIconButton,
              plain && styles.routeIconButtonPlain,
              {
                backgroundColor: plain ? "transparent" : colors.secondary,
                borderColor: plain ? "transparent" : colors.border,
              },
            ]}
          >
            <Ionicons name={icon} size={20} color={colors.foreground} />
          </View>
        ) : null}
        <View
          style={[
            styles.routeHeaderText,
            centered && styles.routeHeaderTextCentered,
          ]}
        >
          {kicker ? (
            <Text
              style={[
                styles.routeKicker,
                { color: colors.sage, fontFamily: "Inter_700Bold" },
              ]}
            >
              {kicker}
            </Text>
          ) : null}
          <Text
            accessibilityRole="header"
            style={[
              styles.routeTitle,
              centered && styles.routeTitleCentered,
              { color: colors.foreground, fontFamily: TITLE_SERIF },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.routeSubtitle,
                centered && styles.routeSubtitleCentered,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actionIcon && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel ?? title}
            onPress={() => {
              hapticSelect();
              onAction();
            }}
            disabled={actionDisabled}
            style={({ pressed }) => [
              styles.routeIconButton,
              plain && styles.routeIconButtonPlain,
              {
                backgroundColor: plain
                  ? "transparent"
                  : pressed || actionDisabled
                    ? colors.secondary
                    : colors.card,
                borderColor: plain ? "transparent" : colors.border,
                opacity: actionDisabled ? 0.55 : 1,
              },
            ]}
          >
            <Ionicons
              name={actionIcon}
              size={plain ? 21 : 19}
              color={colors.foreground}
            />
          </Pressable>
        ) : null}
      </View>
      {showQaReturn ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Return to QA Cockpit${qaTitle ? ` for ${qaTitle}` : ""}`}
          onPress={() =>
            router.push(buildQaReturnToCockpitRoute(qaSurface) as never)
          }
          style={({ pressed }) => [
            styles.qaReturnBanner,
            {
              backgroundColor: pressed
                ? `${colors.sage}28`
                : `${colors.sage}16`,
              borderColor: `${colors.sage}66`,
            },
          ]}
        >
          <Ionicons name="camera-outline" size={17} color={colors.sage} />
          <View style={styles.qaReturnText}>
            <Text
              style={[
                styles.qaReturnTitle,
                { color: colors.sage, fontFamily: "Inter_800ExtraBold" },
              ]}
            >
              Return to QA Cockpit
            </Text>
            <Text
              style={[
                styles.qaReturnDetail,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
              numberOfLines={1}
            >
              Capture done? Attach proof
              {qaTitle
                ? ` for ${qaTitle}`
                : qaSurface
                  ? ` for ${qaSurface}`
                  : ""}
              .
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={colors.sage} />
        </Pressable>
      ) : null}
    </>
  );
}

export type BoardStatusPillTone =
  | "done"
  | "due"
  | "upNext"
  | "upcoming"
  | "neutral";

/** Storybook-mockup status pill: Done / Due / Up Next / Upcoming. */
export function BoardStatusPill({
  label,
  tone = "neutral",
  style,
}: {
  label: string;
  tone?: BoardStatusPillTone;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const palette: Record<BoardStatusPillTone, { bg: string; fg: string }> = {
    done: { bg: colors.sageSoft, fg: colors.forest },
    due: { bg: colors.amberSoft, fg: colors.amber },
    upNext: { bg: colors.amberSoft, fg: colors.amber },
    upcoming: { bg: colors.blueSoft, fg: colors.blue },
    neutral: { bg: colors.muted, fg: colors.mutedForeground },
  };
  const swatch = palette[tone];
  return (
    <View style={[styles.statusPill, { backgroundColor: swatch.bg }, style]}>
      <Text
        style={[
          styles.statusPillText,
          { color: swatch.fg, fontFamily: "Inter_700Bold" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** Storybook-mockup segmented chip tabs (Schedule | Routines | Reminders). */
export function BoardSegmentTabs<T extends string>({
  segments,
  active,
  onChange,
  style,
}: {
  segments: readonly { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const reduced = useReducedMotion();
  // The active fill is a single pill that glides between chips on the shared
  // spring instead of teleporting. Chips are measured on layout; until the
  // active chip has a rect the pill stays hidden and the chip paints its own
  // fill, so the control never flashes unstyled.
  const [rects, setRects] = useState<
    Record<string, { x: number; width: number; height: number }>
  >({});
  const pillPlaced = useRef(false);
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillHeight = useSharedValue(0);

  const activeRect = rects[active];
  useEffect(() => {
    if (!activeRect) return;
    pillHeight.value = SEGMENT_VISUAL_HEIGHT;
    if (reduced || !pillPlaced.current) {
      pillX.value = activeRect.x;
      pillWidth.value = activeRect.width;
      pillPlaced.current = true;
      return;
    }
    pillX.value = withSpring(activeRect.x, SPRING.default);
    pillWidth.value = withSpring(activeRect.width, SPRING.default);
  }, [activeRect, pillHeight, pillWidth, pillX, reduced]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
    height: pillHeight.value,
    opacity: pillWidth.value > 0 ? 1 : 0,
  }));

  return (
    <View style={[styles.segmentRow, style]}>
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.segmentPill,
          { backgroundColor: colors.primary },
          pillStyle,
        ]}
      />
      {segments.map((segment) => {
        const isActive = segment.key === active;
        const measured = Boolean(rects[segment.key]);
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="button"
            accessibilityLabel={segment.label}
            aria-selected={isActive}
            onLayout={(event: LayoutChangeEvent) => {
              const { x, width, height } = event.nativeEvent.layout;
              setRects((prev) => {
                const existing = prev[segment.key];
                if (
                  existing &&
                  existing.x === x &&
                  existing.width === width &&
                  existing.height === height
                ) {
                  return prev;
                }
                return { ...prev, [segment.key]: { x, width, height } };
              });
            }}
            onPress={() => {
              if (!isActive) hapticSelect();
              onChange(segment.key);
            }}
            style={styles.segmentTarget}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.segmentChip,
                  {
                    backgroundColor: isActive
                      ? measured
                        ? "transparent"
                        : colors.primary
                      : pressed
                        ? colors.secondary
                        : colors.card,
                    borderColor: isActive
                      ? measured
                        ? "transparent"
                        : colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.segmentChipText,
                    {
                      color: isActive
                        ? colors.primaryForeground
                        : colors.foreground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {segment.label}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Storybook-mockup action button: forest primary, soft sage, or outline. */
export function BoardActionButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  accessibilityLabel,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "soft" | "outline";
  icon?: IoniconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const colors = useColors();
  const background =
    variant === "primary"
      ? colors.primary
      : variant === "soft"
        ? colors.secondary
        : "transparent";
  const foreground =
    variant === "primary" ? colors.primaryForeground : colors.forest;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.96}
      containerStyle={[styles.actionButtonTarget, style]}
      style={[
        styles.actionButton,
        compact && styles.actionButtonCompact,
        {
          backgroundColor: background,
          borderColor: variant === "outline" ? colors.border : background,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={compact ? 14 : 16} color={foreground} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.actionButtonText,
          compact && styles.actionButtonTextCompact,
          {
            color: variant === "outline" ? colors.foreground : foreground,
            fontFamily: "Inter_700Bold",
          },
        ]}
      >
        {label}
      </Text>
    </PressScale>
  );
}

export function BoardPill({
  label,
  icon,
  tone,
  active,
  style,
}: {
  label: string;
  icon?: IoniconName;
  tone?: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const pillTone = tone ?? colors.sage;
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: active ? pillTone : pillTone + "18",
          borderColor: pillTone + "55",
        },
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={12} color={active ? "#FFFFFF" : pillTone} />
      ) : null}
      <Text
        style={[
          styles.pillText,
          { color: active ? "#FFFFFF" : pillTone, fontFamily: "Inter_700Bold" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function BoardMetricTile({
  icon,
  label,
  value,
  detail,
  tone,
  style,
}: {
  icon: PixelIconName;
  label: string;
  value: string;
  detail?: string;
  tone?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const tileTone = tone ?? colors.sage;
  return (
    <View
      style={[
        styles.metricTile,
        { backgroundColor: colors.background, borderColor: colors.border },
        style,
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: tileTone + "16" }]}>
        <PixelIcon name={icon} size={22} />
      </View>
      <View style={styles.metricText}>
        <Text
          style={[
            styles.metricLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.metricValue,
            { color: colors.foreground, fontFamily: DISPLAY_SEMI },
          ]}
        >
          {value}
        </Text>
        {detail ? (
          <Text
            style={[
              styles.metricDetail,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function BoardCard({
  children,
  style,
  padded = true,
  tone = "card",
  enter,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  tone?: "card" | "soft" | "navy";
  /** Staggered entrance slot: 0, 1, 2... plays the shared fade+rise spring. */
  enter?: number;
}) {
  const colors = useColors();
  const navy = tone === "navy";
  const backgroundColor = navy
    ? colors.brandNavy
    : tone === "soft"
      ? colors.accent
      : colors.card;
  const borderColor = navy
    ? colors.copper + "66"
    : tone === "soft"
      ? colors.stone
      : colors.border;

  const card = (
    <View
      style={[
        padded && styles.cardPadded,
        {
          backgroundColor,
          borderColor,
          borderWidth: colors.pixelUi.borderWidth,
          borderRadius: colors.pixelUi.radius.card,
          shadowColor: colors.navy,
          shadowOpacity: colors.pixelUi.shadow.opacity,
          shadowRadius: colors.pixelUi.shadow.radius,
          shadowOffset: { width: 0, height: colors.pixelUi.shadow.y },
          elevation: colors.pixelUi.shadow.elevation,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (enter === undefined) return card;
  return <Reanimated.View entering={enterUp(enter)}>{card}</Reanimated.View>;
}

export function BoardSectionHeader({
  title,
  action,
  accessory,
  style,
  textStyle,
}: {
  title: string;
  action?: string;
  accessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.sectionHeader,
        { borderBottomColor: colors.border },
        style,
      ]}
    >
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[
          styles.sectionTitle,
          { color: colors.foreground, fontFamily: DISPLAY_SEMI },
          textStyle,
        ]}
      >
        {title}
      </Text>
      {accessory ? (
        accessory
      ) : action ? (
        <Text
          numberOfLines={1}
          style={[
            styles.sectionAction,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {action}
        </Text>
      ) : null}
    </View>
  );
}

export function StatusMeter({
  label,
  value,
  valueLabel,
  icon,
  tone,
  segments,
  polarity = "normal",
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  value: number;
  valueLabel?: string;
  icon?: PixelIconName;
  tone?: string;
  segments?: number;
  polarity?: "normal" | "inverse";
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const colors = useColors();
  const count = segments ?? colors.pixelUi.statusSegments;
  const pct = Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
  // A true zero reads as an empty meter - no phantom lit pip for "0 of 2"
  // meals or a quiet Alone timer. Only a genuinely nonzero value keeps >=1 pip.
  const rawFilled = pct <= 0 ? 0 : Math.max(1, Math.round(pct * count));
  // Alone Time runs on inverse polarity: a full meter reads "together / not
  // alone" (good) and drains as away-time accumulates, so its lit pips never
  // read as the same "achievement" the Mood/Energy/Hunger meters show.
  const filled = polarity === "inverse" ? count - rawFilled : rawFilled;
  const active = tone ?? colors.sage;

  const content = (
    <>
      <View style={styles.meterLabelWrap}>
        {icon ? <PixelIcon name={icon} size={20} /> : null}
        <Text
          style={[
            styles.meterLabel,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {label}
        </Text>
      </View>
      <View
        style={styles.meterSegments}
        accessibilityLabel={`${label} ${valueLabel ?? `${Math.round(pct * 100)} percent`}`}
      >
        {Array.from({ length: count }).map((_, index) => (
          <MeterPip
            key={`${label}-${index}`}
            filled={index < filled}
            color={active}
            emptyColor={colors.meterTrack}
            index={index}
          />
        ))}
      </View>
      {valueLabel ? (
        <Text
          style={[
            styles.meterValue,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {valueLabel}
        </Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ??
          `${label} ${valueLabel ?? `${Math.round(pct * 100)} percent`}`
        }
        accessibilityHint={accessibilityHint}
        hitSlop={MOBILE_INLINE_HIT_SLOP}
        onPress={() => {
          hapticSelect();
          onPress();
        }}
        style={({ pressed }) => [
          styles.meterRow,
          styles.meterPressable,
          {
            backgroundColor: pressed ? colors.secondary : "transparent",
            borderColor: pressed ? active : "transparent",
          },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.meterRow}>{content}</View>;
}

export function QuickActionTile({
  icon,
  label,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  accent,
  style,
  iconSize = 28,
  labelStyle,
  delayLongPress,
}: {
  icon: PixelIconName;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  labelStyle?: StyleProp<TextStyle>;
  delayLongPress?: number;
}) {
  const colors = useColors();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Log ${label}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={onLongPress ? (delayLongPress ?? 350) : undefined}
      scaleTo={0.94}
      containerStyle={[styles.quickTileLayout, style]}
      style={[
        styles.quickTile,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
          borderWidth: colors.pixelUi.borderWidth,
          borderRadius: colors.pixelUi.radius.card,
        },
      ]}
    >
      <View
        style={[
          styles.quickIcon,
          { backgroundColor: accent ?? colors.secondary },
        ]}
      >
        <PixelIcon name={icon} size={iconSize} />
      </View>
      <Text
        style={[
          styles.quickText,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </PressScale>
  );
}

export function PixelSpeechBubble({
  text,
  style,
}: {
  text: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.bubbleWrap, style]} pointerEvents="none">
      <View
        style={[
          styles.bubble,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {text}
        </Text>
      </View>
      <View
        style={[
          styles.bubbleTail,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

export function CareRow({
  icon,
  title,
  detail,
  meta,
  onPress,
  accessibilityLabel,
}: {
  icon: PixelIconName;
  title: string;
  detail?: string;
  meta?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const content = (
    <>
      <PixelIcon name={icon} size={24} />
      <View style={styles.rowText}>
        <Text
          numberOfLines={1}
          style={[
            styles.rowTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            numberOfLines={1}
            style={[
              styles.rowDetail,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text
          style={[
            styles.rowMeta,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {meta}
        </Text>
      ) : null}
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={14}
          color={colors.mutedForeground}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ?? [title, detail, meta].filter(Boolean).join(". ")
        }
        onPress={() => {
          hapticSelect();
          onPress();
        }}
        style={({ pressed }) => [
          styles.careRow,
          { opacity: pressed ? 0.72 : 1 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.careRow}>{content}</View>;
}

const styles = StyleSheet.create({
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  routeHeaderCentered: {
    minHeight: 46,
    marginBottom: 10,
  },
  qaReturnBanner: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: -6,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  qaReturnText: {
    flex: 1,
    minWidth: 0,
  },
  qaReturnTitle: {
    fontSize: 12.5,
  },
  qaReturnDetail: {
    marginTop: 1,
    fontSize: 11,
  },
  routeIconButton: {
    width: MIN_MOBILE_TOUCH_TARGET,
    height: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  routeIconButtonPlain: {
    width: MIN_MOBILE_TOUCH_TARGET,
    height: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
  },
  routeHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  routeHeaderTextCentered: {
    alignItems: "center",
  },
  routeKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 1,
    opacity: 0.85,
  },
  routeTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0,
  },
  routeTitleCentered: {
    fontSize: 21,
    lineHeight: 25,
  },
  routeSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  routeSubtitleCentered: {
    textAlign: "center",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillText: {
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    position: "relative",
  },
  segmentPill: {
    position: "absolute",
    left: 0,
    top: 6,
    borderRadius: 999,
  },
  segmentTarget: {
    flexShrink: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    justifyContent: "center",
  },
  segmentChip: {
    minHeight: SEGMENT_VISUAL_HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentChipText: {
    fontSize: 12.5,
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionButtonTarget: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    justifyContent: "center",
  },
  actionButtonCompact: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 13.5,
  },
  actionButtonTextCompact: {
    fontSize: 12,
  },
  pill: {
    alignSelf: "flex-start",
    borderWidth: 0,
    borderRadius: 999,
    minHeight: 28,
    paddingHorizontal: 11,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pillText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  metricTile: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  metricText: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  metricValue: {
    fontSize: 17,
    lineHeight: 21,
    marginTop: 2,
  },
  metricDetail: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  cardPadded: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    paddingBottom: 2,
    borderBottomWidth: 0,
  },
  sectionTitle: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 16,
    letterSpacing: 0,
  },
  sectionAction: {
    flexShrink: 0,
    fontSize: 11,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 28,
  },
  meterPressable: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  meterLabelWrap: {
    width: 94,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  meterLabel: {
    fontSize: 12,
  },
  meterSegments: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  meterValue: {
    minWidth: 42,
    textAlign: "right",
    fontSize: 11,
  },
  quickTileLayout: {
    width: "23.5%",
  },
  quickTile: {
    width: "100%",
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: {
    fontSize: 10,
  },
  bubbleWrap: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: 190,
    borderWidth: 2,
    borderRadius: 2,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleTail: {
    width: 14,
    height: 14,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    marginTop: -2,
    marginLeft: 28,
    transform: [{ rotate: "-45deg" }],
  },
  careRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingVertical: 9,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 12.5,
  },
  rowDetail: {
    fontSize: 11,
    marginTop: 1,
  },
  rowMeta: {
    fontSize: 10.5,
  },
});
