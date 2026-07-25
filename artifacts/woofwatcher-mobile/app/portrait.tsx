import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BoardCard,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
} from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { LivingPhoenixRoom } from "@/components/LivingPhoenixRoom";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { deriveAvatarMotion } from "@/lib/avatarMotion";
import {
  deriveAvatarPreviewAccessories,
  deriveAvatarPreviewMood,
  deriveAvatarPreviewMotion,
} from "@/lib/avatarPreviewModel";
import {
  buildAvatarSpriteProductionQaSummary,
  buildAvatarSpriteProductionTemplateReview,
} from "@/lib/avatarSpriteProductionQa";
import {
  AVATAR_ACCESSORIES,
  AVATAR_EMOTE_STATES,
  AVATAR_SCAN_WORKFLOW_STEPS,
  AVATAR_TEMPLATES,
  buildTemplateScanSuggestion,
  createDefaultAvatarConfig,
  deriveAvatarAccessoryFit,
  describeAvatarConfig,
  getAvatarTemplate,
  summarizeAvatarAccessoryFits,
  type AvatarAccessoryOption,
  type AvatarEmoteState,
  type AvatarFaceMarkingId,
  type AvatarTemplateId,
  type PetAvatarConfig,
} from "@/lib/avatarStudio";
import {
  getAvatarTemplateAccessorySource,
  getAvatarTemplateBaseSource,
  getAvatarTemplateDisplaySource,
  getAvatarTemplateEmoteSource,
} from "@/lib/avatarTemplateAssets";
import {
  getAvatarTemplateSpritePreview,
  hasAvatarTemplateSpritePack,
} from "@/lib/avatarTemplateSpriteAssets";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { isOwnerOpsBuild } from "@/lib/buildChannel";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import {
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { resolvePetName } from "@/lib/petIdentity";
import { pixelImageStyle } from "@/lib/pixelRendering";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";

const DISPLAY = "Fredoka_700Bold";
const PIXEL_ROOM_SOURCE = require("@/assets/avatar/rooms/phoenix-room-day-option-b.png");
const PIXEL_HEAD_SOURCE = require("@/assets/avatar/phoenix/approved/phoenix-main-head-v2-crisp.png");

type Phase = "idle" | "working" | "result";
type StudioTab = "scan" | "template" | "customize" | "emotes";

const SCAN_LINES = [
  "Opening your photo as a reference...",
  "Lining up pixel template bases...",
  "Setting your dog side by side...",
  "Suggesting a base to start from...",
  "Handing the picks back to you...",
];

const SCAN_WORKFLOW_ACCESSIBILITY_SUMMARY =
  "Photo reference, Template match, Pixel twin, Owner approval";
const HERO_TEMPLATE_SPRITE_SIZE = 256;

const COAT_SWATCHES = [
  "#1B1714",
  "#C99052",
  "#F1E2C7",
  "#5B412F",
  "#E7E0D3",
  "#2F2F31",
  "#A86B3D",
  "#FFFFFF",
];

const FACE_MARKINGS: { id: AvatarFaceMarkingId; label: string }[] = [
  { id: "mask", label: "Mask" },
  { id: "blaze", label: "Blaze" },
  { id: "muzzle", label: "Muzzle" },
  { id: "eyebrows", label: "Brows" },
  { id: "patch", label: "Patch" },
  { id: "none", label: "None" },
];

const EMOTE_ICON: Record<AvatarEmoteState, PixelIconName> = {
  happy: "mood_great",
  calm: "mood_good",
  excited: "happy",
  bored: "clock",
  hungry: "meal",
  anxious: "anxious",
  sleepy: "clock",
  proud: "heart",
  home_alone: "note",
  not_feeling_well: "health",
};

function emoteLabel(state: AvatarEmoteState): string {
  return state
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function updateConfig(
  config: PetAvatarConfig,
  patch: Partial<PetAvatarConfig>,
): PetAvatarConfig {
  return {
    ...config,
    ...patch,
    accessorySlots: {
      ...config.accessorySlots,
      ...(patch.accessorySlots ?? {}),
    },
  };
}

function templateColor(templateId: AvatarTemplateId): string {
  const palette: Record<AvatarTemplateId, string> = {
    shepherd: "#2E5846",
    retriever: "#D8A852",
    husky: "#A8CBE8",
    bully: "#C96358",
    doodle: "#C99052",
    terrier: "#6DA36F",
    hound: "#8C6A4A",
    dachshund: "#B46A35",
    spaniel: "#E07A2F",
    toy: "#C96358",
    slender: "#9DBAA7",
    // Slate blue for mixed: the accent stays readable without reintroducing
    // a dark navy chip into the parchment catalog.
    mixed: "#5B7FA6",
  };
  return palette[templateId];
}

export default function PortraitScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ownerOps = isOwnerOpsBuild();
  const { state } = useCare();
  const {
    avatarConfig,
    hasCustomAvatar,
    hasConfiguredAvatar,
    saveAvatarConfig,
    resetAvatarConfig,
  } = useAvatar();

  const petName = resolvePetName(state.profile.name);
  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "standalone",
  });
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const [phase, setPhase] = useState<Phase>("idle");
  const [activeTab, setActiveTab] = useState<StudioTab>("scan");
  const [draft, setDraft] = useState<PetAvatarConfig>(() => avatarConfig);
  const [previewEmote, setPreviewEmote] = useState<AvatarEmoteState>("happy");
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [scanLine, setScanLine] = useState(0);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const scanSuggestion = useMemo(
    () => buildTemplateScanSuggestion(petName),
    [petName],
  );

  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const templateLife = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setDraft(avatarConfig);
  }, [avatarConfig]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase !== "working") return;
    const scanLoop = Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 860,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 860,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    scanLoop.start();
    pulseLoop.start();
    const lineTimer = setInterval(
      () => setScanLine((idx) => (idx + 1) % SCAN_LINES.length),
      900,
    );
    const finishTimer = setTimeout(() => {
      setDraft(scanSuggestion.suggestedConfig);
      setPhase("result");
      setActiveTab("template");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }, 2450);

    return () => {
      scanLoop.stop();
      pulseLoop.stop();
      clearInterval(lineTimer);
      clearTimeout(finishTimer);
      scanAnim.setValue(0);
      pulse.setValue(0);
    };
  }, [phase, pulse, scanAnim, scanSuggestion.suggestedConfig]);

  useEffect(() => {
    const lifeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(templateLife, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(templateLife, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    lifeLoop.start();

    return () => {
      lifeLoop.stop();
      templateLife.setValue(0);
    };
  }, [templateLife]);

  const selectedTemplate = getAvatarTemplate(draft.templateId);
  const faceMarkingLabel =
    FACE_MARKINGS.find((marking) => marking.id === draft.faceMarkingId)?.label ??
    draft.faceMarkingId;
  const liveTemplateCount = useMemo(
    () =>
      AVATAR_TEMPLATES.filter((template) =>
        hasAvatarTemplateSpritePack(template.id),
      ).length,
    [],
  );
  const avatarSpriteProductionSummary = useMemo(
    () => buildAvatarSpriteProductionQaSummary(),
    [],
  );
  const productionTemplateReview = useMemo(
    () => buildAvatarSpriteProductionTemplateReview(draft.templateId),
    [draft.templateId],
  );
  const selectedTemplateBase = getAvatarTemplateBaseSource(draft.templateId);
  const selectedTemplateEmote = getAvatarTemplateEmoteSource(
    draft.templateId,
    previewEmote,
  );
  const selectedTemplateStillSource =
    selectedTemplateEmote ?? selectedTemplateBase ?? PIXEL_HEAD_SOURCE;
  const previewAccessories = useMemo(
    () => deriveAvatarPreviewAccessories(draft),
    [draft],
  );
  const accessoryFitSummary = useMemo(
    () => summarizeAvatarAccessoryFits(draft.templateId),
    [draft.templateId],
  );
  const accessoryFitBadge =
    accessoryFitSummary.split(";")[0] ?? accessoryFitSummary;
  const previewAccessoryLayers = useMemo(
    () =>
      previewAccessories.map((layer) => ({
        ...layer,
        source: getAvatarTemplateAccessorySource(draft.templateId, layer.id),
      })),
    [draft.templateId, previewAccessories],
  );
  const previewMood = useMemo(
    () => deriveAvatarPreviewMood(previewEmote),
    [previewEmote],
  );
  const previewMotion = useMemo(
    () => deriveAvatarPreviewMotion(draft.templateId, previewEmote),
    [draft.templateId, previewEmote],
  );
  const templateSpritePreview = useMemo(
    () => getAvatarTemplateSpritePreview(draft.templateId, previewEmote),
    [draft.templateId, previewEmote],
  );
  const careTwinPreviewTrack = previewMotion.spriteAction
    ? CARE_TWIN_SPRITE_MANIFEST[previewMotion.spriteAction]
    : null;
  const careTwinPreviewAsset = previewMotion.spriteAction
    ? getCareTwinSpriteAsset(previewMotion.spriteAction)
    : null;
  const previewSpriteTrack =
    templateSpritePreview?.track ?? careTwinPreviewTrack;
  const previewSpriteAsset =
    templateSpritePreview?.asset ?? careTwinPreviewAsset;
  const previewIsSprite = Boolean(previewSpriteTrack && previewSpriteAsset);
  const previewMotionLabel =
    templateSpritePreview?.label ?? previewMotion.label;
  const avatarSummary = describeAvatarConfig(draft);
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const avatarMotion = useMemo(
    () =>
      deriveAvatarMotion({
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        now,
        energy: status.energy,
      }),
    [state.entries, state.routines, state.caregivers, now, status.energy],
  );
  const caregiver = state.caregivers[0]?.name ?? "you";
  const scanTranslate = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250],
  });
  const reticleOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.84],
  });
  const templateLift = templateLife.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  const templateScale = templateLife.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.018],
  });
  const heroSpeech =
    activeTab === "emotes"
      ? previewMood.copy
      : activeTab === "customize"
        ? "Make me yours."
        : "I'm ready!";

  const ensurePermission = async (camera: boolean) => {
    if (Platform.OS === "web") return true;
    const fn = camera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const res = await fn();
    return res.granted;
  };

  const pick = async (camera: boolean) => {
    const ok = await ensurePermission(camera);
    if (!ok) return;

    const res = camera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.86,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.86,
        });

    if (res.canceled || !res.assets?.[0]?.uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSourceUri(res.assets[0].uri);
    setScanLine(0);
    setPhase("working");
    setActiveTab("scan");
  };

  const selectTemplate = (templateId: AvatarTemplateId) => {
    const template = getAvatarTemplate(templateId);
    Haptics.selectionAsync().catch(() => {});
    setDraft((current) =>
      updateConfig(current, {
        templateId,
        earTypeId: template.defaultEarTypeId,
        muzzleTypeId: template.defaultMuzzleTypeId,
        emotePackId: template.recommendedEmotePackId,
      }),
    );
  };

  const setAccessory = (item: AvatarAccessoryOption) => {
    Haptics.selectionAsync().catch(() => {});
    setDraft((current) =>
      updateConfig(current, {
        accessorySlots: { [item.slot]: item.id },
        collarId:
          item.slot === "neck" && item.id.includes("collar")
            ? (item.id as PetAvatarConfig["collarId"])
            : current.collarId,
      }),
    );
  };

  const selectStudioTab = (tab: StudioTab) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveTab(tab);
  };

  const setCoatColor = (swatch: string, primary: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setDraft((current) =>
      updateConfig(
        current,
        primary ? { coatSecondary: swatch } : { coatPrimary: swatch },
      ),
    );
  };

  const setFaceMarking = (marking: AvatarFaceMarkingId) => {
    Haptics.selectionAsync().catch(() => {});
    setDraft((current) => updateConfig(current, { faceMarkingId: marking }));
  };

  const previewMoodState = (emote: AvatarEmoteState) => {
    Haptics.selectionAsync().catch(() => {});
    setPreviewEmote(emote);
  };

  const openAvatarSpriteProductionQa = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: "/care-twin-qa",
      params: { qaSurface: "avatar-sprite-production-review" },
    });
  };

  const saveDraft = async () => {
    await saveAvatarConfig({
      ...draft,
      petName,
      updatedAt: new Date().toISOString(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setSavedToast(`${petName}'s care twin saved`);
    setTimeout(() => setSavedToast(null), 1600);
    setPhase("idle");
  };

  const resetDraft = async () => {
    const clean = createDefaultAvatarConfig(petName);
    setDraft(clean);
    await resetAvatarConfig(petName);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <BoardRouteHeader
          kicker="Pixel Twin"
          title="Avatar Studio"
          subtitle="Choose a pixel twin, then customize."
          back
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          actionIcon="checkmark"
          actionLabel="Save avatar"
          onAction={saveDraft}
          plain
        />

        {phase === "working" ? (
          <BoardCard
            padded={false}
            style={[s.canvasCard, { borderColor: colors.border }]}
          >
            <Image
              source={PIXEL_ROOM_SOURCE}
              style={[StyleSheet.absoluteFill, pixelImageStyle]}
              contentFit="cover"
              transition={220}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(8,26,42,0.44)" },
              ]}
            />
            <Animated.View
              style={[
                s.scanBand,
                { transform: [{ translateY: scanTranslate }] },
              ]}
            >
              <LinearGradient
                colors={["transparent", colors.sage + "55", "#FFF9EF"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.scanLine, { backgroundColor: "#FFF9EF" }]} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[s.reticle, { opacity: reticleOpacity }]}
            >
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
            </Animated.View>
            <View style={s.workingCopy}>
              <View style={[s.softPill, { backgroundColor: colors.amberSoft }]}>
                <Ionicons name="scan-outline" size={12} color={colors.amber} />
                <Text style={[s.softPillText, { color: colors.amber, fontFamily: "Inter_700Bold" }]}>
                  PixelLab template match
                </Text>
              </View>
              {sourceUri ? (
                <View
                  style={[
                    s.sourceProofCard,
                    {
                      backgroundColor: "rgba(255,249,239,0.94)",
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: sourceUri }}
                    style={s.sourceProofImage}
                    contentFit="cover"
                    transition={160}
                  />
                  <View style={s.sourceProofCopy}>
                    <Text
                      style={[
                        s.sourceProofKicker,
                        { color: colors.sage, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      PHOTO REFERENCE
                    </Text>
                    <Text
                      style={[
                        s.sourceProofText,
                        { color: colors.ink, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      Building a pixel twin, not using the photo as the avatar.
                    </Text>
                  </View>
                </View>
              ) : null}
              <Text
                style={[
                  s.workingText,
                  { color: "#FFF9EF", fontFamily: DISPLAY },
                ]}
              >
                {SCAN_LINES[scanLine]}
              </Text>
              <Text
                style={[
                  s.workingHint,
                  {
                    color: "rgba(255,249,239,0.82)",
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                This suggests traits only. You approve the final avatar.
              </Text>
            </View>
          </BoardCard>
        ) : (
          <BoardCard padded={false} style={s.heroPreview}>
            <View style={s.liveRoomStage}>
              {selectedTemplateBase ? (
                <View style={s.templatePreviewStage}>
                  <Image
                    source={PIXEL_ROOM_SOURCE}
                    style={[StyleSheet.absoluteFill, pixelImageStyle]}
                    contentFit="cover"
                    transition={220}
                  />
                  <View
                    style={[
                      s.templateMoodAura,
                      { backgroundColor: previewMood.auraColor },
                    ]}
                    pointerEvents="none"
                  />
                  {!previewIsSprite &&
                  previewAccessoryLayers.some(
                    (layer) => layer.kind === "bed" && layer.source,
                  ) ? (
                    previewAccessoryLayers
                      .filter((layer) => layer.kind === "bed" && layer.source)
                      .map((layer) => (
                        <Image
                          key={layer.id}
                          source={layer.source}
                          style={[s.templateAccessoryLayer, pixelImageStyle]}
                          contentFit="contain"
                          transition={150}
                          pointerEvents="none"
                        />
                      ))
                  ) : !previewIsSprite &&
                    previewAccessories.some((layer) => layer.kind === "bed") ? (
                    <View
                      style={[
                        s.templateAccessoryBed,
                        {
                          backgroundColor:
                            previewAccessories.find(
                              (layer) => layer.kind === "bed",
                            )?.tone ?? colors.stone,
                        },
                      ]}
                      pointerEvents="none"
                    />
                  ) : null}
                  <LinearGradient
                    colors={["rgba(255,249,239,0.08)", "rgba(8,26,42,0.16)"]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={s.templatePixelFloor} pointerEvents="none" />
                  <View style={s.templatePixelLines} pointerEvents="none" />
                  <Animated.View
                    style={[
                      s.templateHeroDogWrap,
                      {
                        transform: [
                          { translateY: templateLift },
                          { scale: templateScale },
                        ],
                      },
                    ]}
                  >
                    {previewIsSprite && previewSpriteTrack ? (
                      <View
                        testID="avatar-studio-pixel-sprite-viewport"
                        style={[
                          s.templateSpriteViewport,
                          {
                            backgroundColor: "rgba(247,242,232,0.12)",
                            borderColor: colors.forest,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.templateSpriteGround,
                            {
                              backgroundColor: colors.sage,
                              borderColor: colors.forest,
                            },
                          ]}
                          pointerEvents="none"
                        />
                        <SpriteSheetPlayer
                          asset={previewSpriteAsset}
                          track={previewSpriteTrack}
                          width={HERO_TEMPLATE_SPRITE_SIZE}
                          height={HERO_TEMPLATE_SPRITE_SIZE}
                          style={s.templateHeroSprite}
                          testID="avatar-studio-live-sprite-preview"
                        />
                      </View>
                    ) : (
                      <>
                        <Image
                          source={selectedTemplateStillSource}
                          style={[s.templateHeroDog, pixelImageStyle]}
                          contentFit="contain"
                          transition={180}
                        />
                        {previewAccessoryLayers.map((layer) => {
                          if (layer.kind !== "bed" && layer.source) {
                            return (
                              <Image
                                key={layer.id}
                                source={layer.source}
                                style={[
                                  s.templateAccessoryLayer,
                                  pixelImageStyle,
                                ]}
                                contentFit="contain"
                                transition={150}
                                pointerEvents="none"
                              />
                            );
                          }
                          switch (layer.kind) {
                            case "bandana":
                              return (
                                <View
                                  key={layer.id}
                                  style={[
                                    s.templateBandana,
                                    { backgroundColor: layer.tone },
                                  ]}
                                  pointerEvents="none"
                                />
                              );
                            case "collar":
                              return (
                                <View
                                  key={layer.id}
                                  style={[
                                    s.templateCollar,
                                    { borderColor: layer.tone },
                                  ]}
                                  pointerEvents="none"
                                />
                              );
                            case "hat":
                              return (
                                <View
                                  key={layer.id}
                                  style={[
                                    s.templateHatWrap,
                                    { borderBottomColor: layer.tone },
                                  ]}
                                  pointerEvents="none"
                                >
                                  <View
                                    style={[
                                      s.templateHatPom,
                                      { backgroundColor: layer.tone },
                                    ]}
                                  />
                                </View>
                              );
                            case "mask":
                              return (
                                <View
                                  key={layer.id}
                                  style={[
                                    s.templateMask,
                                    { backgroundColor: layer.tone },
                                  ]}
                                  pointerEvents="none"
                                />
                              );
                            case "vest":
                              return (
                                <View
                                  key={layer.id}
                                  style={[
                                    s.templateVest,
                                    { backgroundColor: layer.tone },
                                  ]}
                                  pointerEvents="none"
                                />
                              );
                            case "sparkles":
                              return (
                                <View
                                  key={layer.id}
                                  style={s.templateSparkleCluster}
                                  pointerEvents="none"
                                >
                                  <View
                                    style={[
                                      s.templateSparkle,
                                      s.templateSparkleOne,
                                      { backgroundColor: layer.tone },
                                    ]}
                                  />
                                  <View
                                    style={[
                                      s.templateSparkle,
                                      s.templateSparkleTwo,
                                      { backgroundColor: layer.tone },
                                    ]}
                                  />
                                  <View
                                    style={[
                                      s.templateSparkle,
                                      s.templateSparkleThree,
                                      { backgroundColor: layer.tone },
                                    ]}
                                  />
                                </View>
                              );
                            default:
                              return null;
                          }
                        })}
                      </>
                    )}
                  </Animated.View>
                  <View
                    style={[
                      s.templateSpeech,
                      {
                        backgroundColor: colors.ivory,
                        borderColor: colors.forest,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.templateSpeechText,
                        { color: colors.forest, fontFamily: DISPLAY },
                      ]}
                    >
                      {heroSpeech}
                    </Text>
                  </View>
                </View>
              ) : (
                <LivingPhoenixRoom
                  mood={avatarMotion.avatarMood}
                  motion={avatarMotion}
                  speech={
                    activeTab === "emotes"
                      ? "Try my moods."
                      : activeTab === "customize"
                        ? "Make me Phoenix."
                        : "I'm ready."
                  }
                  energy={status.energy}
                  presenceLabel={`${petName} with ${caregiver}`}
                  nextLabel={
                    activeTab === "scan"
                      ? "Scan or choose a template"
                      : selectedTemplate.label
                  }
                  avatarConfig={draft}
                />
              )}
            </View>
            <LinearGradient
              colors={["transparent", "rgba(8,26,42,0.84)"]}
              style={s.savedScrim}
              pointerEvents="none"
            />
            <View style={s.heroCopy}>
              <View
                style={[
                  s.softPill,
                  { backgroundColor: draft.scanAssisted ? colors.sageSoft : colors.amberSoft },
                ]}
              >
                <Ionicons
                  name={draft.scanAssisted ? "scan-outline" : "color-palette-outline"}
                  size={12}
                  color={draft.scanAssisted ? colors.forest : colors.amber}
                />
                <Text
                  style={[
                    s.softPillText,
                    {
                      color: draft.scanAssisted ? colors.forest : colors.amber,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {draft.scanAssisted ? "Scan-assisted" : "Template-built"}
                </Text>
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[s.savedName, { fontFamily: DISPLAY }]}>
                {petName}'s Pixel Twin
              </Text>
              <Text numberOfLines={1} style={[s.savedSub, { fontFamily: "Inter_600SemiBold" }]}>
                {previewIsSprite ? "Live PixelLab sprite rig." : "Still preview until a live animation pack exists."}
              </Text>
            </View>
          </BoardCard>
        )}

        <View style={s.tabRow}>
          {[
            ["scan", "Scan"],
            ["template", "Template"],
            ["customize", "Customize"],
            ["emotes", "Emotes"],
          ].map(([key, label]) => {
            const active = activeTab === key;
            return (
              <PressScale
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Avatar Studio ${label}`}
                hitSlop={MOBILE_INLINE_HIT_SLOP}
                onPress={() => selectStudioTab(key as StudioTab)}
                haptic="none"
                containerStyle={s.tabLayout}
                style={[
                  s.tab,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.tabText,
                    {
                      color: active ? colors.primaryForeground : colors.foreground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {label}
                </Text>
              </PressScale>
            );
          })}
        </View>

        {phase === "result" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader
              title="Generated mood set"
              accessory={<BoardPill label="Owner review" tone={colors.amber} />}
            />
            <Text
              style={[
                s.copy,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              Set your photo side by side and pick the base that best matches
              your dog. These are starting cues to compare against, not an
              automatic detection.
            </Text>
            <View style={s.traitGrid}>
              {scanSuggestion.detectedTraits.map((trait) => (
                <View
                  key={trait}
                  style={[
                    s.traitChip,
                    {
                      backgroundColor: colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={colors.sage}
                  />
                  <Text
                    style={[
                      s.traitText,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {trait}
                  </Text>
                </View>
              ))}
            </View>
          </BoardCard>
        ) : null}

        {activeTab === "scan" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader
              title="Bring your dog in"
              accessory={
                <BoardPill
                  label={hasConfiguredAvatar ? "Configured" : "Start"}
                  tone={colors.sage}
                />
              }
            />
            <Text
              style={[
                s.copy,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              Add 1-3 clear photos. WoofWatcher will suggest a base template and
              traits, then you can edit every choice before saving.
            </Text>
            <View style={s.scanTruthRail}>
              <View style={[s.softPill, { backgroundColor: colors.sageSoft }]}>
                <Ionicons name="sparkles-outline" size={12} color={colors.forest} />
                <Text style={[s.softPillText, { color: colors.forest, fontFamily: "Inter_700Bold" }]}>
                  PixelLab-backed template catalog
                </Text>
              </View>
              <View style={[s.softPill, { backgroundColor: colors.amberSoft }]}>
                <Ionicons name="shield-checkmark-outline" size={12} color={colors.amber} />
                <Text style={[s.softPillText, { color: colors.amber, fontFamily: "Inter_700Bold" }]}>
                  Not a photo filter
                </Text>
              </View>
            </View>
            <View
              accessibilityLabel={SCAN_WORKFLOW_ACCESSIBILITY_SUMMARY}
              style={s.scanPipelineGrid}
            >
              {AVATAR_SCAN_WORKFLOW_STEPS.map((step, index) => (
                <View
                  key={step.id}
                  style={[
                    s.scanPipelineCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.scanPipelineNumber,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        s.scanPipelineNumberText,
                        { color: colors.primaryForeground, fontFamily: "Inter_800ExtraBold" },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.scanPipelineLabel,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_800ExtraBold",
                      },
                    ]}
                  >
                    {step.label}
                  </Text>
                  <Text
                    style={[
                      s.scanPipelineDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {step.detail}
                  </Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose dog photo from gallery"
                onPress={() => pick(false)}
                style={({ pressed }) => [
                  s.secondaryBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Ionicons
                  name="images-outline"
                  size={18}
                  color={colors.foreground}
                />
                <Text
                  style={[
                    s.secondaryBtnText,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Gallery
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take dog photo"
                onPress={() => pick(true)}
                style={({ pressed }) => [
                  s.primaryBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons name="camera" size={18} color="#FFF9EF" />
                <Text
                  style={[s.primaryBtnText, { fontFamily: "Inter_700Bold" }]}
                >
                  Take photo
                </Text>
              </Pressable>
            </View>
          </BoardCard>
        ) : null}

        {activeTab === "template" ? (
          <>
            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Choose base template"
                accessory={
                  <BoardPill
                    label={`${liveTemplateCount}/${AVATAR_TEMPLATES.length} live`}
                    tone={colors.primary}
                  />
                }
              />
              <View style={s.templateGrid}>
                {AVATAR_TEMPLATES.map((template) => {
                  const active = draft.templateId === template.id;
                  const tone = templateColor(template.id);
                  const liveSprite = hasAvatarTemplateSpritePack(template.id);
                  return (
                    <PressScale
                      key={template.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Choose ${template.label} avatar template`}
                      onPress={() => selectTemplate(template.id)}
                      haptic="none"
                      scaleTo={0.97}
                      containerStyle={s.templateTileLayout}
                      style={[
                        s.templateTile,
                        {
                          backgroundColor: active
                            ? tone + "20"
                            : colors.background,
                          borderColor: active ? tone : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.templateArtWrap,
                          {
                            backgroundColor: active
                              ? colors.ivory
                              : tone + "12",
                            borderColor: active ? tone : colors.border,
                          },
                        ]}
                      >
                        <Image
                          source={getAvatarTemplateDisplaySource(template.id)}
                          style={[s.templateArt, pixelImageStyle]}
                          contentFit="contain"
                          transition={140}
                        />
                        <View
                          style={[
                            s.templateLiveBadge,
                            {
                              backgroundColor: liveSprite
                                ? colors.primary
                                : colors.ivory,
                              borderColor: liveSprite
                                ? colors.primary
                                : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.templateLiveBadgeText,
                              {
                                color: liveSprite
                                  ? colors.primaryForeground
                                  : colors.mutedForeground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            {liveSprite ? "Live" : "Still"}
                          </Text>
                        </View>
                        {active ? (
                          <View
                            style={[s.templateCheck, { backgroundColor: tone }]}
                          >
                            <Ionicons
                              name="checkmark"
                              size={13}
                              color="#FFF9EF"
                            />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          s.templateTitle,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {template.label}
                      </Text>
                      <Text
                        style={[
                          s.templateSub,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {template.subtitle}
                      </Text>
                      <Text
                        style={[
                          s.templateSpriteNote,
                          {
                            color: liveSprite ? tone : colors.mutedForeground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {liveSprite
                          ? "Breathes and walks in preview"
                          : "Sprite rig in production"}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </BoardCard>

            {ownerOps ? (
            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Sprite production review"
                accessory={
                  <BoardPill
                    label={productionTemplateReview.proofStatusLabel}
                    tone={colors.sage}
                  />
                }
              />
              <View
                accessibilityLabel={`Avatar sprite production review for ${selectedTemplate.label}`}
                style={[
                  s.productionReviewPanel,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.productionHeadline,
                    { color: colors.foreground, fontFamily: DISPLAY },
                  ]}
                >
                  {productionTemplateReview.headline}
                </Text>
                <Text
                  style={[
                    s.productionCopy,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {productionTemplateReview.template.nativeReviewPrompt}
                </Text>
                <View style={s.productionMetricGrid}>
                  <View
                    style={[
                      s.productionMetricCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.productionMetricValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {avatarSpriteProductionSummary.liveTemplatePacks}/
                      {avatarSpriteProductionSummary.totalTemplates}
                    </Text>
                    <Text
                      style={[
                        s.productionMetricKicker,
                        {
                          color: colors.sage,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      LIVE TEMPLATES
                    </Text>
                  </View>
                  <View
                    style={[
                      s.productionMetricCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.productionMetricValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {avatarSpriteProductionSummary.totalSpriteSlots}
                    </Text>
                    <Text
                      style={[
                        s.productionMetricKicker,
                        {
                          color: colors.sage,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      SPRITE SLOTS
                    </Text>
                  </View>
                  <View
                    style={[
                      s.productionMetricCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.productionMetricValue,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {productionTemplateReview.template.bodyClass}
                    </Text>
                    <Text
                      style={[
                        s.productionMetricKicker,
                        {
                          color: colors.sage,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      BODY CLASS
                    </Text>
                  </View>
                </View>
              </View>

              <View style={s.productionActionList}>
                {productionTemplateReview.template.actions.map((action) => (
                  <View
                    key={action.action}
                    style={[
                      s.productionActionRow,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.productionActionIcon,
                        { backgroundColor: colors.ivory },
                      ]}
                    >
                      <Ionicons
                        name={
                          action.action === "walk-loop"
                            ? "walk-outline"
                            : "pulse-outline"
                        }
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={s.productionActionCopy}>
                      <Text
                        style={[
                          s.productionActionTitle,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_800ExtraBold",
                          },
                        ]}
                      >
                        {action.label}
                      </Text>
                      <Text
                        style={[
                          s.productionActionMeta,
                          {
                            color: colors.sage,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {action.frameCount} frames | {action.fps} fps |{" "}
                        {action.anchor}
                      </Text>
                      <Text
                        style={[
                          s.productionActionNotes,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {action.notes}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={s.productionCheckList}>
                <Text
                  style={[
                    s.productionCheckTitle,
                    {
                      color: colors.sage,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  Game-feel checks
                </Text>
                {productionTemplateReview.gameFeelChecks.map((check) => (
                  <View key={check} style={s.productionCheckRow}>
                    <Ionicons
                      name="scan-circle-outline"
                      size={17}
                      color={colors.sage}
                    />
                    <Text
                      style={[
                        s.productionCheckText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {check}
                    </Text>
                  </View>
                ))}
              </View>

              <Text
                style={[
                  s.productionBoundary,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {productionTemplateReview.nativeProofStatus}
              </Text>
              {ownerOps ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Avatar sprite production QA cockpit"
                  accessibilityHint="Opens the focused native QA checklist for sprite gait and phone crop review."
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={openAvatarSpriteProductionQa}
                  style={({ pressed }) => [
                    s.productionQaButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.78 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.productionQaButtonText,
                      { color: colors.primaryForeground, fontFamily: "Inter_800ExtraBold" },
                    ]}
                  >
                    Open sprite QA cockpit
                  </Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.primaryForeground} />
                </Pressable>
              ) : null}
            </BoardCard>
            ) : null}
          </>
        ) : null}

        {activeTab === "customize" ? (
          <View>
            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Coat colors"
                accessory={<BoardPill label="Editable" tone={colors.sage} />}
              />
              <View style={s.swatchGrid}>
                {COAT_SWATCHES.map((swatch) => {
                  const primary = draft.coatPrimary === swatch;
                  const secondary = draft.coatSecondary === swatch;
                  return (
                    <PressScale
                      key={swatch}
                      accessibilityRole="button"
                      accessibilityState={{ selected: primary || secondary }}
                      accessibilityLabel={`Set coat color ${swatch}`}
                      accessibilityHint={
                        primary
                          ? "Double tap to set this as the secondary coat color."
                          : "Double tap to set this as the primary coat color."
                      }
                      hitSlop={MOBILE_INLINE_HIT_SLOP}
                      onPress={() => setCoatColor(swatch, primary)}
                      haptic="none"
                      scaleTo={0.92}
                      style={[
                        s.swatch,
                        {
                          backgroundColor: swatch,
                          borderColor: primary
                            ? colors.forest
                            : secondary
                              ? colors.amber
                              : colors.border,
                          borderWidth: primary || secondary ? 3 : 1,
                        },
                      ]}
                    >
                      <View />
                    </PressScale>
                  );
                })}
              </View>
              <Text
                style={[
                  s.swatchLegend,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                Tap a swatch to set the primary coat, then tap it again to set
                the secondary.
              </Text>
            </BoardCard>

            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Face markings"
                accessory={
                  <BoardPill label={faceMarkingLabel} tone={colors.amber} />
                }
              />
              <View style={s.optionGrid}>
                {FACE_MARKINGS.map((marking) => {
                  const active = draft.faceMarkingId === marking.id;
                  return (
                    <PressScale
                      key={marking.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Set ${marking.label} face marking`}
                      accessibilityHint="Double tap to apply this marking to the pixel twin."
                      hitSlop={MOBILE_INLINE_HIT_SLOP}
                      onPress={() => setFaceMarking(marking.id)}
                      haptic="none"
                      style={[
                        s.optionPill,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.background,
                          borderColor: active
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.optionText,
                          {
                            color: active ? colors.primaryForeground : colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {marking.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </BoardCard>

            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Accessories"
                accessory={<BoardPill label="Fit map" tone={colors.amber} />}
              />
              <View
                style={[
                  s.accessoryFitPanel,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.accessoryFitTitle,
                    {
                      color: colors.sage,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  Template overlay readiness
                </Text>
                <Text
                  style={[
                    s.accessoryFitSummary,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {accessoryFitSummary}
                </Text>
              </View>
              <View style={s.accessoryGrid}>
                {AVATAR_ACCESSORIES.map((item) => {
                  const active = Object.values(draft.accessorySlots).includes(
                    item.id,
                  );
                  const fit = deriveAvatarAccessoryFit(draft.templateId, item);
                  return (
                    <PressScale
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Set ${item.label} ${item.slot} accessory`}
                      onPress={() => setAccessory(item)}
                      haptic="none"
                      scaleTo={0.97}
                      containerStyle={s.accessoryTileLayout}
                      style={[
                        s.accessoryTile,
                        {
                          backgroundColor: active
                            ? item.tone + "20"
                            : colors.background,
                          borderColor: active ? item.tone : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[s.accessoryDot, { backgroundColor: item.tone }]}
                      />
                      <Text
                        style={[
                          s.accessoryLabel,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          s.accessorySlot,
                          {
                            color: colors.sage,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {item.slot}
                      </Text>
                      <Text
                        style={[
                          s.accessoryFitLabel,
                          {
                            color:
                              fit.status === "template-fitted"
                                ? colors.sage
                                : colors.amber,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {fit.label}
                      </Text>
                      <Text
                        style={[
                          s.accessoryFitHint,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {fit.placementHint}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </BoardCard>
          </View>
        ) : null}

        {activeTab === "emotes" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader
              title="Mood set"
              accessory={
                <BoardPill
                  label={
                    draft.emotePackId === "phoenix-shepherd"
                      ? "Phoenix pack"
                      : "Starter"
                  }
                  tone={colors.primary}
                />
              }
            />
            <View style={s.moodGrid}>
              {AVATAR_EMOTE_STATES.map((emote) => {
                const active = previewEmote === emote;
                const moodPreview = deriveAvatarPreviewMood(emote);
                const moodStill = getAvatarTemplateEmoteSource(
                  draft.templateId,
                  emote,
                );
                return (
                  <PressScale
                    key={emote}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Preview ${emoteLabel(emote)} mood`}
                    accessibilityHint="Double tap to update the live care-twin preview mood."
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    onPress={() => previewMoodState(emote)}
                    haptic="none"
                    scaleTo={0.94}
                    containerStyle={s.moodChip}
                    style={s.moodChipInner}
                  >
                    <View
                      style={[
                        s.moodThumbWrap,
                        {
                          borderColor: active
                            ? moodPreview.chipColor
                            : colors.border,
                          backgroundColor: active
                            ? moodPreview.auraColor
                            : colors.card,
                        },
                      ]}
                    >
                      <Image
                        source={moodStill ?? PIXEL_HEAD_SOURCE}
                        style={[s.moodThumb, pixelImageStyle]}
                        contentFit="contain"
                        transition={150}
                      />
                      <View
                        pointerEvents="none"
                        style={[
                          s.moodWash,
                          {
                            opacity: moodStill ? 0.24 : 1,
                            backgroundColor:
                              emote === "not_feeling_well"
                                ? "rgba(201,99,88,0.22)"
                                : emote === "anxious" || emote === "home_alone"
                                  ? "rgba(168,203,232,0.22)"
                                  : emote === "sleepy" || emote === "calm"
                                    ? "rgba(109,163,111,0.18)"
                                    : "rgba(216,168,82,0.12)",
                          },
                        ]}
                      />
                      <View
                        style={[s.emoteIcon, { backgroundColor: colors.ivory }]}
                      >
                        <PixelIcon name={EMOTE_ICON[emote]} size={18} />
                      </View>
                    </View>
                    <Text
                      style={[
                        s.moodChipLabel,
                        {
                          color: active
                            ? colors.brandNavy
                            : colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {emoteLabel(emote)}
                    </Text>
                  </PressScale>
                );
              })}
            </View>
          </BoardCard>
        ) : null}

        <View style={s.actionRow}>
          <Pressable
            onPress={resetDraft}
            accessibilityRole="button"
            accessibilityLabel="Reset Avatar Studio draft"
            accessibilityHint="Restores the default pixel twin before saving."
            hitSlop={MOBILE_INLINE_HIT_SLOP}
            style={({ pressed }) => [
              s.secondaryBtn,
              { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={18} color={colors.foreground} />
            <Text
              style={[
                s.secondaryBtnText,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Reset
            </Text>
          </Pressable>
          <Pressable
            onPress={saveDraft}
            accessibilityRole="button"
            accessibilityLabel="Save Avatar Studio draft"
            accessibilityHint="Saves the current pixel twin configuration locally."
            hitSlop={MOBILE_INLINE_HIT_SLOP}
            style={({ pressed }) => [
              s.primaryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Ionicons name="heart" size={18} color="#FFF9EF" />
            <Text style={[s.primaryBtnText, { fontFamily: "Inter_700Bold" }]}>
              Save Avatar
            </Text>
          </Pressable>
        </View>

        {hasCustomAvatar ? (
          <BoardCard style={s.tipBoard} tone="soft">
            <Text
              style={[
                s.tipText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Your uploaded mood images still work. The new template config
              gives those images a real editable identity layer.
            </Text>
          </BoardCard>
        ) : (
          <BoardCard style={s.tipBoard} tone="soft">
            <Text
              style={[
                s.tipText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Provider scanning can plug in later. This version ships the
              reliable PixelLab template matcher, character creator, and
              emote-preview system first.
            </Text>
          </BoardCard>
        )}
      </ScrollView>

      {savedToast ? (
        <View
          style={[
            s.toast,
            { backgroundColor: colors.primary, bottom: insets.bottom + 22 },
          ]}
        >
          <Text
            style={[
              s.toastText,
              { color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {savedToast}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  canvasCard: {
    height: 360,
    overflow: "hidden",
    marginBottom: 16,
  },
  scanBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 74,
  },
  scanLine: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 3,
    borderRadius: 3,
  },
  reticle: {
    ...StyleSheet.absoluteFillObject,
    margin: 20,
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#FFF9EF",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  workingCopy: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    gap: 8,
  },
  sourceProofCard: {
    minHeight: 70,
    borderRadius: 4,
    borderWidth: 2,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#081424",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sourceProofImage: {
    width: 52,
    height: 52,
    borderRadius: 3,
  },
  sourceProofCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sourceProofKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  /* Mock-board soft pills: sageSoft/amberSoft chips with forest/amber text. */
  softPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    minHeight: 28,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  softPillText: {
    fontSize: 11,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  sourceProofText: {
    fontSize: 12,
    lineHeight: 16,
  },
  workingText: { fontSize: 25, lineHeight: 30 },
  workingHint: { fontSize: 13, lineHeight: 18 },
  heroPreview: {
    overflow: "hidden",
    aspectRatio: 0.96,
    marginBottom: 10,
    backgroundColor: "#081424",
    position: "relative",
  },
  liveRoomStage: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  templatePreviewStage: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#EDE7DC",
  },
  templatePixelFloor: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 68,
    height: 44,
    borderRadius: 2,
    backgroundColor: "rgba(109,163,111,0.22)",
    borderWidth: 2,
    borderColor: "rgba(8,20,36,0.18)",
    transform: [{ scaleX: 1.08 }, { skewX: "-8deg" }],
  },
  templatePixelLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    borderWidth: 2,
    borderColor: "#081424",
    margin: 10,
  },
  templateHeroDogWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 58,
    height: "76%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  templateHeroDog: {
    width: "100%",
    height: "100%",
  },
  templateSpriteViewport: {
    width: 272,
    height: 272,
    borderRadius: 3,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    position: "relative",
  },
  templateSpriteGround: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 15,
    height: 26,
    borderRadius: 2,
    borderWidth: 2,
    opacity: 0.28,
    transform: [{ skewX: "-8deg" }],
  },
  templateHeroSprite: {
    marginBottom: 7,
  },
  templateAccessoryLayer: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  templateMoodAura: {
    position: "absolute",
    left: 40,
    right: 40,
    top: 24,
    bottom: 56,
    borderRadius: 120,
  },
  templateAccessoryBed: {
    position: "absolute",
    bottom: 28,
    left: "50%",
    marginLeft: -62,
    width: 124,
    height: 28,
    borderRadius: 18,
    opacity: 0.48,
  },
  templateBandana: {
    position: "absolute",
    top: 88,
    width: 48,
    height: 18,
    borderRadius: 10,
    opacity: 0.94,
  },
  templateCollar: {
    position: "absolute",
    top: 90,
    width: 44,
    height: 14,
    borderRadius: 9,
    borderWidth: 3,
    backgroundColor: "rgba(255,249,239,0.72)",
  },
  templateHatWrap: {
    position: "absolute",
    top: 2,
    left: "50%",
    marginLeft: -18,
    width: 0,
    height: 0,
    borderLeftWidth: 18,
    borderRightWidth: 18,
    borderBottomWidth: 28,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    transform: [{ rotate: "-6deg" }],
  },
  templateHatPom: {
    position: "absolute",
    top: -8,
    left: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  templateMask: {
    position: "absolute",
    top: 60,
    width: 56,
    height: 16,
    borderRadius: 10,
    opacity: 0.82,
  },
  templateVest: {
    position: "absolute",
    top: 98,
    width: 58,
    height: 38,
    borderRadius: 16,
    opacity: 0.76,
  },
  templateSparkleCluster: {
    position: "absolute",
    top: 40,
    right: 12,
    width: 42,
    height: 38,
  },
  templateSparkle: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    opacity: 0.92,
  },
  templateSparkleOne: { top: 4, right: 5 },
  templateSparkleTwo: { top: 14, left: 4 },
  templateSparkleThree: { bottom: 2, right: 14 },
  templateSpeech: {
    position: "absolute",
    left: 24,
    top: 24,
    maxWidth: "52%",
    borderRadius: 6,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  templateSpeechText: { fontSize: 15, lineHeight: 19 },
  templateHeroHud: {
    position: "absolute",
    right: 12,
    bottom: 44,
    minWidth: 96,
    maxWidth: 142,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  templateHeroKicker: {
    fontSize: 8.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  templateHeroTitle: { fontSize: 17, lineHeight: 20 },
  templateHeroMood: { fontSize: 10, lineHeight: 13 },
  templateHeroFit: { fontSize: 8.8, lineHeight: 11, maxWidth: 126 },
  savedScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "24%",
  },
  heroCopy: {
    position: "absolute",
    left: 14,
    width: "64%",
    bottom: 10,
    gap: 3,
  },
  savedName: { color: "#FFF9EF", fontSize: 17.5, lineHeight: 20 },
  savedSub: { color: "rgba(255,249,239,0.82)", fontSize: 9.4, lineHeight: 12 },
  tabRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
  },
  tabLayout: { flex: 1 },
  tab: {
    width: "100%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 11.5 },
  avatarBoard: { marginBottom: 10 },
  copy: { fontSize: 13, lineHeight: 19 },
  scanTruthRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  scanPipelineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  scanPipelineCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 92,
    borderRadius: 8,
    borderWidth: 1,
    padding: 9,
    gap: 4,
  },
  scanPipelineNumber: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  scanPipelineNumberText: { fontSize: 11 },
  scanPipelineLabel: { fontSize: 12 },
  scanPipelineDetail: { fontSize: 10.8, lineHeight: 14 },
  traitGrid: { gap: 8, marginTop: 12 },
  traitChip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  traitText: { fontSize: 12.5, flex: 1 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 12 },
  secondaryBtn: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: { fontSize: 14 },
  primaryBtn: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { color: "#FFF9EF", fontSize: 14 },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  templateTileLayout: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  templateTile: {
    width: "100%",
    minHeight: Math.max(178, MIN_MOBILE_TOUCH_TARGET),
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 7,
  },
  templateArtWrap: {
    width: "100%",
    aspectRatio: 1.26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  templateArt: {
    width: "92%",
    height: "92%",
  },
  templateCheck: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 23,
    height: 23,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF9EF",
  },
  templateLiveBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    minHeight: 22,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  templateLiveBadgeText: {
    fontSize: 9,
    textTransform: "uppercase",
  },
  templateTitle: { fontSize: 13.5 },
  templateSub: { fontSize: 11.5, lineHeight: 16 },
  templateSpriteNote: { fontSize: 10.5, lineHeight: 14, marginTop: "auto" },
  productionReviewPanel: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  productionHeadline: { fontSize: 19, lineHeight: 23 },
  productionCopy: { fontSize: 12.5, lineHeight: 18 },
  productionMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  productionMetricCard: {
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
    justifyContent: "center",
  },
  productionMetricValue: { fontSize: 17, lineHeight: 20 },
  productionMetricKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  productionActionList: { gap: 8, marginTop: 12 },
  productionActionRow: {
    minHeight: Math.max(92, MIN_MOBILE_TOUCH_TARGET),
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    gap: 10,
  },
  productionActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  productionActionCopy: { flex: 1, minWidth: 0, gap: 3 },
  productionActionTitle: { fontSize: 12.5 },
  productionActionMeta: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  productionActionNotes: { fontSize: 11.5, lineHeight: 16 },
  productionCheckList: { gap: 8, marginTop: 12 },
  productionCheckTitle: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  productionCheckRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  productionCheckText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  productionBoundary: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 12,
  },
  productionQaButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  productionQaButtonText: {
    fontSize: 13,
  },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  swatchLegend: { fontSize: 11.5, lineHeight: 15, marginTop: 8 },
  swatch: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
  },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { fontSize: 12 },
  accessoryFitPanel: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  accessoryFitTitle: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  accessoryFitSummary: { fontSize: 12, lineHeight: 17 },
  accessoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  accessoryTileLayout: {
    flexBasis: "47.5%",
    flexGrow: 1,
  },
  accessoryTile: {
    width: "100%",
    minHeight: Math.max(126, MIN_MOBILE_TOUCH_TARGET),
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    justifyContent: "flex-start",
    gap: 5,
  },
  accessoryDot: { width: 18, height: 18, borderRadius: 5 },
  accessoryLabel: { fontSize: 12.5 },
  accessorySlot: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  accessoryFitLabel: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  accessoryFitHint: { fontSize: 10.5, lineHeight: 14 },
  moodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  moodChip: {
    width: "30.9%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  moodChipInner: {
    width: "100%",
    alignItems: "center",
  },
  moodThumbWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 6,
    position: "relative",
  },
  moodThumb: { width: "100%", height: "100%" },
  moodWash: {
    ...StyleSheet.absoluteFillObject,
  },
  emoteIcon: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  moodChipLabel: { fontSize: 10.5, textAlign: "center" },
  tipBoard: { marginTop: 2 },
  tipText: { fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { fontSize: 13 },
});
