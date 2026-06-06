import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCare } from "@/context/CareContext";
import { useAvatar, MOODS, AvatarSet } from "@/context/AvatarContext";
import { MOOD_META, type Mood } from "@/lib/phoenixStatus";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const PAINTING_LINES = [
  "Mixing the paints…",
  "Getting the ears just right…",
  "Adding a sparkle to those eyes…",
  "Painting every little mood…",
  "A few more brushstrokes…",
];

type Phase = "idle" | "working" | "result";

type ResultSet = Partial<Record<Mood, string>>; // mood -> data uri

export default function PortraitScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const { getToken } = useAuth();
  const { avatarSet, getAvatarSource, hasCustomAvatar, saveAvatarSet, clearAvatarSet } = useAvatar();
  const name = state.profile.name;

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const { width: winW } = useWindowDimensions();
  const canvasW = Math.min(winW, 520) - 40;
  const canvasH = canvasW / 0.82;

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ResultSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [sourceUri, setSourceUri] = useState<string | null>(null);

  // Brush spinner + rotating copy while working
  const spin = useRef(new Animated.Value(0)).current;
  // Cinematic scan beam sweeping over the source photo
  const scan = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== "working") return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    const scanLoop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: 1900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    scanLoop.start();
    pulseLoop.start();
    const t = setInterval(() => setLineIdx((i) => (i + 1) % PAINTING_LINES.length), 1900);
    return () => {
      loop.stop();
      scanLoop.stop();
      pulseLoop.stop();
      spin.setValue(0);
      scan.setValue(0);
      pulse.setValue(0);
      clearInterval(t);
    };
  }, [phase, spin, scan, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scanTranslate = scan.interpolate({ inputRange: [0, 1], outputRange: [0, canvasH - 56] });
  const reticleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  const ensurePermission = async (camera: boolean) => {
    if (Platform.OS === "web") return true;
    const fn = camera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const res = await fn();
    return res.granted;
  };

  const pick = async (camera: boolean) => {
    setError(null);
    const ok = await ensurePermission(camera);
    if (!ok) {
      setError(
        camera
          ? "Camera access is needed to snap a photo."
          : "Photo access is needed to choose a picture.",
      );
      return;
    }

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    };
    const res = camera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (res.canceled || !res.assets?.[0]?.uri) return;
    await generate(res.assets[0].uri);
  };

  const generate = async (uri: string) => {
    try {
      setPhase("working");
      setResult(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setSourceUri(uri);
      // Downscale + compress to keep the upload small and fast
      const shrunk = await manipulateAsync(uri, [{ resize: { width: 900 } }], {
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      });
      const imageBase64 = shrunk.base64;
      if (!imageBase64) throw new Error("Could not read that image.");

      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/avatar-emotions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imageBase64, mimeType: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok || !data.images || Object.keys(data.images).length === 0) {
        throw new Error(data.error || "The portrait studio is busy. Try again in a moment.");
      }

      const set: ResultSet = {};
      for (const mood of MOODS) {
        const img = data.images[mood];
        if (img?.imageBase64) {
          set[mood] = `data:${img.mimeType || "image/png"};base64,${img.imageBase64}`;
        }
      }
      setResult(set);
      setPhase("result");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError((e as Error).message || "Something went wrong. Please try again.");
      setPhase("idle");
    }
  };

  const deleteStoredFiles = async (set: AvatarSet | null) => {
    if (!set || Platform.OS === "web") return;
    await Promise.all(
      Object.values(set).map(async (uri) => {
        if (uri && uri.startsWith("file://")) {
          try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          } catch {
            // best-effort cleanup
          }
        }
      }),
    );
  };

  const saveSet = async () => {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const previous = avatarSet;
      const stored: AvatarSet = {};
      for (const mood of MOODS) {
        const dataUri = result[mood];
        if (!dataUri) continue;
        if (Platform.OS !== "web" && FileSystem.documentDirectory) {
          const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
          const fileUri = `${FileSystem.documentDirectory}avatar-${mood}-${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          stored[mood] = fileUri;
        } else {
          stored[mood] = dataUri;
        }
      }
      await saveAvatarSet(stored);
      await deleteStoredFiles(previous);
      setResult(null);
      setPhase("idle");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Couldn't save the avatars. Please try again.");
    }
  };

  const revertToDefault = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const previous = avatarSet;
    await clearAvatarSet();
    await deleteStoredFiles(previous);
  };

  const moodLabel = (m: Mood) => MOOD_META[m].label;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 60, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={[s.backBtn, { backgroundColor: colors.card }]}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Avatar Studio</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={[s.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Snap one photo of {name} and we'll paint a full set of moods — happy, playful, cozy,
          unsure and sleepy. They become {name}'s live avatar across the app.
        </Text>

        {/* Working state — cinematic scan over the source photo */}
        {phase === "working" && (
          <View style={[s.canvasCard, { backgroundColor: colors.card, shadowColor: colors.primary, width: canvasW, height: canvasH, alignSelf: "center" }]}>
            {sourceUri ? (
              <Image source={{ uri: sourceUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            ) : (
              <LinearGradient colors={["#FBF6EE", "#EAF1E9"]} style={StyleSheet.absoluteFill} />
            )}

            {/* Cool scan tint so the beam reads clearly */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20,40,32,0.34)" }]} pointerEvents="none" />

            {/* Sweeping scan beam */}
            <Animated.View style={[s.scanBand, { transform: [{ translateY: scanTranslate }] }]} pointerEvents="none">
              <LinearGradient
                colors={["transparent", colors.sage + "22", colors.sage + "66"]}
                style={s.scanBandFill}
              />
              <View style={[s.scanLine, { backgroundColor: "#EAFBF0", shadowColor: colors.sage }]} />
            </Animated.View>

            {/* Reticle corner brackets */}
            <Animated.View style={[s.reticle, { opacity: reticleOpacity }]} pointerEvents="none">
              <View style={[s.corner, s.cornerTL, { borderColor: "#EAFBF0" }]} />
              <View style={[s.corner, s.cornerTR, { borderColor: "#EAFBF0" }]} />
              <View style={[s.corner, s.cornerBL, { borderColor: "#EAFBF0" }]} />
              <View style={[s.corner, s.cornerBR, { borderColor: "#EAFBF0" }]} />
            </Animated.View>

            {/* Bottom copy */}
            <LinearGradient colors={["transparent", "rgba(15,28,22,0.82)"]} style={s.workingScrim} pointerEvents="none" />
            <View style={s.workingCopy}>
              <View style={s.workingCopyRow}>
                <Animated.View style={{ transform: [{ rotate }] }}>
                  <Ionicons name="sparkles" size={16} color="#EAFBF0" />
                </Animated.View>
                <Text style={[s.workingText, { color: "#FFFFFF", fontFamily: DISPLAY_SEMI }]}>
                  {PAINTING_LINES[lineIdx]}
                </Text>
              </View>
              <Text style={[s.workingHint, { color: "rgba(255,255,255,0.82)", fontFamily: "Inter_400Regular" }]}>
                Reading {name}'s features and painting all five moods.
              </Text>
            </View>
          </View>
        )}

        {/* Result preview — the full emotion set */}
        {phase === "result" && result && (
          <View>
            <View style={[s.heroPreview, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
              <Image source={{ uri: result.happy ?? Object.values(result)[0] }} style={s.heroImg} contentFit="cover" transition={300} />
              <View style={[s.resultBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="sparkles" size={13} color="#FFF" />
                <Text style={[s.resultBadgeText, { fontFamily: "Inter_700Bold" }]}>Fresh off the easel</Text>
              </View>
            </View>

            <View style={s.moodGrid}>
              {MOODS.map((m) =>
                result[m] ? (
                  <View key={m} style={s.moodChip}>
                    <View style={[s.moodThumbWrap, { borderColor: colors.border }]}>
                      <Image source={{ uri: result[m] }} style={s.moodThumb} contentFit="cover" transition={200} />
                    </View>
                    <Text style={[s.moodChipLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {moodLabel(m)}
                    </Text>
                  </View>
                ) : null,
              )}
            </View>

            <View style={s.actionRow}>
              <Pressable
                onPress={() => { setResult(null); setPhase("idle"); }}
                style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="refresh" size={18} color={colors.foreground} />
                <Text style={[s.secondaryBtnText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Try again</Text>
              </Pressable>
              <Pressable
                onPress={saveSet}
                style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name="heart" size={18} color="#FFF" />
                <Text style={[s.primaryBtnText, { fontFamily: "Inter_700Bold" }]}>Make it live</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Idle: current live avatar set + actions */}
        {phase === "idle" && (
          <View>
            <View style={[s.heroPreview, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
              <Image source={getAvatarSource("happy")} style={s.heroImg} contentFit="cover" transition={200} />
              <LinearGradient
                colors={["transparent", "rgba(20,30,24,0.55)"]}
                style={s.savedScrim}
                pointerEvents="none"
              />
              <Text style={[s.savedName, { fontFamily: DISPLAY }]}>
                {hasCustomAvatar ? `${name}'s avatar` : "Default art"}
              </Text>
              {hasCustomAvatar && (
                <View style={[s.liveBadge, { backgroundColor: colors.sage }]}>
                  <View style={s.liveDot} />
                  <Text style={[s.liveBadgeText, { fontFamily: "Inter_700Bold" }]}>LIVE</Text>
                </View>
              )}
            </View>

            {/* Current mood set preview */}
            <View style={s.moodGrid}>
              {MOODS.map((m) => (
                <View key={m} style={s.moodChip}>
                  <View style={[s.moodThumbWrap, { borderColor: colors.border }]}>
                    <Image source={getAvatarSource(m)} style={s.moodThumb} contentFit="cover" transition={150} />
                  </View>
                  <Text style={[s.moodChipLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {moodLabel(m)}
                  </Text>
                </View>
              ))}
            </View>

            {error && (
              <View style={[s.errorBox, { backgroundColor: colors.copper + "14", borderColor: colors.copper + "44" }]}>
                <Ionicons name="alert-circle" size={16} color={colors.copper} />
                <Text style={[s.errorText, { color: colors.copper, fontFamily: "Inter_500Medium" }]}>{error}</Text>
              </View>
            )}

            <View style={s.actionRow}>
              <Pressable
                onPress={() => pick(false)}
                style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="images-outline" size={18} color={colors.foreground} />
                <Text style={[s.secondaryBtnText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Library</Text>
              </Pressable>
              <Pressable
                onPress={() => pick(true)}
                style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name="camera" size={18} color="#FFF" />
                <Text style={[s.primaryBtnText, { fontFamily: "Inter_700Bold" }]}>
                  {hasCustomAvatar ? "New photo" : "Create set"}
                </Text>
              </Pressable>
            </View>

            {hasCustomAvatar && (
              <Pressable onPress={revertToDefault} style={({ pressed }) => [s.revertBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons name="arrow-undo" size={15} color={colors.mutedForeground} />
                <Text style={[s.revertText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Revert to default art
                </Text>
              </Pressable>
            )}

            <View style={s.tipRow}>
              <Ionicons name="sparkles-outline" size={15} color={colors.sage} />
              <Text style={[s.tipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                One photo paints all five moods. Best with a clear, well-lit shot of {name}'s face.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {phase === "working" && Platform.OS === "web" && (
        <View style={s.webSpinner}><ActivityIndicator color={colors.primary} /></View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  backBtn: {
    width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center",
    shadowColor: "#0F1F33", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  headerTitle: { fontSize: 21, letterSpacing: -0.2 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 4, marginBottom: 20 },

  canvasCard: {
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  scanBand: { position: "absolute", left: 0, right: 0, top: 0, height: 56 },
  scanBandFill: { ...StyleSheet.absoluteFillObject, borderRadius: 2 },
  scanLine: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 0,
    height: 2.5,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  reticle: { ...StyleSheet.absoluteFillObject, margin: 20 },
  corner: { position: "absolute", width: 26, height: 26 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 8 },
  workingScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "42%" },
  workingCopy: { position: "absolute", left: 20, right: 20, bottom: 20, gap: 6 },
  workingCopyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  workingText: { fontSize: 17, flexShrink: 1 },
  workingHint: { fontSize: 13, lineHeight: 18 },

  heroPreview: {
    borderRadius: 26,
    overflow: "hidden",
    aspectRatio: 1,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  heroImg: { width: "100%", height: "100%" },

  resultBadge: {
    position: "absolute", top: 14, left: 14, flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12,
  },
  resultBadgeText: { color: "#FFF", fontSize: 12 },

  savedScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" },
  savedName: { position: "absolute", left: 18, bottom: 16, color: "#FFF", fontSize: 22 },
  liveBadge: {
    position: "absolute", top: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
  liveBadgeText: { color: "#FFF", fontSize: 11, letterSpacing: 0.5 },

  moodGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  moodChip: { alignItems: "center", flex: 1 },
  moodThumbWrap: {
    width: "92%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", borderWidth: 1, marginBottom: 6,
  },
  moodThumb: { width: "100%", height: "100%" },
  moodChipLabel: { fontSize: 11 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 14,
  },
  errorText: { fontSize: 13.5, flex: 1, lineHeight: 18 },

  actionRow: { flexDirection: "row", gap: 12 },
  secondaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 15, borderRadius: 16, borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 15 },
  primaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 15, borderRadius: 16,
    shadowColor: "#2E5846", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  primaryBtnText: { color: "#FFF", fontSize: 15 },

  revertBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 },
  revertText: { fontSize: 13.5 },

  tipRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, paddingHorizontal: 16 },
  tipText: { fontSize: 13, textAlign: "center", flexShrink: 1 },

  webSpinner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
