import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardCard, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { useColors } from "@/hooks/useColors";
import type { MoreSection } from "@/lib/navigationOwnership";
import { getRouteTopPadding, getTabbedRouteBottomPadding, MIN_MOBILE_TOUCH_TARGET } from "@/lib/mobileLayout";

export interface SettingsScreenProps {
  onBack: () => void;
  onOpenSection: (section: Exclude<MoreSection, "root">) => void;
}

export default function SettingsScreen({ onBack, onOpenSection }: SettingsScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPadding = getRouteTopPadding({ platform: Platform.OS, topInset: insets.top, surface: "tabbed" });
  const bottomPadding = getTabbedRouteBottomPadding({ platform: Platform.OS, bottomInset: insets.bottom });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPadding, paddingHorizontal: 16, paddingBottom: bottomPadding, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      <BoardRouteHeader
        back
        onBack={onBack}
        title="How WoofWatcher works"
        subtitle="A truthful guide to the five care tabs and local app controls."
      />
      <BoardCard enter={0}>
        <BoardSectionHeader title="The five tabs" />
        {[
          "Home shows what is happening now.",
          "Log records care and supports corrections.",
          "Plans schedules care.",
          "Health keeps trends and shareable records.",
          "More manages your dog, people, and privacy.",
        ].map((sentence) => <Text key={sentence} style={[styles.body, { color: colors.foreground }]}>{sentence}</Text>)}
      </BoardCard>
      <BoardCard enter={1}>
        <BoardSectionHeader title="Manage this device" />
        <Pressable accessibilityRole="button" accessibilityLabel="Dog Profile" onPress={() => onOpenSection("dog-profile")} style={[styles.row, { borderColor: colors.border }]}>
          <Ionicons name="paw-outline" size={20} color={colors.primary} /><Text style={[styles.rowText, { color: colors.foreground }]}>Dog Profile</Text><Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Avatar Studio" onPress={() => onOpenSection("avatar-studio")} style={[styles.row, { borderColor: colors.border }]}>
          <Ionicons name="color-palette-outline" size={20} color={colors.primary} /><Text style={[styles.rowText, { color: colors.foreground }]}>Avatar Studio</Text><Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Privacy & Data" onPress={() => onOpenSection("privacy")} style={[styles.row, { borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} /><Text style={[styles.rowText, { color: colors.foreground }]}>Privacy & Data</Text><Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      </BoardCard>
      <View>
        <Text style={[styles.note, { color: colors.mutedForeground }]}>Online account features aren't available in this version. Your care data stays on this device.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: "Inter_500Medium", fontSize: 16, lineHeight: 23, marginTop: 8 },
  row: { minHeight: MIN_MOBILE_TOUCH_TARGET, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  rowText: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 16 },
  note: { fontFamily: "Inter_500Medium", fontSize: 14, lineHeight: 20 },
});
