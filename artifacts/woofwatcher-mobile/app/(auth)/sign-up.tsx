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
  PrimaryButton,
} from "@/components/auth-ui";
import { OwnerOpsUnavailableScreen } from "@/components/board/OwnerOpsBoundary";
import { useColors } from "@/hooks/useColors";
import { isClerkEnabledForBuild } from "@/lib/auth";
import { MIN_MOBILE_TOUCH_TARGET } from "@/lib/mobileLayout";

WebBrowser.maybeCompleteAuthSession();

type EmailAction = "create" | "verify" | "resend";
type SignUpAction = EmailAction | "google";
type EmailCodeDelivery = "idle" | "sending" | "sent" | "failed";
const ACCOUNT_CREATION_FAILURE =
  "We couldn't create your account. Check your email, password, and connection, then try again.";
const EMAIL_CODE_SEND_FAILURE =
  "Your account is ready, but we couldn't send the verification code. Check your connection, then try Resend code.";
const EMAIL_VERIFICATION_FAILURE =
  "We couldn't verify that code. Check the code and your connection, then try again or request a new one.";
const SIGN_UP_SESSION_ACTIVATION_FAILURE =
  "We verified your email, but couldn't start your account session. Check your connection, then try again.";
const ADDITIONAL_SIGN_UP_REQUIREMENTS =
  "Your email was verified, but your account needs another setup step before you can continue. Return to account creation or try Google sign-up.";
const GOOGLE_SIGN_UP_FAILURE =
  "Google sign-up didn't finish. Check your connection, then try again.";

function getVerificationTitle(delivery: EmailCodeDelivery): string {
  switch (delivery) {
    case "sending":
      return "Sending your code";
    case "sent":
      return "Check your email";
    case "failed":
      return "Send a verification code";
    default:
      return "Verify your email";
  }
}

