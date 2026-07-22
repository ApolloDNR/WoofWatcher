import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, G, Path, Polyline, Rect } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import {
  loadStorybookMapData,
  type GeoPoint,
  type StorybookMapData,
  type StorybookRoadClass,
} from "@/lib/storybookMapData";
import {
  computeTrailTiles,
  fitRouteViewport,
  latToWorldY,
  lonToWorldX,
  projectRoutePoint,
  type WalkRoutePoint,
} from "@/lib/walkRoute";

/**
 * Trail map with two honest styles, both real OpenStreetMap data:
 *
 * - "real" (default): OSM raster tiles, plain slippy-map math, no API key.
 * - "storybook": vector geometry from the Overpass API drawn with SVG in the
 *   app's own parchment/sage/navy game-world palette — the neighborhood as
 *   WoofWatcher room art. Geometry caches on-device; when it is unavailable
 *   (offline, fetch failed) the map falls back to the real tiles
 *   automatically, and when those fail too a calm muted panel remains.
 *
 * The recorded walk route is an SVG polyline on top in both styles: sage
 * start dot, heart finish marker. OSM attribution is always shown with
 * either style, as the data license requires.
 */
export interface TrailMapProps {
  route: WalkRoutePoint[];
  /** Fixed height in px. Omit and pass aspectRatio for fluid sizing. */
  height?: number;
  aspectRatio?: number;
  /** "real" raster tiles (default) or the drawn "storybook" world. */
  mapStyle?: "real" | "storybook";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Overlay content (chips, captions) rendered above the map. */
  children?: ReactNode;
}

// 12x12 heart, drawn around (6,6); translated onto the route end point.
const HEART_PATH =
  "M6 10.8C4.55 9.5 1.6 7.05 1.6 4.7 1.6 3.1 2.8 2 4.2 2c.75 0 1.45.4 1.8 1.05C6.35 2.4 7.05 2 7.8 2c1.4 0 2.6 1.1 2.6 2.7 0 2.35-2.95 4.8-4.4 6.1z";

/**
 * Storybook palette, pinned to the light reference board's warm family so
 * the drawn world reads like the rooms/park art in both themes (the real
 * raster tiles are likewise light in dark mode). Sources in
 * constants/colors.ts: ground sits between cream #F3ECDA and muted #E9E0CA;
 * greens come from the sageSoft family; water from blueSoft; buildings from
 * the stone/border family; roads are ivory with brandNavy-tinted casings.
 */
const STORYBOOK = {
  ground: "#F1E8D2",
  green: "#DCE8CB",
  greenEdge: "#B9CFA4",
  water: "#C3D8E6",
  waterEdge: "#9FBDD3",
  building: "#E0D3B6",
  buildingEdge: "#CDBC97",
  casing: "#081424", // brandNavy, applied at low opacity under roads
  minorRoad: "#FBF6E7", // ivory token
  majorRoad: "#FDF9EC",
  footpath: "#F8F1DD",
};

/** Road stroke widths (view px) per class: [casingWidth, fillWidth]. */
const ROAD_WIDTHS: Record<StorybookRoadClass, [number, number]> = {
  major: [7, 4.6],
  minor: [5, 3.1],
  footpath: [0, 1.8],
};

type StorybookState = "idle" | "loading" | "unavailable";

