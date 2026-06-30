import { useSignIn, useSSO } from "@clerk/expo";
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
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const colors = useColors();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
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
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setFormError(error.message ?? "Could not sign in. Check your details.");
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) return;
          router.replace("/(tabs)");
        },
      });
    } else {
      setFormError("Additional verification is required to sign in.");
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
        err instanceof Error ? err.message : "Google sign-in was cancelled.",
      );
    } finally {
      setSsoLoading(false);
    }
  }, [router, startSSOFlow]);

  const busy = fetchStatus === "fetching";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Return to your household care space, review Phoenix's open loops, and keep the account layer ready for shared sync."
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
        error={fieldErrors.identifier?.message}
      />
      <Field
        label="Password"
        secureTextEntry
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password?.message}
      />
      <PrimaryButton
        label="Sign in"
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
