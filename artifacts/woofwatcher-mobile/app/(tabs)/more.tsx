import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCare } from "@/context/CareContext";

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[sh.header, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{title.toUpperCase()}</Text>;
}
const sh = StyleSheet.create({ header: { fontSize: 11, letterSpacing: 1.2, marginBottom: 8, marginTop: 24, paddingHorizontal: 4 } });

function MenuRow({
  icon,
  label,
  sublabel,
  color,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  color?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [mr.row, { opacity: pressed ? 0.7 : 1, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
    >
      <View style={[mr.iconBg, { backgroundColor: (color || colors.copper) + "1a" }]}>{icon}</View>
      <View style={mr.mid}>
        <Text style={[mr.label, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
        {sublabel ? <Text numberOfLines={1} style={[mr.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sublabel}</Text> : null}
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}
const mr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  iconBg: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  mid: { flex: 1 },
  label: { fontSize: 15 },
  sub: { fontSize: 12, marginTop: 2 },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={ir.row}>
      <Text style={[ir.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <Text style={[ir.value, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{value}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8, gap: 16 },
  label: { fontSize: 13, flexShrink: 0 },
  value: { fontSize: 13, flex: 1, textAlign: "right" },
});

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const router = useRouter();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { dietProfile, caregivers, profile, entries, routines } = state;

  const [dietOpen, setDietOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  const generateCarePass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const recentLines = entries.slice(0, 5).map((e) => `  • ${e.type.toUpperCase()}: ${e.title}${e.note ? ` — ${e.note}` : ""}`).join("\n");
    const routineLines = routines.map((r) => `  ${r.time} — ${r.label} (${r.owner})`).join("\n");
    const pass = [
      `WOOFWATCHER CARE PASS — ${today}`,
      "",
      `🐾 ${profile.name} (${profile.breed})`,
      `Weight: ${profile.weight.current} ${profile.weight.unit}`,
      `Focus: ${profile.careFocus}`,
      "",
      "DIET",
      `Food: ${dietProfile.primaryFood}`,
      `Portion: ${dietProfile.normalPortion}`,
      `Schedule: ${dietProfile.mealSchedule}`,
      `Avoid: ${dietProfile.avoid}`,
      `Snack: ${dietProfile.bedtimeSnack}`,
      "",
      "DAILY SCHEDULE",
      routineLines,
      "",
      "RECENT LOG (last 5)",
      recentLines || "  (no entries)",
      "",
      `⚠️  ${profile.vetBoundary}`,
    ].join("\n");

    Share.share({ message: pass, title: `WoofWatcher Care Pass — ${profile.name}` }).catch(() =>
      Alert.alert("Care Pass", pass)
    );
  };

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: Platform.OS === "web" ? 118 : 100, paddingHorizontal: 18 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>More</Text>

      {/* WoofGuide CTA */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/woofguide"); }}
        style={[s.woofCard, { backgroundColor: colors.copper + "18", borderColor: colors.copper + "44" }]}
      >
        <View style={[s.woofIcon, { backgroundColor: colors.copper + "22" }]}>
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.copper} />
        </View>
        <View style={s.woofText}>
          <Text style={[s.woofTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>WoofGuide</Text>
          <Text style={[s.woofSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Ask about Phoenix's care, diet, and patterns</Text>
        </View>
        <Feather name="arrow-right" size={18} color={colors.copper} />
      </Pressable>

      {/* Diet Profile */}
      <SectionHeader title="Diet profile" />
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setDietOpen((v) => !v); }}
        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={s.cardRow}>
          <View style={[s.cardIcon, { backgroundColor: colors.copper + "1a" }]}>
            <Ionicons name="restaurant" size={18} color={colors.copper} />
          </View>
          <Text style={[s.cardTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Phoenix's diet</Text>
          <Feather name={dietOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>
        {dietOpen && (
          <View style={[s.cardBody, { borderTopColor: colors.border }]}>
            <InfoRow label="Food" value={dietProfile.primaryFood} />
            <InfoRow label="Portion" value={dietProfile.normalPortion} />
            <InfoRow label="Schedule" value={dietProfile.mealSchedule} />
            <InfoRow label="Toppers" value={dietProfile.toppers} />
            <InfoRow label="Bedtime snack" value={dietProfile.bedtimeSnack} />
            <InfoRow label="Treats" value={dietProfile.treatsAllowed} />
            <InfoRow label="Avoid" value={dietProfile.avoid} />
            <InfoRow label="Sensitivities" value={dietProfile.sensitivities} />
            <InfoRow label="Quirks" value={dietProfile.appetiteQuirks} />
            {dietProfile.vetNotes ? (
              <View style={[s.vetNote, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "33" }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.amber} />
                <Text style={[s.vetNoteText, { color: colors.amber, fontFamily: "Inter_400Regular" }]}>{dietProfile.vetNotes}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>

      {/* Care Team */}
      <SectionHeader title="Care team" />
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setTeamOpen((v) => !v); }}
        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={s.cardRow}>
          <View style={[s.cardIcon, { backgroundColor: colors.sage + "1a" }]}>
            <Ionicons name="people" size={18} color={colors.sage} />
          </View>
          <Text style={[s.cardTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
            {caregivers.map((c) => c.name).join(" & ")}
          </Text>
          <Feather name={teamOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>
        {teamOpen && (
          <View style={[s.cardBody, { borderTopColor: colors.border }]}>
            {caregivers.map((c) => (
              <View key={c.name} style={s.caregiverRow}>
                <View style={[s.avatarSmall, { backgroundColor: colors.sage + "22" }]}>
                  <Ionicons name="person" size={14} color={colors.sage} />
                </View>
                <View style={s.caregiverText}>
                  <Text style={[s.caregiverName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{c.name}</Text>
                  <Text style={[s.caregiverRole, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{c.role}</Text>
                </View>
                <Text style={[s.caregiverCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {entries.filter((e) => e.caregiver === c.name).length} entries
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>

      {/* Care Pass */}
      <SectionHeader title="Share & export" />
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuRow
          icon={<MaterialCommunityIcons name="card-account-details-outline" size={18} color={colors.amber} />}
          color={colors.amber}
          label="Care Pass"
          sublabel="Generate a shareable summary for sitters or vets"
          onPress={generateCarePass}
          last
        />
      </View>

      {/* About */}
      <SectionHeader title="About" />
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[mr.row, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <View style={[mr.iconBg, { backgroundColor: colors.copper + "1a" }]}>
            <MaterialCommunityIcons name="paw" size={18} color={colors.copper} />
          </View>
          <View style={mr.mid}>
            <Text style={[mr.label, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>WoofWatcher</Text>
            <Text style={[mr.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Shared dog care tracker</Text>
          </View>
        </View>
        <View style={[mr.row]}>
          <View style={mr.mid}>
            <Text numberOfLines={3} style={[mr.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 17 }]}>{profile.vetBoundary}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, marginBottom: 4 },
  woofCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, marginTop: 14 },
  woofIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  woofText: { flex: 1 },
  woofTitle: { fontSize: 16, marginBottom: 2 },
  woofSub: { fontSize: 13 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  cardRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  cardIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: 15 },
  cardBody: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 2 },
  vetNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderRadius: 8, borderWidth: 1, padding: 8, marginTop: 8 },
  vetNoteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  caregiverRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 },
  avatarSmall: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  caregiverText: { flex: 1 },
  caregiverName: { fontSize: 14 },
  caregiverRole: { fontSize: 12, marginTop: 1 },
  caregiverCount: { fontSize: 12 },
  listCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
});
