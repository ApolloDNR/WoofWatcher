import React from "react";

export function Ionicons(props: Record<string, unknown>): React.JSX.Element {
  return <i data-icon={String(props.name ?? "icon")} />;
}

export default Ionicons;

export const ImpactFeedbackStyle = {
  Light: "light",
  Medium: "medium",
};
export const NotificationFeedbackType = { Success: "success" };
export async function selectionAsync(): Promise<void> {}
export async function impactAsync(): Promise<void> {}
export async function notificationAsync(): Promise<void> {}

const router = Object.freeze({
  push() {},
  replace() {},
  back() {},
});
export function useRouter() {
  return router;
}
export function useLocalSearchParams(): Record<string, string> {
  return {};
}
export function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export const Accuracy = { Balanced: "balanced" };
let locationPermissionGranted = false;
let locationPermissionRequests = 0;
let locationWatchStarts = 0;
let locationWatchStops = 0;

export function resetCareHouseholdRendererLocation(): void {
  locationPermissionGranted = false;
  locationPermissionRequests = 0;
  locationWatchStarts = 0;
  locationWatchStops = 0;
}

export function setCareHouseholdRendererLocationPermission(
  granted: boolean,
): void {
  locationPermissionGranted = granted;
}

export function getCareHouseholdRendererLocationSnapshot() {
  return Object.freeze({
    permissionRequests: locationPermissionRequests,
    watchStarts: locationWatchStarts,
    watchStops: locationWatchStops,
  });
}

export async function requestForegroundPermissionsAsync() {
  locationPermissionRequests += 1;
  return { granted: locationPermissionGranted };
}
export async function watchPositionAsync() {
  locationWatchStarts += 1;
  let removed = false;
  return {
    remove() {
      if (removed) return;
      removed = true;
      locationWatchStops += 1;
    },
  };
}
