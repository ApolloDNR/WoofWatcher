import {
  Redirect,
  type Href,
  useLocalSearchParams,
} from "expo-router";

import { resolvePlanReminderDestination } from "@/lib/planReminderCenter";

export default function RemindersCompatibilityRoute() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const destination = resolvePlanReminderDestination(params);
  const redirectHref: Href = destination.params
    ? { pathname: destination.pathname, params: { ...destination.params } }
    : destination.pathname;

  return <Redirect href={redirectHref} />;
}
