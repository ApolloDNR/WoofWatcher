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

function RecordIcon({ type, color, size = 20 }: { type: string; color: string; size?: number }) {
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
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: Platform.OS === "web" ? 118 : 120, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.screenTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>Health Watch</Text>

      {/* Weight Card */}
      <View style={[s.weightCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
        <View style={s.weightHeader}>
          <View style={[s.iconBg, { backgroundColor: colors.copper + "1A" }]}>
            <MaterialCommunityIcons name="scale" size={20} color={colors.copper} />
          </View>
          <Text style={[s.weightTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Weight Tracking</Text>
        </View>
        <View style={s.weightNumbers}>
          <View style={s.weightStat}>
            <Text style={[s.weightValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{currentWeight}</Text>
            <Text style={[s.weightUnit, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{profile.weight.unit} current</Text>
          </View>
          <View style={[s.weightDivider, { backgroundColor: colors.border }]} />
          <View style={s.weightStat}>
            <Text style={[s.weightValue, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>{goalWeight}</Text>
            <Text style={[s.weightUnit, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{profile.weight.unit} goal</Text>
          </View>
        </View>
        <View style={[s.progressBg, { backgroundColor: colors.background }]}>
          <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: colors.copper }]} />
        </View>
        <Text style={[s.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {(goalWeight - currentWeight).toFixed(1)} {profile.weight.unit} remaining
        </Text>
        <View style={[s.noteBox, { backgroundColor: colors.background }]}>
          <Text style={[s.weightNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.weight.goal}</Text>
        </View>
      </View>

      {/* Bile Watch */}
      <Text style={[s.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>BILE WATCH</Text>
      <View style={[s.infoCard, { backgroundColor: colors.amber + "1A", borderColor: colors.amber + "33" }]}>
        <Ionicons name="information-circle" size={18} color={colors.amber} style={{marginTop: 2}} />
        <Text style={[s.infoText, { color: colors.amber, fontFamily: "Inter_500Medium" }]}>
          Yellow bile vomiting can indicate long empty-stomach windows. Log to share with vet.
        </Text>
      </View>
      {bileEntries.length === 0 ? (
        <View style={[s.emptySmall, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.emptySmallText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No vomit incidents logged. Looking good!</Text>
        </View>
      ) : (
        <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
          {bileEntries.map((e, i) => (
            <View key={e.id} style={[s.row, i < bileEntries.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <View style={[s.rowIconBg, { backgroundColor: colors.amber + "1A" }]}>
                <Ionicons name="warning" size={18} color={colors.amber} />
              </View>
              <View style={s.rowMid}>
                <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{e.title}</Text>
                {e.note ? <Text numberOfLines={1} style={[s.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{e.note}</Text> : null}
              </View>
              <Text style={[s.rowRight, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{timeAgo(e.occurredAt)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Health Log */}
      <Text style={[s.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", marginTop: 12 }]}>HEALTH LOG</Text>
      {healthEntries.length === 0 ? (
        <View style={[s.emptySmall, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.emptySmallText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No health entries yet</Text>
        </View>
      ) : (
        <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
          {healthEntries.map((e, i) => (
            <View key={e.id} style={[s.row, i < healthEntries.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <View style={[s.rowIconBg, { backgroundColor: colors.rose + "1A" }]}>
                <Ionicons name="medkit" size={18} color={colors.rose} />
              </View>
              <View style={s.rowMid}>
                <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{e.title}</Text>
                {e.note ? <Text numberOfLines={1} style={[s.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{e.note}</Text> : null}
              </View>
              <Text style={[s.rowRight, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{timeAgo(e.occurredAt)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Records */}
      <Text style={[s.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", marginTop: 12 }]}>RECORDS</Text>
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
        {records.map((r, i) => (
          <View key={r.id} style={[s.row, i < records.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={[s.rowIconBg, { backgroundColor: colors.sage + "1A" }]}>
              <RecordIcon type={r.type} color={colors.sage} size={18} />
            </View>
            <View style={s.rowMid}>
              <Text style={[s.rowTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{r.title}</Text>
              <Text numberOfLines={2} style={[s.rowSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{r.note}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: colors.background }]}>
              <Text style={[s.rowRight, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{r.due}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Vet boundary */}
      <View style={[s.vetNotice, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark" size={16} color={colors.sage} />
        <Text style={[s.vetNoticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.vetBoundary}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, marginBottom: 20, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 12, letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
  
  weightCard: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 32, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  weightHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  iconBg: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  weightTitle: { fontSize: 16 },
  weightNumbers: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  weightStat: { flex: 1, alignItems: "flex-start" },
  weightValue: { fontSize: 36, letterSpacing: -1 },
  weightUnit: { fontSize: 14, marginTop: 4 },
  weightDivider: { width: 1, height: 40, marginHorizontal: 20 },
  
  progressBg: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 12 },
  progressFill: { height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 13, marginBottom: 16 },
  
  noteBox: { padding: 12, borderRadius: 12 },
  weightNote: { fontSize: 13, lineHeight: 18 },
  
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  
  listCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden", marginBottom: 32, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  rowIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowMid: { flex: 1 },
  rowTitle: { fontSize: 15, marginBottom: 4 },
  rowSub: { fontSize: 13, lineHeight: 18 },
  rowRight: { fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  
  emptySmall: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center", marginBottom: 32 },
  emptySmallText: { fontSize: 14 },
  
  vetNotice: { flexDirection: "row", gap: 10, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  vetNoticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
