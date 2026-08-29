import { useSignIn, useSSO } from "@clerk/expo";
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

type SignInAction = "password" | "google";
const PASSWORD_SIGN_IN_FAILURE =
  "We couldn't sign you in. Check your email and password, then try again.";
const SESSION_ACTIVATION_FAILURE =
  "Your details were accepted, but we couldn't start your account session. Check your connection, then try again.";
const GOOGLE_SIGN_IN_FAILURE =
  "Google sign-in didn't finish. Check your connection, then try again.";

export default function SignInScreen() {
  // Clerk hooks require the matching provider. Production remains local-only
  // even if a valid Clerk key is accidentally present in the build environment.
  if (!isClerkEnabledForBuild) {
    return <OwnerOpsUnavailableScreen />;
  }
  return <ClerkSignInScreen />;
}

function ClerkSignInScreen() {
  const colors = useColors();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | undefined>();
  const [activeAction, setActiveAction] = useState<SignInAction | null>(null);
  // State updates do not become visible until React renders again. This ref
  // closes the same-frame gap so a fast second press cannot overlap password
  // and Google provider work.
  const actionGateRef = useRef<SignInAction | null>(null);

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
  const busy = providerBusy || activeAction !== null;

  const handleSubmit = async () => {
    if (busy || actionGateRef.current !== null) return;
    actionGateRef.current = "password";
    setActiveAction("password");
    setFormError(undefined);
    try {
      try {
        const { error } = await signIn.password({ emailAddress, password });
        if (error) {
          setFormError(PASSWORD_SIGN_IN_FAILURE);
          return;
        }
      } catch {
        setFormError(PASSWORD_SIGN_IN_FAILURE);
        return;
      }

      if (signIn.status === "complete") {
        try {
          const { error: finalizeError } = await signIn.finalize({
            navigate: ({ session }) => {
              if (session?.currentTask) return;
              router.replace("/(tabs)");
            },
          });
          if (finalizeError) {
            setFormError(SESSION_ACTIVATION_FAILURE);
            return;
          }
        } catch {
          setFormError(SESSION_ACTIVATION_FAILURE);
          return;
        }
      } else {
        setFormError("Additional verification is required to sign in.");
      }
    } finally {
      actionGateRef.current = null;
      setActiveAction(null);
    }
  };

  const handleGoogle = useCallback(async () => {
    if (busy || actionGateRef.current !== null) return;
    actionGateRef.current = "google";
    setActiveAction("google");
    setFormError(undefined);
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
        setFormError(GOOGLE_SIGN_IN_FAILURE);
      }
    } catch {
      setFormError(GOOGLE_SIGN_IN_FAILURE);
    } finally {
      actionGateRef.current = null;
      setActiveAction(null);
    }
  }, [busy, router, startSSOFlow]);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Return to your household care space and pick up where you left off."
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
        error={fieldErrors.identifier ? "Check your email address." : undefined}
      />
      <Field
        label="Password"
        secureTextEntry
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        error={fieldErrors.password ? "Check your password." : undefined}
      />
      <PrimaryButton
        label="Sign in"
        onPress={handleSubmit}
        loading={activeAction === "password"}
        disabled={!emailAddress || !password || busy}
      />
      <Divider />
      <GoogleButton
        onPress={handleGoogle}
        loading={activeAction === "google"}
        disabled={busy}
      />
      <View style={styles.footer}>
        <Text
          style={[
            styles.footerText,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          New here?{" "}
        </Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Create an account"
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
              Create an account
            </Text>
          </Pressable>
        </Link>
      </View>
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
});
