import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deriveOnboardingStatus } from "@workspace/care-domain";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { isClerkConfigured, useWoofAuth } from "@/lib/auth";
import { buildAuthSetupProofManifest } from "@/lib/authProviderProof";
import {
  applyBreedTemplateToAvatarConfig,
  deriveSetupTwinPlan,
} from "@/lib/breedTemplateMatch";
import { isOwnerOpsBuild } from "@/lib/buildChannel";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
} from "@/lib/mobileLayout";
import {
  applySetupWizardDraft,
  buildSetupWizardConfirmation,
  createSetupWizardDraft,
  type SetupWizardDraft,
  type SetupWizardHouseholdMode,
} from "@/lib/setupWizard";

const DISPLAY_SEMI = "Fredoka_600SemiBold";
// Storybook mockup: big warm serif for celebration titles (same face the
// board route headers use).
const TITLE_SERIF = "Fraunces_700Bold";

// Placeholders must read as hints, not as filled values: soften the muted
// foreground token with alpha so an empty form never looks complete while
// the progress card still says "0/4 ready".
const PLACEHOLDER_TEXT_ALPHA = "80";

type IoniconName = keyof typeof Ionicons.glyphMap;

// Section names as they read on this screen, keyed by onboarding step id, so
// the disabled save button can say exactly which cards still need attention.
const SETUP_SECTION_NAME_BY_STEP_ID: Record<string, string> = {
  "dog-profile": "Dog profile",
  "diet-profile": "Diet baseline",
  "starter-routine": "Starter routine",
  "household-caregiver": "Household caregiver",
};

function formatSectionList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

const ROUTINE_TYPES: { label: string; value: string; icon: IoniconName }[] = [
  { label: "Meal", value: "meal", icon: "restaurant-outline" },
  { label: "Walk", value: "walk", icon: "paw-outline" },
  { label: "Medication", value: "medication", icon: "medical-outline" },
  { label: "Care", value: "care", icon: "heart-outline" },
];

const HOUSEHOLD_MODES: {
  label: string;
  value: SetupWizardHouseholdMode;
  icon: IoniconName;
  detail: string;
}[] = [
  {
    label: "Create household",
    value: "create",
    icon: "home-outline",
    detail: "Start this dog's shared home base for routines, logs, reports, and invites later.",
  },
  {
    label: "Join by invite",
    value: "join",
    icon: "mail-open-outline",
    detail: "Have an invite code? Enter it to join an existing household.",
  },
  {
    label: "Local preview",
    value: "local",
    icon: "phone-portrait-outline",
    detail: "Keep everything on this device for now - you can connect an account later.",
  },
];

