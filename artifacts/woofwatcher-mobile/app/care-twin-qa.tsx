import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardCard, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { LivingPhoenixRoom, type PhoenixRoomStat } from "@/components/LivingPhoenixRoom";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { useColors } from "@/hooks/useColors";
import {
  evaluateCareTwinRuntimeQaScenario,
  listCareTwinRuntimeQaScenarios,
  type CareTwinRuntimeQaResult,
} from "@/lib/careTwinAssets";
import {
  buildCareTwinQaShareText,
  careTwinQaStatusLabel,
  summarizeCareTwinQaReviews,
  type CareTwinQaReview,
  type CareTwinQaReviewStatus,
} from "@/lib/careTwinQaReport";
import {
  buildMobileReleaseQaShareText,
  formatMobileReleaseQaMissingEvidence,
  formatMobileReleaseQaPlatformEvidence,
  listMobileReleaseQaSurfaces,
  mobileReleaseQaScreenshotEvidenceComplete,
  mobileReleaseQaStatusLabel,
  summarizeMobileReleaseQaReviews,
  type MobileReleaseQaReview,
  type MobileReleaseQaReviewStatus,
  type MobileReleaseQaSurface,
} from "@/lib/mobileReleaseQa";
import {
  buildMobileQaSessionSnapshot,
  MOBILE_QA_SESSION_STORAGE_KEY,
  parseMobileQaSessionSnapshot,
} from "@/lib/mobileQaSession";
import { deriveCareTwinChoreography } from "@/lib/careTwinChoreography";
import { buildQaScreenshotEvidence, type QaScreenshotEvidence, type QaScreenshotEvidencePlatform } from "@/lib/qaScreenshotEvidence";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

function formatSlug(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function energyForScenario(result: CareTwinRuntimeQaResult): number {
  switch (result.actualNeed) {
    case "rest":
      return 42;
    case "health":
      return 48;
    case "comfort":
      return 55;
    case "activity":
      return 76;
    case "hunger":
      return 64;
    case "hydration":
      return 68;
    default:
      return 82;
  }
}

function iconForNeed(need: CareTwinRuntimeQaResult["actualNeed"]): PixelIconName {
  switch (need) {
    case "activity":
      return "walk";
    case "hunger":
      return "meal";
    case "hydration":
      return "bile";
    case "rest":
      return "clock";
    case "comfort":
      return "heart";
    case "health":
      return "health";
    default:
      return "bond";
  }
}

function formatSavedAt(value?: string): string {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved locally";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readoutsFor(result: CareTwinRuntimeQaResult): PhoenixRoomStat[] {
  const energy = energyForScenario(result);
  return [
    {
      label: "Sprite",
      value: formatSlug(result.actualAction),
      icon: iconForNeed(result.actualNeed),
      progress: result.readiness.spriteReady ? 100 : 0,
    },
    {
      label: "Room",
      value: formatSlug(result.actualRoomVariant),
      icon: "heart",
      progress: result.readiness.roomReady ? 100 : 0,
    },
    {
      label: "Energy",
      value: `${energy}%`,
      icon: "energy",
      progress: energy,
    },
    {
      label: "Need",
      value: formatSlug(result.actualNeed),
      icon: iconForNeed(result.actualNeed),
      progress: result.readiness.layeredReady ? 100 : 50,
    },
  ];
}

function QaBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <View style={[s.badge, { backgroundColor: `${tone}18`, borderColor: `${tone}55` }]}>
      <Text style={[s.badgeText, { color: tone, fontFamily: "Inter_700Bold" }]}>{label}</Text>
    </View>
  );
}

function statusTone(
  status: CareTwinQaReviewStatus | MobileReleaseQaReviewStatus,
  colors: ReturnType<typeof useColors>,
): string {
  if (status === "pass") return colors.sage;
  if (status === "needs-review") return colors.amber;
  return colors.mutedForeground;
}

function qaScreenshotPlatformForRuntime(): QaScreenshotEvidencePlatform {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") return Platform.OS;
  return "unknown";
}

