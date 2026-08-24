import { useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, Text, View, StyleSheet } from "react-native";

import {
  AuthShell,
  Divider,
  Field,
  FormError,
  GoogleButton,
  PrimaryButton,
} from "@/components/auth-ui";
import { OwnerOpsUnavailableScreen } from "@/components/board/OwnerOpsBoundary";
import { useColors } from "@/hooks/useColors";
import { isClerkEnabledForBuild } from "@/lib/auth";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  // Clerk hooks require the matching provider. Production remains local-only
  // even if a valid Clerk key is accidentally present in the build environment.
  if (!isClerkEnabledForBuild) {
    return <OwnerOpsUnavailableScreen />;
  }
  return <ClerkSignUpScreen />;
}

function ClerkSignUpScreen() {
  const colors = useColors();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | undefined>();
  const [ssoLoading, setSsoLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const fieldErrors = (errors?.fields ?? {}) as unknown as Record<
    string,
    { message?: string } | undefined
  >;

  const handleSubmit = async () => {
    setFormError(undefined);
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setFormError(error.message ?? "Could not create your account.");
      return;
    }
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    setFormError(undefined);
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) return;
          router.replace("/(tabs)");
        },
      });
    } else {
      setFormError("That code didn't work. Try again or request a new one.");
    }
  };

  const handleGoogle = useCallback(async () => {
    setFormError(undefined);
    setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/(tabs)");
          },
        });
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Google sign-up was cancelled.",
      );
    } finally {
      setSsoLoading(false);
    }
  }, [router, startSSOFlow]);

  const busy = fetchStatus === "fetching";
  const awaitingCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  if (awaitingCode) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a verification code to ${emailAddress}. Enter it below to protect your household care space.`}
      >
        <FormError message={formError} />
        <Field
          label="Verification code"
          keyboardType="number-pad"
          placeholder="123456"
          value={code}
          onChangeText={setCode}
          error={fieldErrors.code?.message}
        />
        <PrimaryButton
          label="Verify & continue"
          onPress={handleVerify}
          loading={busy}
          disabled={!code}
        />
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Didn&apos;t get it?{" "}
          </Text>
          <Text
            onPress={() => signUp.verifications.sendEmailCode()}
            style={[
              styles.footerLink,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            Resend code
          </Text>
        </View>
        <View nativeID="clerk-captcha" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Create a private account for your dog's care. Care data stays on this device unless you choose an available sharing feature."
    >
      <FormError message={formError} />
      <Field
        label="Email address"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        value={emailAddress}
        onChangeText={setEmailAddress}
        error={fieldErrors.emailAddress?.message}
      />
      <Field
        label="Password"
        secureTextEntry
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password?.message}
      />
      <PrimaryButton
        label="Create account"
        onPress={handleSubmit}
        loading={busy}
        disabled={!emailAddress || !password}
      />
      <Divider />
      <GoogleButton onPress={handleGoogle} loading={ssoLoading} />
      <View style={styles.footer}>
        <Text
          style={[
            styles.footerText,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          Already have an account?{" "}
        </Text>
        <Link href="/(auth)/sign-in">
          <Text
            style={[
              styles.footerLink,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            Sign in
          </Text>
        </Link>
      </View>
      <View nativeID="clerk-captcha" />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14 },
});
