import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useUpdateHousehold,
  useJoinHousehold,
  useUpdateMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { getCareEventDefinition } from "@workspace/care-domain";
import { useColors } from "@/hooks/useColors";
import { useCare } from "@/context/CareContext";
import { useAvatar } from "@/context/AvatarContext";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";
import { PulseIcon, PulseIconName, PULSE_COLORS } from "@/components/PulseIcon";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, refresh, updateCareDoc } = useCare();
  const { dietProfile, profile, entries, routines } = state;
  const { getAvatarSource } = useAvatar();

  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const me = useGetMe();
  const updateHousehold = useUpdateHousehold();
  const joinHousehold = useJoinHousehold();
  const updateMe = useUpdateMe();

  const household = me.data?.household;
  const members = me.data?.members ?? [];
  const myName = me.data?.user.displayName?.trim() || "";

  const now = Date.now();
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);

  const streak = useMemo(() => {
    const days = new Set(entries.map((e) => e.occurredAt.slice(0, 10)));
    let s = 0;
    let d = new Date(now);
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().slice(0, 10);
      if (!days.has(key)) break;
      s++;
      d = new Date(d.getTime() - 86400000);
    }
    return s;
  }, [entries, now]);

  const todayLogCount = useMemo(() => {
    const today = new Date(now).toISOString().slice(0, 10);
    return entries.filter((e) => e.occurredAt.startsWith(today)).length;
  }, [entries, now]);

  const energyDots = Math.round(((status.energy - 35) / (96 - 35)) * 4) + 1;

  const topInset = Platform.OS === "web" ? 24 : insets.top;

  const [dietOpen, setDietOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pBreed, setPBreed] = useState("");
  const [pWeight, setPWeight] = useState("");
  const [pWeightUnit, setPWeightUnit] = useState<"lb" | "kg">("lb");
  const [pFocus, setPFocus] = useState("");
  const [pMicrochip, setPMicrochip] = useState("");
  const [pPrimaryVet, setPPrimaryVet] = useState("");
  const [pEmergencyContact, setPEmergencyContact] = useState("");
  const [pInsuranceProvider, setPInsuranceProvider] = useState("");
  const [pInsurancePolicy, setPInsurancePolicy] = useState("");

  const [dietEditOpen, setDietEditOpen] = useState(false);
  const [dPrimaryFood, setDPrimaryFood] = useState("");
  const [dNormalPortion, setDNormalPortion] = useState("");
  const [dMealSchedule, setDMealSchedule] = useState("");
  const [dToppers, setDToppers] = useState("");
  const [dBedtimeSnack, setDBedtimeSnack] = useState("");
  const [dTreatsAllowed, setDTreatsAllowed] = useState("");
  const [dAvoid, setDAvoid] = useState("");
  const [dSensitivities, setDSensitivities] = useState("");
  const [dAppetiteQuirks, setDAppetiteQuirks] = useState("");
  const [dVetNotes, setDVetNotes] = useState("");
  const [dSupplements, setDSupplements] = useState("");

  const memberColor = (idx: number) => {
    const palette = [colors.primary, colors.copper, colors.sage, colors.amber, colors.rose];
    return palette[(idx >= 0 ? idx : 0) % palette.length];
  };

  const refreshMe = () => queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });

  const shareInvite = () => {
    if (!household) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({
      message: `Join our ${household.name} on WoofWatcher to help care for ${profile.name}. Invite code: ${household.inviteCode}`,
      title: "WoofWatcher invite",
    }).catch(() => Alert.alert("Invite code", household.inviteCode));
  };

  const submitJoin = () => {
    const code = joinCode.trim();
    if (!code) return;
    joinHousehold.mutate(
      { data: { inviteCode: code } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setJoinOpen(false);
          setJoinCode("");
          refreshMe();
          refresh();
        },
        onError: () => Alert.alert("Couldn't join", "That invite code didn't match a household."),
      },
    );
  };

  const submitRename = () => {
    const name = renameValue.trim();
    if (!name) return;
    updateHousehold.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setRenameOpen(false);
          refreshMe();
        },
        onError: () => Alert.alert("Couldn't rename", "Please try again."),
      },
    );
  };

  const submitName = () => {
    const name = nameValue.trim();
    if (!name) return;
    updateMe.mutate(
      { data: { displayName: name } },
      {
        onSuccess: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setNameOpen(false);
          refreshMe();
        },
        onError: () => Alert.alert("Couldn't update name", "Please try again."),
      },
    );
  };

  const openProfileEdit = () => {
    setPName(profile.name === "My Dog" ? "" : profile.name);
    setPBreed(profile.breed);
    setPWeight(profile.weight.current > 0 ? String(profile.weight.current) : "");
    setPWeightUnit((profile.weight.unit as "lb" | "kg") || "lb");
    setPFocus(profile.careFocus);
    setPMicrochip(profile.microchipNumber ?? "");
    setPPrimaryVet(profile.primaryVet ?? "");
    setPEmergencyContact(profile.emergencyContact ?? "");
    setPInsuranceProvider(profile.insuranceProvider ?? "");
    setPInsurancePolicy(profile.insurancePolicy ?? "");
    setProfileOpen(true);
  };

  const saveProfile = () => {
    const name = pName.trim() || "My Dog";
    const w = parseFloat(pWeight);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({
      ...doc,
      profile: {
        ...doc.profile,
        name,
        publicLabel: name,
        breed: pBreed.trim(),
        careFocus: pFocus.trim(),
        microchipNumber: pMicrochip.trim(),
        primaryVet: pPrimaryVet.trim(),
        emergencyContact: pEmergencyContact.trim(),
        insuranceProvider: pInsuranceProvider.trim(),
        insurancePolicy: pInsurancePolicy.trim(),
        weight: {
          ...doc.profile.weight,
          current: Number.isFinite(w) && w > 0 ? w : doc.profile.weight.current,
          unit: pWeightUnit,
        },
      },
    }));
    setProfileOpen(false);
  };

  const openDietEdit = () => {
    setDPrimaryFood(dietProfile.primaryFood);
    setDNormalPortion(dietProfile.normalPortion);
    setDMealSchedule(dietProfile.mealSchedule);
    setDToppers(dietProfile.toppers);
    setDBedtimeSnack(dietProfile.bedtimeSnack);
    setDTreatsAllowed(dietProfile.treatsAllowed);
    setDAvoid(dietProfile.avoid);
    setDSensitivities(dietProfile.sensitivities);
    setDAppetiteQuirks(dietProfile.appetiteQuirks);
    setDVetNotes(dietProfile.vetNotes);
    setDSupplements(dietProfile.supplements);
    setDietEditOpen(true);
  };

  const saveDiet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateCareDoc((doc) => ({
      ...doc,
      dietProfile: {
        ...doc.dietProfile,
        primaryFood: dPrimaryFood.trim(),
        normalPortion: dNormalPortion.trim(),
        mealSchedule: dMealSchedule.trim(),
        toppers: dToppers.trim(),
        supplements: dSupplements.trim(),
        bedtimeSnack: dBedtimeSnack.trim(),
        treatsAllowed: dTreatsAllowed.trim(),
        avoid: dAvoid.trim(),
        sensitivities: dSensitivities.trim(),
        appetiteQuirks: dAppetiteQuirks.trim(),
        vetNotes: dVetNotes.trim(),
      },
    }));
    setDietEditOpen(false);
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out", "You'll need to sign back in to sync care logs.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          signOut();
        },
      },
    ]);
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
    const recentLines = entries
      .slice(0, 5)
      .map((e) => {
        const label = getCareEventDefinition(e.type, e.details).label.toUpperCase();
        return `  • ${label}: ${e.title}${e.note ? ` — ${e.note}` : ""}`;
      })
      .join("\n");
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
      icon: "paw",
      iconName: "sparkles",
      label: "Setup Checklist",
      sub: "Profile, diet, starter routine, and household basics",
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/setup");
      },
    },
    {
      icon: "heart",
      iconName: "chatbubbles",
      label: "WoofGuide Assistant",
      sub: `Ask about ${profile.name}'s care, diet, and patterns`,
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
            <Pressable
              onPress={openProfileEdit}
              hitSlop={8}
              style={[s.profileEditBtn, { backgroundColor: "rgba(255,255,255,0.9)" }]}
            >
              <Ionicons name="pencil" size={14} color={colors.primary} />
            </Pressable>
            <View style={s.profileAvatarWrap}>
              <View style={[s.profileAvatar, { backgroundColor: colors.card, borderColor: colors.card }]}>
                <Image source={getAvatarSource(status.mood)} style={s.profileAvatarImg} resizeMode="cover" />
              </View>
            </View>
            <View style={s.profileBody}>
              <Text style={[s.profileName, { color: colors.foreground, fontFamily: DISPLAY }]}>{profile.name}</Text>
              <Text style={[s.profileBreed, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{profile.breed}</Text>
              <View style={[s.profileStats, { borderTopColor: colors.border }]}>
                <View style={s.profileStat}>
                  <Text style={[s.profileStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {profile.weight.current > 0 ? `${profile.weight.current} ${profile.weight.unit}` : "—"}
                  </Text>
                  <Text style={[s.profileStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Weight</Text>
                </View>
                <View style={[s.profileStatDivider, { backgroundColor: colors.border }]} />
                <View style={s.profileStat}>
                  <Text style={[s.profileStatValue, { color: streak > 0 ? colors.sage : colors.mutedForeground, fontFamily: DISPLAY_SEMI }]}>
                    {streak > 0 ? `${streak}d` : "—"}
                  </Text>
                  <Text style={[s.profileStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Streak</Text>
                </View>
                <View style={[s.profileStatDivider, { backgroundColor: colors.border }]} />
                <View style={s.profileStat}>
                  <Text style={[s.profileStatValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{routines.length}</Text>
                  <Text style={[s.profileStatLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Routines</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Today's status strip */}
          <View style={[s.statusStrip, { backgroundColor: colors.card, shadowColor: colors.primary, marginTop: 12 }]}>
            <View style={[s.statusCell, { borderRightWidth: 1, borderRightColor: colors.border }]}>
              <Text style={[s.statusValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{status.mood}</Text>
              <Text style={[s.statusLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Today's mood</Text>
            </View>
            <View style={s.statusCell}>
              <View style={s.statusEnergyRow}>
                {[1, 2, 3, 4, 5].map((dot) => (
                  <View
                    key={dot}
                    style={[
                      s.statusEnergyDot,
                      { backgroundColor: dot <= energyDots ? colors.primary : colors.border },
                    ]}
                  />
                ))}
              </View>
              <Text style={[s.statusLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Energy level</Text>
            </View>
            <View style={[s.statusCell, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
              <Text style={[s.statusValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{todayLogCount}</Text>
              <Text style={[s.statusLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Logs today</Text>
            </View>
          </View>

          {/* Care Team / Household */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Care Team</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setRenameValue(household?.name ?? "");
                setRenameOpen(true);
              }}
              hitSlop={8}
              disabled={!household}
            >
              <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>Rename</Text>
            </Pressable>
          </View>

          {/* Invite card */}
          <View style={[s.inviteCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <View style={s.inviteTop}>
              <View style={[s.inviteIcon, { backgroundColor: colors.sage + "1A" }]}>
                <Ionicons name="people" size={20} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.inviteHousehold, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {household?.name ?? "Your household"}
                </Text>
                <Text style={[s.inviteSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {members.length} {members.length === 1 ? "member" : "members"} syncing care
                </Text>
              </View>
            </View>
            <View style={[s.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View>
                <Text style={[s.codeLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>INVITE CODE</Text>
                <Text style={[s.codeValue, { color: colors.foreground, fontFamily: DISPLAY }]}>
                  {household?.inviteCode ?? "—"}
                </Text>
              </View>
              <Pressable
                onPress={shareInvite}
                disabled={!household}
                style={({ pressed }) => [s.shareBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name="share-outline" size={16} color="#fff" />
                <Text style={[s.shareBtnText, { fontFamily: "Inter_700Bold" }]}>Invite</Text>
              </Pressable>
            </View>
          </View>

          {/* Members */}
          <View style={[s.listCard, { backgroundColor: colors.card, shadowColor: colors.primary, marginTop: 12 }]}>
            {members.length === 0 ? (
              <View style={s.teamRow}>
                <Text style={[s.teamRole, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Loading members…
                </Text>
              </View>
            ) : (
              members.map((m, i) => {
                const cg = memberColor(i);
                const name = m.displayName?.trim() || m.email?.split("@")[0] || "Member";
                const logCount = entries.filter((e) => e.caregiver === name).length;
                return (
                  <View
                    key={m.id}
                    style={[s.teamRow, i < members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    <View style={[s.teamAvatar, { backgroundColor: cg + "1A" }]}>
                      <Text style={[s.teamInitial, { color: cg, fontFamily: "Inter_700Bold" }]}>
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.teamNameLine}>
                        <Text style={[s.teamName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{name}</Text>
                        {m.isSelf && (
                          <View style={[s.youBadge, { backgroundColor: colors.primary + "1A" }]}>
                            <Text style={[s.youBadgeText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>You</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.teamRole, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                        {m.role === "owner" ? "Owner" : "Caregiver"}
                      </Text>
                    </View>
                    <View style={[s.logBadge, { backgroundColor: colors.background }]}>
                      <Text style={[s.logBadgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{logCount} logs</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Household actions */}
          <View style={[s.listCard, { backgroundColor: colors.card, shadowColor: colors.primary, marginTop: 12 }]}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setNameValue(myName);
                setNameOpen(true);
              }}
              style={({ pressed }) => [s.linkRow, { borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[s.linkIconWrap, { backgroundColor: colors.copper + "16" }]}>
                <Ionicons name="person-circle" size={20} color={colors.copper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.linkLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Your display name</Text>
                <Text numberOfLines={1} style={[s.linkSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {myName || "Set how you appear on logs"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setJoinCode("");
                setJoinOpen(true);
              }}
              style={({ pressed }) => [s.linkRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[s.linkIconWrap, { backgroundColor: colors.sage + "16" }]}>
                <Ionicons name="enter-outline" size={20} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.linkLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Join another household</Text>
                <Text numberOfLines={1} style={[s.linkSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Enter an invite code from a family member
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable onPress={() => { Haptics.selectionAsync(); openDietEdit(); }} hitSlop={8}>
                <Text style={[s.sectionLink, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => { Haptics.selectionAsync(); setDietOpen((v) => !v); }} hitSlop={8}>
                <Text style={[s.sectionLink, { color: colors.copper, fontFamily: "Inter_600SemiBold" }]}>{dietOpen ? "Hide" : "Details"}</Text>
              </Pressable>
            </View>
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

          {/* Sign out */}
          <Pressable
            onPress={confirmSignOut}
            style={({ pressed }) => [s.signOut, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="log-out-outline" size={19} color={colors.rose} />
            <Text style={[s.signOutText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>Sign out</Text>
          </Pressable>

          <Text style={[s.footer, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            WoofWatcher · Happy dog, simplified care 💚
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Diet profile edit modal */}
      <Modal visible={dietEditOpen} transparent animationType="slide" onRequestClose={() => setDietEditOpen(false)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setDietEditOpen(false)}>
          <Pressable style={[s.profileModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingHorizontal: 22 }}
              bounces={false}
            >
              <View style={s.modalHandle} />
              <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Diet Profile</Text>

              {[
                { label: "PRIMARY FOOD", value: dPrimaryFood, set: setDPrimaryFood, placeholder: "e.g. Royal Canin GI dry kibble" },
                { label: "NORMAL PORTION", value: dNormalPortion, set: setDNormalPortion, placeholder: "e.g. 1¼ cups twice daily" },
                { label: "MEAL SCHEDULE", value: dMealSchedule, set: setDMealSchedule, placeholder: "e.g. 7 AM and 6 PM" },
                { label: "TOPPERS", value: dToppers, set: setDToppers, placeholder: "e.g. Bone broth, low-sodium" },
                { label: "SUPPLEMENTS", value: dSupplements, set: setDSupplements, placeholder: "e.g. Probiotic daily" },
                { label: "BEDTIME SNACK", value: dBedtimeSnack, set: setDBedtimeSnack, placeholder: "e.g. ½ cup kibble at 10 PM" },
                { label: "TREATS ALLOWED", value: dTreatsAllowed, set: setDTreatsAllowed, placeholder: "e.g. Zuke's minis, max 3/day" },
                { label: "AVOID", value: dAvoid, set: setDAvoid, placeholder: "e.g. Grains, chicken, rawhide" },
                { label: "SENSITIVITIES", value: dSensitivities, set: setDSensitivities, placeholder: "e.g. Chicken allergy confirmed" },
                { label: "APPETITE QUIRKS", value: dAppetiteQuirks, set: setDAppetiteQuirks, placeholder: "e.g. Eats slowly, dislikes change" },
                { label: "VET NOTES", value: dVetNotes, set: setDVetNotes, placeholder: "e.g. Low-fat diet per Dr. Kim" },
              ].map((f) => (
                <View key={f.label}>
                  <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{f.label}</Text>
                  <TextInput
                    value={f.value}
                    onChangeText={f.set}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                  />
                </View>
              ))}

              <Pressable
                onPress={saveDiet}
                style={({ pressed }) => [s.profSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[s.profSaveBtnText, { fontFamily: "Inter_700Bold" }]}>Save diet profile</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Join household modal */}
      <PromptModal
        visible={joinOpen}
        colors={colors}
        icon="enter-outline"
        title="Join a household"
        subtitle="Enter the invite code shared by a family member."
        placeholder="e.g. PHX-7QK2"
        value={joinCode}
        onChangeText={setJoinCode}
        autoCapitalize="characters"
        confirmLabel="Join"
        loading={joinHousehold.isPending}
        onCancel={() => setJoinOpen(false)}
        onConfirm={submitJoin}
      />

      {/* Rename household modal */}
      <PromptModal
        visible={renameOpen}
        colors={colors}
        icon="home-outline"
        title="Rename household"
        subtitle="Give your care team a name everyone recognizes."
        placeholder="The Phoenix Pack"
        value={renameValue}
        onChangeText={setRenameValue}
        confirmLabel="Save"
        loading={updateHousehold.isPending}
        onCancel={() => setRenameOpen(false)}
        onConfirm={submitRename}
      />

      {/* Display name modal */}
      <PromptModal
        visible={nameOpen}
        colors={colors}
        icon="person-circle-outline"
        title="Your display name"
        subtitle="This is how you'll appear on every care log."
        placeholder="Alex"
        value={nameValue}
        onChangeText={setNameValue}
        confirmLabel="Save"
        loading={updateMe.isPending}
        onCancel={() => setNameOpen(false)}
        onConfirm={submitName}
      />

      {/* Dog profile edit modal */}
      <Modal visible={profileOpen} transparent animationType="slide" onRequestClose={() => setProfileOpen(false)}>
        <Pressable style={[s.modalBackdrop, { justifyContent: "flex-end" }]} onPress={() => setProfileOpen(false)}>
          <Pressable
            style={[s.profileModal, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingHorizontal: 22 }}
              bounces={false}
            >
            <View style={s.modalHandle} />
            <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>Dog Profile</Text>

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NAME</Text>
            <TextInput
              value={pName}
              onChangeText={setPName}
              placeholder="e.g. Luna"
              placeholderTextColor={colors.mutedForeground}
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>BREED</Text>
            <TextInput
              value={pBreed}
              onChangeText={setPBreed}
              placeholder="e.g. Golden Retriever mix"
              placeholderTextColor={colors.mutedForeground}
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <View style={s.profWeightRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>WEIGHT</Text>
                <TextInput
                  value={pWeight}
                  onChangeText={setPWeight}
                  placeholder="0.0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
              </View>
              <View>
                <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>UNIT</Text>
                <View style={s.unitRow}>
                  {(["lb", "kg"] as const).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => { Haptics.selectionAsync(); setPWeightUnit(u); }}
                      style={[s.unitPill, { backgroundColor: pWeightUnit === u ? colors.primary : colors.background, borderColor: pWeightUnit === u ? colors.primary : colors.border }]}
                    >
                      <Text style={[s.unitText, { color: pWeightUnit === u ? "#fff" : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>CARE FOCUS (OPTIONAL)</Text>
            <TextInput
              value={pFocus}
              onChangeText={setPFocus}
              placeholder="e.g. Maintain healthy weight, ease anxiety"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_400Regular", minHeight: 60, textAlignVertical: "top" }]}
            />

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>MICROCHIP NUMBER</Text>
            <TextInput
              value={pMicrochip}
              onChangeText={setPMicrochip}
              placeholder="985112..."
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>PRIMARY VET</Text>
            <TextInput
              value={pPrimaryVet}
              onChangeText={setPPrimaryVet}
              placeholder="Clinic or veterinarian"
              placeholderTextColor={colors.mutedForeground}
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>EMERGENCY CONTACT</Text>
            <TextInput
              value={pEmergencyContact}
              onChangeText={setPEmergencyContact}
              placeholder="Name and phone"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
            />

            <View style={s.profWeightRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>INSURANCE</Text>
                <TextInput
                  value={pInsuranceProvider}
                  onChangeText={setPInsuranceProvider}
                  placeholder="Provider"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.profFieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>POLICY</Text>
                <TextInput
                  value={pInsurancePolicy}
                  onChangeText={setPInsurancePolicy}
                  placeholder="Policy #"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  style={[s.profField, { backgroundColor: colors.background, color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                />
              </View>
            </View>

            <Pressable
              onPress={saveProfile}
              style={({ pressed }) => [s.profSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[s.profSaveBtnText, { fontFamily: "Inter_700Bold" }]}>Save profile</Text>
            </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PromptModal({
  visible,
  colors,
  icon,
  title,
  subtitle,
  placeholder,
  value,
  onChangeText,
  confirmLabel,
  loading,
  autoCapitalize = "sentences",
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  colors: ReturnType<typeof useColors>;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  confirmLabel: string;
  loading?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.modalBackdrop} onPress={onCancel}>
        <Pressable style={[s.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[s.modalIcon, { backgroundColor: colors.primary + "1A" }]}>
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
          <Text style={[s.modalTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{title}</Text>
          <Text style={[s.modalSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{subtitle}</Text>
          <TextInput
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            style={[s.modalInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_500Medium" }]}
            returnKeyType="done"
            onSubmitEditing={onConfirm}
          />
          <View style={s.modalActions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [s.modalCancel, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[s.modalCancelText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => [s.modalConfirm, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.7 : 1 }]}
            >
              <Text style={[s.modalConfirmText, { fontFamily: "Inter_700Bold" }]}>{loading ? "…" : confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    overflow: "hidden",
  },
  profileAvatarImg: { width: "100%", height: "100%", borderRadius: 20 },
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
  teamNameLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  teamName: { fontSize: 15.5 },
  teamRole: { fontSize: 13, marginTop: 2 },
  youBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  youBadgeText: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 },
  logBadge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 11 },
  logBadgeText: { fontSize: 12 },

  inviteCard: {
    borderRadius: 22,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  inviteTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  inviteIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  inviteHousehold: { fontSize: 16 },
  inviteSub: { fontSize: 13, marginTop: 2 },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  codeLabel: { fontSize: 10.5, letterSpacing: 0.6 },
  codeValue: { fontSize: 21, letterSpacing: 1, marginTop: 3 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 40, borderRadius: 13 },
  shareBtnText: { color: "#fff", fontSize: 14 },

  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  signOutText: { fontSize: 15 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,31,36,0.45)", justifyContent: "center", paddingHorizontal: 28 },
  modalCard: {
    borderRadius: 26,
    padding: 24,
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  modalIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  modalTitle: { fontSize: 19, letterSpacing: -0.2 },
  modalSub: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  modalInput: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, marginTop: 16 },
  modalActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, height: 48, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 15 },
  modalConfirm: { flex: 2, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modalConfirmText: { color: "#fff", fontSize: 15 },

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

  statusStrip: {
    flexDirection: "row",
    borderRadius: 22,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  statusCell: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 6 },
  statusValue: { fontSize: 16, letterSpacing: -0.2, textTransform: "capitalize" },
  statusLabel: { fontSize: 11.5, marginTop: 3, textAlign: "center" },
  statusEnergyRow: { flexDirection: "row", gap: 4, marginBottom: 1 },
  statusEnergyDot: { width: 8, height: 8, borderRadius: 4 },

  notice: { flexDirection: "row", gap: 10, borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 24 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  footer: { fontSize: 13, textAlign: "center", marginTop: 18 },

  profileEditBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  profileModal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", paddingTop: 14 },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", marginBottom: 16 },
  sheetTitle: { fontSize: 20, marginBottom: 4, letterSpacing: -0.2 },
  profFieldLabel: { fontSize: 11, letterSpacing: 0.6, marginBottom: 7, marginTop: 16 },
  profField: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  profWeightRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  unitRow: { flexDirection: "row", gap: 8, paddingBottom: 1 },
  unitPill: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, borderWidth: 1 },
  unitText: { fontSize: 14 },
  profSaveBtn: { marginTop: 24, borderRadius: 15, paddingVertical: 15, alignItems: "center" },
  profSaveBtnText: { color: "#fff", fontSize: 15.5 },
});