export default function CareTwinQaScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [qaStatusById, setQaStatusById] = useState<Record<string, CareTwinQaReviewStatus>>({});
  const [qaNotes, setQaNotes] = useState<Record<string, string>>({});
  const [qaEvidenceById, setQaEvidenceById] = useState<Record<string, QaScreenshotEvidence[]>>({});
  const [surfaceStatusById, setSurfaceStatusById] = useState<Record<string, MobileReleaseQaReviewStatus>>({});
  const [surfaceNotes, setSurfaceNotes] = useState<Record<string, string>>({});
  const [surfaceEvidenceById, setSurfaceEvidenceById] = useState<Record<string, QaScreenshotEvidence[]>>({});
  const [qaSessionLoaded, setQaSessionLoaded] = useState(false);
  const [qaSessionSavedAt, setQaSessionSavedAt] = useState<string | undefined>();
  const scenarios = useMemo(
    () => listCareTwinRuntimeQaScenarios().map(evaluateCareTwinRuntimeQaScenario),
    [],
  );
  const releaseSurfaces = useMemo(() => listMobileReleaseQaSurfaces(), []);
  const readyCount = scenarios.filter((result) => result.readiness.layeredReady).length;
  const qaReviews = useMemo<CareTwinQaReview[]>(
    () =>
      scenarios.map((result) => ({
        scenarioId: result.scenario.id,
        status: qaStatusById[result.scenario.id] ?? "unreviewed",
        note: qaNotes[result.scenario.id]?.trim(),
        screenshotEvidence: qaEvidenceById[result.scenario.id],
      })),
    [qaEvidenceById, qaNotes, qaStatusById, scenarios],
  );
  const qaSummary = useMemo(
    () => summarizeCareTwinQaReviews(scenarios, qaReviews),
    [qaReviews, scenarios],
  );
  const releaseReviews = useMemo<MobileReleaseQaReview[]>(
    () =>
      releaseSurfaces.map((surface) => ({
        surfaceId: surface.id,
        status: surfaceStatusById[surface.id] ?? "unreviewed",
        note: surfaceNotes[surface.id]?.trim(),
        screenshotEvidence: surfaceEvidenceById[surface.id],
      })),
    [releaseSurfaces, surfaceEvidenceById, surfaceNotes, surfaceStatusById],
  );
  const releaseSummary = useMemo(
    () => summarizeMobileReleaseQaReviews(releaseSurfaces, releaseReviews),
    [releaseReviews, releaseSurfaces],
  );
  const releaseScreenshotEvidenceComplete = mobileReleaseQaScreenshotEvidenceComplete(releaseSummary);
  const releasePlatformEvidenceLabel = formatMobileReleaseQaPlatformEvidence(releaseSummary);
  const releaseMissingEvidenceLabel = formatMobileReleaseQaMissingEvidence(releaseSummary);
  const attachedEvidenceFiles = releaseSummary.attachedScreenshots + qaSummary.attachedScreenshots;
  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const bottomInset = Platform.OS === "web" ? 32 : insets.bottom + 18;

  useEffect(() => {
    let cancelled = false;

    const loadSavedSession = async () => {
      try {
        const raw = await AsyncStorage.getItem(MOBILE_QA_SESSION_STORAGE_KEY);
        const savedSession = parseMobileQaSessionSnapshot(raw);
        if (!cancelled && savedSession) {
          setQaStatusById(savedSession.careTwinStatusById);
          setQaNotes(savedSession.careTwinNotes);
          setQaEvidenceById(savedSession.careTwinEvidenceById);
          setSurfaceStatusById(savedSession.surfaceStatusById);
          setSurfaceNotes(savedSession.surfaceNotes);
          setSurfaceEvidenceById(savedSession.surfaceEvidenceById);
          setQaSessionSavedAt(savedSession.savedAtIso);
        }
      } catch {
        // QA session recovery should never block the internal route.
      } finally {
        if (!cancelled) setQaSessionLoaded(true);
      }
    };

    loadSavedSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!qaSessionLoaded) return;

    const snapshot = buildMobileQaSessionSnapshot({
      careTwinStatusById: qaStatusById,
      careTwinNotes: qaNotes,
      careTwinEvidenceById: qaEvidenceById,
      surfaceStatusById,
      surfaceNotes,
      surfaceEvidenceById,
    });
    setQaSessionSavedAt(snapshot.savedAtIso);
    AsyncStorage.setItem(MOBILE_QA_SESSION_STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, [qaEvidenceById, qaNotes, qaSessionLoaded, qaStatusById, surfaceEvidenceById, surfaceNotes, surfaceStatusById]);

  const markScenario = (scenarioId: string, status: CareTwinQaReviewStatus) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    setQaStatusById((current) => ({
      ...current,
      [scenarioId]: current[scenarioId] === status ? "unreviewed" : status,
    }));
  };

  const markSurface = (surfaceId: string, status: MobileReleaseQaReviewStatus) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    setSurfaceStatusById((current) => ({
      ...current,
      [surfaceId]: current[surfaceId] === status ? "unreviewed" : status,
    }));
  };

  const openSurface = (surface: MobileReleaseQaSurface) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push(surface.route as never);
  };

  const pickScreenshotEvidence = async (fallbackFileName: string): Promise<QaScreenshotEvidence | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]?.uri) return null;

      const asset = result.assets[0];
      const fileName =
        typeof (asset as { fileName?: unknown }).fileName === "string"
          ? (asset as { fileName: string }).fileName
          : fallbackFileName;

      return buildQaScreenshotEvidence({
        uri: asset.uri,
        fileName,
        source: "library",
        targetPlatform: qaScreenshotPlatformForRuntime(),
        capturedAtIso: new Date().toISOString(),
      }, fallbackFileName);
    } catch {
      Alert.alert("Screenshot unavailable", "Choose the screenshot from Photos after capturing it on iOS or Android.");
      return null;
    }
  };

  const attachSurfaceScreenshot = async (surface: MobileReleaseQaSurface) => {
    const evidence = await pickScreenshotEvidence(`${surface.id}-qa-screenshot.png`);
    if (!evidence) return;
    setSurfaceEvidenceById((current) => ({
      ...current,
      [surface.id]: [...(current[surface.id] ?? []), evidence],
    }));
  };

  const attachScenarioScreenshot = async (scenarioId: string) => {
    const evidence = await pickScreenshotEvidence(`${scenarioId}-qa-screenshot.png`);
    if (!evidence) return;
    setQaEvidenceById((current) => ({
      ...current,
      [scenarioId]: [...(current[scenarioId] ?? []), evidence],
    }));
  };

  const shareQaSummary = async () => {
    const reviewedAtIso = new Date().toISOString();
    const message = [
      buildMobileReleaseQaShareText(releaseSurfaces, releaseReviews, reviewedAtIso),
      buildCareTwinQaShareText(scenarios, qaReviews, reviewedAtIso),
    ].join("\n\n");

    try {
      await Share.share({
        title: "WoofWatcher Mobile Release QA",
        message,
      });
    } catch {
      Alert.alert("Share failed", "Could not open the native share sheet for this QA report.");
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[s.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={[s.content, { paddingTop: topInset + 14, paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          kicker="Native QA"
          title="Care Twin State Lab"
          subtitle="Open this route on iOS and Android to review every production Phoenix room state without manually editing care history."
          back
          onBack={() => router.back()}
        />

        <BoardCard style={s.summaryCard}>
          <View style={s.summaryTop}>
            <View style={[s.summaryIcon, { backgroundColor: `${colors.sage}18` }]}>
              <PixelIcon name="heart" size={34} />
            </View>
            <View style={s.summaryCopy}>
              <Text style={[s.summaryTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
                Mobile release cockpit.
              </Text>
              <Text style={[s.summaryText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Check launch workflows, screenshot evidence, sprite states, phone-size readability, and non-diagnostic tone.
              </Text>
            </View>
          </View>
          <View style={s.summaryGrid}>
            <QaBadge label={`${releaseSummary.passed}/${releaseSummary.total} release`} tone={releaseSummary.passed === releaseSummary.total ? colors.sage : colors.amber} />
            <QaBadge label={`${readyCount}/${scenarios.length} layered`} tone={readyCount === scenarios.length ? colors.sage : colors.amber} />
            <QaBadge label={`${qaSummary.passed} pass`} tone={colors.sage} />
            <QaBadge label={`${qaSummary.needsReview} needs tune`} tone={colors.amber} />
            <QaBadge label={`${qaSummary.unreviewed} unreviewed`} tone={colors.mutedForeground} />
            <QaBadge label={`${attachedEvidenceFiles} evidence files`} tone={releaseScreenshotEvidenceComplete ? colors.sage : colors.amber} />
            <QaBadge label={releaseScreenshotEvidenceComplete ? "Native proof ready" : "Native proof open"} tone={releaseScreenshotEvidenceComplete ? colors.sage : colors.amber} />
            <QaBadge label={`iOS ${releaseSummary.attachedIosScreenshots}/${releaseSummary.requiredIosScreenshots}`} tone={releaseSummary.missingIosScreenshots === 0 ? colors.sage : colors.amber} />
            <QaBadge label={`Android ${releaseSummary.attachedAndroidScreenshots}/${releaseSummary.requiredAndroidScreenshots}`} tone={releaseSummary.missingAndroidScreenshots === 0 ? colors.sage : colors.amber} />
            <QaBadge label={qaSessionLoaded ? "Saved locally" : "Loading saved QA"} tone={qaSessionLoaded ? colors.sage : colors.amber} />
          </View>
          <Text style={[s.platformEvidenceText, { color: releaseScreenshotEvidenceComplete ? colors.sage : colors.amber, fontFamily: "Inter_700Bold" }]}>
            Platform proof: {releasePlatformEvidenceLabel}. {releaseMissingEvidenceLabel}.
          </Text>
          <Text style={[s.savedSessionText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            Local QA session: {formatSavedAt(qaSessionSavedAt)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share care twin QA summary"
            onPress={shareQaSummary}
            style={({ pressed }) => [
              s.shareButton,
              {
                backgroundColor: pressed ? colors.secondary : colors.brandNavy,
                borderColor: colors.brandNavy,
              },
            ]}
          >
            <Ionicons name="share-outline" size={18} color="#FFF9EF" />
            <Text style={[s.shareButtonText, { fontFamily: "Inter_700Bold" }]}>Share QA summary</Text>
          </Pressable>
        </BoardCard>

        <BoardSectionHeader title="Launch Workflow QA" action={releaseScreenshotEvidenceComplete ? "platform proof complete" : releaseMissingEvidenceLabel} />

        {releaseSurfaces.map((surface) => {
          const reviewStatus = surfaceStatusById[surface.id] ?? "unreviewed";
          const reviewTone = statusTone(reviewStatus, colors);
          const attachedScreenshots = surfaceEvidenceById[surface.id] ?? [];

          return (
            <BoardCard key={surface.id} style={s.surfaceCard}>
              <View style={s.surfaceHeader}>
                <View style={s.surfaceTitleWrap}>
                  <View style={[s.surfaceIcon, { backgroundColor: `${colors.brandNavy}12` }]}>
                    <Ionicons name="phone-portrait-outline" size={18} color={colors.brandNavy} />
                  </View>
                  <View style={s.surfaceTitleCopy}>
                    <Text style={[s.surfaceTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
                      {surface.title}
                    </Text>
                    <Text style={[s.surfaceRoute, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                      {surface.route} · {surface.priority === "launch-critical" ? "Launch critical" : "Release polish"}
                    </Text>
                  </View>
                </View>
                <QaBadge label={mobileReleaseQaStatusLabel(reviewStatus)} tone={reviewTone} />
              </View>

              <Text style={[s.surfaceGoal, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {surface.goal}
              </Text>
              <View style={[s.promptBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                <Text style={[s.promptLabel, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>
                  Device prompt
                </Text>
                <Text style={[s.promptText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {surface.devicePrompt}
                </Text>
              </View>

              <View style={s.evidenceList}>
                {surface.requiredEvidence.map((evidence) => (
                  <View key={evidence} style={s.evidenceRow}>
                    <Ionicons name="camera-outline" size={14} color={colors.copper} />
                    <Text style={[s.evidenceText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {evidence}
                    </Text>
                  </View>
                ))}
              </View>

              <EvidenceCapture
                label={`${attachedScreenshots.length} attached`}
                evidence={attachedScreenshots}
                onAttach={() => attachSurfaceScreenshot(surface)}
                onClear={() =>
                  setSurfaceEvidenceById((current) => ({
                    ...current,
                    [surface.id]: [],
                  }))
                }
              />

              <Text style={[s.launchRisk, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>
                Release risk: {surface.launchRisk}
              </Text>

              <View style={s.reviewGrid}>
                <ReviewButton
                  active={reviewStatus === "pass"}
                  icon="checkmark-circle"
                  label="Pass"
                  onPress={() => markSurface(surface.id, "pass")}
                  tone={colors.sage}
                />
                <ReviewButton
                  active={reviewStatus === "needs-review"}
                  icon="build"
                  label="Needs tune"
                  onPress={() => markSurface(surface.id, "needs-review")}
                  tone={colors.amber}
                />
              </View>

              <TextInput
                accessibilityLabel={`Release QA notes for ${surface.title}`}
                multiline
                onChangeText={(text) =>
                  setSurfaceNotes((current) => ({
                    ...current,
                    [surface.id]: text,
                  }))
                }
                placeholder="Release notes: safe area, touch target, route, copy, screenshot file..."
                placeholderTextColor={colors.mutedForeground}
                style={[
                  s.noteInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
                value={surfaceNotes[surface.id] ?? ""}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open QA surface: ${surface.title}`}
                onPress={() => openSurface(surface)}
                style={({ pressed }) => [
                  s.openSurfaceButton,
                  {
                    backgroundColor: pressed ? `${colors.sage}1A` : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[s.openSurfaceText, { color: colors.brandNavy, fontFamily: "Inter_700Bold" }]}>
                  Open surface
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.brandNavy} />
              </Pressable>
            </BoardCard>
          );
        })}

        <BoardSectionHeader title="Device Review Matrix" action={`${scenarios.length} scenes`} />

        {scenarios.map((result, index) => {
          const energy = energyForScenario(result);
          const missing = result.readiness.missing.join(", ");
          const reviewStatus = qaStatusById[result.scenario.id] ?? "unreviewed";
          const reviewTone = statusTone(reviewStatus, colors);
          const choreography = deriveCareTwinChoreography(result.plan);
          const attachedScreenshots = qaEvidenceById[result.scenario.id] ?? [];

          return (
            <BoardCard key={result.scenario.id} style={s.scenarioCard}>
              <View style={s.scenarioHeader}>
                <View style={s.scenarioTitleRow}>
                  <View style={[s.indexBubble, { backgroundColor: colors.brandNavy }]}>
                    <Text style={[s.indexText, { fontFamily: DISPLAY_SEMI }]}>{index + 1}</Text>
                  </View>
                  <View style={s.scenarioTitleCopy}>
                    <Text style={[s.scenarioTitle, { color: colors.foreground, fontFamily: DISPLAY }]}>
                      {result.scenario.label}
                    </Text>
                    <Text style={[s.scenarioSub, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                      {formatSlug(result.actualAction)} in {formatSlug(result.actualRoomVariant)}
                    </Text>
                  </View>
                </View>
                <QaBadge
                  label={careTwinQaStatusLabel(reviewStatus)}
                  tone={reviewTone}
                />
              </View>

              <View style={s.stageFrame} testID={`care-twin-qa-stage-${result.scenario.id}`}>
                <LivingPhoenixRoom
                  mood={result.scenario.motion.avatarMood}
                  motion={result.scenario.motion}
                  speech={result.scenario.motion.speech}
                  energy={energy}
                  presenceLabel="Native QA mode"
                  nextLabel={result.plan.recommendedActionLabel}
                  statusReadouts={readoutsFor(result)}
                />
              </View>

              <View style={s.metaGrid}>
                <MetaItem icon="game-controller-outline" label="Sprite" value={formatSlug(result.actualAction)} />
                <MetaItem icon="home-outline" label="Room" value={formatSlug(result.actualRoomVariant)} />
                <MetaItem icon="locate-outline" label="Zone" value={formatSlug(result.actualZone)} />
                <MetaItem icon="pulse-outline" label="Need" value={formatSlug(result.actualNeed)} />
                <MetaItem icon="hand-left-outline" label="Tap" value={formatSlug(choreography.tapReaction.action)} />
              </View>

              <View style={[s.promptBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[s.promptLabel, { color: colors.brandNavy, fontFamily: "Inter_700Bold" }]}>
                  Motion recipe
                </Text>
                <Text style={[s.promptText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {choreography.qaSummary}
                </Text>
              </View>

              <View style={[s.promptBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                <Text style={[s.promptLabel, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>
                  QA prompt
                </Text>
                <Text style={[s.promptText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {result.scenario.nativeQaPrompt}
                </Text>
              </View>

              <EvidenceCapture
                label={`${attachedScreenshots.length} attached`}
                evidence={attachedScreenshots}
                onAttach={() => attachScenarioScreenshot(result.scenario.id)}
                onClear={() =>
                  setQaEvidenceById((current) => ({
                    ...current,
                    [result.scenario.id]: [],
                  }))
                }
              />

              <View style={s.reviewGrid}>
                <ReviewButton
                  active={reviewStatus === "pass"}
                  icon="checkmark-circle"
                  label="Pass"
                  onPress={() => markScenario(result.scenario.id, "pass")}
                  tone={colors.sage}
                />
                <ReviewButton
                  active={reviewStatus === "needs-review"}
                  icon="build"
                  label="Needs tune"
                  onPress={() => markScenario(result.scenario.id, "needs-review")}
                  tone={colors.amber}
                />
              </View>

              <TextInput
                accessibilityLabel={`QA notes for ${result.scenario.label}`}
                multiline
                onChangeText={(text) =>
                  setQaNotes((current) => ({
                    ...current,
                    [result.scenario.id]: text,
                  }))
                }
                placeholder="Device notes: crop, scale, loop timing, gait, touch response..."
                placeholderTextColor={colors.mutedForeground}
                style={[
                  s.noteInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
                value={qaNotes[result.scenario.id] ?? ""}
              />

              {missing ? (
                <Text style={[s.missingText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>
                  Missing: {missing}
                </Text>
              ) : (
                <Text style={[s.readyText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                  Layered room and sprite assets are registered for this state.
                </Text>
              )}
            </BoardCard>
          );
        })}
      </ScrollView>
    </>
  );
}

function ReviewButton({
  active,
  icon,
  label,
  onPress,
  tone,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  tone: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        s.reviewButton,
        {
          backgroundColor: active ? `${tone}1F` : colors.background,
          borderColor: active ? tone : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={tone} />
      <Text style={[s.reviewButtonText, { color: active ? tone : colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EvidenceCapture({
  evidence,
  label,
  onAttach,
  onClear,
}: {
  evidence: readonly QaScreenshotEvidence[];
  label: string;
  onAttach: () => void;
  onClear: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[s.evidenceCapture, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={s.evidenceCaptureHeader}>
        <View style={s.evidenceCaptureTitleRow}>
          <Ionicons name="images-outline" size={16} color={colors.copper} />
          <Text style={[s.evidenceCaptureTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Screenshot evidence
          </Text>
        </View>
        <QaBadge label={label} tone={evidence.length ? colors.sage : colors.amber} />
      </View>
      <Text style={[s.evidenceCaptureHelp, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
        Capture the screen on iOS or Android, then attach it here from Photos so the QA report keeps local proof with the route notes.
      </Text>
      {evidence.length ? (
        <View style={s.attachedList}>
          {evidence.map((item) => (
            <View key={`${item.uri}-${item.capturedAtIso}`} style={[s.attachedItem, { borderColor: colors.border }]}>
              <Ionicons name="image-outline" size={14} color={colors.sage} />
              <Text style={[s.attachedName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                {item.fileName}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={s.evidenceActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach QA screenshot from Photos"
          onPress={onAttach}
          style={({ pressed }) => [
            s.attachButton,
            {
              backgroundColor: pressed ? `${colors.copper}22` : `${colors.copper}12`,
              borderColor: `${colors.copper}55`,
            },
          ]}
        >
          <Ionicons name="camera-outline" size={16} color={colors.copper} />
          <Text style={[s.attachButtonText, { color: colors.copper, fontFamily: "Inter_700Bold" }]}>Attach screenshot</Text>
        </Pressable>
        {evidence.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear attached QA screenshots"
            onPress={onClear}
            style={({ pressed }) => [
              s.clearEvidenceButton,
              {
                backgroundColor: pressed ? `${colors.rose}18` : colors.background,
                borderColor: `${colors.rose}55`,
              },
            ]}
          >
            <Text style={[s.clearEvidenceText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View style={[s.metaItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Ionicons name={icon} size={14} color={colors.copper} />
      <Text style={[s.metaLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{label}</Text>
      <Text style={[s.metaValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  summaryCard: {
    gap: 14,
  },
  summaryTop: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
  },
  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 19,
    letterSpacing: 0,
  },
  summaryText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformEvidenceText: {
    fontSize: 12,
    lineHeight: 17,
  },
  savedSessionText: {
    fontSize: 12,
    lineHeight: 17,
  },
  shareButton: {
    minHeight: 46,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareButtonText: {
    color: "#FFF9EF",
    fontSize: 13,
  },
  surfaceCard: {
    gap: 12,
  },
  surfaceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  surfaceTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  surfaceIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  surfaceTitleCopy: {
    flex: 1,
  },
  surfaceTitle: {
    fontSize: 17,
    letterSpacing: 0,
  },
  surfaceRoute: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  surfaceGoal: {
    fontSize: 13,
    lineHeight: 19,
  },
  evidenceList: {
    gap: 7,
  },
  evidenceRow: {
    flexDirection: "row",
    gap: 7,
    alignItems: "flex-start",
  },
  evidenceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  evidenceCapture: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  evidenceCaptureHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  evidenceCaptureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  evidenceCaptureTitle: {
    fontSize: 13,
  },
  evidenceCaptureHelp: {
    fontSize: 12,
    lineHeight: 17,
  },
  attachedList: {
    gap: 6,
  },
  attachedItem: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  attachedName: {
    flex: 1,
    fontSize: 12,
  },
  evidenceActions: {
    flexDirection: "row",
    gap: 8,
  },
  attachButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  attachButtonText: {
    fontSize: 12,
  },
  clearEvidenceButton: {
    minHeight: 40,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  clearEvidenceText: {
    fontSize: 12,
  },
  launchRisk: {
    fontSize: 12,
    lineHeight: 17,
  },
  openSurfaceButton: {
    minHeight: 42,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  openSurfaceText: {
    fontSize: 12,
  },
  badge: {
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0,
  },
  scenarioCard: {
    gap: 13,
  },
  scenarioHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  scenarioTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  indexBubble: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    color: "#FFF9EF",
    fontSize: 14,
  },
  scenarioTitleCopy: {
    flex: 1,
  },
  scenarioTitle: {
    fontSize: 17,
    letterSpacing: 0,
  },
  scenarioSub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  stageFrame: {
    minHeight: 310,
    overflow: "hidden",
    borderRadius: 14,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: {
    flexGrow: 1,
    minWidth: "46%",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 12,
    lineHeight: 16,
  },
  promptBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  promptLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 19,
  },
  reviewGrid: {
    flexDirection: "row",
    gap: 8,
  },
  reviewButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  reviewButtonText: {
    fontSize: 12,
  },
  noteInput: {
    minHeight: 74,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: "top",
  },
  missingText: {
    fontSize: 12,
    lineHeight: 17,
  },
  readyText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
