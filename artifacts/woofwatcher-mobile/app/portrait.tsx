import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCare } from "@/context/CareContext";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

const PORTRAIT_KEY = "woofwatcher.portrait.v1";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const PAINTING_LINES = [
  "Mixing the paints…",
  "Getting the ears just right…",
  "Adding a sparkle to those eyes…",
  "Capturing that goofy grin…",
  "A few more brushstrokes…",
];

type Phase = "idle" | "working" | "result";

export default function PortraitScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const name = state.profile.name;

  const topInset = Platform.OS === "web" ? 20 : insets.top;

  const [phase, setPhase] = useState<Phase>("idle");
  const [saved, setSaved] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lineIdx, setLineIdx] = useState(0);

  // Load any previously saved portrait
  useEffect(() => {
    AsyncStorage.getItem(PORTRAIT_KEY).then((uri) => {
      if (uri) setSaved(uri);
    });
  }, []);

  // Brush spinner + rotating copy while working
  const spin = useRef(new Animated.Value(0)).current;
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
    loop.start();
    const t = setInterval(() => setLineIdx((i) => (i + 1) % PAINTING_LINES.length), 1900);
    return () => {
      loop.stop();
      spin.setValue(0);
      clearInterval(t);
    };
  }, [phase, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

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
    await stylize(res.assets[0].uri);
  };

  const stylize = async (uri: string) => {
    try {
      setPhase("working");
      setResult(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Downscale + compress to keep the upload small and fast
      const shrunk = await manipulateAsync(uri, [{ resize: { width: 900 } }], {
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      });
      const imageBase64 = shrunk.base64;
      if (!imageBase64) throw new Error("Could not read that image.");

      const res = await fetch(`${BASE_URL}/api/avatar-stylize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageBase64) {
        throw new Error(data.error || "The portrait studio is busy. Try again in a moment.");
      }

      const dataUri = `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`;
      setResult(dataUri);
      setPhase("result");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError((e as Error).message || "Something went wrong. Please try again.");
      setPhase("idle");
    }
  };

  const savePortrait = async () => {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let stored = result;
      if (Platform.OS !== "web" && FileSystem.documentDirectory) {
        const base64 = result.slice(result.indexOf(",") + 1);
        const fileUri = `${FileSystem.documentDirectory}phoenix-portrait-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        stored = fileUri;
      }
      await AsyncStorage.setItem(PORTRAIT_KEY, stored);
      setSaved(stored);
      setResult(null);
      setPhase("idle");
    } catch {
      setError("Couldn't save the portrait. Please try again.");
    }
  };

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
          <Text style={[s.headerTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>Portrait Studio</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={[s.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Snap a photo of {name} and we'll paint a cozy storybook portrait.
        </Text>

        {/* Working state */}
        {phase === "working" && (
          <View style={[s.canvasCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
            <LinearGradient colors={["#FBF6EE", "#EAF1E9"]} style={s.canvasFill}>
              <Animated.View style={{ transform: [{ rotate }] }}>
                <View style={[s.brushCircle, { backgroundColor: colors.primary + "18" }]}>
                  <Ionicons name="brush" size={34} color={colors.primary} />
                </View>
              </Animated.View>
              <Text style={[s.workingText, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                {PAINTING_LINES[lineIdx]}
              </Text>
              <Text style={[s.workingHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                This usually takes a few seconds.
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Result preview */}
        {phase === "result" && result && (
          <View>
            <View style={[s.canvasCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
              <Image source={{ uri: result }} style={s.canvasImage} contentFit="cover" transition={300} />
              <View style={[s.resultBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="sparkles" size={13} color="#FFF" />
                <Text style={[s.resultBadgeText, { fontFamily: "Inter_700Bold" }]}>Fresh off the easel</Text>
              </View>
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
                onPress={savePortrait}
                style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name="heart" size={18} color="#FFF" />
                <Text style={[s.primaryBtnText, { fontFamily: "Inter_700Bold" }]}>Save portrait</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Idle: saved portrait (if any) + actions */}
        {phase === "idle" && (
          <View>
            {saved ? (
              <View style={[s.canvasCard, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
                <Image source={{ uri: saved }} style={s.canvasImage} contentFit="cover" transition={200} />
                <LinearGradient
                  colors={["transparent", "rgba(20,30,24,0.55)"]}
                  style={s.savedScrim}
                  pointerEvents="none"
                />
                <Text style={[s.savedName, { fontFamily: DISPLAY }]}>{name}'s portrait</Text>
              </View>
            ) : (
              <View style={[s.canvasCard, s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.emptyIcon, { backgroundColor: colors.primary + "14" }]}>
                  <Ionicons name="color-palette-outline" size={40} color={colors.primary} />
                </View>
                <Text style={[s.emptyTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  No portrait yet
                </Text>
                <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Best with a clear, well-lit photo where {name}'s face is easy to see.
                </Text>
              </View>
            )}

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
                  {saved ? "New photo" : "Take photo"}
                </Text>
              </Pressable>
            </View>

            <View style={[s.tipRow]}>
              <Ionicons name="sparkles-outline" size={15} color={colors.sage} />
              <Text style={[s.tipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Every portrait is hand-painted by AI in {name}'s app style.
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
    aspectRatio: 0.82,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  canvasFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  canvasImage: { width: "100%", height: "100%" },
  brushCircle: { width: 74, height: 74, borderRadius: 37, alignItems: "center", justifyContent: "center" },
  workingText: { fontSize: 18, textAlign: "center" },
  workingHint: { fontSize: 13.5, textAlign: "center" },

  resultBadge: {
    position: "absolute", top: 14, left: 14, flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12,
  },
  resultBadgeText: { color: "#FFF", fontSize: 12 },

  savedScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" },
  savedName: { position: "absolute", left: 18, bottom: 16, color: "#FFF", fontSize: 22 },

  emptyCard: { borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },
  emptyIcon: { width: 84, height: 84, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 19 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center", paddingHorizontal: 10 },

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

  tipRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, paddingHorizontal: 16 },
  tipText: { fontSize: 13, textAlign: "center", flexShrink: 1 },

  webSpinner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
