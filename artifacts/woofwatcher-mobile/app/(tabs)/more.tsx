import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const { dietProfile, caregivers, profile, entries, routines } = state;

  const topInset = Platform.OS === "web" ? 24 : insets.top;

  const [dietOpen, setDietOpen] = useState(false);

  const caregiverColor = (name: string) => {
    const palette = [colors.primary, colors.copper, colors.sage, colors.amber];
    const idx = caregivers.findIndex((c) => c.name === name);
    return palette[(idx >= 0 ? idx : 0) % palette.length];
  };

  // Mount animation
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [fade, slide]);

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
      Alert.alert("Care Pass", pass),
    );
  };

  const dietItems: { icon: PulseIconName; label: string; value: string }[] = [
    { icon: "bowl", label: "Food", value: dietProfile.primaryFood },
    { icon: "bowl", label: "Portion", value: dietProfile.normalPortion },
    { icon: "star", label: "Schedule", value: dietProfile.mealSchedule },
    { icon: "candy", label: "Toppers", value: dietProfile.toppers },
    { icon: "bone", label: "Bedtime snack", value: dietProfile.bedtimeSnack },
    { icon: "bone", label: "Treats", value: dietProfile.treatsAllowed },
    { icon: "vomit", label: "Avoid", value: dietProfile.avoid },
  ];

  const links: { icon: PulseIconName; iconName: keyof typeof Ionicons.glyphMap; label: string; sub: string; onPress: () => void }[] = [
    {
      icon: "heart",
      iconName: "chatbubbles",
      label: "WoofGuide Assistant",
      sub: "Ask about Phoenix's care, diet, and patterns",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/woofguide");
      },
    },
    {
      icon: "star",
      iconName: "color-palette",
      label: "Portrait Studio",
      sub: "Turn a photo into a hand-painted masterpiece",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/portrait");
      },
    },
    {
      icon: "paw",
      iconName: "card",
      label: "Care Pass",
      sub: "Share a summary for sitters or the vet",
      onPress: generateCarePass,
    },
  ];

  const H_PAD = 20;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 130, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* Header */}
          <View style={s.header}>
            <Text style={[s.title, { color: colors.foreground, fontFamily: DISPLAY }]}>Profile & Care Team</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Everything that keeps {profile.name} thriving 🐾
            </Text>
          </View>

          {/* Profile header card */}
          <View style={[s.profileCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <LinearGradient
              colors={[colors.primary, colors.sage]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.profileBanner}
            />
            <View style={s.profileAvatarWrap}>
              <View style={[s.profileAvatar, { backgroundColor: colors.card }]}>
                <PulseIcon name="paw" size={36} />
              </View>
            </View>
            <View style={s.profileBody}>
              <Text style={[s.profileName, { color: colors.foreground, fontFamily: DISPLAY }]}>{profile.name}</Text>
              <Text style={[s.profileBreed, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{profile.breed}</Text>
              <View style={[s.profileStats, { borderTopColor: colors.border }]}>
                <View style={s.profileStat}>
                  <Text style={[s.profileStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {profile.weight.current} {profile.weight.unit}
                  </Text>
                  <Text style={[s.profileStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Weight</Text>
                </View>
                <View style={[s.profileStatDivider, { backgroundColor: colors.border }]} />
                <View style={[s.profileStat, { flex: 1.6 }]}>
                  <Text numberOfLines={1} style={[s.profileStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{profile.weight.goal}</Text>
                  <Text style={[s.profileStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Goal</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Care Team */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Care Team</Text>
          </View>
          <View style={[s.listCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {caregivers.map((c, i) => {
              const cg = caregiverColor(c.name);
              const logCount = entries.filter((e) => e.caregiver === c.name).length;
              return (
                <View
                  key={c.name}
                  style={[s.teamRow, i < caregivers.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                >
                  <View style={[s.teamAvatar, { backgroundColor: cg + "1A" }]}>
                    <Text style={[s.teamInitial, { color: cg, fontFamily: "Inter_700Bold" }]}>
                      {(c.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.teamName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{c.name}</Text>
                    <Text style={[s.teamRole, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{c.role}</Text>
                  </View>
                  <View style={[s.logBadge, { backgroundColor: colors.background }]}>
                    <Text style={[s.logBadgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{logCount} logs</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Links */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Tools & Sharing</Text>
          </View>
          <View style={[s.listCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            {links.map((l, i) => (
              <Pressable
                key={l.label}
                onPress={l.onPress}
                style={({ pressed }) => [s.linkRow, i < links.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={[s.linkIconWrap, { backgroundColor: PULSE_COLORS[l.icon] + "16" }]}>
                  <Ionicons name={l.iconName} size={20} color={PULSE_COLORS[l.icon]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.linkLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{l.label}</Text>
                  <Text numberOfLines={1} style={[s.linkSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{l.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>

          {/* Diet profile */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Diet Profile</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setDietOpen((v) => !v);
              }}
              hitSlop={8}
            >
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>{dietOpen ? "Hide" : "Show all"}</Text>
            </Pressable>
          </View>
          <View style={[s.dietCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.dietHeader}>
              <View style={[s.dietIconWrap, { backgroundColor: colors.copper + "1A" }]}>
                <PulseIcon name="bowl" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.dietTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{dietProfile.primaryFood}</Text>
                <Text style={[s.dietSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{dietProfile.mealSchedule}</Text>
              </View>
            </View>
            {dietOpen && (
              <View style={[s.dietBody, { borderTopColor: colors.border }]}>
                {dietItems.map((d) => (
                  <View key={d.label} style={s.dietRow}>
                    <View style={[s.dietRowIcon, { backgroundColor: PULSE_COLORS[d.icon] + "14" }]}>
                      <PulseIcon name={d.icon} size={14} />
                    </View>
                    <Text style={[s.dietLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{d.label}</Text>
                    <Text style={[s.dietValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{d.value}</Text>
                  </View>
                ))}
                {dietProfile.vetNotes ? (
                  <View style={[s.vetNote, { backgroundColor: colors.amber + "14", borderColor: colors.amber + "33" }]}>
                    <Ionicons name="information-circle" size={16} color={colors.amber} style={{ marginTop: 1 }} />
                    <Text style={[s.vetNoteText, { color: colors.amber, fontFamily: "Inter_500Medium" }]}>{dietProfile.vetNotes}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* About / boundary */}
          <View style={[s.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.sage} />
            <Text style={[s.noticeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.vetBoundary}</Text>
          </View>
          <Text style={[s.footer, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            WoofWatcher · Happy dog, simplified care 💚
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  header: { marginBottom: 18 },
  title: { fontSize: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 3 },

  profileCard: {
    borderRadius: 26,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 5,
  },
  profileBanner: { height: 72, width: "100%" },
  profileAvatarWrap: { alignItems: "center", marginTop: -38 },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  profileBody: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10 },
  profileName: { fontSize: 24, letterSpacing: -0.3 },
  profileBreed: { fontSize: 13.5, marginTop: 2, textAlign: "center" },
  profileStats: { flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 16, borderTopWidth: 1, width: "100%" },
  profileStat: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  profileStatValue: { fontSize: 16, letterSpacing: -0.2, textAlign: "center" },
  profileStatLabel: { fontSize: 12, marginTop: 3 },
  profileStatDivider: { width: 1, height: 36 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 20, letterSpacing: -0.2 },
  sectionLink: { fontSize: 14 },

  listCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  teamAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  teamInitial: { fontSize: 17 },
  teamName: { fontSize: 15.5 },
  teamRole: { fontSize: 13, marginTop: 2 },
  logBadge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 11 },
  logBadgeText: { fontSize: 12 },

  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15 },
  linkIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  linkLabel: { fontSize: 15.5 },
  linkSub: { fontSize: 13, marginTop: 2 },

  dietCard: {
    borderRadius: 22,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  dietHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  dietIconWrap: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dietTitle: { fontSize: 15.5 },
  dietSub: { fontSize: 13, marginTop: 2 },
  dietBody: { borderTopWidth: 1, marginTop: 14, paddingTop: 6 },
  dietRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  dietRowIcon: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  dietLabel: { fontSize: 13, width: 92 },
  dietValue: { fontSize: 13, flex: 1, textAlign: "right" },
  vetNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12 },
  vetNoteText: { flex: 1, fontSize: 13.5, lineHeight: 19 },

  notice: { flexDirection: "row", gap: 10, borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 24 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  footer: { fontSize: 13, textAlign: "center", marginTop: 18 },
});