export default function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ownerOps = isOwnerOpsBuild();
  const { state, updateCareDoc, isLoaded } = useCare();
  const { isSignedIn } = useWoofAuth();
  const { avatarConfig, hasConfiguredAvatar, saveAvatarConfig } = useAvatar();
  const [draft, setDraft] = useState<SetupWizardDraft>(() => createSetupWizardDraft(state));
  const [dirty, setDirty] = useState(false);
  // Confirm toggle for the breed-matched twin swap. hasConfiguredAvatar
  // already blocks the swap when the owner customized the twin, but it cannot
  // tell "never opened Avatar Studio" apart from "deliberately re-saved the
  // default shepherd", so the swap stays owner-confirmable here. Defaults ON.
  const [matchTwinToBreed, setMatchTwinToBreed] = useState(true);
  // Snapshot of the save celebration, captured at save time so the sheet
  // stays stable while care and avatar state update underneath it.
  const [successMoment, setSuccessMoment] = useState<{
    dogName: string;
    twinLine: string;
    templateLine: string;
  } | null>(null);

  useEffect(() => {
    if (!isLoaded || dirty) return;
    setDraft(createSetupWizardDraft(state));
  }, [dirty, isLoaded, state]);

  const preview = useMemo(() => applySetupWizardDraft(state, draft, state.updatedAt), [draft, state]);
  const onboarding = useMemo(
    () =>
      deriveOnboardingStatus({
        profile: preview.profile,
        dietProfile: preview.dietProfile,
        routines: preview.routines,
        caregivers: preview.caregivers,
      }),
    [preview],
  );
  const confirmation = useMemo(
    () => buildSetupWizardConfirmation(preview, { isSignedIn: Boolean(isSignedIn), isClerkConfigured }),
    [isSignedIn, preview],
  );
  const authSetupProofManifest = buildAuthSetupProofManifest(state.launchProviderProfile.authSetupProofEvidence ?? undefined);
  // Breed-matched pixel twin plan: previewed under the breed field so the
  // template swap on save is never a surprise.
  const twinPlan = useMemo(
    () =>
      deriveSetupTwinPlan({
        breed: draft.breed,
        dogName: preview.profile.name,
        currentTemplateId: avatarConfig.templateId,
        hasConfiguredAvatar,
        matchTwinToBreed,
      }),
    [avatarConfig.templateId, draft.breed, hasConfiguredAvatar, matchTwinToBreed, preview.profile.name],
  );

  const setField = (key: keyof SetupWizardDraft, value: string) => {
    setDirty(true);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const householdReady = draft.householdMode !== "join" || draft.inviteCode.trim().length >= 3;
  const canSave = onboarding.isComplete && householdReady;

  // Which sections still block the save, in this screen's own words. Shown
  // under the CTA and echoed when a blocked save is tapped, so the disabled
  // state never reads as a dead button.
  const remainingSections = [
    ...onboarding.steps
      .filter((step) => !step.done)
      .map((step) => SETUP_SECTION_NAME_BY_STEP_ID[step.id] ?? step.title),
    ...(householdReady ? [] : ["the invite code"]),
  ];
  const saveBlockedMessage = remainingSections.length
    ? `Complete ${formatSectionList(remainingSections)} to save.`
    : "";

  const saveSetup = () => {
    if (!canSave) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      notifyDialog("Almost there", saveBlockedMessage);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateCareDoc((doc) => applySetupWizardDraft(doc, draft));
    if (twinPlan.willSwapTemplate) {
      // Persist through AvatarContext.saveAvatarConfig - the same state path
      // Avatar Studio's Save uses - with the template-picker patch, so the
      // room twin follows the typed breed without duplicating studio logic.
      void saveAvatarConfig(
        applyBreedTemplateToAvatarConfig(
          avatarConfig,
          twinPlan.resultTemplateId,
          preview.profile.name,
        ),
      ).catch(() => {});
    }
    // In-app success sheet (Alert is a no-op on react-native-web); the
    // hand-off to Today or Plan happens from the sheet's own buttons.
    setSuccessMoment({
      dogName: preview.profile.name,
      twinLine: twinPlan.successLine,
      templateLine: twinPlan.willSwapTemplate
        ? `Twin: ${twinPlan.resultTemplateLabel} - change anytime in Avatar Studio.`
        : twinPlan.previewLine,
    });
  };

  const meetDog = () => {
    Haptics.selectionAsync();
    setSuccessMoment(null);
    router.replace("/(tabs)");
  };

  const reviewPlan = () => {
    Haptics.selectionAsync();
    setSuccessMoment(null);
    router.replace("/calendar");
  };

  const finishLater = () => {
    Haptics.selectionAsync();
    router.replace("/(tabs)");
  };
  const openAuthSetupProofMission = () => {
    Haptics.selectionAsync();
    router.push("/care-twin-qa?qaSurface=auth-setup-onboarding-proof" as never);
  };

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "setup",
  });
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const keyboardOffset = getKeyboardAvoidingVerticalOffset({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "setup",
  });
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  return (
    <>
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding, paddingHorizontal: 20 }}
        >
          <BoardRouteHeader
            kicker="Care foundation"
            title="Set up WoofWatcher"
            subtitle="One clean setup pass gives Today, Log, Reports, Records, and WoofGuide the context they need."
            icon="sparkles-outline"
          />

          <BoardCard style={s.progressCard}>
            <BoardSectionHeader
              title="Setup progress"
              accessory={<BoardPill label={`${onboarding.completedCount}/${onboarding.totalCount} ready`} tone={colors.primary} />}
            />
            <View style={s.progressTop}>
              <View>
                <Text style={[s.progressValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {onboarding.completedCount}/{onboarding.totalCount}
                </Text>
                <Text style={[s.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Steps to confirm before saving
                </Text>
              </View>
              <View style={[s.percentPill, { backgroundColor: colors.primary + "16" }]}>
                <Text style={[s.percentText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{onboarding.percent}%</Text>
              </View>
            </View>
            <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[s.progressFill, { width: `${onboarding.percent}%`, backgroundColor: colors.primary }]} />
            </View>
            <View style={s.stepGrid}>
              {onboarding.steps.map((step) => (
                <View key={step.id} style={s.stepItem}>
                  <Ionicons
                    name={step.done ? "checkmark-circle" : "ellipse-outline"}
                    size={15}
                    color={step.done ? colors.sage : colors.mutedForeground}
                  />
                  <Text numberOfLines={1} style={[s.stepText, { color: step.done ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {(() => {
                      const t = step.title.replace("Set up ", "").replace("Add ", "");
                      return t.charAt(0).toUpperCase() + t.slice(1);
                    })()}
                  </Text>
                </View>
              ))}
            </View>
          </BoardCard>

          <Section title="Dog profile" icon="paw-outline">
            <Field label="Name" value={draft.dogName} placeholder="Phoenix" onChangeText={(value) => setField("dogName", value)} />
            <Field label="Breed or mix" value={draft.breed} placeholder="German Shepherd mix" onChangeText={(value) => setField("breed", value)} />
            <View style={s.twinPreview}>
              <View style={s.twinLineRow}>
                <Ionicons name="sparkles-outline" size={14} color={colors.copper} />
                <Text style={[s.twinLineText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {twinPlan.previewLine}
                </Text>
              </View>
              {twinPlan.swapAvailable ? (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Match twin to breed on save"
                  aria-checked={matchTwinToBreed}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMatchTwinToBreed((value) => !value);
                  }}
                  style={({ pressed }) => [
                    s.twinToggle,
                    {
                      backgroundColor: matchTwinToBreed ? colors.primary + "14" : colors.background,
                      borderColor: matchTwinToBreed ? colors.primary : colors.border,
                      opacity: pressed ? 0.76 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={matchTwinToBreed ? "checkbox" : "square-outline"}
                    size={17}
                    color={matchTwinToBreed ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[s.twinToggleText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    Match twin to breed on save
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={s.twoCol}>
              <Field label="Weight" value={draft.weight} placeholder="68" keyboardType="decimal-pad" onChangeText={(value) => setField("weight", value)} />
              <Field label="Unit" value={draft.weightUnit} placeholder="lb" onChangeText={(value) => setField("weightUnit", value)} />
            </View>
            <Field
              label="Care focus"
              value={draft.careFocus}
              placeholder="Support anxious eating and steady routines"
              multiline
              onChangeText={(value) => setField("careFocus", value)}
            />
          </Section>

          <Section title="Diet baseline" icon="restaurant-outline">
            <Field label="Food" value={draft.primaryFood} placeholder="Sensitive kibble" onChangeText={(value) => setField("primaryFood", value)} />
            <Field label="Normal portion" value={draft.normalPortion} placeholder="1 cup" onChangeText={(value) => setField("normalPortion", value)} />
            <Field label="Meal schedule" value={draft.mealSchedule} placeholder="7 AM and 6 PM" onChangeText={(value) => setField("mealSchedule", value)} />
          </Section>

          <Section title="Starter routine" icon="calendar-outline">
            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>TYPE</Text>
            <View style={s.typeRow}>
              {ROUTINE_TYPES.map((item) => {
                const selected = draft.routineType === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Routine type ${item.label}`}
                    aria-selected={selected}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setField("routineType", item.value);
                    }}
                    style={({ pressed }) => [
                      s.typePill,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={14} color={selected ? "#fff" : colors.primary} />
                    <Text style={[s.typeText, { color: selected ? "#fff" : colors.foreground, fontFamily: "Inter_700Bold" }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Routine name" value={draft.routineLabel} placeholder="Breakfast" onChangeText={(value) => setField("routineLabel", value)} />
            <Field label="Time" value={draft.routineTime} placeholder="7:30 AM" onChangeText={(value) => setField("routineTime", value)} />
          </Section>

          <Section title="Household path" icon="home-outline">
            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>HOW SHOULD THIS CARE HOME START?</Text>
            <View style={s.modeStack}>
              {HOUSEHOLD_MODES.map((item) => {
                const selected = draft.householdMode === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    aria-selected={selected}
                    accessibilityLabel={`${item.label}. ${item.detail}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setField("householdMode", item.value);
                    }}
                    style={({ pressed }) => [
                      s.modeCard,
                      {
                        backgroundColor: selected ? colors.primary + "14" : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.76 : 1,
                      },
                    ]}
                  >
                    <View style={[s.modeIcon, { backgroundColor: selected ? colors.primary : colors.primary + "16" }]}>
                      <Ionicons name={item.icon} size={16} color={selected ? "#fff" : colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.modeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{item.label}</Text>
                      <Text style={[s.modeDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{item.detail}</Text>
                    </View>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                );
              })}
            </View>
            <Field
              label="Household name"
              value={draft.householdName}
              placeholder="Phoenix House"
              onChangeText={(value) => setField("householdName", value)}
            />
            {draft.householdMode === "join" && (
              <Field
                label="Invite code"
                value={draft.inviteCode}
                placeholder="WW-42"
                autoCapitalize="characters"
                onChangeText={(value) => setField("inviteCode", value)}
              />
            )}
          </Section>

          <Section title="Household caregiver" icon="people-outline">
            <Field label="Name" value={draft.caregiverName} placeholder="Apollo" onChangeText={(value) => setField("caregiverName", value)} />
            <Field label="Role" value={draft.caregiverRole} placeholder="Primary caregiver" onChangeText={(value) => setField("caregiverRole", value)} />
          </Section>

          <BoardCard style={s.confirmationCard}>
            <BoardSectionHeader
              title="After save"
              accessory={<BoardPill label="Review" tone={colors.amber} />}
            />
            <Text style={[s.confirmationTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{confirmation.title}</Text>
            <Text style={[s.householdLabel, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{confirmation.householdLabel}</Text>
            <Text style={[s.confirmationDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{confirmation.detail}</Text>
            <View style={s.confirmationRows}>
              {confirmation.nextActions.map((item) => (
                <View key={item} style={s.confirmationRow}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.sage} />
                  <Text style={[s.confirmationItem, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={[s.boundaryBox, { backgroundColor: colors.amber + "18", borderColor: colors.amber + "55" }]}>
              <Ionicons name="lock-closed-outline" size={15} color={colors.copper} />
              <Text style={[s.boundaryText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {confirmation.syncLabel} {confirmation.providerBoundary}
              </Text>
            </View>
          </BoardCard>

          {ownerOps ? (
          <BoardCard style={s.authSetupProofCard}>
            <BoardSectionHeader
              title="Auth/Setup proof manifest"
              accessory={<BoardPill label="Native proof blocked" tone={colors.amber} />}
            />
            <View style={s.authSetupProofGrid}>
              {authSetupProofManifest.rows.map((row) => (
                <View key={row.label} style={[s.authSetupProofCell, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[s.authSetupProofLabel, { color: colors.mutedForeground, fontFamily: "Inter_800ExtraBold" }]}>
                    {row.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.authSetupProofValue,
                      { color: row.status === "ready" ? colors.sage : colors.amber, fontFamily: "Inter_800ExtraBold" },
                    ]}
                  >
                    {row.value}
                  </Text>
                  <Text numberOfLines={2} style={[s.authSetupProofDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {row.detail}
                  </Text>
                </View>
              ))}
            </View>
            {authSetupProofManifest.blockers.map((blocker) => (
              <Text key={blocker} numberOfLines={2} style={[s.authSetupProofBlocker, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                - {blocker}
              </Text>
            ))}
          </BoardCard>
          ) : null}

          <View style={s.actions}>
            <Pressable
              onPress={saveSetup}
              accessibilityRole="button"
              accessibilityLabel={householdReady ? "Save foundation" : "Add invite code"}
              accessibilityHint={canSave ? undefined : saveBlockedMessage}
              aria-disabled={!canSave}
              style={({ pressed }) => [
                s.saveBtn,
                { backgroundColor: canSave ? colors.primary : colors.border, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color={canSave ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[s.saveText, { color: canSave ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                {householdReady ? "Save foundation" : "Add invite code"}
              </Text>
            </Pressable>
            {!canSave && saveBlockedMessage ? (
              <Text
                aria-live="polite"
                style={[s.saveHint, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
              >
                {saveBlockedMessage}
              </Text>
            ) : null}
            <Pressable
              onPress={finishLater}
              accessibilityRole="button"
              accessibilityLabel="Finish setup later"
              style={({ pressed }) => [s.laterBtn, { opacity: pressed ? 0.65 : 1 }]}
            >
              <Text style={[s.laterText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>Finish later</Text>
            </Pressable>
            {ownerOps ? (
              <Pressable
                onPress={openAuthSetupProofMission}
                accessibilityRole="button"
                accessibilityLabel="Open auth and setup proof mission"
                style={({ pressed }) => [
                  s.proofBtn,
                  { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.copper} />
                <Text style={[s.proofText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Open setup proof</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save celebration: an in-app board sheet instead of a native alert,
          so the success moment works on every platform and hands off to
          Today or Plan without governance copy. */}
      <Modal
        visible={successMoment !== null}
        transparent
        animationType="slide"
        onRequestClose={meetDog}
      >
        <Pressable
          accessibilityLabel="Continue to Today"
          style={s.sheetBackdrop}
          onPress={meetDog}
        >
          <Pressable onPress={(event) => event.stopPropagation()}>
            <BoardCard style={[s.sheetCard, { paddingBottom: modalSheetBottomPadding }]}>
              <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
              <View style={[s.sheetBadge, { backgroundColor: colors.primary + "16" }]}>
                <Ionicons name="sparkles" size={26} color={colors.primary} />
              </View>
              <Text style={[s.sheetKicker, { color: colors.copper, fontFamily: DISPLAY_SEMI }]}>
                Care foundation saved
              </Text>
              <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: TITLE_SERIF }]}>
                {successMoment?.twinLine}
              </Text>
              <Text style={[s.sheetTwinLine, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                {successMoment?.templateLine}
              </Text>
              <View style={s.sheetBoundaryRow}>
                <Ionicons name="lock-closed-outline" size={13} color={colors.mutedForeground} />
                <Text style={[s.sheetBoundaryText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Everything stays on this device.
                </Text>
              </View>
              <Pressable
                onPress={meetDog}
                accessibilityRole="button"
                accessibilityLabel={`Meet ${successMoment?.dogName ?? "your dog"}`}
                style={({ pressed }) => [
                  s.saveBtn,
                  s.sheetPrimaryBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
                ]}
              >
                <Ionicons name="paw" size={17} color={colors.primaryForeground} />
                <Text style={[s.saveText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                  Meet {successMoment?.dogName ?? "your dog"}
                </Text>
              </Pressable>
              <Pressable
                onPress={reviewPlan}
                accessibilityRole="button"
                accessibilityLabel="Review plan"
                style={({ pressed }) => [
                  s.sheetSecondaryBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Text style={[s.sheetSecondaryText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  Review plan
                </Text>
              </Pressable>
            </BoardCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IoniconName;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <BoardCard style={s.section}>
      <View style={s.sectionHead}>
        <View style={[s.sectionIcon, { backgroundColor: colors.primary + "16" }]}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{title}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </BoardCard>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  multiline = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground + PLACEHOLDER_TEXT_ALPHA}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        style={[
          s.field,
          multiline ? s.fieldMultiline : null,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
            fontFamily: multiline ? "Inter_400Regular" : "Inter_600SemiBold",
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  progressCard: { marginBottom: 16 },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressValue: { fontSize: 28 },
  progressLabel: { fontSize: 12, marginTop: 1 },
  percentPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13 },
  percentText: { fontSize: 13 },
  progressTrack: { height: 7, borderRadius: 4, overflow: "hidden", marginTop: 14 },
  progressFill: { height: "100%", borderRadius: 4 },
  stepGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 5, width: "47%" },
  stepText: { fontSize: 11.5 },
  section: { marginBottom: 14 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18 },
  sectionBody: { marginTop: 12, gap: 11 },
  fieldLabel: { fontSize: 10.5, letterSpacing: 0.5, marginBottom: 7 },
  field: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  fieldMultiline: { minHeight: 76, textAlignVertical: "top" },
  twoCol: { flexDirection: "row", gap: 10 },
  twinPreview: { gap: 8, marginTop: -3 },
  twinLineRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  twinLineText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  twinToggle: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  twinToggleText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 2 },
  typePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  typeText: { fontSize: 12.5 },
  modeStack: { gap: 9, marginBottom: 2 },
  modeCard: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  modeIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  modeTitle: { fontSize: 13.5 },
  modeDetail: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  confirmationCard: { marginBottom: 14 },
  confirmationTitle: { fontSize: 19, marginTop: 10 },
  householdLabel: { fontSize: 12, marginTop: 2 },
  confirmationDetail: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  confirmationRows: { gap: 8, marginTop: 12 },
  confirmationRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  confirmationItem: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  boundaryBox: { borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 13 },
  boundaryText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  authSetupProofCard: { marginBottom: 14 },
  authSetupProofGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  authSetupProofCell: {
    width: "48.5%",
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
  },
  authSetupProofLabel: { fontSize: 9, lineHeight: 12, textTransform: "uppercase" },
  authSetupProofValue: { fontSize: 11, lineHeight: 14, marginTop: 4 },
  authSetupProofDetail: { fontSize: 10, lineHeight: 14, marginTop: 4 },
  authSetupProofBlocker: { fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  actions: { gap: 12, marginTop: 8 },
  saveBtn: { height: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveText: { fontSize: 15.5 },
  saveHint: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: -4, paddingHorizontal: 8 },
  laterBtn: { height: 42, alignItems: "center", justifyContent: "center" },
  laterText: { fontSize: 14 },
  proofBtn: { minHeight: 42, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  proofText: { fontSize: 12.5 },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(8, 20, 36, 0.45)" },
  sheetCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, marginBottom: 14 },
  sheetBadge: { alignSelf: "center", width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  sheetKicker: { fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", textAlign: "center" },
  sheetTitle: { fontSize: 23, lineHeight: 29, textAlign: "center", marginTop: 5 },
  sheetTwinLine: { fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 8 },
  sheetBoundaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 12 },
  sheetBoundaryText: { fontSize: 11.5, lineHeight: 16 },
  sheetPrimaryBtn: { marginTop: 18 },
  sheetSecondaryBtn: { height: 46, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 10 },
  sheetSecondaryText: { fontSize: 13.5 },
});
