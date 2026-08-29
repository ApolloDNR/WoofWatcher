import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

import {
  BoardCard,
  BoardRouteHeader,
  BoardSectionHeader,
  ModalBackdropPressable,
  ModalSheetPressable,
} from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { useRouteMotionActive } from "@/hooks/useActiveCurrentTime";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  CARE_READ_ONLY_MESSAGE,
  runAcceptedCareMutation,
} from "@/lib/careWriteProtection";
import { validateProfileWeightDraft } from "@/lib/careWorkflowValidation";
import {
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { DEFAULT_PET_PLACEHOLDER, resolvePetName } from "@/lib/petIdentity";
import {
  deriveCareStorageRecoveryAction,
  deriveCareStorageUnavailableDashboard,
  derivePhoenixStatus,
} from "@/lib/phoenixStatus";

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
    <Text
      style={[
        s.kicker,
        { color: colors.sage, fontFamily: "Inter_700Bold" },
        style,
      ]}
    >
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
  const routeMotionActive = useRouteMotionActive();
  const breath = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(breath);
    breath.value = 0;
    if (reduced || !routeMotionActive) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, reduced, routeMotionActive]);
  return useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.012 }],
  }));
}

/**
 * One facts-table row: muted label on the left, the real value (or an honest
 * "Not on file") on the right. Supported fields open the one local editor;
 * unsupported facts remain honest, accessible text with no fake affordance.
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
  onPress?: () => void;
  accessibilityHint?: string;
  last?: boolean;
}) {
  const colors = useColors();
  const rowStyle = [
    s.factRow,
    !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
  ];
  const content = (
    <>
      <View style={s.factLabelWrap}>
        <Text
          style={[
            s.factLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            numberOfLines={1}
            style={[
              s.factDetail,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
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
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={15}
          color={colors.mutedForeground}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        scaleTo={0.98}
        style={rowStyle}
      >
        {content}
      </PressScale>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${detail ? `. ${detail}` : ""}`}
      style={rowStyle}
    >
      {content}
    </View>
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
      style={({ pressed }) => [
        s.heroChip,
        style,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color="#FBF6E7" />
    </Pressable>
  );
}

export interface DogProfileScreenProps {
  surface: "standalone" | "tabbed";
  onBack: () => void;
  onOpenAvatarStudio: () => void;
}

export default function DogProfileScreen({
  surface,
  onBack,
  onOpenAvatarStudio,
}: DogProfileScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const {
    state,
    careMutationsBlocked,
    isInitialSyncSettled,
    isLoaded,
    persistCurrentCareSnapshot,
    retryLocalHydration,
    storageWarning,
    updateCareDoc,
  } = useCare();
  const { getAvatarSource } = useAvatar();
  const breathStyle = useBreath();
  const now = Date.now();

  const profile = state.profile;
  const petName = resolvePetName(profile.name);
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);

  const bottomPadding =
    surface === "tabbed"
      ? getTabbedRouteBottomPadding({
          platform: Platform.OS,
          bottomInset: insets.bottom,
        })
      : getStandaloneRouteBottomPadding({
          platform: Platform.OS,
          bottomInset: insets.bottom,
        });
  // Shared safe-area top handling for the full-bleed hero back chip (also gives
  // the web preview a sensible top inset where insets.top is 0).
  const heroTopPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface,
  });
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const keyboardOffset = getKeyboardAvoidingVerticalOffset({
    platform: Platform.OS,
    topInset: insets.top,
    surface,
  });
  const profileStorageUnavailable = !isLoaded || storageWarning !== null;
  const profileStorageDashboard = deriveCareStorageUnavailableDashboard({
    isLoaded,
    storageWarning,
  });
  const profileStorageRecoveryAction = deriveCareStorageRecoveryAction({
    isLoaded,
    isInitialSyncSettled,
    storageWarning,
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pBreed, setPBreed] = useState("");
  const [pWeight, setPWeight] = useState("");
  const [pWeightError, setPWeightError] = useState<string | null>(null);
  const [pWeightUnit, setPWeightUnit] = useState<"lb" | "kg">("lb");
  const [pFocus, setPFocus] = useState("");
  const [pBackground, setPBackground] = useState("");
  const [pMicrochip, setPMicrochip] = useState("");
  const [pPrimaryVet, setPPrimaryVet] = useState("");
  const [pEmergencyContact, setPEmergencyContact] = useState("");
  const [pInsuranceProvider, setPInsuranceProvider] = useState("");
  const [pInsurancePolicy, setPInsurancePolicy] = useState("");

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

  const showCareReadOnly = () =>
    notifyDialog("Update WoofWatcher", CARE_READ_ONLY_MESSAGE);

  const openProfileEdit = () => {
    setPName(profile.name === "My Dog" ? "" : profile.name);
    setPBreed(profile.breed);
    setPWeight(
      profile.weight.current > 0 ? String(profile.weight.current) : "",
    );
    setPWeightError(null);
    setPWeightUnit((profile.weight.unit as "lb" | "kg") || "lb");
    setPFocus(profile.careFocus ?? "");
    setPBackground(profile.background ?? "");
    setPMicrochip(profile.microchipNumber ?? "");
    setPPrimaryVet(profile.primaryVet ?? "");
    setPEmergencyContact(profile.emergencyContact ?? "");
    setPInsuranceProvider(profile.insuranceProvider ?? "");
    setPInsurancePolicy(profile.insurancePolicy ?? "");
    setProfileOpen(true);
  };

  const saveProfile = () => {
    const weightValidation = validateProfileWeightDraft(pWeight);
    if (!weightValidation.ok) {
      setPWeightError(weightValidation.message);
      return;
    }
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    setPWeightError(null);
    const name = pName.trim() || DEFAULT_PET_PLACEHOLDER;
    const weight = weightValidation.value;
    const updated = updateCareDoc((doc) => ({
      ...doc,
      profile: {
        ...doc.profile,
        name,
        publicLabel: name,
        breed: pBreed.trim(),
        careFocus: pFocus.trim(),
        background: pBackground.trim(),
        microchipNumber: pMicrochip.trim(),
        primaryVet: pPrimaryVet.trim(),
        emergencyContact: pEmergencyContact.trim(),
        insuranceProvider: pInsuranceProvider.trim(),
        insurancePolicy: pInsurancePolicy.trim(),
        weight: {
          ...doc.profile.weight,
          current: weight ?? doc.profile.weight.current,
          unit: pWeightUnit,
        },
      },
    }));
    const accepted = runAcceptedCareMutation(updated, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setProfileOpen(false);
    });
    if (!accepted) showCareReadOnly();
  };

  const openAvatarStudio = () => {
    void Haptics.selectionAsync();
    onOpenAvatarStudio();
  };
  const goBack = () => {
    void Haptics.selectionAsync();
    onBack();
  };

  const facts: {
    label: string;
    value: string;
    empty?: boolean;
    detail?: string;
    onPress?: () => void;
    hint?: string;
  }[] = [
    {
      label: "Breed",
      value: breed || "Not on file",
      empty: !breed,
      onPress: openProfileEdit,
      hint: `Opens the profile editor for ${petName}'s breed.`,
    },
    {
      // No birthday field exists in the data model - honest empty, not a guess.
      label: "Birthday",
      value: "Not on file",
      empty: true,
      detail: "Not tracked yet",
    },
    {
      label: "Weight",
      value:
        weightCurrent > 0 ? `${weightCurrent} ${weightUnit}` : "Not on file",
      empty: weightCurrent <= 0,
      detail:
        weightCurrent > 0 && weightGoal
          ? `Goal: ${weightGoal}`
          : weightCurrent <= 0
            ? "Add a current weight"
            : undefined,
      onPress: openProfileEdit,
      hint: `Opens the profile editor for ${petName}'s weight.`,
    },
    {
      label: "Care Focus",
      value: profile.careFocus?.trim() || "Not on file",
      empty: !profile.careFocus?.trim(),
      onPress: openProfileEdit,
      hint: `Opens the profile editor for ${petName}'s care focus.`,
    },
    {
      // No sex/gender field exists in the data model - honest empty state.
      label: "Sex",
      value: "Not on file",
      empty: true,
      detail: "Not tracked yet",
    },
    {
      label: "Microchip",
      value: microchip || "Not on file",
      empty: !microchip,
      onPress: openProfileEdit,
      hint: "Opens the profile editor to add a microchip number.",
    },
    {
      label: "Insurance",
      value: insProvider || insPolicy || "Not on file",
      empty: !insProvider && !insPolicy,
      detail: insProvider && insPolicy ? `Policy ${insPolicy}` : undefined,
      onPress: openProfileEdit,
      hint: "Opens the profile editor to add insurance details.",
    },
    {
      label: "Vet",
      value: vet || "Not on file",
      empty: !vet,
      onPress: openProfileEdit,
      hint: "Opens the profile editor to add a primary vet.",
    },
    {
      label: "Emergency contact",
      value: emergency || "Not on file",
      empty: !emergency,
      onPress: openProfileEdit,
      hint: "Opens the profile editor to add an emergency contact.",
    },
  ];

  if (profileStorageUnavailable) {
    const recoveryActionLabel =
      profileStorageRecoveryAction?.label ??
      (storageWarning === "newer-version"
        ? "Update required"
        : storageWarning === "reset"
          ? "Back to More"
          : null);
    const runStorageRecovery = () => {
      void Haptics.selectionAsync();
      if (profileStorageRecoveryAction?.kind === "retry-read") {
        retryLocalHydration();
        return;
      }
      if (profileStorageRecoveryAction?.kind === "retry-save") {
        void persistCurrentCareSnapshot();
        return;
      }
      if (storageWarning === "newer-version") {
        showCareReadOnly();
        return;
      }
      onBack();
    };

    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <ScrollView
          style={s.container}
          contentContainerStyle={[
            s.recoveryContent,
            { paddingTop: heroTopPadding, paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <BoardRouteHeader
            kicker="WOOFWATCHER"
            title="Dog Profile"
            subtitle="Profile details are hidden until device storage is trusted."
            back
            onBack={goBack}
            plain
          />
          <BoardCard style={s.recoveryCard}>
            <BoardSectionHeader title="Profile details hidden" />
            <Text
              style={[
                s.recoveryMessage,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {profileStorageDashboard?.message ??
                "WoofWatcher is checking device storage before showing personal profile details."}
            </Text>
            {recoveryActionLabel ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recoveryActionLabel}
                onPress={runStorageRecovery}
                style={({ pressed }) => [
                  s.recoveryAction,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.84 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="refresh-outline"
                  size={17}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    s.recoveryActionText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {recoveryActionLabel}
                </Text>
              </Pressable>
            ) : null}
          </BoardCard>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-bleed park hero: scene, floating back + edit chips, and the
            name over a soft scrim. The portrait straddles its lower edge. */}
        <View
          style={[
            s.hero,
            {
              height: insets.top + HERO_CONTENT_HEIGHT,
              backgroundColor: colors.secondary,
            },
          ]}
        >
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
            <HeroChip
              icon="chevron-back"
              accessibilityLabel="Back"
              onPress={goBack}
            />
            <View style={s.heroTitleWrap} pointerEvents="none">
              {/* sageSoft is a dark surface token in dark mode (#233C2E) and is
                  illegible on the night hero, so use the bright cream token there;
                  both scrim-safe over the dark top gradient. */}
              <Text
                style={[
                  s.heroKicker,
                  {
                    color: colors.isDark ? colors.cream : colors.sageSoft,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
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
              onPress={openProfileEdit}
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
          style={[
            s.avatarRing,
            {
              backgroundColor: colors.card,
              borderColor: colors.gold,
              shadowColor: colors.brandNavy,
            },
          ]}
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
              <View
                style={[s.heartChip, { backgroundColor: colors.rose + "1C" }]}
              >
                <Ionicons name="heart" size={15} color={colors.rose} />
              </View>
            }
          />
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={
              about
                ? `About ${petName}: ${about}`
                : `Add a few words about ${petName}`
            }
            accessibilityHint="Opens the profile editor to edit the About text."
            onPress={openProfileEdit}
            scaleTo={0.99}
            style={s.aboutBody}
          >
            {about ? (
              <Text
                style={[
                  s.aboutText,
                  { color: colors.foreground, fontFamily: "Inter_500Medium" },
                ]}
              >
                {about}
              </Text>
            ) : (
              <View style={[s.aboutEmpty, { borderColor: colors.border }]}>
                <Text
                  style={[
                    s.aboutEmptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Add a few words about {petName} — their story, personality,
                  and the little things that make them yours.
                </Text>
                <View style={s.aboutAddRow}>
                  <Ionicons name="add" size={15} color={colors.sage} />
                  <Text
                    style={[
                      s.aboutAddText,
                      { color: colors.sage, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Add about
                  </Text>
                </View>
              </View>
            )}
          </PressScale>
        </BoardCard>
      </ScrollView>

      <Modal
        visible={profileOpen}
        transparent
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={() => setProfileOpen(false)}
      >
        <ModalBackdropPressable
          style={s.modalBackdrop}
          onPress={() => setProfileOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={keyboardOffset}
            style={s.modalDock}
          >
            <ModalSheetPressable
              visible={profileOpen}
              onRequestClose={() => setProfileOpen(false)}
              style={[s.profileModal, { backgroundColor: colors.card }]}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingBottom: modalSheetBottomPadding,
                  paddingHorizontal: 22,
                }}
                bounces={false}
                style={s.profileFormScroll}
              >
                <View
                  style={[s.modalHandle, { backgroundColor: colors.border }]}
                />
                <Text
                  accessibilityRole="header"
                  style={[
                    s.sheetTitle,
                    { color: colors.foreground, fontFamily: SERIF },
                  ]}
                >
                  Dog Profile
                </Text>
                <Text
                  style={[
                    s.sheetSubtitle,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Keep the details caregivers need in one clear place.
                </Text>

                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  NAME
                </Text>
                <TextInput
                  accessibilityLabel="Dog name"
                  value={pName}
                  onChangeText={setPName}
                  placeholder="e.g. Luna"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    s.profField,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />

                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  BREED
                </Text>
                <TextInput
                  accessibilityLabel="Dog breed"
                  value={pBreed}
                  onChangeText={setPBreed}
                  placeholder="e.g. Golden Retriever mix"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    s.profField,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />

                <View style={s.profWeightRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.profFieldLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      WEIGHT
                    </Text>
                    <TextInput
                      accessibilityLabel="Current weight"
                      value={pWeight}
                      onChangeText={(value) => {
                        setPWeight(value);
                        setPWeightError(null);
                      }}
                      placeholder="0.0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      style={[
                        s.profField,
                        {
                          backgroundColor: colors.background,
                          color: pWeightError ? colors.rose : colors.foreground,
                          borderWidth: pWeightError ? 1 : 0,
                          borderColor: pWeightError
                            ? colors.rose
                            : "transparent",
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    />
                    {pWeightError ? (
                      <Text
                        aria-live="polite"
                        style={[
                          s.fieldError,
                          {
                            color: colors.rose,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {pWeightError}
                      </Text>
                    ) : null}
                  </View>
                  <View>
                    <Text
                      style={[
                        s.profFieldLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      UNIT
                    </Text>
                    <View style={s.unitRow}>
                      {(["lb", "kg"] as const).map((u) => (
                        <Pressable
                          key={u}
                          accessibilityRole="radio"
                          accessibilityLabel={`Weight unit ${u}`}
                          accessibilityState={{ selected: pWeightUnit === u }}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setPWeightUnit(u);
                          }}
                          style={[
                            s.unitPill,
                            {
                              backgroundColor:
                                pWeightUnit === u
                                  ? colors.primary
                                  : colors.background,
                              borderColor:
                                pWeightUnit === u
                                  ? colors.primary
                                  : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.unitText,
                              {
                                color:
                                  pWeightUnit === u
                                    ? colors.primaryForeground
                                    : colors.foreground,
                                fontFamily: "Inter_600SemiBold",
                              },
                            ]}
                          >
                            {u}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  CARE FOCUS (OPTIONAL)
                </Text>
                <TextInput
                  accessibilityLabel="Care focus"
                  value={pFocus}
                  onChangeText={setPFocus}
                  placeholder="e.g. Maintain healthy weight, ease anxiety"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[
                    s.profField,
                    s.profFieldMultiline,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                />

                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  BACKGROUND / ABOUT
                </Text>
                <TextInput
                  accessibilityLabel="Dog background and about"
                  value={pBackground}
                  onChangeText={setPBackground}
                  placeholder="Personality, history, and helpful caregiver context"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[
                    s.profField,
                    s.profFieldMultiline,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                />

                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  MICROCHIP NUMBER
                </Text>
                <TextInput
                  accessibilityLabel="Microchip number"
                  value={pMicrochip}
                  onChangeText={setPMicrochip}
                  placeholder="985112..."
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  style={[
                    s.profField,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />

                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  PRIMARY VET
                </Text>
                <TextInput
                  accessibilityLabel="Primary veterinarian"
                  value={pPrimaryVet}
                  onChangeText={setPPrimaryVet}
                  placeholder="Clinic or veterinarian"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    s.profField,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />

                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  EMERGENCY CONTACT
                </Text>
                <TextInput
                  accessibilityLabel="Emergency contact"
                  value={pEmergencyContact}
                  onChangeText={setPEmergencyContact}
                  placeholder="Name and phone"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  style={[
                    s.profField,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />

                <View style={s.profWeightRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.profFieldLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      INSURANCE
                    </Text>
                    <TextInput
                      accessibilityLabel="Insurance provider"
                      value={pInsuranceProvider}
                      onChangeText={setPInsuranceProvider}
                      placeholder="Provider"
                      placeholderTextColor={colors.mutedForeground}
                      style={[
                        s.profField,
                        {
                          backgroundColor: colors.background,
                          color: colors.foreground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.profFieldLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      POLICY
                    </Text>
                    <TextInput
                      accessibilityLabel="Insurance policy number"
                      value={pInsurancePolicy}
                      onChangeText={setPInsurancePolicy}
                      placeholder="Policy #"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="characters"
                      style={[
                        s.profField,
                        {
                          backgroundColor: colors.background,
                          color: colors.foreground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    />
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save dog profile"
                  onPress={saveProfile}
                  style={({ pressed }) => [
                    s.profSaveBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.profSaveBtnText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Save profile
                  </Text>
                </Pressable>
              </ScrollView>
            </ModalSheetPressable>
          </KeyboardAvoidingView>
        </ModalBackdropPressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  recoveryContent: { paddingHorizontal: 16 },
  recoveryCard: { marginTop: 14 },
  recoveryMessage: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  recoveryAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  recoveryActionText: { fontSize: 13 },

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
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    marginTop: 2,
    paddingVertical: 8,
    justifyContent: "center",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,31,36,0.45)",
    justifyContent: "flex-end",
  },
  modalDock: { flex: 1, justifyContent: "flex-end" },
  profileModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    paddingTop: 14,
  },
  profileFormScroll: { flexShrink: 1, minHeight: 0 },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  profFieldLabel: {
    fontSize: 12,
    letterSpacing: 0.6,
    marginBottom: 7,
    marginTop: 16,
  },
  profField: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  profFieldMultiline: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  fieldError: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  profWeightRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  unitRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 1,
  },
  unitPill: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  unitText: {
    fontSize: 14,
  },
  profSaveBtn: {
    marginTop: 24,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  profSaveBtnText: {
    fontSize: 15.5,
  },
});
