import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
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
import { useReducedMotion } from "react-native-reanimated";

import {
  BoardCard,
  BoardSectionHeader,
  ModalBackdropPressable,
  ModalSheetPressable,
} from "@/components/board/BoardPrimitives";
import { PulseIcon, PULSE_COLORS, type PulseIconName } from "@/components/PulseIcon";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import {
  CARE_READ_ONLY_MESSAGE,
  runAcceptedCareMutation,
} from "@/lib/careWriteProtection";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";

const DISPLAY_SEMI = "Fredoka_600SemiBold";

export interface DietScreenProps {
  openDetails?: boolean;
}

export default function DietScreen({
  openDetails = false,
}: DietScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { state, careMutationsBlocked, updateCareDoc } = useCare();
  const { dietProfile } = state;
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const keyboardOffset = getKeyboardAvoidingVerticalOffset({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });

  const [dietOpen, setDietOpen] = useState(false);
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

  useEffect(() => {
    if (openDetails) setDietOpen(true);
  }, [openDetails]);

  const showCareReadOnly = () =>
    notifyDialog("Update WoofWatcher", CARE_READ_ONLY_MESSAGE);

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
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    const updated = updateCareDoc((doc) => ({
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
    const accepted = runAcceptedCareMutation(updated, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDietEditOpen(false);
    });
    if (!accepted) showCareReadOnly();
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

  return (
    <>
      <BoardCard style={s.card}>
        <BoardSectionHeader
          title="Diet Profile"
          accessory={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit diet profile"
                onPress={() => {
                  Haptics.selectionAsync();
                  openDietEdit();
                }}
                style={s.sectionActionTarget}
              >
                <Text
                  style={[
                    s.sectionLink,
                    {
                      color: colors.primary,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Edit
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${dietOpen ? "Hide" : "Show"} diet profile details`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDietOpen((value) => !value);
                }}
                style={s.sectionActionTarget}
              >
                <Text
                  style={[
                    s.sectionLink,
                    {
                      color: colors.copper,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {dietOpen ? "Hide" : "Details"}
                </Text>
              </Pressable>
            </View>
          }
        />
        <View style={s.dietHeader}>
          <View style={[s.dietIconWrap, { backgroundColor: colors.copper + "1A" }]}>
            <PulseIcon name="bowl" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                s.dietTitle,
                {
                  color: dietProfile.primaryFood
                    ? colors.foreground
                    : colors.mutedForeground,
                  fontFamily: DISPLAY_SEMI,
                },
              ]}
            >
              {dietProfile.primaryFood || "No diet set yet"}
            </Text>
            <Text
              style={[
                s.dietSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {dietProfile.mealSchedule || "Add food and portions with Edit."}
            </Text>
          </View>
        </View>
        {dietOpen ? (
          <View style={[s.dietBody, { borderTopColor: colors.border }]}>
            {dietItems.map((item) => (
              <View key={item.label} style={s.dietRow}>
                <View
                  style={[
                    s.dietRowIcon,
                    { backgroundColor: PULSE_COLORS[item.icon] + "14" },
                  ]}
                >
                  <PulseIcon name={item.icon} size={14} />
                </View>
                <Text
                  style={[
                    s.dietLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    s.dietValue,
                    {
                      color: item.value
                        ? colors.foreground
                        : colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {item.value || "Not set"}
                </Text>
              </View>
            ))}
            {dietProfile.vetNotes ? (
              <View
                style={[
                  s.vetNote,
                  {
                    backgroundColor: colors.amber + "14",
                    borderColor: colors.amber + "33",
                  },
                ]}
              >
                <Ionicons
                  name="information-circle"
                  size={16}
                  color={colors.amber}
                  style={{ marginTop: 1 }}
                />
                <Text
                  style={[
                    s.vetNoteText,
                    { color: colors.amber, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {dietProfile.vetNotes}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </BoardCard>

      <Modal
        visible={dietEditOpen}
        transparent
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={() => setDietEditOpen(false)}
      >
        <ModalBackdropPressable
          style={s.modalBackdrop}
          onPress={() => setDietEditOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={keyboardOffset}
            style={s.modalDock}
          >
            <ModalSheetPressable
              visible={dietEditOpen}
              onRequestClose={() => setDietEditOpen(false)}
              closeAccessibilityLabel="Close diet profile editor"
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
              <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
              <Text
                style={[
                  s.sheetTitle,
                  { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                ]}
              >
                Diet Profile
              </Text>

              {[
                {
                  label: "PRIMARY FOOD",
                  value: dPrimaryFood,
                  set: setDPrimaryFood,
                  placeholder: "e.g. Royal Canin GI dry kibble",
                },
                {
                  label: "NORMAL PORTION",
                  value: dNormalPortion,
                  set: setDNormalPortion,
                  placeholder: "e.g. 1¼ cups twice daily",
                },
                {
                  label: "MEAL SCHEDULE",
                  value: dMealSchedule,
                  set: setDMealSchedule,
                  placeholder: "e.g. 7 AM and 6 PM",
                },
                {
                  label: "TOPPERS",
                  value: dToppers,
                  set: setDToppers,
                  placeholder: "e.g. Bone broth, low-sodium",
                },
                {
                  label: "SUPPLEMENTS",
                  value: dSupplements,
                  set: setDSupplements,
                  placeholder: "e.g. Probiotic daily",
                },
                {
                  label: "BEDTIME SNACK",
                  value: dBedtimeSnack,
                  set: setDBedtimeSnack,
                  placeholder: "e.g. ½ cup kibble at 10 PM",
                },
                {
                  label: "TREATS ALLOWED",
                  value: dTreatsAllowed,
                  set: setDTreatsAllowed,
                  placeholder: "e.g. Zuke's minis, max 3/day",
                },
                {
                  label: "AVOID",
                  value: dAvoid,
                  set: setDAvoid,
                  placeholder: "e.g. Grains, chicken, rawhide",
                },
                {
                  label: "SENSITIVITIES",
                  value: dSensitivities,
                  set: setDSensitivities,
                  placeholder: "e.g. Chicken allergy confirmed",
                },
                {
                  label: "APPETITE QUIRKS",
                  value: dAppetiteQuirks,
                  set: setDAppetiteQuirks,
                  placeholder: "e.g. Eats slowly, dislikes change",
                },
                {
                  label: "VET NOTES",
                  value: dVetNotes,
                  set: setDVetNotes,
                  placeholder: "e.g. Low-fat diet per Dr. Kim",
                },
              ].map((field) => (
                <View key={field.label}>
                  <Text
                    style={[
                      s.profFieldLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {field.label}
                  </Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.set}
                    accessibilityLabel={field.label}
                    placeholder={field.placeholder}
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
              ))}

              <Pressable
                onPress={saveDiet}
                accessibilityRole="button"
                accessibilityLabel="Save diet profile"
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
                  Save diet profile
                </Text>
              </Pressable>
              </ScrollView>
            </ModalSheetPressable>
          </KeyboardAvoidingView>
        </ModalBackdropPressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 14 },
  sectionActionTarget: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLink: { fontSize: 14 },
  dietHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  dietIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  dietTitle: { fontSize: 15.5 },
  dietSub: { fontSize: 13, marginTop: 2 },
  dietBody: { borderTopWidth: 1, marginTop: 14, paddingTop: 6 },
  dietRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  dietRowIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  dietLabel: { fontSize: 13, width: 92 },
  dietValue: { fontSize: 13, flex: 1, textAlign: "right" },
  vetNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
  },
  vetNoteText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,31,36,0.45)",
    justifyContent: "flex-end",
    paddingHorizontal: 28,
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
  sheetTitle: { fontSize: 20, marginBottom: 4, letterSpacing: -0.2 },
  profFieldLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 7,
    marginTop: 16,
  },
  profField: {
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  profSaveBtn: {
    marginTop: 24,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  profSaveBtnText: { fontSize: 15.5 },
});
