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
  return <Text style={[sh.header, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{title.toUpperCase()}</Text>;
}
const sh = StyleSheet.create({ header: { fontSize: 12, letterSpacing: 1.2, marginBottom: 12, marginTop: 32, paddingHorizontal: 4 } });

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
      style={({ pressed }) => [mr.row, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }]}
    >
      <View style={[mr.iconBg, { backgroundColor: (color || colors.copper) + "1a" }]}>{icon}</View>
      <View style={mr.mid}>
        <Text style={[mr.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
        {sublabel ? <Text numberOfLines={1} style={[mr.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sublabel}</Text> : null}
      </View>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}
const mr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  iconBg: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  mid: { flex: 1 },
  label: { fontSize: 16 },
  sub: { fontSize: 13, marginTop: 4 },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[ir.row, { borderBottomColor: colors.background }]}>
      <Text style={[ir.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <Text style={[ir.value, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{value}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 12, gap: 16, borderBottomWidth: 1 },
  label: { fontSize: 14, flexShrink: 0 },
  value: { fontSize: 14, flex: 1, textAlign: "right" },
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
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: Platform.OS === "web" ? 118 : 120, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.screenTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>More</Text>

      {/* WoofGuide CTA - Dark Navy Theme */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/woofguide"); }}
        style={({pressed}) => [s.woofCard, { backgroundColor: colors.navy, opacity: pressed ? 0.9 : 1, shadowColor: colors.navy }]}
      >
        <View style={[s.woofIcon, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
          <Ionicons name="chatbubbles" size={28} color="#FFF" />
        </View>
        <View style={s.woofText}>
          <Text style={[s.woofTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>Woof Assistant</Text>
          <Text style={[s.woofSub, { color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" }]}>Ask about Phoenix's care, diet, and patterns</Text>
        </View>
        <Feather name="arrow-right" size={24} color="#FFF" />
      </Pressable>

      {/* Diet Profile */}
      <SectionHeader title="Diet profile" />
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setDietOpen((v) => !v); }}
        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}
      >
        <View style={s.cardRow}>
          <View style={[s.cardIcon, { backgroundColor: colors.copper + "1a" }]}>
            <Ionicons name="restaurant" size={20} color={colors.copper} />
          </View>
          <Text style={[s.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Phoenix's diet</Text>
          <Feather name={dietOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.mutedForeground} />
        </View>
        {dietOpen && (
          <View style={[s.cardBody, { borderTopColor: colors.border }]}>
            <InfoRow label="Food" value={dietProfile.primaryFood} />
            <InfoRow label="Portion" value={dietProfile.normalPortion} />
            <InfoRow label="Schedule" value={dietProfile.mealSchedule} />
            <InfoRow label="Toppers" value={dietProfile.toppers} />
            <InfoRow label="Snack" value={dietProfile.bedtimeSnack} />
            <InfoRow label="Treats" value={dietProfile.treatsAllowed} />
            <InfoRow label="Avoid" value={dietProfile.avoid} />
            
            {dietProfile.vetNotes ? (
              <View style={[s.vetNote, { backgroundColor: colors.amber + "1A", borderColor: colors.amber + "33" }]}>
                <Ionicons name="information-circle" size={16} color={colors.amber} style={{marginTop: 2}}/>
                <Text style={[s.vetNoteText, { color: colors.amber, fontFamily: "Inter_500Medium" }]}>{dietProfile.vetNotes}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>

      {/* Care Team */}
      <SectionHeader title="Care team" />
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setTeamOpen((v) => !v); }}
        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}
      >
        <View style={s.cardRow}>
          <View style={[s.cardIcon, { backgroundColor: colors.sage + "1a" }]}>
            <Ionicons name="people" size={20} color={colors.sage} />
          </View>
          <Text style={[s.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {caregivers.map((c) => c.name).join(" & ")}
          </Text>
          <Feather name={teamOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.mutedForeground} />
        </View>
        {teamOpen && (
          <View style={[s.cardBody, { borderTopColor: colors.border }]}>
            {caregivers.map((c) => (
              <View key={c.name} style={s.caregiverRow}>
                <View style={[s.avatarSmall, { backgroundColor: colors.sage + "22" }]}>
                  <Ionicons name="person" size={16} color={colors.sage} />
                </View>
                <View style={s.caregiverText}>
                  <Text style={[s.caregiverName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{c.name}</Text>
                  <Text style={[s.caregiverRole, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{c.role}</Text>
                </View>
                <View style={[s.countBadge, { backgroundColor: colors.background }]}>
                  <Text style={[s.caregiverCount, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {entries.filter((e) => e.caregiver === c.name).length} logs
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Pressable>

      {/* Care Pass */}
      <SectionHeader title="Share & export" />
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
        <MenuRow
          icon={<MaterialCommunityIcons name="card-account-details" size={20} color={colors.amber} />}
          color={colors.amber}
          label="Care Pass"
          sublabel="Generate a shareable summary for sitters or vets"
          onPress={generateCarePass}
          last
        />
      </View>

      {/* About */}
      <SectionHeader title="About" />
      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
        <View style={[mr.row, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          <View style={[mr.iconBg, { backgroundColor: colors.copper + "1a" }]}>
            <MaterialCommunityIcons name="paw" size={20} color={colors.copper} />
          </View>
          <View style={mr.mid}>
            <Text style={[mr.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>WoofWatcher</Text>
            <Text style={[mr.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Happy dog. Simplified care.</Text>
          </View>
        </View>
        <View style={[mr.row, { paddingVertical: 20 }]}>
          <View style={mr.mid}>
            <Text numberOfLines={4} style={[mr.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 20 }]}>{profile.vetBoundary}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, marginBottom: 8, letterSpacing: -0.5 },
  
  woofCard: { flexDirection: "row", alignItems: "center", borderRadius: 24, padding: 20, gap: 16, marginTop: 16, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 6 },
  woofIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  woofText: { flex: 1 },
  woofTitle: { fontSize: 18, marginBottom: 4 },
  woofSub: { fontSize: 14, lineHeight: 20 },
  
  card: { borderRadius: 20, borderWidth: 1, overflow: "hidden", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: 16 },
  cardBody: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 0 },
  
  vetNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 16, marginTop: 12 },
  vetNoteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  
  caregiverRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "#F7F5F1" },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  caregiverText: { flex: 1 },
  caregiverName: { fontSize: 15, marginBottom: 2 },
  caregiverRole: { fontSize: 13 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  caregiverCount: { fontSize: 12 },
  
  listCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
});
