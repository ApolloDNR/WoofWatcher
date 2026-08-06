import { Redirect, type Href, useLocalSearchParams } from "expo-router";
import { resolveCanonicalDestination } from "@/lib/navigationOwnership";

export default function LegacyMoreBridge() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const destination = resolveCanonicalDestination({ pathname: "/woofguide", params });
  const redirectHref: Href = destination.params
    ? { pathname: destination.pathname, params: { ...destination.params } }
    : destination.pathname;
  return <Redirect href={redirectHref} />;
}
