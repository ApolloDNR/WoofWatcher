import React, { useMemo, useState, type ReactNode } from "react";
import {
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
  fitRouteViewport,
  projectRoutePoint,
  type WalkRoutePoint,
} from "@/lib/walkRoute";

/**
 * A private, device-only route canvas.
 *
 * The recorded GPS shape is projected locally onto a bundled SVG scene. The
 * grid and terrain flourishes are deliberately abstract rather than claimed
 * street geography: no tile URL, map SDK, geocoder, or route-derived request
 * leaves the device. Start, waypoints, and finish stay useful offline.
 */
export interface TrailMapProps {
  route: WalkRoutePoint[];
  /** Fixed height in px. Omit and pass aspectRatio for fluid sizing. */
  height?: number;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Overlay content (chips, captions) rendered above the route canvas. */
  children?: ReactNode;
}

// 12x12 heart, drawn around (6,6); translated onto the route end point.
const HEART_PATH =
  "M6 10.8C4.55 9.5 1.6 7.05 1.6 4.7 1.6 3.1 2.8 2 4.2 2c.75 0 1.45.4 1.8 1.05C6.35 2.4 7.05 2 7.8 2c1.4 0 2.6 1.1 2.6 2.7 0 2.35-2.95 4.8-4.4 6.1z";

function roundCoord(value: number): number {
  return Math.round(value * 10) / 10;
}