function getVerificationSubtitle(
  delivery: EmailCodeDelivery,
  emailAddress: string,
): string {
  switch (delivery) {
    case "sending":
      return `We're sending a verification code to ${emailAddress}. Keep this screen open while we finish.`;
    case "sent":
      return `We sent a verification code to ${emailAddress}. Enter it below to protect your household care space.`;
    case "failed":
      return `Verify ${emailAddress} to protect your household care space. Use Resend code to request another code.`;
    default:
      return `Verify ${emailAddress} to protect your household care space. Use Resend code to request a verification code.`;
  }
}

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
  const [emailAction, setEmailAction] = useState<EmailAction | null>(null);
  const [emailCodeDelivery, setEmailCodeDelivery] =
    useState<EmailCodeDelivery>("idle");
  const [ssoLoading, setSsoLoading] = useState(false);
  // React state alone leaves a same-frame gap between a press and the next
  // render. The shared gate prevents any email and Google action from
  // starting together during that gap.
  const actionGateRef = useRef<SignUpAction | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const fieldErrors = (errors?.fields ?? {}) as unknown as Record<
    string,
    unknown
  >;
  const providerBusy = fetchStatus === "fetching";
  const busy = providerBusy || emailAction !== null || ssoLoading;

  const handleSubmit = async () => {
    if (busy || actionGateRef.current !== null) return;
    actionGateRef.current = "create";
    setFormError(undefined);
    setEmailAction("create");
    setEmailCodeDelivery("idle");
    try {
      try {
        const { error } = await signUp.password({ emailAddress, password });
        if (error) {
          setEmailCodeDelivery("idle");
          setFormError(ACCOUNT_CREATION_FAILURE);
          return;
        }
      } catch {
        setEmailCodeDelivery("idle");
        setFormError(ACCOUNT_CREATION_FAILURE);
        return;
      }

      setEmailCodeDelivery("sending");
      try {
        const { error: sendError } =
          await signUp.verifications.sendEmailCode();
        if (sendError) {
          setEmailCodeDelivery("failed");
          setFormError(EMAIL_CODE_SEND_FAILURE);
          return;
        }
        setEmailCodeDelivery("sent");
      } catch {
        setEmailCodeDelivery("failed");
        setFormError(EMAIL_CODE_SEND_FAILURE);
      }
    } finally {
      actionGateRef.current = null;
      setEmailAction(null);
    }
  };

  const handleVerify = async () => {
    if (busy || actionGateRef.current !== null) return;
    actionGateRef.current = "verify";
    setFormError(undefined);
    setEmailAction("verify");
    try {
      try {
        const { error: verificationError } =
          await signUp.verifications.verifyEmailCode({ code });
        if (verificationError) {
          setFormError(EMAIL_VERIFICATION_FAILURE);
          return;
        }
      } catch {
        setFormError(EMAIL_VERIFICATION_FAILURE);
        return;
      }

      if (signUp.status === "complete") {
        try {
          const { error: finalizeError } = await signUp.finalize({
            navigate: ({ session }) => {
              if (session?.currentTask) return;
              router.replace("/(tabs)");
            },
          });
          if (finalizeError) {
            setFormError(SIGN_UP_SESSION_ACTIVATION_FAILURE);
            return;
          }
        } catch {
          setFormError(SIGN_UP_SESSION_ACTIVATION_FAILURE);
          return;
        }
      } else {
        setFormError(ADDITIONAL_SIGN_UP_REQUIREMENTS);
      }
    } finally {
      actionGateRef.current = null;
      setEmailAction(null);
    }
  };

  const handleResend = async () => {
    if (busy || actionGateRef.current !== null) return;
    actionGateRef.current = "resend";
    setFormError(undefined);
    setEmailAction("resend");
    setEmailCodeDelivery("sending");
    try {
      const { error: resendError } =
        await signUp.verifications.sendEmailCode();
      if (resendError) {
        setEmailCodeDelivery("failed");
        setFormError(
          "We couldn't send a new code. Check your connection, then try again.",
        );
        return;
      }
      setEmailCodeDelivery("sent");
    } catch {
      setEmailCodeDelivery("failed");
      setFormError(
        "We couldn't send a new code. Check your connection, then try again.",
      );
    } finally {
      actionGateRef.current = null;
      setEmailAction(null);
    }
  };

  const handleGoogle = useCallback(async () => {
    if (busy || actionGateRef.current !== null) return;
    actionGateRef.current = "google";
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
      } else {
        setFormError(GOOGLE_SIGN_UP_FAILURE);
      }
    } catch {
      setFormError(GOOGLE_SIGN_UP_FAILURE);
    } finally {
      actionGateRef.current = null;
      setSsoLoading(false);
    }
  }, [busy, router, startSSOFlow]);

  const awaitingCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  if (awaitingCode) {
    return (
      <AuthShell
        title={getVerificationTitle(emailCodeDelivery)}
        subtitle={getVerificationSubtitle(emailCodeDelivery, emailAddress)}
      >
        <FormError message={formError} />
        <Field
          label="Verification code"
          keyboardType="number-pad"
          placeholder="123456"
          value={code}
          onChangeText={setCode}
          editable={!busy}
          error={fieldErrors.code ? "Check your verification code." : undefined}
        />
        <PrimaryButton
          label="Verify & continue"
          onPress={handleVerify}
          loading={
            emailAction === "verify" ||
            (providerBusy && emailAction !== "resend")
          }
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
            accessibilityState={{
              disabled: busy,
              busy: emailAction === "resend",
            }}
            disabled={busy}
            onPress={handleResend}
            style={({ pressed }) => [
              styles.resendButton,
              { opacity: busy ? 0.5 : pressed ? 0.7 : 1 },
            ]}
          >
            <Text
              style={[
                styles.footerLink,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {emailAction === "resend" ? "Sending…" : "Resend code"}
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
        editable={!busy}
        error={fieldErrors.emailAddress ? "Check your email address." : undefined}
      />
      <Field
        label="Password"
        secureTextEntry
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        error={fieldErrors.password ? "Check your password." : undefined}
      />
      <PrimaryButton
        label="Create account"
        onPress={handleSubmit}
        loading={
          emailAction === "create" ||
          (providerBusy && !ssoLoading && emailAction === null)
        }
        disabled={!emailAddress || !password || busy}
      />
      <Divider />
      <GoogleButton
        onPress={handleGoogle}
        loading={ssoLoading}
        disabled={busy}
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
        <Link href="/(auth)/sign-in" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Sign in"
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            style={({ pressed }) => [
              styles.footerLinkButton,
              { opacity: busy ? 0.5 : pressed ? 0.7 : 1 },
            ]}
          >
            <Text
              style={[
                styles.footerLink,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Sign in
            </Text>
          </Pressable>
        </Link>
      </View>
      <View nativeID="clerk-captcha" />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  footerText: { flexShrink: 1, fontSize: 14, lineHeight: 20 },
  footerLink: { fontSize: 14 },
  footerLinkButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  resendButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
