import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const RECORD_ICONS: Record<string, [string, string]> = {
  vet: ["mci", "stethoscope"],
  vaccine: ["ionicons", "shield-checkmark-outline"],
  weight: ["mci", "scale"],
  instruction: ["ionicons", "document-text-outline"],
  medication: ["mci", "pill"],
  microchip: ["mci", "chip"],
};

function RecordIcon({ type, color, size = 18 }: { type: string; color: string; size?: number }) {
  const info = RECORD_ICONS[type] || ["ionicons", "document-outline"];
  if (info[0] === "mci") return <MaterialCommunityIcons name={info[1] as any} size={size} color={color} />;
  return <Ionicons name={info[1] as any} size={size} color={color} />;
}

export default function HealthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const { profile, entries, records } = state;
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const currentWeight = profile.weight.current;
  const goalWeight = 58;
  const startWeight = 50;
  const progress = Math.min(1, Math.max(0, (currentWeight - startWeight) / (goalWeight - startWeight)));

  const healthEntries = useMemo(
    () => entries.filter((e) => ["vomit", "health", "vet", "weight", "medication"].includes(e.type)).slice(0, 6),
    [entries]
  );
  const bileEntries = useMemo(() => entries.filter((e) => e.type === "vomit").slice(0, 5), [entries]);

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: Platform.OS === "web" ? 118 : 100, paddingHorizontal: 18 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Health</Text>

      {/* Weight Card */}
      <View style={[s.weightCard, { backgroundColor: colors.card, borderColor: colors.copper + "44" }]}>
        <View style={s.weightHeader}>
          <MaterialCommunityIcons name="scale" size={20} color={colors.copper} />
          <Text style={[s.weightTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Weight tracking</Text>
        </View>
        <View style={s.weightNumbers}>
          <View style={s.weightStat}>
            <Text style={[s.weightValue, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>{currentWeight}</Text>
            <Text style={[s.weightUnit, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.weight.unit} current</Text>
          </View>
          <View style={[s.weightDivider, { backgroundColor: colors.border }]} />
          <View style={s.weightStat}>
            <Text style={[s.weightValue, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>{goalWeight}</Text>
            <Text style={[s.weightUnit, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.weight.unit} goal</Text>
          </View>
        </View>
        <View style={[s.progressBg, { backgroundColor: colors.border }]}>
          <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: colors.copper }]} />
        </View>
        <Text style={[s.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {Math.round(progress * 100)}% toward goal · {(goalWeight - currentWeight).toFixed(1)} {profile.weight.unit} remaining
        </Text>
        <Text style={[s.weightNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.weight.goal}</Text>
      </View>

      {/* Bile Watch */}
      <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Bile watch</Text>
      <View style={[s.infoCard, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "33" }]}>
        <Ionicons name="information-circle-outline" size={15} color={colors.amber} />
        <Text style={[s.infoText, { color: colors.amber, fontFamily: "Inter_400Regular" }]}>
          Yellow bile vomiting can indicate long empty-stomach windows. Log and share patterns with your vet.
        </Text>
      </View>
      {bileEntries.length === 0 ? (
        <View style={[s.emptySmall, { borderColor: colors.border }]}>
          <Text style={[s.emptySmallText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No vomit incidents logged</Text>
        </View>
      ) : (
        <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {bileEntries.map((e, i) => (
            <View key={e.id} style={[s.row, i < bileEntries.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={[s.iconBg, { backgroundColor: colors.rose + "1a" }]}>
                <Ionicons name="warning-outline" size={16} color={colors.rose} />
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

      {/* Health Log */}
      <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Health log</Text>
      {healthEntries.length === 0 ? (
        <View style={[s.emptySmall, { borderColor: colors.border }]}>
          <Text style={[s.emptySmallText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No health entries yet</Text>
        </View>
      ) : (
        <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {healthEntries.map((e, i) => (
            <View key={e.id} style={[s.row, i < healthEntries.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={[s.iconBg, { backgroundColor: colors.rose + "1a" }]}>
                <Ionicons name="medkit-outline" size={16} color={colors.rose} />
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

      {/* Records */}
      <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Records</Text>
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {records.map((r, i) => (
          <View key={r.id} style={[s.row, i < records.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={[s.iconBg, { backgroundColor: colors.accent + "1a" }]}>
              <RecordIcon type={r.type} color={colors.accent} size={16} />
            </View>
            <View style={s.rowMid}>
              <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{r.title}</Text>
              <Text numberOfLines={2} style={[s.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.note}</Text>
            </View>
            <Text style={[s.rowRight, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.due}</Text>
          </View>
        ))}
      </View>

      {/* Vet boundary */}
      <View style={[s.vetNotice, { borderColor: colors.border }]}>
        <Ionicons name="shield-outline" size={13} color={colors.mutedForeground} />
        <Text style={[s.vetNoticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.vetBoundary}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, marginBottom: 18 },
  sectionTitle: { fontSize: 14, marginBottom: 9 },
  weightCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24 },
  weightHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  weightTitle: { fontSize: 15 },
  weightNumbers: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  weightStat: { flex: 1, alignItems: "center" },
  weightValue: { fontSize: 32 },
  weightUnit: { fontSize: 12, marginTop: 2 },
  weightDivider: { width: StyleSheet.hairlineWidth, height: 40 },
  progressBg: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, marginBottom: 8 },
  weightNote: { fontSize: 12, lineHeight: 17 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 10 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  listCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", marginBottom: 22 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, gap: 10 },
  iconBg: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowMid: { flex: 1 },
  rowTitle: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 1 },
  rowRight: { fontSize: 12, maxWidth: 80, textAlign: "right" },
  emptySmall: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 16, alignItems: "center", marginBottom: 22 },
  emptySmallText: { fontSize: 13 },
  vetNotice: { flexDirection: "row", gap: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10, marginBottom: 8 },
  vetNoticeText: { flex: 1, fontSize: 11, lineHeight: 16 },
});
