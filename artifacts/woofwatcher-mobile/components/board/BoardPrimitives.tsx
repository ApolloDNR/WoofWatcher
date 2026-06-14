import { Ionicons } from "@expo/vector-icons";
import React, { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useColors } from "@/hooks/useColors";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

export function BoardCard({
  children,
  style,
  padded = true,
  tone = "card",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  tone?: "card" | "soft" | "navy";
}) {
  const colors = useColors();
  const navy = tone === "navy";
  const backgroundColor = navy ? colors.brandNavy : tone === "soft" ? colors.accent : colors.card;
  const borderColor = navy ? colors.shellNavy : colors.border;

  return (
    <View
      style={[
        styles.card,
        padded && styles.cardPadded,
        {
          backgroundColor,
          borderColor,
          borderRadius: colors.pixelUi.radius.card,
          shadowColor: colors.navy,
          shadowOpacity: colors.pixelUi.shadow.opacity,
          shadowRadius: colors.pixelUi.shadow.radius,
          shadowOffset: { width: 0, height: colors.pixelUi.shadow.y },
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function BoardSectionHeader({
  title,
  action,
  style,
  textStyle,
}: {
  title: string;
  action?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: colors.navy, fontFamily: DISPLAY_SEMI }, textStyle]}>
        {title}
      </Text>
      {action ? (
        <Text style={[styles.sectionAction, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
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
}: {
  label: string;
  value: number;
  valueLabel?: string;
  icon?: PixelIconName;
  tone?: string;
  segments?: number;
}) {
  const colors = useColors();
  const count = segments ?? colors.pixelUi.statusSegments;
  const pct = Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
  const filled = Math.max(1, Math.round(pct * count));
  const active = tone ?? colors.sage;

  return (
    <View style={styles.meterRow}>
      <View style={styles.meterLabelWrap}>
        {icon ? <PixelIcon name={icon} size={20} /> : null}
        <Text style={[styles.meterLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {label}
        </Text>
      </View>
      <View style={styles.meterSegments} accessibilityLabel={`${label} ${valueLabel ?? `${Math.round(pct * 100)} percent`}`}>
        {Array.from({ length: count }).map((_, index) => (
          <View
            key={`${label}-${index}`}
            style={[
              styles.meterSegment,
              {
                backgroundColor: index < filled ? active : colors.muted,
                borderColor: index < filled ? active : colors.border,
              },
            ]}
          />
        ))}
      </View>
      {valueLabel ? (
        <Text style={[styles.meterValue, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
          {valueLabel}
        </Text>
      ) : null}
    </View>
  );
}

export function QuickActionTile({
  icon,
  label,
  onPress,
  accessibilityLabel,
  accent,
}: {
  icon: PixelIconName;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accent?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Log ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickTile,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.secondary : colors.card,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: accent ?? colors.secondary }]}>
        <PixelIcon name={icon} size={28} />
      </View>
      <Text style={[styles.quickText, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>{label}</Text>
    </Pressable>
  );
}

export function PixelSpeechBubble({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View style={[styles.bubbleWrap, style]} pointerEvents="none">
      <View style={[styles.bubble, { backgroundColor: colors.ivory, borderColor: colors.navy }]}>
        <Text style={[styles.bubbleText, { color: colors.navy, fontFamily: "Inter_700Bold" }]}>{text}</Text>
      </View>
      <View style={[styles.bubbleTail, { backgroundColor: colors.ivory, borderColor: colors.navy }]} />
    </View>
  );
}

export function CareRow({
  icon,
  title,
  detail,
  meta,
  onPress,
}: {
  icon: PixelIconName;
  title: string;
  detail?: string;
  meta?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const content = (
    <>
      <PixelIcon name={icon} size={24} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={[styles.rowDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text style={[styles.rowMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
          {meta}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${detail ?? ""}`}
        onPress={onPress}
        style={({ pressed }) => [styles.careRow, { opacity: pressed ? 0.72 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.careRow}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    elevation: 2,
  },
  cardPadded: {
    padding: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sectionAction: {
    fontSize: 11,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 28,
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
    gap: 3,
  },
  meterSegment: {
    flex: 1,
    height: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  meterValue: {
    minWidth: 42,
    textAlign: "right",
    fontSize: 11,
  },
  quickTile: {
    width: "31.5%",
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: {
    fontSize: 10.5,
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