export function TrailMap({
  route,
  height,
  aspectRatio,
  style,
  accessibilityLabel,
  children,
}: TrailMapProps) {
  const colors = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height: layoutHeight } = event.nativeEvent.layout;
    if (
      !size ||
      Math.abs(size.width - width) > 1 ||
      Math.abs(size.height - layoutHeight) > 1
    ) {
      setSize({ width, height: layoutHeight });
    }
  };

  const viewport = useMemo(
    () => (size ? fitRouteViewport(route, size.width, size.height) : null),
    [route, size],
  );

  const projected = useMemo(() => {
    if (!viewport || !size) return null;
    const points = route.map((point) =>
      projectRoutePoint(point, viewport, size.width, size.height),
    );
    if (points.length < 2) return null;
    const waypointIndexes =
      points.length >= 4
        ? [
            Math.floor((points.length - 1) / 3),
            Math.floor(((points.length - 1) * 2) / 3),
          ]
        : [];
    return {
      polyline: points
        .map((point) => `${roundCoord(point.x)},${roundCoord(point.y)}`)
        .join(" "),
      start: points[0],
      end: points[points.length - 1],
      waypoints: waypointIndexes.map((index) => points[index]),
    };
  }, [route, viewport, size]);

  const canvas = useMemo(() => {
    if (!size) return null;
    const { width, height: canvasHeight } = size;
    const grid: string[] = [];
    const gridStep = Math.max(
      28,
      Math.round(Math.min(width, canvasHeight) / 6),
    );
    for (let x = gridStep; x < width; x += gridStep) {
      grid.push(`M${x} 0V${canvasHeight}`);
    }
    for (let y = gridStep; y < canvasHeight; y += gridStep) {
      grid.push(`M0 ${y}H${width}`);
    }

    return {
      grid: grid.join(""),
      greenPatch: [
        `M${-0.08 * width} ${0.15 * canvasHeight}`,
        `C${0.1 * width} ${-0.03 * canvasHeight},`,
        `${0.35 * width} ${0.04 * canvasHeight},`,
        `${0.38 * width} ${0.25 * canvasHeight}`,
        `C${0.32 * width} ${0.42 * canvasHeight},`,
        `${0.05 * width} ${0.43 * canvasHeight},`,
        `${-0.08 * width} ${0.32 * canvasHeight}Z`,
      ].join(" "),
      bluePatch: [
        `M${0.7 * width} ${0.6 * canvasHeight}`,
        `C${0.82 * width} ${0.5 * canvasHeight},`,
        `${1.03 * width} ${0.55 * canvasHeight},`,
        `${1.08 * width} ${0.7 * canvasHeight}`,
        `L${1.08 * width} ${1.08 * canvasHeight}`,
        `L${0.72 * width} ${1.08 * canvasHeight}`,
        `C${0.62 * width} ${0.9 * canvasHeight},`,
        `${0.61 * width} ${0.73 * canvasHeight},`,
        `${0.7 * width} ${0.6 * canvasHeight}Z`,
      ].join(" "),
      contourA: [
        `M${-0.05 * width} ${0.72 * canvasHeight}`,
        `C${0.18 * width} ${0.52 * canvasHeight},`,
        `${0.36 * width} ${0.88 * canvasHeight},`,
        `${0.6 * width} ${0.7 * canvasHeight}`,
        `S${0.88 * width} ${0.44 * canvasHeight},`,
        `${1.06 * width} ${0.62 * canvasHeight}`,
      ].join(" "),
      contourB: [
        `M${0.02 * width} ${0.82 * canvasHeight}`,
        `C${0.2 * width} ${0.68 * canvasHeight},`,
        `${0.39 * width} ${0.96 * canvasHeight},`,
        `${0.62 * width} ${0.79 * canvasHeight}`,
        `S${0.86 * width} ${0.58 * canvasHeight},`,
        `${1.02 * width} ${0.73 * canvasHeight}`,
      ].join(" "),
    };
  }, [size]);

  const ground = colors.isDark ? "#10251F" : "#F1E8D2";
  const gridColor = colors.isDark ? "#395348" : "#D7CBAF";
  const greenPatch = colors.isDark ? "#1E3C2D" : "#DCE8CB";
  const bluePatch = colors.isDark ? "#173246" : "#C7DBE8";
  const contour = colors.isDark ? "#61766C" : "#C4B79A";

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ??
        "Private device-only view of the recorded walk route"
      }
      onLayout={onLayout}
      style={[
        s.frame,
        {
          backgroundColor: ground,
          borderColor: colors.border,
          borderRadius: colors.pixelUi.radius.card,
        },
        height != null
          ? { height }
          : aspectRatio != null
            ? { aspectRatio }
            : s.defaultHeight,
        style,
      ]}
    >
      {canvas && size ? (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            fill={ground}
          />
          <Path d={canvas.greenPatch} fill={greenPatch} fillOpacity={0.86} />
          <Path d={canvas.bluePatch} fill={bluePatch} fillOpacity={0.72} />
          <Path
            d={canvas.grid}
            fill="none"
            stroke={gridColor}
            strokeWidth={1}
            strokeOpacity={colors.isDark ? 0.28 : 0.5}
            strokeDasharray="2 6"
          />
          <Path
            d={canvas.contourA}
            fill="none"
            stroke={contour}
            strokeWidth={1.4}
            strokeOpacity={0.36}
            strokeDasharray="5 7"
          />
          <Path
            d={canvas.contourB}
            fill="none"
            stroke={contour}
            strokeWidth={1}
            strokeOpacity={0.25}
            strokeDasharray="4 8"
          />

          {projected ? (
            <>
              <Polyline
                points={projected.polyline}
                fill="none"
                stroke={colors.brandNavy}
                strokeWidth={7}
                strokeOpacity={colors.isDark ? 0.95 : 0.82}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Polyline
                points={projected.polyline}
                fill="none"
                stroke={colors.forestBright}
                strokeWidth={3.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {projected.waypoints.map((waypoint, index) => (
                <Circle
                  key={`waypoint-${index}`}
                  cx={waypoint.x}
                  cy={waypoint.y}
                  r={3.5}
                  fill={colors.ivory}
                  stroke={colors.forest}
                  strokeWidth={1.5}
                />
              ))}
              <Circle
                cx={projected.start.x}
                cy={projected.start.y}
                r={7}
                fill={colors.sage}
                stroke={colors.ivory}
                strokeWidth={2}
              />
              <Circle
                cx={projected.start.x}
                cy={projected.start.y}
                r={2}
                fill={colors.ivory}
              />
              <G>
                <Circle
                  cx={projected.end.x}
                  cy={projected.end.y}
                  r={10}
                  fill={colors.ivory}
                  stroke={colors.brandNavy}
                  strokeWidth={2}
                />
                <G
                  transform={`translate(${projected.end.x - 6}, ${projected.end.y - 6})`}
                >
                  <Path d={HEART_PATH} fill={colors.rose} />
                </G>
              </G>
            </>
          ) : null}
        </Svg>
      ) : null}

      <View
        pointerEvents="none"
        style={[
          s.compass,
          { backgroundColor: colors.card + "E8", borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            s.compassArrow,
            { color: colors.forest, fontFamily: "Inter_700Bold" },
          ]}
        >
          ↑
        </Text>
        <Text
          style={[
            s.compassText,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          N
        </Text>
      </View>

      {children}

      <View
        pointerEvents="none"
        style={[
          s.privacyBadge,
          { backgroundColor: colors.card + "EC", borderColor: colors.border },
        ]}
      >
        <View style={[s.privacyDot, { backgroundColor: colors.sage }]} />
        <Text
          style={[
            s.privacyText,
            { color: colors.mutedForeground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Device-only route
        </Text>
      </View>
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
  compass: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    gap: 0,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    right: 8,
    top: 8,
  },
  compassArrow: {
    fontSize: 16,
    lineHeight: 16,
  },
  compassText: {
    fontSize: 9,
    letterSpacing: 0.8,
    lineHeight: 11,
  },
  privacyBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 7,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    right: 7,
  },
  privacyDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  privacyText: {
    fontSize: 9,
    letterSpacing: 0.2,
  },
});
