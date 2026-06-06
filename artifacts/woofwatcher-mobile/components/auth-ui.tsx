import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
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

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.logoWrap, { backgroundColor: colors.primary }]}>
        <Ionicons name="paw" size={34} color="#FFFFFF" />
      </View>
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
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {subtitle}
      </Text>
      <View style={styles.form}>{children}</View>
    </ScrollView>
  );
}

export function Field({
  label,
  error,
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
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[styles.buttonText, { fontFamily: "Inter_600SemiBold" }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function GoogleButton({
  onPress,
  loading,
}: {
  onPress: () => void;
  loading?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.googleButton,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: loading ? 0.6 : pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons name="logo-google" size={18} color={colors.foreground} />
      <Text
        style={[
          styles.googleText,
          { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        Continue with Google
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
      style={[
        styles.formError,
        { backgroundColor: colors.secondary, borderColor: colors.destructive },
      ]}
    >
      <Text
        style={[
          styles.formErrorText,
          { color: colors.destructive, fontFamily: "Inter_500Medium" },
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#2E5846",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  title: {
    fontSize: 30,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    maxWidth: 300,
  },
  form: {
    width: "100%",
    marginTop: 28,
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
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  googleText: {
    fontSize: 15,
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
});
