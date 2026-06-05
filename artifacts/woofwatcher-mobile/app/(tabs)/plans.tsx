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
    <View style={[gb.badge, { backgroundColor: bg + "1A" }]}>
      <Text style={[gb.label, { color: bg, fontFamily: "Inter_600SemiBold" }]}>
        {CATEGORY_LABELS[category] || category}
      </Text>
    </View>
  );
}
const gb = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  label: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
});

function StatusDot({ status }: { status: string }) {
  const colors = useColors();
  const colorMap: Record<string, string> = { active: colors.sage, paused: colors.amber, done: colors.mutedForeground };
  return <View style={[sd.dot, { backgroundColor: colorMap[status] || colors.mutedForeground }]} />;
}
const sd = StyleSheet.create({ dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 } });

export default function PlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const { routines, goals } = state;
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: Platform.OS === "web" ? 118 : 120, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.screenTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>Plans</Text>

      <Text style={[s.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>DAILY SCHEDULE</Text>
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
        {routines.map((r, i) => (
          <View key={r.id} style={[s.routineRow, i < routines.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={s.timeCol}>
              <Text style={[s.routineTime, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>{r.time}</Text>
            </View>
            <View style={[s.iconBg, { backgroundColor: entryTypeColor(r.type, colors) + "1a" }]}>
              <EntryTypeIcon type={r.type} size={18} color={entryTypeColor(r.type, colors)} />
            </View>
            <View style={s.routineMid}>
              <Text style={[s.routineLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.label}</Text>
              <Text style={[s.routineOwner, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{r.owner}</Text>
              {r.note ? <Text numberOfLines={2} style={[s.routineNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.note}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <Text style={[s.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", marginTop: 12 }]}>GOALS</Text>
      {goals.length === 0 ? (
        <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="flag-outline" size={32} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No goals set</Text>
        </View>
      ) : (
        goals.map((g) => (
          <View key={g.id} style={[s.goalCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
            <View style={s.goalHeader}>
              <StatusDot status={g.status} />
              <View style={s.goalHeaderText}>
                <Text style={[s.goalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{g.title}</Text>
                <GoalCategoryBadge category={g.category} />
              </View>
            </View>
            <View style={[s.goalBody, { backgroundColor: colors.background }]}>
              <Text style={[s.goalTarget, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{g.target}</Text>
              {g.note ? <Text style={[s.goalNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{g.note}</Text> : null}
            </View>
            <View style={s.goalFooter}>
              <Ionicons name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[s.goalDue, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{g.due}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, marginBottom: 20, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 12, letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
  
  listCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden", marginBottom: 32, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  routineRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  timeCol: { width: 72, paddingTop: 6 },
  routineTime: { fontSize: 14 },
  iconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: -2 },
  routineMid: { flex: 1 },
  routineLabel: { fontSize: 16, marginBottom: 2 },
  routineOwner: { fontSize: 13, marginBottom: 6 },
  routineNote: { fontSize: 14, lineHeight: 20 },
  
  goalCard: { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 16, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  goalHeader: { flexDirection: "row", gap: 12, marginBottom: 16 },
  goalHeaderText: { flex: 1, gap: 8, alignItems: "flex-start" },
  goalTitle: { fontSize: 18 },
  goalBody: { padding: 16, borderRadius: 12, marginBottom: 16 },
  goalTarget: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  goalNote: { fontSize: 13, lineHeight: 18 },
  goalFooter: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalDue: { fontSize: 13 },
  
  empty: { borderRadius: 20, borderWidth: 1, padding: 40, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15 },
});
