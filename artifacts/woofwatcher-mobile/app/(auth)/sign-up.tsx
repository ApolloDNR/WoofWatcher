import { useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View, StyleSheet } from "react-native";

import {
  AuthShell,
  Divider,
  Field,
  FormError,
  GoogleButton,
  LocalPreviewGateway,
  PrimaryButton,
} from "@/components/auth-ui";
import { useColors } from "@/hooks/useColors";
import { isClerkConfigured } from "@/lib/auth";
import {
  executeAuthAction,
  ownerSafeProviderError,
  signUpCredentialError,
} from "@/lib/authAction";

WebBrowser.maybeCompleteAuthSession();

type SignUpAuthAction = "submit" | "verify" | "resend" | "google";

export default function SignUpScreen() {
  // Clerk hooks throw without a configured provider, so the local-preview
  // gateway renders instead of mounting the account form in preview builds.
  if (!isClerkConfigured) {
    return (
      <LocalPreviewGateway subtitle="Account creation is not connected in this preview build. Care data stays local-first until production sync providers are configured." />
    );
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
  const [submitLoading, setSubmitLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const authActionRef = useRef<SignUpAuthAction | null>(null);

  const beginAuthAction = useCallback(
    (action: SignUpAuthAction): boolean => {
      if (authActionRef.current) return false;
      authActionRef.current = action;
      return true;
    },
    [],
  );

  const endAuthAction = useCallback((action: SignUpAuthAction) => {
    if (authActionRef.current === action) authActionRef.current = null;
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync().catch(() => undefined);
    return () => void WebBrowser.coolDownAsync().catch(() => undefined);
  }, []);

  const fieldErrors = (errors?.fields ?? {}) as unknown as Record<
    string,
    { longMessage?: string } | undefined
  >;

  const handleSubmit = async () => {
    if (!beginAuthAction("submit")) return;
    await executeAuthAction({
      setLoading: setSubmitLoading,
      setError: setFormError,
      thrownMessage: signUpCredentialError(undefined),
      onFinally: () => endAuthAction("submit"),
      action: async () => {
        const passwordResult = await signUp.password({
          emailAddress,
          password,
        });
        if (passwordResult.error) {
          return signUpCredentialError(passwordResult.error);
        }

        const sendResult =
          await signUp.verifications.sendEmailCode();
        if (sendResult.error) {
          return signUpCredentialError(sendResult.error);
        }
        return undefined;
      },
    });
  };

  const handleVerify = async () => {
    if (!beginAuthAction("verify")) return;
    await executeAuthAction({
      setLoading: setVerifyLoading,
      setError: setFormError,
      thrownMessage:
        "We couldn't verify that code. Check your connection and try again.",
      onFinally: () => endAuthAction("verify"),
      action: async () => {
        const verifyResult =
          await signUp.verifications.verifyEmailCode({ code });
        if (verifyResult.error) {
          return ownerSafeProviderError(
            verifyResult.error,
            "That code didn't work. Try again or request a new one.",
          );
        }
        if (signUp.status !== "complete") {
          return "That code didn't work. Try again or request a new one.";
        }

        const finalizeResult = await signUp.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/(tabs)");
          },
        });
        if (finalizeResult.error) {
          return ownerSafeProviderError(
            finalizeResult.error,
            "Your email was verified, but account setup could not finish. Try again.",
          );
        }
        return undefined;
      },
    });
  };

  const handleResend = async () => {
    if (!beginAuthAction("resend")) return;
    await executeAuthAction({
      setLoading: setResendLoading,
      setError: setFormError,
      thrownMessage:
        "We couldn't resend the verification code. Check your connection and try again.",
      onFinally: () => endAuthAction("resend"),
      action: async () => {
        const sendResult =
          await signUp.verifications.sendEmailCode();
        if (sendResult.error) {
          return ownerSafeProviderError(
            sendResult.error,
            "A new verification code could not be sent. Try again.",
          );
        }
        return undefined;
      },
    });
  };

  const handleGoogle = useCallback(async () => {
    if (!beginAuthAction("google")) return;
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
        err instanceof Error && err.name === "AbortError"
          ? "Google sign-up was cancelled."
          : "Google sign-up could not finish. Check your connection and try again.",
      );
    } finally {
      endAuthAction("google");
      setSsoLoading(false);
    }
  }, [beginAuthAction, endAuthAction, router, startSSOFlow]);

  const busy =
    fetchStatus === "fetching" ||
    submitLoading ||
    verifyLoading ||
    resendLoading ||
    ssoLoading;
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
          error={ownerSafeProviderError(fieldErrors.code, "") || undefined}
        />
        <PrimaryButton
          label="Verify & continue"
          onPress={handleVerify}
          loading={verifyLoading}
          disabled={!code || busy}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resend verification code"
            onPress={handleResend}
            disabled={busy}
            style={({ pressed }) => [
              styles.resendButton,
              { opacity: busy ? 0.5 : pressed ? 0.72 : 1 },
            ]}
          >
            <Text
              style={[
                styles.footerLink,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {resendLoading ? "Sending…" : "Resend code"}
            </Text>
          </Pressable>
        </View>
        <View nativeID="clerk-captcha" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Create the account layer for your dog's care twin. Care data stays local-first until production sync providers are configured."
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
      />
      <Field
        label="Password"
        secureTextEntry
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
      />
      <PrimaryButton
        label="Create account"
        onPress={handleSubmit}
        loading={submitLoading}
        disabled={!emailAddress || !password || busy}
      />
      <Divider />
      <GoogleButton
        onPress={handleGoogle}
        loading={ssoLoading}
        disabled={
          submitLoading ||
          verifyLoading ||
          resendLoading ||
          fetchStatus === "fetching"
        }
      />
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
  resendButton: {
    minHeight: 44,
    justifyContent: "center",
  },
});
