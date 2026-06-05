import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { EntryTypeIcon, entryTypeColor } from "@/components/EntryTypeIcon";

const CATEGORY_LABELS: Record<string, string> = {
  weight: "Weight", training: "Training", anxiety: "Anxiety",
  social: "Social", health: "Health", custom: "Custom",
};

function GoalCategoryBadge({ category }: { category: string }) {
  const colors = useColors();
  const bgMap: Record<string, string> = {
    weight: colors.copper, training: colors.amber, social: colors.sage,
    health: colors.rose, anxiety: colors.amber, custom: colors.mutedForeground,
  };
  const bg = bgMap[category] || colors.mutedForeground;
  return (
    <View style={[gb.badge, { backgroundColor: bg + "22" }]}>
      <Text style={[gb.label, { color: bg, fontFamily: "Inter_500Medium" }]}>
        {CATEGORY_LABELS[category] || category}
      </Text>
    </View>
  );
}
const gb = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  label: { fontSize: 11 },
});

function StatusDot({ status }: { status: string }) {
  const colors = useColors();
  const colorMap: Record<string, string> = { active: colors.sage, paused: colors.amber, done: colors.mutedForeground };
  return <View style={[sd.dot, { backgroundColor: colorMap[status] || colors.mutedForeground }]} />;
}
const sd = StyleSheet.create({ dot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 } });

export default function PlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const { routines, goals } = state;
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: Platform.OS === "web" ? 118 : 100, paddingHorizontal: 18 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Plans</Text>

      <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Daily schedule</Text>
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {routines.map((r, i) => (
          <View key={r.id} style={[s.routineRow, i < routines.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={s.timeCol}>
              <Text style={[s.routineTime, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>{r.time}</Text>
            </View>
            <View style={[s.iconBg, { backgroundColor: entryTypeColor(r.type, colors) + "1a" }]}>
              <EntryTypeIcon type={r.type} size={16} />
            </View>
            <View style={s.routineMid}>
              <Text style={[s.routineLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{r.label}</Text>
              <Text style={[s.routineOwner, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.owner}</Text>
              {r.note ? <Text numberOfLines={2} style={[s.routineNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.note}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Goals</Text>
      {goals.length === 0 ? (
        <View style={[s.empty, { borderColor: colors.border }]}>
          <Ionicons name="flag-outline" size={28} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No goals set</Text>
        </View>
      ) : (
        goals.map((g) => (
          <View key={g.id} style={[s.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.goalHeader}>
              <StatusDot status={g.status} />
              <View style={s.goalHeaderText}>
                <Text style={[s.goalTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{g.title}</Text>
                <GoalCategoryBadge category={g.category} />
              </View>
            </View>
            <Text style={[s.goalTarget, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{g.target}</Text>
            {g.note ? <Text style={[s.goalNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{g.note}</Text> : null}
            <View style={s.goalFooter}>
              <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
              <Text style={[s.goalDue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{g.due}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, marginBottom: 18 },
  sectionTitle: { fontSize: 14, marginBottom: 9 },
  listCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", marginBottom: 24 },
  routineRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  timeCol: { width: 68 },
  routineTime: { fontSize: 13, marginTop: 1 },
  iconBg: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  routineMid: { flex: 1 },
  routineLabel: { fontSize: 14, marginBottom: 2 },
  routineOwner: { fontSize: 12, marginBottom: 3 },
  routineNote: { fontSize: 12, lineHeight: 17 },
  goalCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 10 },
  goalHeader: { flexDirection: "row", gap: 10, marginBottom: 8 },
  goalHeaderText: { flex: 1, gap: 4 },
  goalTitle: { fontSize: 15 },
  goalTarget: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  goalNote: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  goalFooter: { flexDirection: "row", alignItems: "center", gap: 4 },
  goalDue: { fontSize: 12 },
  empty: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 28, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14 },
});