function roundCoord(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Concatenate features into a single SVG path (M/L, Z for rings). */
function featuresToPath(
  features: readonly (readonly GeoPoint[])[],
  project: (point: GeoPoint) => { x: number; y: number },
  close: boolean,
): string {
  const parts: string[] = [];
  for (const feature of features) {
    if (feature.length < 2) continue;
    const segment = feature
      .map((point, index) => {
        const { x, y } = project(point);
        return `${index === 0 ? "M" : "L"}${roundCoord(x)} ${roundCoord(y)}`;
      })
      .join("");
    parts.push(close ? `${segment}Z` : segment);
  }
  return parts.join("");
}

export function TrailMap({
  route,
  height,
  aspectRatio,
  mapStyle = "real",
  style,
  accessibilityLabel,
  children,
}: TrailMapProps) {
  const colors = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});
  const [storybook, setStorybook] = useState<StorybookMapData | StorybookState>("idle");

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (!size || Math.abs(size.width - w) > 1 || Math.abs(size.height - h) > 1) {
      setSize({ width: w, height: h });
    }
  };

  /* Storybook geometry loads cache-first per route; honest failure flips
     the map back to the real raster tiles. */
  useEffect(() => {
    if (mapStyle !== "storybook" || route.length < 2) {
      setStorybook("idle");
      return;
    }
    let cancelled = false;
    setStorybook("loading");
    loadStorybookMapData(route)
      .then((data) => {
        if (!cancelled) setStorybook(data ?? "unavailable");
      })
      .catch(() => {
        if (!cancelled) setStorybook("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [mapStyle, route]);

  const storybookData = typeof storybook === "object" ? storybook : null;
  const storybookPending = mapStyle === "storybook" && storybook === "loading";
  const showStorybook = mapStyle === "storybook" && storybookData != null;
  // Raster tiles render for "real" style and as the storybook fallback.
  const showTiles = !showStorybook && !storybookPending;

  const viewport = useMemo(
    () => (size ? fitRouteViewport(route, size.width, size.height) : null),
    [route, size],
  );
  const tiles = useMemo(
    () =>
      viewport && size && showTiles
        ? computeTrailTiles(viewport, size.width, size.height)
        : [],
    [viewport, size, showTiles],
  );
  const projected = useMemo(() => {
    if (!viewport || !size) return null;
    const points = route.map((point) =>
      projectRoutePoint(point, viewport, size.width, size.height),
    );
    if (points.length < 2) return null;
    return {
      polyline: points
        .map((p) => `${roundCoord(p.x)},${roundCoord(p.y)}`)
        .join(" "),
      start: points[0],
      end: points[points.length - 1],
    };
  }, [route, viewport, size]);

  /* Project the storybook layers once per data/viewport change; each layer
     collapses into a single SVG path for cheap rendering. */
  const storybookPaths = useMemo(() => {
    if (!showStorybook || !storybookData || !viewport || !size) return null;
    const halfW = size.width / 2;
    const halfH = size.height / 2;
    const project = (point: GeoPoint) => ({
      x: lonToWorldX(point.lon, viewport.zoom) - viewport.centerX + halfW,
      y: latToWorldY(point.lat, viewport.zoom) - viewport.centerY + halfH,
    });
    const roadsOf = (roadClass: StorybookRoadClass) =>
      featuresToPath(
        storybookData.roads
          .filter((road) => road.class === roadClass)
          .map((road) => road.points),
        project,
        false,
      );
    return {
      greens: featuresToPath(storybookData.greenPolys, project, true),
      waterPolys: featuresToPath(storybookData.waterPolys, project, true),
      waterLines: featuresToPath(storybookData.waterLines, project, false),
      buildings: featuresToPath(storybookData.buildingPolys, project, true),
      footpaths: roadsOf("footpath"),
      minorRoads: roadsOf("minor"),
      majorRoads: roadsOf("major"),
    };
  }, [showStorybook, storybookData, viewport, size]);

  const allTilesFailed =
    tiles.length > 0 && tiles.every((tile) => failedTiles[tile.key]);
  const showAttribution =
    (showTiles && tiles.length > 0 && !allTilesFailed) || showStorybook;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? "Map of the recorded walk route"}
      onLayout={onLayout}
      style={[
        s.frame,
        {
          backgroundColor: storybookPending || showStorybook ? STORYBOOK.ground : colors.muted,
          borderColor: colors.border,
          borderRadius: colors.pixelUi.radius.card,
        },
        height != null ? { height } : aspectRatio != null ? { aspectRatio } : s.defaultHeight,
        style,
      ]}
    >
      {showTiles ? (
        allTilesFailed ? (
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
        )
      ) : null}

      {showStorybook && storybookPaths && size ? (
        <Svg
          width={size.width}
          height={size.height}
          style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
        >
          {/* Parchment ground, then soft nature, then the built world. */}
          <Rect x={0} y={0} width={size.width} height={size.height} fill={STORYBOOK.ground} />
          {storybookPaths.greens ? (
            <Path
              d={storybookPaths.greens}
              fill={STORYBOOK.green}
              fillRule="nonzero"
              stroke={STORYBOOK.greenEdge}
              strokeWidth={1.2}
              strokeOpacity={0.7}
              strokeLinejoin="round"
            />
          ) : null}
          {storybookPaths.waterPolys ? (
            <Path
              d={storybookPaths.waterPolys}
              fill={STORYBOOK.water}
              fillRule="nonzero"
              stroke={STORYBOOK.waterEdge}
              strokeWidth={1.2}
              strokeOpacity={0.8}
              strokeLinejoin="round"
            />
          ) : null}
          {storybookPaths.waterLines ? (
            <Path
              d={storybookPaths.waterLines}
              fill="none"
              stroke={STORYBOOK.water}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {/* Soft taupe blocks; the rounded stroke melts hard corners. */}
          {storybookPaths.buildings ? (
            <Path
              d={storybookPaths.buildings}
              fill={STORYBOOK.building}
              fillOpacity={0.55}
              fillRule="nonzero"
              stroke={STORYBOOK.buildingEdge}
              strokeOpacity={0.6}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          ) : null}
          {/* Footpaths: thin dashed cream trails. */}
          {storybookPaths.footpaths ? (
            <Path
              d={storybookPaths.footpaths}
              fill="none"
              stroke={STORYBOOK.footpath}
              strokeWidth={ROAD_WIDTHS.footpath[1]}
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {/* Roads: navy-tinted casing under a warm ivory fill. */}
          {storybookPaths.minorRoads ? (
            <>
              <Path
                d={storybookPaths.minorRoads}
                fill="none"
                stroke={STORYBOOK.casing}
                strokeOpacity={0.18}
                strokeWidth={ROAD_WIDTHS.minor[0]}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d={storybookPaths.minorRoads}
                fill="none"
                stroke={STORYBOOK.minorRoad}
                strokeWidth={ROAD_WIDTHS.minor[1]}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}
          {storybookPaths.majorRoads ? (
            <>
              <Path
                d={storybookPaths.majorRoads}
                fill="none"
                stroke={STORYBOOK.casing}
                strokeOpacity={0.28}
                strokeWidth={ROAD_WIDTHS.major[0]}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d={storybookPaths.majorRoads}
                fill="none"
                stroke={STORYBOOK.majorRoad}
                strokeWidth={ROAD_WIDTHS.major[1]}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}
        </Svg>
      ) : null}

      {projected && size ? (
        <Svg
          width={size.width}
          height={size.height}
          style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
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

      {showAttribution ? (
        <View style={[s.attribution, { backgroundColor: colors.card + "E0" }]}>
          <Text style={[s.attributionText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {showStorybook ? "Map data © OpenStreetMap contributors" : "© OpenStreetMap contributors"}
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
