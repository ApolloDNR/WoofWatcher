import { useSignIn, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, View, StyleSheet } from "react-native";

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
  signInCredentialError,
} from "@/lib/authAction";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  // Clerk hooks throw without a configured provider, so the local-preview
  // gateway renders instead of mounting the account form in preview builds.
  if (!isClerkConfigured) {
    return (
      <LocalPreviewGateway subtitle="Accounts are not connected in this preview build. Review your dog's care space in local-only mode and sign in once production auth is configured." />
    );
  }
  return <ClerkSignInScreen />;
}

function ClerkSignInScreen() {
  const colors = useColors();
  const { signIn, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | undefined>();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const authActionRef = useRef<"submit" | "google" | null>(null);

  const beginAuthAction = useCallback(
    (action: "submit" | "google"): boolean => {
      if (authActionRef.current) return false;
      authActionRef.current = action;
      return true;
    },
    [],
  );

  const endAuthAction = useCallback((action: "submit" | "google") => {
    if (authActionRef.current === action) authActionRef.current = null;
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync().catch(() => undefined);
    return () => void WebBrowser.coolDownAsync().catch(() => undefined);
  }, []);

  const handleSubmit = async () => {
    if (!beginAuthAction("submit")) return;
    await executeAuthAction({
      setLoading: setSubmitLoading,
      setError: setFormError,
      thrownMessage:
        "We couldn't reach account sign-in. Check your connection and try again.",
      onFinally: () => endAuthAction("submit"),
      action: async () => {
        const passwordResult = await signIn.password({
          emailAddress,
          password,
        });
        if (passwordResult.error) {
          return signInCredentialError(passwordResult.error);
        }
        if (signIn.status !== "complete") {
          return "This account requires a sign-in step this app version does not support. Use Google sign-in or contact support.";
        }

        const finalizeResult = await signIn.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/(tabs)");
          },
        });
        if (finalizeResult.error) {
          return ownerSafeProviderError(
            finalizeResult.error,
            "Your details were accepted, but sign-in could not finish. Try again.",
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
          ? "Google sign-in was cancelled."
          : "Google sign-in could not finish. Check your connection and try again.",
      );
    } finally {
      endAuthAction("google");
      setSsoLoading(false);
    }
  }, [beginAuthAction, endAuthAction, router, startSSOFlow]);

  const busy =
    fetchStatus === "fetching" || submitLoading || ssoLoading;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Return to your household care space, review your dog's open loops, and keep the account layer ready for shared sync."
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
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
      />
      <PrimaryButton
        label="Sign in"
        onPress={handleSubmit}
        loading={submitLoading}
        disabled={!emailAddress || !password || busy}
      />
      <Divider />
      <GoogleButton
        onPress={handleGoogle}
        loading={ssoLoading}
        disabled={submitLoading || fetchStatus === "fetching"}
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
        <Link href="/(auth)/sign-up">
          <Text
            style={[
              styles.footerLink,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            Create an account
          </Text>
        </Link>
      </View>
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
