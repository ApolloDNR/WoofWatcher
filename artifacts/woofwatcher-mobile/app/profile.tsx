import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardCard, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import {
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { resolvePetName } from "@/lib/petIdentity";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";

const SERIF = "Fraunces_700Bold";

// Same full-bleed park scene the Home walk view uses, reused here as the
// Profile hero so the "park scene + circular avatar" mock reads 1:1 without
// generating any new art.
// Purpose-cropped hero bands, not the tall full-bleed scenes: cover-fitting
// the 9:16 art into this short wide hero showed only its empty sky, washing
// the skyline into a gray smear under the scrims. The day band frames
// skyline + tree + bench + flowers; the night band keeps moon + lamp glow.
const HERO_PARK_DAY = require("@/assets/avatar/rooms/profile-hero-park-day.png");
const HERO_PARK_NIGHT = require("@/assets/avatar/rooms/profile-hero-park-night.png");

const AVATAR_SIZE = 112;
const HERO_CONTENT_HEIGHT = 188;

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

/** Tiny, quiet sage kicker (matches the route-header kicker language). */
function Kicker({ label, style }: { label: string; style?: object }) {
  const colors = useColors();
  return (
    <Text style={[s.kicker, { color: colors.sage, fontFamily: "Inter_700Bold" }, style]}>
      {label}
    </Text>
  );
}

/**
 * Subtle idle breathe for the portrait so it reads alive without pulling
 * focus (1.0 -> 1.012), mirroring the pet-card sprite pulse on Pack. Honors
 * the reduce-motion setting.
 */
function useBreath() {
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, reduced]);
  return useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.value * 0.012 }] }));
}

/**
 * One facts-table row: muted label on the left, the real value (or an honest
 * "Not on file") on the right, and a chevron because every row is editable.
 * Never invents a value - absent fields say so and route to the screen that
 * owns them.
 */
