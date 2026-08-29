import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { WoofWatcherLogo } from "@/components/brand/WoofWatcherLogo";
import { isClerkEnabledForBuild } from "@/lib/auth";
import { isOwnerOpsBuild } from "@/lib/buildChannel";
import { buildAuthSetupProofManifest } from "@/lib/authProviderProof";
import {
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import { pixelImageStyle, stageImageFill } from "@/lib/pixelRendering";

const PIXEL_ROOM_SOURCE = require("@/assets/avatar/rooms/phoenix-room-day-option-b.png");
const PIXEL_DOG_SOURCE = require("@/assets/avatar/phoenix/approved/phoenix-main-avatar-v2-crisp.png");
const DISPLAY_SEMI = "Fredoka_600SemiBold";
const BUBBLE_INK = "#142033";

const TRUST_STEPS = [
  {
    icon: "shield-checkmark-outline" as const,
    label: "Provider account",
    detail: isClerkEnabledForBuild ? "Provider enabled" : "Local-only mode",
  },
  {
    icon: "home-outline" as const,
    label: "Local-first care",
    detail: "Logs stay usable on this device while sync is configured.",
  },
  {
    icon: "sparkles-outline" as const,
    label: "CareTwin ready",
    detail:
      "Set up your dog, then invite your household when providers are live.",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "auth",
  });
  const ownerOps = isOwnerOpsBuild();
  const openAuthSetupProofMission = () => {
    Haptics.selectionAsync();
    router.push("/care-twin-qa?qaSurface=auth-setup-onboarding-proof" as never);
  };
  const authSetupProofManifest = ownerOps
    ? buildAuthSetupProofManifest()
    : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: topPadding, paddingBottom: bottomPadding },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View
        accessibilityLabel="WoofWatcher CareTwin account gateway"
        style={[styles.gateway, { borderColor: colors.border }]}
      >
        <View style={styles.gatewayTop}>
          <WoofWatcherLogo
            layout="row"
            size={42}
            wordmarkSize={28}
            navy={colors.foreground}
            copper={colors.copper}
          />
          <View
            style={[
              styles.modePill,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={
                isClerkEnabledForBuild
                  ? "cloud-done-outline"
                  : "phone-portrait-outline"
              }
              size={13}
              color={colors.sage}
            />
            <Text
              style={[
                styles.modePillText,
                { color: colors.sage, fontFamily: "Inter_700Bold" },
              ]}
            >
              {isClerkEnabledForBuild ? "Account ready" : "Local preview"}
            </Text>
          </View>
        </View>

        <ImageBackground
          source={PIXEL_ROOM_SOURCE}
          resizeMode="cover"
          imageStyle={[stageImageFill, styles.stageImage, pixelImageStyle]}
          style={styles.stage}
        >
          <View
            style={[
              styles.speechBubble,
              { backgroundColor: colors.ivory, borderColor: BUBBLE_INK },
            ]}
          >
            <Text
              style={[
                styles.speechKicker,
                { color: colors.copper, fontFamily: DISPLAY_SEMI },
              ]}
            >
              CARETWIN ACCOUNT GATEWAY
            </Text>
            <Text
              style={[
                styles.speechText,
                { color: BUBBLE_INK, fontFamily: "Inter_700Bold" },
              ]}
            >
              Real care. Pixel heart.
            </Text>
          </View>
          <Image
            source={PIXEL_DOG_SOURCE}
            resizeMode="contain"
            fadeDuration={0}
            style={[styles.stageDog, pixelImageStyle]}
          />
          <View
            style={[
              styles.stageHud,
              { backgroundColor: colors.ivory, borderColor: colors.border },
            ]}
          >
            <View style={[styles.stageDot, { backgroundColor: colors.sage }]} />
            <Text
              style={[
                styles.stageHudText,
                { color: BUBBLE_INK, fontFamily: "Inter_700Bold" },
              ]}
            >
              Your dog's care starts here
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.trustGrid}>
          {TRUST_STEPS.map((step) => (
            <View
              key={step.label}
              style={[
                styles.trustTile,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name={step.icon} size={16} color={colors.copper} />
              <Text
                style={[
                  styles.trustLabel,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {step.label}
              </Text>
              <Text
                style={[
                  styles.trustDetail,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {step.detail}
              </Text>
            </View>
          ))}
        </View>
        {ownerOps && authSetupProofManifest ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open auth and setup proof mission"
              onPress={openAuthSetupProofMission}
              style={({ pressed }) => [
                styles.proofButton,
                {
                  backgroundColor: colors.ivory,
                  borderColor: colors.copper,
                  opacity: pressed ? 0.76 : 1,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={15}
                color={colors.copper}
              />
              <Text
                style={[
                  styles.proofButtonText,
                  { color: BUBBLE_INK, fontFamily: "Inter_800ExtraBold" },
                ]}
              >
                Open setup proof
              </Text>
            </Pressable>
            <View
              style={[
                styles.proofManifest,
                { backgroundColor: colors.ivory, borderColor: colors.border },
              ]}
            >
              <View style={styles.proofManifestHead}>
                <Text
                  style={[
                    styles.proofManifestTitle,
                    { color: BUBBLE_INK, fontFamily: "Inter_800ExtraBold" },
                  ]}
                >
                  Auth/Setup proof manifest
                </Text>
                <Text
                  style={[
                    styles.proofManifestPill,
                    { color: colors.copper, fontFamily: "Inter_800ExtraBold" },
                  ]}
                >
                  Native proof blocked
                </Text>
              </View>
              <View style={styles.proofManifestGrid}>
                {authSetupProofManifest.rows.map((row) => (
                  <View
                    key={row.label}
                    style={[
                      styles.proofManifestCell,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.proofManifestLabel,
                        {
                          color: colors.copper,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {row.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.proofManifestValue,
                        {
                          color:
                            row.status === "ready" ? colors.sage : BUBBLE_INK,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {row.value}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.proofManifestDetail,
                        { color: BUBBLE_INK, fontFamily: "Inter_500Medium" },
                      ]}
                    >
                      {row.detail}
                    </Text>
                  </View>
                ))}
              </View>
              {authSetupProofManifest.blockers.map((blocker) => (
                <Text
                  key={blocker}
                  numberOfLines={2}
                  style={[
                    styles.proofManifestBlocker,
                    { color: BUBBLE_INK, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  - {blocker}
                </Text>
              ))}
            </View>
          </>
        ) : null}
      </View>

      <View
        style={[
          styles.formCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {subtitle}
        </Text>
        <View style={styles.form}>{children}</View>
      </View>
    </ScrollView>
  );
}

export function Field({
  label,
  error,
  accessibilityLabel,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text
        style={[
          styles.label,
          { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
            color: colors.foreground,
            fontFamily: "Inter_400Regular",
          },
        ]}
        {...props}
      />
      {error ? (
        <Text
          style={[
            styles.error,
            { color: colors.destructive, fontFamily: "Inter_400Regular" },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: Boolean(isDisabled),
        busy: Boolean(loading),
      }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.primary,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            {
              color: colors.primaryForeground,
              fontFamily: "Inter_600SemiBold",
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function LocalPreviewGateway({ subtitle }: { subtitle: string }) {
  const colors = useColors();
  const router = useRouter();
  return (
    <AuthShell title="Local preview" subtitle={subtitle}>
      <PrimaryButton
        label="Continue in local preview"
        onPress={() => router.replace("/(tabs)")}
      />
      <Text
        style={[
          styles.previewBoundary,
          { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
        ]}
      >
        Provider sign-in stays off until production auth setup and launch
        approval are complete. Care data stays on this device.
      </Text>
    </AuthShell>
  );
}

export function GoogleButton({
  onPress,
  loading,
  disabled,
}: {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  const isDisabled = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        loading ? "Connecting to Google" : "Continue with Google"
      }
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.googleButton,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: isDisabled ? 0.6 : pressed ? 0.9 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.foreground} />
      ) : (
        <Ionicons name="logo-google" size={18} color={colors.foreground} />
      )}
      <Text
        style={[
          styles.googleText,
          { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {loading ? "Connecting to Google…" : "Continue with Google"}
      </Text>
    </Pressable>
  );
}

export function Divider() {
  const colors = useColors();
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      <Text
        style={[
          styles.dividerText,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        or
      </Text>
      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

export function FormError({ message }: { message?: string }) {
  const colors = useColors();
  if (!message) return null;
  return (
    <View
      role="alert"
      accessibilityRole="alert"
      aria-live="assertive"
      style={[
        styles.formError,
        {
          backgroundColor: colors.destructive,
          borderColor: colors.destructive,
        },
      ]}
    >
      <Text
        style={[
          styles.formErrorText,
          {
            color: colors.isDark
              ? colors.brandNavy
              : colors.destructiveForeground,
            fontFamily: "Inter_700Bold",
          },
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    alignItems: "center",
  },
  gateway: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 28,
    padding: 10,
    marginBottom: 14,
    overflow: "hidden",
  },
  gatewayTop: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  modePill: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modePillText: {
    fontSize: 11,
    textTransform: "uppercase",
  },
  stage: {
    minHeight: 230,
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  stageImage: {
    borderRadius: 20,
  },
  speechBubble: {
    position: "absolute",
    left: 18,
    top: 18,
    maxWidth: 194,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  speechKicker: {
    fontSize: 9,
    letterSpacing: 0,
    marginBottom: 3,
  },
  speechText: {
    fontSize: 15,
    lineHeight: 19,
  },
  stageDog: {
    position: "absolute",
    right: -10,
    bottom: 10,
    width: 205,
    height: 205,
  },
  stageHud: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 13,
    margin: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stageDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  stageHudText: {
    fontSize: 13,
  },
  trustGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  trustTile: {
    flex: 1,
    minHeight: 94,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 5,
  },
  trustLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  trustDetail: {
    fontSize: 10,
    lineHeight: 13,
  },
  proofButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  proofButtonText: {
    fontSize: 11,
    lineHeight: 14,
  },
  proofManifest: {
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 10,
    padding: 10,
  },
  proofManifestHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  proofManifestTitle: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  proofManifestPill: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: "uppercase",
  },
  proofManifestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  proofManifestCell: {
    width: "48.5%",
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  proofManifestLabel: {
    fontSize: 8.5,
    lineHeight: 11,
    textTransform: "uppercase",
  },
  proofManifestValue: {
    fontSize: 10.5,
    lineHeight: 13,
    marginTop: 4,
  },
  proofManifestDetail: {
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 4,
  },
  proofManifestBlocker: {
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 7,
  },
  formCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  title: {
    fontSize: 28,
    textAlign: "left",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "left",
    marginTop: 8,
    lineHeight: 21,
  },
  form: {
    width: "100%",
    marginTop: 22,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: {
    fontSize: 12,
    marginTop: 6,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  googleButton: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  googleText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
  },
  formError: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  formErrorText: {
    fontSize: 13,
  },
  previewBoundary: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 16,
  },
});
