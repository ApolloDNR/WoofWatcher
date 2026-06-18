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
import { LivingPhoenixRoom } from "@/components/LivingPhoenixRoom";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { deriveAvatarMotion } from "@/lib/avatarMotion";
import {
  AVATAR_ACCESSORIES,
  AVATAR_EMOTE_STATES,
  AVATAR_TEMPLATES,
  buildMockScanSuggestion,
  createDefaultAvatarConfig,
  describeAvatarConfig,
  getAvatarTemplate,
  type AvatarAccessoryOption,
  type AvatarEmoteState,
  type AvatarFaceMarkingId,
  type AvatarTemplateId,
  type PetAvatarConfig,
} from "@/lib/avatarStudio";
import { getAvatarTemplatePreviewSource } from "@/lib/avatarTemplateAssets";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";

const DISPLAY = "Fredoka_700Bold";
const PIXEL_ROOM_SOURCE = require("@/assets/avatar/rooms/phoenix-room-day.png");
const PIXEL_HEAD_SOURCE = require("@/assets/avatar/phoenix/approved/phoenix-main-head-v2.png");

type Phase = "idle" | "working" | "result";
type StudioTab = "scan" | "template" | "customize" | "emotes";

const SCAN_LINES = [
  "Reading body shape...",
  "Finding coat colors...",
  "Checking ears and muzzle...",
  "Matching a pixel template...",
  "Preparing owner review...",
];

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

function updateConfig(config: PetAvatarConfig, patch: Partial<PetAvatarConfig>): PetAvatarConfig {
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
    mixed: "#081424",
  };
  return palette[templateId];
}