function FactRow({
  label,
  value,
  empty,
  detail,
  onPress,
  accessibilityHint,
  last,
}: {
  label: string;
  value: string;
  empty?: boolean;
  detail?: string;
  onPress: () => void;
  accessibilityHint?: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      scaleTo={0.98}
      style={[s.factRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
    >
      <View style={s.factLabelWrap}>
        <Text style={[s.factLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
          {label}
        </Text>
        {detail ? (
          <Text
            numberOfLines={1}
            style={[s.factDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={[
          s.factValue,
          {
            color: empty ? colors.mutedForeground : colors.foreground,
            fontFamily: empty ? "Inter_500Medium" : "Inter_700Bold",
          },
        ]}
      >
        {value}
      </Text>
      <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
    </PressScale>
  );
}

/** Round, translucent icon chip that floats over the scene (back / edit). */
function HeroChip({
  icon,
  accessibilityLabel,
  onPress,
  style,
}: {
  icon: IoniconName;
  accessibilityLabel: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={MOBILE_INLINE_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [s.heroChip, style, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={20} color="#FBF6E7" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const { getAvatarSource } = useAvatar();
  const breathStyle = useBreath();
  const now = Date.now();

  const profile = state.profile;
  const petName = resolvePetName(profile.name);
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);

  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  // Shared safe-area top handling for the full-bleed hero back chip (also gives
  // the web preview a sensible top inset where insets.top is 0).
  const heroTopPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "standalone",
  });

  // Real, trimmed field values. Anything blank stays blank here and renders an
  // honest empty state below rather than a placeholder that looks like data.
  const breed = profile.breed?.trim();
  const weightCurrent = profile.weight?.current ?? 0;
  const weightUnit = profile.weight?.unit?.trim() || "lb";
  const weightGoal = profile.weight?.goal?.trim();
  const microchip = profile.microchipNumber?.trim();
  const insProvider = profile.insuranceProvider?.trim();
  const insPolicy = profile.insurancePolicy?.trim();
  const vet = profile.primaryVet?.trim();
  const emergency = profile.emergencyContact?.trim();
  const about = profile.background?.trim();

  const go = (route: string) => {
    void Haptics.selectionAsync();
    router.push(route as never);
  };
  // Name / breed / weight live in the setup flow; the record-detail fields
  // (chip, insurance, vet, emergency) live in the More profile editor. Each
  // row points at the screen that can actually change it.
  const openSetup = () => go("/setup");
  const openMore = () => go("/more");
  const openAvatarStudio = () => go("/portrait");
  const goBack = () => {
    void Haptics.selectionAsync();
    if (router.canGoBack()) router.back();
    else router.replace("/" as never);
  };

  const facts: {
    label: string;
    value: string;
    empty?: boolean;
    detail?: string;
    onPress: () => void;
    hint: string;
  }[] = [
    {
      label: "Breed",
      value: breed || "Not on file",
      empty: !breed,
      onPress: openSetup,
      hint: `Opens setup to edit ${petName}'s breed.`,
    },
    {
      // No birthday field exists in the data model - honest empty, not a guess.
      label: "Birthday",
      value: "Not on file",
      empty: true,
      detail: "Not tracked yet",
      onPress: openSetup,
      hint: `WoofWatcher doesn't store a birthday yet. Opens ${petName}'s setup.`,
    },
    {
      label: "Weight",
      value: weightCurrent > 0 ? `${weightCurrent} ${weightUnit}` : "Not on file",
      empty: weightCurrent <= 0,
      detail:
        weightCurrent > 0 && weightGoal
          ? `Goal: ${weightGoal}`
          : weightCurrent <= 0
            ? "Log a weigh-in in setup"
            : undefined,
      onPress: openSetup,
      hint: `Opens setup to update ${petName}'s weight.`,
    },
    {
      // No sex/gender field exists in the data model - honest empty state.
      label: "Sex",
      value: "Not on file",
      empty: true,
      detail: "Not tracked yet",
      onPress: openSetup,
      hint: `WoofWatcher doesn't store a sex yet. Opens ${petName}'s setup.`,
    },
    {
      label: "Microchip",
      value: microchip || "Not on file",
      empty: !microchip,
      onPress: openMore,
      hint: "Opens the profile editor in More to add a microchip number.",
    },
    {
      label: "Insurance",
      value: insProvider || insPolicy || "Not on file",
      empty: !insProvider && !insPolicy,
      detail: insProvider && insPolicy ? `Policy ${insPolicy}` : undefined,
      onPress: openMore,
      hint: "Opens the profile editor in More to add insurance details.",
    },
    {
      label: "Vet",
      value: vet || "Not on file",
      empty: !vet,
      onPress: openMore,
      hint: "Opens the profile editor in More to add a primary vet.",
    },
    {
      label: "Emergency contact",
      value: emergency || "Not on file",
      empty: !emergency,
      onPress: openMore,
      hint: "Opens the profile editor in More to add an emergency contact.",
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-bleed park hero: scene, floating back + edit chips, and the
            name over a soft scrim. The portrait straddles its lower edge. */}
        <View style={[s.hero, { height: insets.top + HERO_CONTENT_HEIGHT, backgroundColor: colors.secondary }]}>
          {/* Explicit 100% size: RN-web renders an absolute-fill Image at its
              natural size without it, showing a zoomed corner of the band. */}
          <Image
            source={colors.isDark ? HERO_PARK_NIGHT : HERO_PARK_DAY}
            style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
            resizeMode="cover"
            fadeDuration={0}
          />
          {/* Top scrim seats the cream chips + name; bottom scrim melts the
              scene into the parchment so the avatar seam feels intentional.
              The day scene is pale (bright sky + pale skyline), so a lighter top
              scrim keeps it from muddying and the bottom melt is pushed down so
              the skyline/park survives rather than washing into cream. The night
              scene has natural contrast (stars + dark silhouette), so it keeps
              the deeper scrim + earlier melt that already reads well. */}
          <LinearGradient
            colors={
              colors.isDark
                ? ["rgba(26,23,20,0.46)", "rgba(26,23,20,0.08)", "transparent"]
                : ["rgba(26,23,20,0.52)", "rgba(26,23,20,0.12)", "transparent"]
            }
            locations={[0, 0.42, 0.72]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", colors.background]}
            locations={colors.isDark ? [0.55, 1] : [0.74, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={[s.heroBar, { paddingTop: heroTopPadding }]}>
            <HeroChip icon="chevron-back" accessibilityLabel="Back" onPress={goBack} />
            <View style={s.heroTitleWrap} pointerEvents="none">
              {/* sageSoft is a dark surface token in dark mode (#233C2E) and is
                  illegible on the night hero, so use the bright cream token there;
                  both scrim-safe over the dark top gradient. */}
              <Text style={[s.heroKicker, { color: colors.isDark ? colors.cream : colors.sageSoft, fontFamily: "Inter_700Bold" }]}>
                PROFILE
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[s.heroName, { color: "#FBF6E7", fontFamily: SERIF }]}
              >
                {petName}
              </Text>
            </View>
            <HeroChip
              icon="pencil"
              accessibilityLabel={`Edit ${petName}'s profile`}
              onPress={openSetup}
            />
          </View>
        </View>

        {/* Circular portrait, tapping opens Avatar Studio (the identity edit). */}
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`${petName}'s portrait`}
          accessibilityHint="Opens Avatar Studio to change the pixel twin."
          onPress={openAvatarStudio}
          scaleTo={0.95}
          containerStyle={s.avatarLayout}
          style={[s.avatarRing, { backgroundColor: colors.card, borderColor: colors.gold, shadowColor: colors.navy }]}
        >
          <Animated.Image
            source={getAvatarSource(status.mood)}
            style={[s.avatarImg, breathStyle]}
            resizeMode="cover"
            accessibilityLabel={`${petName} avatar`}
          />
        </PressScale>

        <Kicker label="DETAILS" style={s.sectionKicker} />
        <BoardCard style={s.card} enter={0}>
          <BoardSectionHeader title="Details" />
          {facts.map((fact, index) => (
            <FactRow
              key={fact.label}
              label={fact.label}
              value={fact.value}
              empty={fact.empty}
              detail={fact.detail}
              onPress={fact.onPress}
              accessibilityHint={fact.hint}
              last={index === facts.length - 1}
            />
          ))}
        </BoardCard>

        <Kicker label="STORY" style={s.sectionKicker} />
        <BoardCard style={s.card} enter={1}>
          <BoardSectionHeader
            title={`About ${petName}`}
            accessory={
              <View style={[s.heartChip, { backgroundColor: colors.rose + "1C" }]}>
                <Ionicons name="heart" size={15} color={colors.rose} />
              </View>
            }
          />
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={
              about ? `About ${petName}: ${about}` : `Add a few words about ${petName}`
            }
            accessibilityHint="Opens setup to edit the About text."
            onPress={openSetup}
            scaleTo={0.99}
            style={s.aboutBody}
          >
            {about ? (
              <Text style={[s.aboutText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {about}
              </Text>
            ) : (
              <View style={[s.aboutEmpty, { borderColor: colors.border }]}>
                <Text style={[s.aboutEmptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Add a few words about {petName} — their story, personality, and the little
                  things that make them yours.
                </Text>
                <View style={s.aboutAddRow}>
                  <Ionicons name="add" size={15} color={colors.sage} />
                  <Text style={[s.aboutAddText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    Add about
                  </Text>
                </View>
              </View>
            )}
          </PressScale>
        </BoardCard>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  hero: {
    width: "100%",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  heroBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    gap: 10,
  },
  heroChip: {
    width: MIN_MOBILE_TOUCH_TARGET,
    height: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26,23,20,0.42)",
    borderWidth: 1,
    borderColor: "rgba(251,246,231,0.32)",
  },
  heroTitleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  heroKicker: {
    fontSize: 9.5,
    letterSpacing: 1.4,
    marginBottom: 2,
    opacity: 0.95,
  },
  heroName: {
    fontSize: 26,
    lineHeight: 30,
    textAlign: "center",
  },

  avatarLayout: {
    alignSelf: "center",
    marginTop: -(AVATAR_SIZE / 2),
    zIndex: 3,
  },
  avatarRing: {
    width: AVATAR_SIZE + 12,
    height: AVATAR_SIZE + 12,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 999,
  },

  sectionKicker: {
    marginTop: 16,
    marginBottom: 6,
    marginHorizontal: 20,
  },
  kicker: {
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  card: {
    marginHorizontal: 16,
  },

  factRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
  },
  factLabelWrap: {
    flex: 1,
    minWidth: 0,
  },
  factLabel: {
    fontSize: 13,
  },
  factDetail: {
    fontSize: 11,
    marginTop: 2,
  },
  factValue: {
    flexShrink: 1,
    maxWidth: "56%",
    textAlign: "right",
    fontSize: 13,
  },

  heartChip: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  aboutBody: {
    marginTop: 2,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 21,
  },
  aboutEmpty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  aboutEmptyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  aboutAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aboutAddText: {
    fontSize: 12.5,
  },
});
