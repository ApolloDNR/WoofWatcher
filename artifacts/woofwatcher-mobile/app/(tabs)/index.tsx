import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { EntryTypeIcon, entryTypeColor } from "@/components/EntryTypeIcon";
import { useRouter } from "expo-router";

export default function PhoenixScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const { routines } = state;
  const router = useRouter();
  
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const now = Date.now();
  const nextRoutine = useMemo(() => {
    return routines.find((r) => {
      const [time, period] = r.time.split(" ");
      const [hStr, mStr] = time.split(":");
      let h = parseInt(hStr, 10);
      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      const routineMs = new Date().setHours(h, parseInt(mStr || "0", 10), 0, 0);
      return routineMs > now;
    }) ?? routines[0];
  }, [routines, now]);

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: Platform.OS === "web" ? 118 : 120, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.brandHeader}>
        <Text style={[s.logoWoof, { color: colors.primary, fontFamily: "Inter_800ExtraBold" }]}>Woof<Text style={{color: colors.copper}}>Watcher</Text></Text>
        <Text style={[s.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Happy dog. Simplified care.</Text>
      </View>

      {/* Tamagotchi Hero Card */}
      <View style={[s.heroCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
        <View style={s.heroImageContainer}>
          <Image source={require("@/assets/images/phoenix-hero.png")} style={s.heroImage} resizeMode="cover" />
          <View style={[s.speechBubble, { backgroundColor: colors.card }]}>
            <Text style={[s.speechText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>Let's make today amazing!</Text>
            <View style={[s.speechArrow, { borderTopColor: colors.card }]} />
          </View>
        </View>

        <View style={s.heroStats}>
          <View style={[s.heroStatBadge, { backgroundColor: colors.sage + "22" }]}>
            <Text style={[s.heroStatLabel, { color: colors.sage, fontFamily: "Inter_600SemiBold" }]}>🥰 Joyful</Text>
          </View>
          <View style={[s.heroStatBadge, { backgroundColor: colors.amber + "22", flexDirection: "row", alignItems: "center", gap: 6 }]}>
            <Ionicons name="flash" size={14} color={colors.amber} />
            <Text style={[s.heroStatLabel, { color: colors.amber, fontFamily: "Inter_600SemiBold" }]}>Energy 72%</Text>
          </View>
        </View>

        <View style={[s.heroFooter, { borderTopColor: colors.border }]}>
          <Text style={[s.heroFooterText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Next up <Text style={{color: colors.mutedForeground, fontFamily: "Inter_400Regular"}}>· {nextRoutine?.label} at {nextRoutine?.time}</Text></Text>
        </View>
      </View>

      {/* Today's Care Overview */}
      <Text style={[s.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>TODAY'S CARE</Text>
      <View style={s.careGrid}>
        {[
          { label: "Meals", val: "1/2", icon: "restaurant", color: colors.copper },
          { label: "Walks", val: "1/3", icon: "walk", color: colors.sage },
          { label: "Potty", val: "2", icon: "leaf", color: colors.amber },
        ].map((item, i) => (
          <View key={i} style={[s.careCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={[s.careIcon, { backgroundColor: item.color + "1A" }]}>
              <Ionicons name={item.icon as any} size={18} color={item.color} />
            </View>
            <Text style={[s.careVal, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{item.val}</Text>
            <Text style={[s.careLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick Log */}
      <Text style={[s.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", marginTop: 12 }]}>QUICK LOG</Text>
      <View style={s.quickLogGrid}>
        {[
          { id: "meal", label: "Meal", icon: "restaurant", color: colors.copper },
          { id: "walk", label: "Walk", icon: "walk", color: colors.sage },
          { id: "potty", label: "Potty", icon: "water", color: colors.amber },
          { id: "medication", label: "Meds", icon: "medkit", color: colors.rose },
        ].map((item) => (
          <Pressable 
            key={item.id} 
            style={({pressed}) => [s.quickLogBtn, { backgroundColor: colors.card, shadowColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push("/log")}
          >
            <View style={[s.quickLogIcon, { backgroundColor: item.color + "1A" }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>
            <Text style={[s.quickLogLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  brandHeader: { marginBottom: 20, alignItems: "center" },
  logoWoof: { fontSize: 24, letterSpacing: -0.5 },
  tagline: { fontSize: 13, marginTop: 4 },
  
  heroCard: { borderRadius: 24, overflow: "visible", marginBottom: 32, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4 },
  heroImageContainer: { height: 220, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  speechBubble: { position: "absolute", top: 20, right: 20, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity: 0.1, shadowRadius: 12 },
  speechText: { fontSize: 14 },
  speechArrow: { position: "absolute", bottom: -8, left: 24, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8, borderLeftColor: "transparent", borderRightColor: "transparent" },
  
  heroStats: { flexDirection: "row", padding: 16, gap: 12, justifyContent: "center" },
  heroStatBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  heroStatLabel: { fontSize: 14 },
  
  heroFooter: { padding: 16, borderTopWidth: 1, alignItems: "center" },
  heroFooterText: { fontSize: 14 },

  sectionTitle: { fontSize: 12, letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
  
  careGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
  careCard: { flex: 1, padding: 16, borderRadius: 20, alignItems: "center", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  careIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  careVal: { fontSize: 20, marginBottom: 2 },
  careLabel: { fontSize: 12 },

  quickLogGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  quickLogBtn: { width: "48%", padding: 16, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  quickLogIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  quickLogLabel: { fontSize: 15 },
});