export default function PortraitScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const {
    avatarConfig,
    hasCustomAvatar,
    hasConfiguredAvatar,
    saveAvatarConfig,
    resetAvatarConfig,
  } = useAvatar();

  const petName = state.profile.name && state.profile.name !== "My Dog" ? state.profile.name : "Phoenix";
  const topInset = Platform.OS === "web" ? 20 : insets.top;

  const [phase, setPhase] = useState<Phase>("idle");
  const [activeTab, setActiveTab] = useState<StudioTab>("scan");
  const [draft, setDraft] = useState<PetAvatarConfig>(() => avatarConfig);
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [scanLine, setScanLine] = useState(0);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const scanSuggestion = useMemo(() => buildMockScanSuggestion(petName), [petName]);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

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
    const lineTimer = setInterval(() => setScanLine((idx) => (idx + 1) % SCAN_LINES.length), 900);
    const finishTimer = setTimeout(() => {
      setDraft(scanSuggestion.suggestedConfig);
      setPhase("result");
      setActiveTab("template");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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

  const selectedTemplate = getAvatarTemplate(draft.templateId);
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
  const caregiver = state.caregivers[0]?.name ?? "Emma";
  const scanTranslate = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 250] });
  const reticleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.84] });

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
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.86 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.86 });

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
        collarId: item.slot === "neck" && item.id.includes("collar") ? (item.id as PetAvatarConfig["collarId"]) : current.collarId,
      }),
    );
  };

  const saveDraft = async () => {
    await saveAvatarConfig({ ...draft, petName, updatedAt: new Date().toISOString() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 72, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <BoardRouteHeader
          kicker="Avatar Studio"
          title="Create the care twin"
          subtitle="Upload photos to help us suggest your dog's pixel care twin, then approve and customize it."
          back
          onBack={() => router.back()}
          actionIcon="checkmark"
          actionLabel="Save avatar"
          onAction={saveDraft}
          plain
        />

        {phase === "working" ? (
          <BoardCard padded={false} style={[s.canvasCard, { borderColor: colors.border }]}>
            {sourceUri ? (
              <Image source={{ uri: sourceUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
            ) : (
              <Image source={PIXEL_ROOM_SOURCE} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,26,42,0.44)" }]} />
            <Animated.View style={[s.scanBand, { transform: [{ translateY: scanTranslate }] }]}>
              <LinearGradient
                colors={["transparent", colors.sage + "55", "#FFF9EF"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.scanLine, { backgroundColor: "#FFF9EF" }]} />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[s.reticle, { opacity: reticleOpacity }]}>
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
            </Animated.View>
            <View style={s.workingCopy}>
              <BoardPill label="Scan assist mock" icon="scan-outline" tone={colors.amber} active />
              <Text style={[s.workingText, { color: "#FFF9EF", fontFamily: DISPLAY }]}>{SCAN_LINES[scanLine]}</Text>
              <Text style={[s.workingHint, { color: "rgba(255,249,239,0.82)", fontFamily: "Inter_600SemiBold" }]}>
                This suggests traits only. You approve the final avatar.
              </Text>
            </View>
          </BoardCard>
        ) : (
          <BoardCard padded={false} style={s.heroPreview}>
            <View style={s.liveRoomStage}>
              <LivingPhoenixRoom
                mood={avatarMotion.avatarMood}
                motion={avatarMotion}
                speech={activeTab === "emotes" ? "Try my moods." : activeTab === "customize" ? "Make me Phoenix." : "I'm ready."}
                energy={status.energy}
                presenceLabel={`${petName} with ${caregiver}`}
                nextLabel={activeTab === "scan" ? "Scan or choose a template" : selectedTemplate.label}
              />
            </View>
            <View style={s.pixelFrameOverlay} pointerEvents="none">
              <View style={[s.pixelIdCard, { backgroundColor: "rgba(255,249,239,0.94)", borderColor: colors.navy }]}>
                <Image source={PIXEL_HEAD_SOURCE} style={s.pixelHead} contentFit="cover" transition={160} />
                <View style={s.pixelIdCopy}>
                  <Text style={[s.pixelIdKicker, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>CARE TWIN</Text>
                  <Text style={[s.pixelIdName, { color: colors.navy, fontFamily: DISPLAY }]}>{selectedTemplate.label}</Text>
                  <View style={s.pixelLevelRow}>
                    <View style={[s.pixelLevelPip, { backgroundColor: colors.sage }]} />
                    <View style={[s.pixelLevelPip, { backgroundColor: colors.sage }]} />
                    <View style={[s.pixelLevelPip, { backgroundColor: colors.sage }]} />
                    <View style={[s.pixelLevelPip, { backgroundColor: colors.stone }]} />
                  </View>
                </View>
              </View>
            </View>
            <LinearGradient
              colors={["transparent", "rgba(8,26,42,0.84)"]}
              style={s.savedScrim}
              pointerEvents="none"
            />
            <View style={s.heroCopy}>
              <BoardPill
                label={draft.scanAssisted ? "Scan-assisted" : "Template-built"}
                icon={draft.scanAssisted ? "scan-outline" : "color-palette-outline"}
                tone={draft.scanAssisted ? colors.sage : colors.amber}
                active
              />
              <Text style={[s.savedName, { fontFamily: DISPLAY }]}>{petName}'s Pixel Twin</Text>
              <Text style={[s.savedSub, { fontFamily: "Inter_600SemiBold" }]}>{avatarSummary}</Text>
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
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Avatar Studio ${label}`}
                onPress={() => setActiveTab(key as StudioTab)}
                style={[
                  s.tab,
                  {
                    backgroundColor: active ? colors.brandNavy : colors.card,
                    borderColor: active ? colors.brandNavy : colors.border,
                  },
                ]}
              >
                <Text style={[s.tabText, { color: active ? "#FFF9EF" : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {phase === "result" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader title="Generated mood set" action="Owner review" />
            <Text style={[s.copy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {scanSuggestion.copy}
            </Text>
            <View style={s.traitGrid}>
              {scanSuggestion.detectedTraits.map((trait) => (
                <View key={trait} style={[s.traitChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.sage} />
                  <Text style={[s.traitText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{trait}</Text>
                </View>
              ))}
            </View>
          </BoardCard>
        ) : null}

        {activeTab === "scan" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader title="Bring your dog in" action={hasConfiguredAvatar ? "Configured" : "Start"} />
            <Text style={[s.copy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Add 1-3 clear photos. WoofWatcher will suggest a base template and traits, then you can edit every choice before saving.
            </Text>
            <View style={s.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose dog photo from gallery"
                onPress={() => pick(false)}
                style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
              >
                <Ionicons name="images-outline" size={18} color={colors.foreground} />
                <Text style={[s.secondaryBtnText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Gallery</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take dog photo"
                onPress={() => pick(true)}
                style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
              >
                <Ionicons name="camera" size={18} color="#FFF9EF" />
                <Text style={[s.primaryBtnText, { fontFamily: "Inter_700Bold" }]}>Take photo</Text>
              </Pressable>
            </View>
          </BoardCard>
        ) : null}

        {activeTab === "template" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader title="Choose base template" action={selectedTemplate.label} />
            <View style={s.templateGrid}>
              {AVATAR_TEMPLATES.map((template) => {
                const active = draft.templateId === template.id;
                const tone = templateColor(template.id);
                return (
                  <Pressable
                    key={template.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Choose ${template.label} avatar template`}
                    onPress={() => selectTemplate(template.id)}
                    style={[
                      s.templateTile,
                      {
                        backgroundColor: active ? tone + "20" : colors.background,
                        borderColor: active ? tone : colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.templateArtWrap,
                        {
                          backgroundColor: active ? colors.ivory : tone + "12",
                          borderColor: active ? tone : colors.border,
                        },
                      ]}
                    >
                      <Image
                        source={getAvatarTemplatePreviewSource(template.id)}
                        style={s.templateArt}
                        contentFit="contain"
                        transition={140}
                      />
                      {active ? (
                        <View style={[s.templateCheck, { backgroundColor: tone }]}>
                          <Ionicons name="checkmark" size={13} color="#FFF9EF" />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[s.templateTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                      {template.label}
                    </Text>
                    <Text style={[s.templateSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      {template.subtitle}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </BoardCard>
        ) : null}

        {activeTab === "customize" ? (
          <View>
            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader title="Coat colors" action="Editable" />
              <View style={s.swatchGrid}>
                {COAT_SWATCHES.map((swatch) => {
                  const primary = draft.coatPrimary === swatch;
                  const secondary = draft.coatSecondary === swatch;
                  return (
                    <Pressable
                      key={swatch}
                      accessibilityRole="button"
                      accessibilityLabel={`Set coat color ${swatch}`}
                      onPress={() =>
                        setDraft((current) =>
                          updateConfig(current, primary ? { coatSecondary: swatch } : { coatPrimary: swatch }),
                        )
                      }
                      style={[
                        s.swatch,
                        {
                          backgroundColor: swatch,
                          borderColor: primary ? colors.navy : secondary ? colors.copper : colors.border,
                          borderWidth: primary || secondary ? 3 : 1,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </BoardCard>

            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader title="Face and ears" action={draft.faceMarkingId} />
              <View style={s.optionGrid}>
                {FACE_MARKINGS.map((marking) => {
                  const active = draft.faceMarkingId === marking.id;
                  return (
                    <Pressable
                      key={marking.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setDraft((current) => updateConfig(current, { faceMarkingId: marking.id }))}
                      style={[
                        s.optionPill,
                        {
                          backgroundColor: active ? colors.brandNavy : colors.background,
                          borderColor: active ? colors.brandNavy : colors.border,
                        },
                      ]}
                    >
                      <Text style={[s.optionText, { color: active ? "#FFF9EF" : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {marking.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </BoardCard>

            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader title="Accessories" action="Slots" />
              <View style={s.accessoryGrid}>
                {AVATAR_ACCESSORIES.map((item) => {
                  const active = Object.values(draft.accessorySlots).includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Set ${item.label} ${item.slot} accessory`}
                      onPress={() => setAccessory(item)}
                      style={[
                        s.accessoryTile,
                        {
                          backgroundColor: active ? item.tone + "20" : colors.background,
                          borderColor: active ? item.tone : colors.border,
                        },
                      ]}
                    >
                      <View style={[s.accessoryDot, { backgroundColor: item.tone }]} />
                      <Text style={[s.accessoryLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {item.label}
                      </Text>
                      <Text style={[s.accessorySlot, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                        {item.slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </BoardCard>
          </View>
        ) : null}

        {activeTab === "emotes" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader title="Mood set" action={draft.emotePackId === "phoenix-shepherd" ? "Phoenix pack" : "Starter"} />
            <View style={s.moodGrid}>
              {AVATAR_EMOTE_STATES.map((emote) => (
                <View key={emote} style={s.moodChip}>
                  <View style={[s.moodThumbWrap, { borderColor: colors.border }]}>
                    <Image source={PIXEL_HEAD_SOURCE} style={s.moodThumb} contentFit="cover" transition={150} />
                    <View
                      pointerEvents="none"
                      style={[
                        s.moodWash,
                        {
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
                    <View style={[s.emoteIcon, { backgroundColor: colors.ivory }]}>
                      <PixelIcon name={EMOTE_ICON[emote]} size={18} />
                    </View>
                  </View>
                  <Text style={[s.moodChipLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {emoteLabel(emote)}
                  </Text>
                </View>
              ))}
            </View>
          </BoardCard>
        ) : null}

        <View style={s.actionRow}>
          <Pressable
            onPress={resetDraft}
            style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
          >
            <Ionicons name="refresh" size={18} color={colors.foreground} />
            <Text style={[s.secondaryBtnText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Reset</Text>
          </Pressable>
          <Pressable
            onPress={saveDraft}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
          >
            <Ionicons name="heart" size={18} color="#FFF9EF" />
            <Text style={[s.primaryBtnText, { fontFamily: "Inter_700Bold" }]}>Save Avatar</Text>
          </Pressable>
        </View>

        {hasCustomAvatar ? (
          <BoardCard style={s.tipBoard} tone="soft">
            <Text style={[s.tipText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              Your uploaded mood images still work. The new template config gives those images a real editable identity layer.
            </Text>
          </BoardCard>
        ) : (
          <BoardCard style={s.tipBoard} tone="soft">
            <Text style={[s.tipText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              True AI scanning plugs in later. This version ships the reliable character creator, scan suggestion, and emote-preview system first.
            </Text>
          </BoardCard>
        )}
      </ScrollView>

      {savedToast ? (
        <View style={[s.toast, { backgroundColor: colors.brandNavy, bottom: insets.bottom + 22 }]}>
          <Text style={[s.toastText, { fontFamily: "Inter_700Bold" }]}>{savedToast}</Text>
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
  workingText: { fontSize: 25, lineHeight: 30 },
  workingHint: { fontSize: 13, lineHeight: 18 },
  heroPreview: {
    overflow: "hidden",
    aspectRatio: 0.96,
    marginBottom: 12,
    backgroundColor: "#081424",
    position: "relative",
  },
  liveRoomStage: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  pixelFrameOverlay: {
    position: "absolute",
    left: 14,
    top: 14,
    right: 14,
    alignItems: "flex-end",
  },
  pixelIdCard: {
    width: 184,
    minHeight: 76,
    borderRadius: 2,
    borderWidth: 2,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pixelHead: {
    width: 54,
    height: 54,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: "#081424",
    backgroundColor: "#F7F2E8",
  },
  pixelIdCopy: { flex: 1, minWidth: 0, gap: 2 },
  pixelIdKicker: { fontSize: 8, letterSpacing: 0.6, textTransform: "uppercase" },
  pixelIdName: { fontSize: 16, lineHeight: 18 },
  pixelLevelRow: { flexDirection: "row", gap: 3, marginTop: 3 },
  pixelLevelPip: {
    width: 14,
    height: 7,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: "rgba(8,20,36,0.22)",
  },
  savedScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "52%",
  },
  heroCopy: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    gap: 7,
  },
  savedName: { color: "#FFF9EF", fontSize: 25 },
  savedSub: { color: "rgba(255,249,239,0.82)", fontSize: 12.5, lineHeight: 17 },
  tabRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 11.5 },
  avatarBoard: { marginBottom: 12 },
  copy: { fontSize: 13, lineHeight: 19 },
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
    minHeight: 48,
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
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { color: "#FFF9EF", fontSize: 14 },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  templateTile: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 178,
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
  templateTitle: { fontSize: 13.5 },
  templateSub: { fontSize: 11.5, lineHeight: 16 },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  swatch: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { fontSize: 12 },
  accessoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  accessoryTile: {
    flexBasis: "47.5%",
    flexGrow: 1,
    minHeight: 82,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    justifyContent: "center",
    gap: 5,
  },
  accessoryDot: { width: 18, height: 18, borderRadius: 5 },
  accessoryLabel: { fontSize: 12.5 },
  accessorySlot: { fontSize: 10, textTransform: "uppercase" },
  moodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  moodChip: { width: "30.9%", alignItems: "center" },
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
  toastText: { color: "#FFF9EF", fontSize: 13 },
});
