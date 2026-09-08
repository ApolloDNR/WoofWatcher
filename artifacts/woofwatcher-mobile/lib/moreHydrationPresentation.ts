import type { CareHydrationStatus } from "../context/CareContext";

interface MoreHydrationPresentationBase {
  isBusy: boolean;
  canRetry: boolean;
  badgeLabel: string;
  metricPlaceholder: "—";
  statusTitle: string;
  statusDetail: string;
  routeSubtitle: string;
}

export type MoreHydrationPresentation<T> =
  | (MoreHydrationPresentationBase & {
      status: "loading" | "failed";
      content: null;
      canUseDataActions: false;
    })
  | (MoreHydrationPresentationBase & {
      status: "ready";
      content: T;
      canUseDataActions: true;
    });

export function getMoreHydrationPresentation<T>(
  status: CareHydrationStatus,
  content: T,
  readyRouteSubtitle: string,
): MoreHydrationPresentation<T> {
  if (status === "loading") {
    return {
      status,
      content: null,
      isBusy: true,
      canRetry: false,
      canUseDataActions: false,
      badgeLabel: "Loading",
      metricPlaceholder: "—",
      statusTitle: "Loading saved care",
      statusDetail: "Reading this device's saved care record.",
      routeSubtitle:
        "Loading saved care before showing this profile and its tools.",
    };
  }

  if (status === "failed") {
    return {
      status,
      content: null,
      isBusy: false,
      canRetry: true,
      canUseDataActions: false,
      badgeLabel: "Load failed",
      metricPlaceholder: "—",
      statusTitle: "Saved care unavailable",
      statusDetail:
        "WoofWatcher could not read this device's saved care. Retry before using these tools.",
      routeSubtitle:
        "Saved care is unavailable. Retry below to restore this profile and its tools.",
    };
  }

  return {
    status,
    content,
    isBusy: false,
    canRetry: false,
    canUseDataActions: true,
    badgeLabel: "Ready",
    metricPlaceholder: "—",
    statusTitle: "Saved care ready",
    statusDetail: "This device's saved care record is ready.",
    routeSubtitle: readyRouteSubtitle,
  };
}

export function shouldLoadMoreOwnerQaSession(ownerOps: boolean): boolean {
  return ownerOps;
}
