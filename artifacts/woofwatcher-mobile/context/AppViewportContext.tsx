import React, { createContext, useContext, useState } from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";

export interface AppViewportSize {
  width: number;
  height: number;
}

const AppViewportContext = createContext<AppViewportSize | null>(null);

export function AppViewportProvider({
  children,
  initialViewport,
}: {
  children: React.ReactNode;
  initialViewport: AppViewportSize;
}) {
  const [measuredViewport, setMeasuredViewport] =
    useState<AppViewportSize | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setMeasuredViewport((current) =>
      current?.width === width && current.height === height
        ? current
        : { width, height },
    );
  };

  const viewport = measuredViewport ?? initialViewport;
  return (
    <View style={styles.root} onLayout={handleLayout}>
      <AppViewportContext.Provider value={viewport}>
        {children}
      </AppViewportContext.Provider>
    </View>
  );
}

export function useAppViewport(): AppViewportSize {
  const measuredViewport = useContext(AppViewportContext);
  const windowViewport = useWindowDimensions();
  return measuredViewport ?? windowViewport;
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, width: "100%" },
});
