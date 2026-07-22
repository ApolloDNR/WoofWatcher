import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OwnerOpsUnavailableScreen } from "@/components/board/OwnerOpsBoundary";
import { isOwnerOpsBuild } from "@/lib/buildChannel";
import {
  deriveHealthWatch,
  derivePremiumPreview,
  type PremiumFeatureGate,
  type PremiumPlan,
  type PremiumValueSignal,
} from "@workspace/care-domain";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { BoardCard, BoardPill, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import { notifyDialog } from "@/lib/confirmDialog";
import { MIN_MOBILE_TOUCH_TARGET, getRouteTopPadding, getStandaloneRouteBottomPadding } from "@/lib/mobileLayout";
import { buildPaymentsProviderProofManifest } from "@/lib/paymentsProviderProof";
import { pixelImageStyle, stageImageFill } from "@/lib/pixelRendering";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const PIXEL_DISPLAY = "Fredoka_600SemiBold";
const PREMIUM_VALUE_STAGE_ROOM = require("@/assets/avatar/rooms/phoenix-room-day-pixellab-400x300.png");
const PREMIUM_VALUE_STAGE_SPRITE = getCareTwinSpriteAsset("celebrate-hop");
const PREMIUM_VALUE_STAGE_TRACK = CARE_TWIN_SPRITE_MANIFEST["celebrate-hop"];

function signalIcon(key: PremiumValueSignal["key"]): keyof typeof Ionicons.glyphMap {
  if (key === "household") return "people-outline";
  if (key === "health") return "heart-outline";
  if (key === "reports") return "document-text-outline";
  if (key === "records") return "folder-open-outline";
  return "calendar-outline";
}

export default function PremiumScreen() {
  // Store builds hide the gated Plus preview: pricing tiers may not be
  // shown to reviewers or households until checkout is provider-approved.
  if (!isOwnerOpsBuild()) {
    return <OwnerOpsUnavailableScreen title="WoofWatcher Plus preview unavailable" />;
  }
  return <PremiumScreenBody />;
}

function PremiumScreenBody() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useCare();
  const now = Date.now();

  const healthWatch = useMemo(
    () => deriveHealthWatch({ entries: state.entries, routines: state.routines, now }),
    [state.entries, state.routines, now],
  );

  const preview = useMemo(
    () =>
      derivePremiumPreview({
        caregiverCount: Math.max(state.caregivers.length, 1),
        routineCount: state.routines.length,
        reportHistoryCount: state.reportArtifacts.length,
        recordCount: state.records.length,
        healthSignalCount: healthWatch.signals.length,
      }),
    [
      state.caregivers.length,
      state.routines.length,
      state.reportArtifacts.length,
      state.records.length,
      healthWatch.signals.length,
    ],
  );

  const recommendedPlan =
    preview.plans.find((plan) => plan.id === preview.recommendedPlanId) ?? preview.plans[1];
  const includedEntitlements = preview.entitlements.included.slice(0, 3);
  const lockedEntitlements = preview.entitlements.locked.slice(0, 5);
  const premiumStageSpeech =
    lockedEntitlements[0]
      ? `${recommendedPlan.name} unlocks ${lockedEntitlements[0].label.toLowerCase()} when checkout is approved.`
      : `${recommendedPlan.name} is ready to review once launch gates close.`;
  const premiumStageHud = [
    { label: "Plan", value: recommendedPlan.name, tone: colors.primary },
    { label: "Price", value: recommendedPlan.monthlyPrice, tone: colors.amber },
    { label: "Signals", value: String(preview.valueSignals.length), tone: colors.sage },
    { label: "Gate", value: "Checkout", tone: colors.amber },
  ];
  const paymentsProofManifest = buildPaymentsProviderProofManifest();

  const isWebRoutePreview = (Platform.OS as string) === "web";
  const fade = useRef(new Animated.Value(isWebRoutePreview ? 1 : 0)).current;
  const slide = useRef(new Animated.Value(isWebRoutePreview ? 0 : 18)).current;
  useEffect(() => {
    if (isWebRoutePreview) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: !isWebRoutePreview }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: !isWebRoutePreview }),
    ]).start();
  }, [fade, isWebRoutePreview, slide]);

  const showLaunchChecklist = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    notifyDialog(
      "Premium launch checklist",
      "Payments stay disabled until privacy terms, support scope, refund workflow, subscription packaging, and app-store launch target are approved.",
    );
  };

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "standalone",
  });
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topPadding, paddingHorizontal: 20, paddingBottom: bottomPadding }}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <BoardCard padded={false} style={s.premiumValueStageCard}>
            <ImageBackground
              source={PREMIUM_VALUE_STAGE_ROOM}
              resizeMode="stretch"
              imageStyle={[stageImageFill, s.premiumValueStageImage, pixelImageStyle]}
              style={s.premiumValueStage}
              testID="premium-value-pixel-stage"
            >
              <View style={s.premiumValueStageShade} />

              <View style={s.premiumValueStageTop}>
                <View style={s.premiumValueBubble}>
                  <Text style={[s.premiumValueKicker, { color: colors.copper, fontFamily: PIXEL_DISPLAY }]}>
                    Plus Value Console
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={[s.premiumValueSpeech, { color: colors.brandNavy, fontFamily: PIXEL_DISPLAY }]}
                  >
                    {premiumStageSpeech}
                  </Text>
                  <View style={s.premiumValueBubbleTail} />
                </View>
                <View
                  style={[
                    s.premiumValueChip,
                    { backgroundColor: colors.brandNavy + "E8", borderColor: colors.ivory + "55" },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={15} color={colors.amber} />
                  <Text style={[s.premiumValueChipText, { color: colors.ivory, fontFamily: "Inter_800ExtraBold" }]}>
                    Checkout gated
                  </Text>
                </View>
              </View>

              <View style={[s.premiumValueSprite, { pointerEvents: "none" }]}>
                <View style={s.premiumValueSpriteShadow} />
                <SpriteSheetPlayer
                  asset={PREMIUM_VALUE_STAGE_SPRITE}
                  track={PREMIUM_VALUE_STAGE_TRACK}
                  width={136}
                  height={136}
                  testID="premium-value-pixel-sprite"
                />
              </View>

              <View
                style={[
                  s.premiumValueHud,
                  { backgroundColor: colors.brandNavy + "DF", borderColor: colors.ivory + "44" },
                ]}
              >
                {premiumStageHud.map((metric) => (
                  <View key={metric.label} style={s.premiumValueHudCell}>
                    <Text style={[s.premiumValueHudLabel, { color: colors.ivory, fontFamily: PIXEL_DISPLAY }]}>
                      {metric.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.premiumValueHudValue, { color: metric.tone, fontFamily: "Inter_800ExtraBold" }]}
                    >
                      {metric.value}
                    </Text>
                    <View style={s.premiumValueSignalRow}>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <View
                          key={`${metric.label}-${index}`}
                          style={[
                            s.premiumValueSignalBar,
                            {
                              backgroundColor:
                                index < Math.min(5, preview.valueSignals.length || 1)
                                  ? metric.tone
                                  : colors.ivory + "30",
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              <View style={s.premiumValueFooter}>
                <View
                  style={[
                    s.premiumValuePlanCard,
                    { backgroundColor: colors.ivory + "E8", borderColor: colors.ivory + "AA" },
                  ]}
                >
                  <Text style={[s.premiumValuePlanLabel, { color: colors.copper, fontFamily: "Inter_800ExtraBold" }]}>
                    Recommended
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[s.premiumValuePlanValue, { color: colors.brandNavy, fontFamily: DISPLAY_SEMI }]}
                  >
                    {recommendedPlan.name} · {recommendedPlan.monthlyPrice}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open premium launch checklist from value console"
                  onPress={showLaunchChecklist}
                  style={({ pressed }) => [
                    s.premiumValueAction,
                    { backgroundColor: colors.sage, opacity: pressed ? 0.82 : 1 },
                  ]}
                >
                  <Text style={[s.premiumValueActionText, { fontFamily: "Inter_800ExtraBold" }]}>
                    Launch checklist
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color={colors.ivory} />
                </Pressable>
              </View>
            </ImageBackground>
          </BoardCard>

          <View style={[s.notice, { backgroundColor: colors.amber + "14", borderColor: colors.amber + "45" }]}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.amber} />
            <Text style={[s.noticeText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              {preview.launchNotice}
            </Text>
          </View>

          <BoardCard style={s.paymentsProofCard}>
            <BoardSectionHeader
              title="Payments proof manifest"
              accessory={<BoardPill label="Checkout disabled" tone={colors.amber} />}
            />
            <Text style={[s.paymentsProofIntro, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Paid checkout stays blocked until every provider proof row is approved from real billing evidence.
            </Text>
            <View style={s.paymentsProofGrid}>
              {paymentsProofManifest.rows.map((row) => (
                <View key={row.label} style={[s.paymentsProofCell, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[s.paymentsProofLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    {row.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.paymentsProofValue,
                      {
                        color: row.status === "ready" ? colors.sage : colors.amber,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {row.value}
                  </Text>
                  <Text numberOfLines={2} style={[s.paymentsProofDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {row.detail}
                  </Text>
                </View>
              ))}
            </View>
            {paymentsProofManifest.blockers.map((blocker) => (
              <Text
                key={blocker}
                numberOfLines={2}
                style={[s.paymentsProofBlocker, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              >
                - {blocker}
              </Text>
            ))}
          </BoardCard>

          <BoardCard style={s.premiumBoard}>
            <BoardSectionHeader
              title="Why upgrade"
              accessory={<BoardPill label={`${preview.valueSignals.length} signals`} tone={colors.sage} />}
            />
            <View style={s.signalGrid}>
              {preview.valueSignals.slice(0, 4).map((signal) => (
                <View key={signal.key} style={[s.signalTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[s.signalIcon, { backgroundColor: colors.sage + "16" }]}>
                    <Ionicons name={signalIcon(signal.key)} size={18} color={colors.sage} />
                  </View>
                  <Text style={[s.signalLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    {signal.label}
                  </Text>
                  <Text style={[s.signalDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {signal.detail}
                  </Text>
                </View>
              ))}
            </View>
          </BoardCard>

          <View style={s.planSection}>
            <BoardSectionHeader title="Plans" accessory={<BoardPill label="Checkout gated" tone={colors.amber} />} />
          </View>
          <View style={s.planStack}>
            {preview.plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                recommended={plan.id === preview.recommendedPlanId}
                colors={colors}
              />
            ))}
          </View>

          <BoardCard style={s.entitlementCard}>
            <BoardSectionHeader title="Launch entitlements" accessory={<BoardPill label="Current: Free" tone={colors.primary} />} />
            <Text style={[s.entitlementSub, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Current plan: Free
            </Text>
            <Text style={[s.entitlementNote, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              {preview.entitlements.upgradeHeadline}
            </Text>
            <View style={s.entitlementColumns}>
              <EntitlementList
                title="Included now"
                features={includedEntitlements}
                locked={false}
                colors={colors}
              />
              <EntitlementList
                title="Locked until upgrade"
                features={lockedEntitlements}
                locked
                colors={colors}
              />
            </View>
          </BoardCard>

          <View style={s.actionRow}>
            <Pressable
              onPress={showLaunchChecklist}
              accessibilityRole="button"
              accessibilityLabel="Open premium launch checklist"
              style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="clipboard-outline" size={18} color={colors.primaryForeground} />
              <Text style={[s.primaryText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>Launch checklist</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel="Back to care"
              style={({ pressed }) => [s.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[s.secondaryText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Back to care</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function EntitlementList({
  title,
  features,
  locked,
  colors,
}: {
  title: string;
  features: readonly PremiumFeatureGate[];
  locked: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={s.entitlementColumn}>
      <Text style={[s.entitlementColumnTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
        {title}
      </Text>
      {features.map((feature) => (
        <View key={feature.key} style={s.entitlementRow}>
          <View style={[s.entitlementIcon, { backgroundColor: locked ? colors.amber + "16" : colors.sage + "16" }]}>
            <Ionicons
              name={locked ? "lock-closed-outline" : "checkmark"}
              size={14}
              color={locked ? colors.amber : colors.sage}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.entitlementLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {feature.label}
            </Text>
            <Text style={[s.entitlementDetail, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {locked ? `${feature.requiredPlanId.toUpperCase()} - ${feature.detail}` : feature.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PlanCard({
  plan,
  recommended,
  colors,
}: {
  plan: PremiumPlan;
  recommended: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <BoardCard
      style={[
        s.planCard,
        {
          borderColor: recommended ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={s.planTop}>
        <View>
          <Text style={[s.planName, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{plan.name}</Text>
          <Text style={[s.planSummary, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {plan.summary}
          </Text>
        </View>
        <View style={[s.pricePill, { backgroundColor: recommended ? colors.primary : colors.background }]}>
          <Text style={[s.priceText, { color: recommended ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {plan.monthlyPrice}
          </Text>
        </View>
      </View>
      {recommended ? (
        <View style={[s.recommendedPill, { backgroundColor: colors.sage + "14" }]}>
          <Ionicons name="checkmark-circle" size={15} color={colors.sage} />
          <Text style={[s.recommendedText, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>Recommended for your current care setup</Text>
        </View>
      ) : null}
      <View style={s.featureList}>
        {plan.features.map((feature) => (
          <View key={feature} style={s.featureRow}>
            <Ionicons name="checkmark" size={15} color={colors.sage} />
            <Text style={[s.featureText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{feature}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.annualText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
        Annual target: {plan.annualPrice}
      </Text>
    </BoardCard>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  premiumValueStageCard: {
    overflow: "hidden",
    borderRadius: 8,
  },
  premiumValueStage: {
    minHeight: 372,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  premiumValueStageImage: {
    borderRadius: 8,
  },
  premiumValueStageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 20, 36, 0.14)",
  },
  premiumValueStageTop: {
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  premiumValueBubble: {
    position: "relative",
    flex: 1,
    maxWidth: 248,
    borderWidth: 2,
    borderColor: "#142033",
    backgroundColor: "rgba(255, 249, 239, 0.94)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowColor: "#081424",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  premiumValueKicker: {
    fontSize: 8,
    lineHeight: 12,
    textTransform: "uppercase",
  },
  premiumValueSpeech: {
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
  },
  premiumValueBubbleTail: {
    position: "absolute",
    width: 16,
    height: 16,
    left: 22,
    bottom: -9,
    backgroundColor: "rgba(255, 249, 239, 0.94)",
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#142033",
    transform: [{ rotate: "45deg" }],
  },
  premiumValueChip: {
    flexShrink: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  premiumValueChipText: {
    fontSize: 11,
    textTransform: "uppercase",
  },
  premiumValueSprite: {
    position: "absolute",
    right: 20,
    bottom: 134,
    width: 146,
    height: 146,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumValueSpriteShadow: {
    position: "absolute",
    width: 112,
    height: 24,
    borderRadius: 999,
    bottom: 10,
    backgroundColor: "rgba(8, 20, 36, 0.24)",
  },
  premiumValueHud: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 86,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    gap: 8,
  },
  premiumValueHudCell: {
    flex: 1,
    minWidth: 0,
  },
  premiumValueHudLabel: {
    fontSize: 7,
    lineHeight: 11,
    textTransform: "uppercase",
    opacity: 0.72,
  },
  premiumValueHudValue: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  premiumValueSignalRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 6,
  },
  premiumValueSignalBar: {
    flex: 1,
    height: 6,
    borderRadius: 2,
  },
  premiumValueFooter: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  premiumValuePlanCard: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: "center",
  },
  premiumValuePlanLabel: {
    fontSize: 10,
    textTransform: "uppercase",
  },
  premiumValuePlanValue: {
    fontSize: 15,
    marginTop: 2,
  },
  premiumValueAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  premiumValueActionText: {
    color: "#FFF9EF",
    fontSize: 12,
  },
  notice: { flexDirection: "row", gap: 9, borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 14 },
  noticeText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  paymentsProofCard: { marginTop: 14 },
  paymentsProofIntro: { fontSize: 12.5, lineHeight: 18, marginTop: -4 },
  paymentsProofGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  paymentsProofCell: {
    width: "48.5%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 118,
  },
  paymentsProofLabel: { fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.4 },
  paymentsProofValue: { fontSize: 11.5, marginTop: 4 },
  paymentsProofDetail: { fontSize: 10.5, lineHeight: 14, marginTop: 4 },
  paymentsProofBlocker: { fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  premiumBoard: { marginTop: 18 },
  signalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  signalTile: { width: "48.5%", borderWidth: 1, borderRadius: 16, padding: 14 },
  signalIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  signalLabel: { fontSize: 14 },
  signalDetail: { fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  planSection: { marginTop: 18, marginHorizontal: 2 },
  planStack: { gap: 12 },
  planCard: { borderWidth: 1.5 },
  planTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  planName: { fontSize: 20 },
  planSummary: { fontSize: 13, lineHeight: 19, marginTop: 4, maxWidth: 220 },
  pricePill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  priceText: { fontSize: 12 },
  recommendedPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginTop: 12, alignSelf: "flex-start" },
  recommendedText: { fontSize: 11.5 },
  featureList: { gap: 8, marginTop: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { flex: 1, fontSize: 13.5, lineHeight: 18 },
  annualText: { fontSize: 12, marginTop: 14 },
  entitlementCard: { marginTop: 14 },
  entitlementSub: { fontSize: 12.5, marginTop: -4 },
  entitlementNote: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  entitlementColumns: { gap: 14, marginTop: 16 },
  entitlementColumn: { gap: 10 },
  entitlementColumnTitle: { fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.5 },
  entitlementRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  entitlementIcon: { width: 27, height: 27, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  entitlementLabel: { fontSize: 13.5 },
  entitlementDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  primaryBtn: { flex: 1, height: 52, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { fontSize: 14.5 },
  secondaryBtn: { minWidth: 112, height: 52, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  secondaryText: { fontSize: 14 },
});
