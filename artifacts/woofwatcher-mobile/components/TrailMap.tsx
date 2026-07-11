import React, { useMemo, useState, type ReactNode } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, G, Path, Polyline } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import {
  computeTrailTiles,
  fitRouteViewport,
  projectRoutePoint,
  type WalkRoutePoint,
} from "@/lib/walkRoute";

/**
 * Real trail map: OpenStreetMap raster tiles (plain slippy-map math, no API
 * key, no SDK) with the recorded walk route drawn on top as an SVG polyline.
 * Start is a sage dot, the finish is a heart marker. Tiles only load online;
 * when every tile fails the map falls back to a calm muted panel while the
 * route line stays visible. Attribution is required by OSM and always shown
 * with the tiles.
 */
export interface TrailMapProps {
  route: WalkRoutePoint[];
  /** Fixed height in px. Omit and pass aspectRatio for fluid sizing. */
  height?: number;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Overlay content (chips, captions) rendered above the map. */
  children?: ReactNode;
}

// 12x12 heart, drawn around (6,6); translated onto the route end point.
const HEART_PATH =
  "M6 10.8C4.55 9.5 1.6 7.05 1.6 4.7 1.6 3.1 2.8 2 4.2 2c.75 0 1.45.4 1.8 1.05C6.35 2.4 7.05 2 7.8 2c1.4 0 2.6 1.1 2.6 2.7 0 2.35-2.95 4.8-4.4 6.1z";

export function TrailMap({
  route,
  height,
  aspectRatio,
  style,
  accessibilityLabel,
  children,
}: TrailMapProps) {
  const colors = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (!size || Math.abs(size.width - w) > 1 || Math.abs(size.height - h) > 1) {
      setSize({ width: w, height: h });
    }
  };

  const viewport = useMemo(
    () => (size ? fitRouteViewport(route, size.width, size.height) : null),
    [route, size],
  );
  const tiles = useMemo(
    () => (viewport && size ? computeTrailTiles(viewport, size.width, size.height) : []),
    [viewport, size],
  );
  const projected = useMemo(() => {
    if (!viewport || !size) return null;
    const points = route.map((point) =>
      projectRoutePoint(point, viewport, size.width, size.height),
    );
    if (points.length < 2) return null;
    return {
      polyline: points
        .map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`)
        .join(" "),
      start: points[0],
      end: points[points.length - 1],
    };
  }, [route, viewport, size]);

  const allTilesFailed =
    tiles.length > 0 && tiles.every((tile) => failedTiles[tile.key]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? "Map of the recorded walk route"}
      onLayout={onLayout}
      style={[
        s.frame,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
          borderRadius: colors.pixelUi.radius.card,
        },
        height != null ? { height } : aspectRatio != null ? { aspectRatio } : s.defaultHeight,
        style,
      ]}
    >
      {allTilesFailed ? (
        <View style={[StyleSheet.absoluteFill, s.fallback, { backgroundColor: colors.muted }]}>
          <Text style={[s.fallbackText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            Map loads when online
          </Text>
        </View>
      ) : (
        tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.uri }}
            fadeDuration={0}
            onError={() =>
              setFailedTiles((prev) => (prev[tile.key] ? prev : { ...prev, [tile.key]: true }))
            }
            style={[s.tile, { left: tile.left, top: tile.top }]}
          />
        ))
      )}

      {projected && size ? (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Polyline
            points={projected.polyline}
            fill="none"
            stroke={colors.brandNavy}
            strokeWidth={5.5}
            strokeOpacity={0.88}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Polyline
            points={projected.polyline}
            fill="none"
            stroke={colors.forestBright}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle
            cx={projected.start.x}
            cy={projected.start.y}
            r={5.5}
            fill={colors.sage}
            stroke={colors.ivory}
            strokeWidth={1.6}
          />
          <G>
            <Circle
              cx={projected.end.x}
              cy={projected.end.y}
              r={9}
              fill={colors.ivory}
              stroke={colors.brandNavy}
              strokeWidth={1.6}
            />
            <G transform={`translate(${projected.end.x - 6}, ${projected.end.y - 6})`}>
              <Path d={HEART_PATH} fill={colors.rose} />
            </G>
          </G>
        </Svg>
      ) : null}

      {children}

      {!allTilesFailed && tiles.length > 0 ? (
        <View style={[s.attribution, { backgroundColor: colors.card + "E0" }]}>
          <Text style={[s.attributionText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            © OpenStreetMap contributors
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  frame: {
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  defaultHeight: { height: 220 },
  tile: {
    position: "absolute",
    width: 256,
    height: 256,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: { fontSize: 12.5 },
  attribution: {
    position: "absolute",
    right: 6,
    bottom: 5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  attributionText: { fontSize: 8.5, letterSpacing: 0.1 },
});
