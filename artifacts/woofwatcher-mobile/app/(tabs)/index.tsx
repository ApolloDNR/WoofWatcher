import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { EntryTypeIcon, entryTypeColor } from "@/components/EntryTypeIcon";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SeverityDot({ severity }: { severity?: string }) {
  const colors = useColors();
  if (!severity || severity === "normal") return null;
  const bg = severity === "urgent" ? colors.rose : colors.amber;
  return <View style={[dotS.dot, { backgroundColor: bg }]} />;
}
const dotS = StyleSheet.create({ dot: { position: "absolute", top: 0, right: 0, width: 7, height: 7, borderRadius: 4 } });

const ROUTINE_ICONS: Record<string, [string, string]> = {
  meal: ["ionicons", "restaurant"],
  walk: ["mci", "walk"],
  note: ["ionicons", "document-text-outline"],
  treat: ["mci", "bone"],
};

function RoutineIcon({ type, color }: { type: string; color: string }) {
  const info = ROUTINE_ICONS[type] || ["ionicons", "time-outline"];
  if (info[0] === "mci") return <MaterialCommunityIcons name={info[1] as any} size={16} color={color} />;
  return <Ionicons name={info[1] as any} size={16} color={color} />;
}

export default function PhoenixScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const { profile, caregivers, entries, routines } = state;
  const recentEntries = useMemo(() => entries.slice(0, 5), [entries]);
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: Platform.OS === "web" ? 118 : 100, paddingHorizontal: 18 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.appName, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>WoofWatcher</Text>

      {/* Profile Card */}
      <View style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.avatar, { backgroundColor: colors.copper + "22", borderColor: colors.copper }]}>
          <MaterialCommunityIcons name="paw" size={36} color={colors.copper} />
        </View>
        <View style={s.profileInfo}>
          <Text style={[s.dogName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{profile.name}</Text>
          <Text style={[s.breed, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.breed}</Text>
          <View style={s.careRow}>
            <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
            <Text style={[s.careText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {caregivers.map((c) => c.name).join(" · ")}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        {[
          { value: `${profile.weight.current}`, label: `${profile.weight.unit}`, color: colors.copper },
          { value: `${entries.length}`, label: "entries", color: colors.sage },
          { value: `${routines.length}`, label: "routines", color: colors.amber },
        ].map((stat) => (
          <View key={stat.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.statValue, { color: stat.color, fontFamily: "Inter_700Bold" }]}>{stat.value}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Care Focus */}
      <View style={[s.focusCard, { backgroundColor: colors.card + "bb", borderColor: colors.border, borderLeftColor: colors.sage }]}>
        <Text style={[s.focusText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{profile.careFocus}</Text>
      </View>

      {/* Daily Routine */}
      <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Daily routine</Text>
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {routines.map((r, i) => (
          <View key={r.id} style={[s.row, i < routines.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={[s.iconBg, { backgroundColor: entryTypeColor(r.type, colors) + "1a" }]}>
              <RoutineIcon type={r.type} color={entryTypeColor(r.type, colors)} />
            </View>
            <View style={s.rowMid}>
              <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{r.label}</Text>
              <Text style={[s.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.owner}</Text>
            </View>
            <Text style={[s.rowRight, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{r.time}</Text>
          </View>
        ))}
      </View>

      {/* Recent Activity */}
      <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Recent activity</Text>
      {recentEntries.length === 0 ? (
        <View style={[s.empty, { borderColor: colors.border }]}>
          <Ionicons name="paw-outline" size={28} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No entries yet</Text>
        </View>
      ) : (
        <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {recentEntries.map((e, i) => (
            <View key={e.id} style={[s.row, i < recentEntries.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={[s.iconBg, { backgroundColor: entryTypeColor(e.type, colors) + "1a" }]}>
                <EntryTypeIcon type={e.type} size={16} />
                <SeverityDot severity={e.severity} />
              </View>
              <View style={s.rowMid}>
                <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{e.title}</Text>
                {e.note ? <Text numberOfLines={1} style={[s.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{e.note}</Text> : null}
              </View>
              <Text style={[s.rowRight, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{timeAgo(e.occurredAt)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  appName: { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 14 },
  profileCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14, marginBottom: 10 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  profileInfo: { flex: 1 },
  dogName: { fontSize: 22, marginBottom: 2 },
  breed: { fontSize: 13, marginBottom: 5 },
  careRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  careText: { fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, alignItems: "center" },
  statValue: { fontSize: 21 },
  statLabel: { fontSize: 11, marginTop: 2 },
  focusCard: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3, padding: 12, marginBottom: 22 },
  focusText: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 14, marginBottom: 9 },
  listCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, gap: 12 },
  iconBg: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowMid: { flex: 1 },
  rowTitle: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 1 },
  rowRight: { fontSize: 12 },
  empty: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 28, alignItems: "center", gap: 8, marginBottom: 16 },
  emptyText: { fontSize: 14 },
});
