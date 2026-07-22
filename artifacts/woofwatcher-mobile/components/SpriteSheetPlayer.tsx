import React, { useEffect, useMemo } from "react";
import {
  PixelRatio,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import type { CareTwinSpriteAsset } from "@/lib/careTwinAssets";
import { pixelArtSamplingStyle } from "@/lib/pixelRendering";

export interface SpriteSheetTrack {
  key: string;
  frameCount: number;
  fps: number;
  loop: boolean;
  slotSize: number;
}

interface Props {
  asset: CareTwinSpriteAsset | null;
  track: SpriteSheetTrack;
  width?: number;
  height?: number;
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SpriteSheetPlayer({
  asset,
  track,
  width = track.slotSize,
  height = track.slotSize,
  playing = true,
  style,
  testID = "care-twin-sprite-player",
}: Props) {
  const frameProgress = useSharedValue(0);
  const totalFrames = Math.max(1, Math.min(track.frameCount, (asset?.columns ?? 0) * (asset?.rows ?? 0)));
  const durationMs = Math.max(160, Math.round((totalFrames / Math.max(1, track.fps)) * 1000));

  useEffect(() => {
    frameProgress.value = 0;
    if (!asset || !playing) return;

    const target = track.loop ? totalFrames : totalFrames - 0.001;
    frameProgress.value = track.loop
      ? withRepeat(withTiming(target, { duration: durationMs, easing: Easing.linear }), -1, false)
      : withTiming(target, { duration: durationMs, easing: Easing.linear });
  }, [asset, durationMs, frameProgress, playing, totalFrames, track.loop]);

  const frameMetrics = useMemo(() => {
    if (!asset) return null;

    // Snap the frame box to the device pixel grid: a fractional frame width
    // makes every translateX step land between device pixels, which bleeds a
    // sliver of the neighboring frame into the viewport edge.
    const frameWidth = PixelRatio.roundToNearestPixel(width);
    const frameHeight = PixelRatio.roundToNearestPixel(height);

    return {
      sheetWidth: asset.columns * frameWidth,
      sheetHeight: asset.rows * frameHeight,
      frameWidth,
      frameHeight,
      columns: asset.columns,
      samplingStyle: pixelArtSamplingStyle(frameWidth, asset.frameWidth),
    };
  }, [asset, height, width]);

  const sheetStyle = useAnimatedStyle(() => {
    if (!frameMetrics) return {};
    const index = Math.max(0, Math.min(totalFrames - 1, Math.floor(frameProgress.value)));
    const column = index % frameMetrics.columns;
    const row = Math.floor(index / frameMetrics.columns);

    return {
      transform: [
        { translateX: -column * frameMetrics.frameWidth },
        { translateY: -row * frameMetrics.frameHeight },
      ],
    };
  }, [frameMetrics, totalFrames]);

  if (!asset || !frameMetrics) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ pointerEvents: "none" }, 
        styles.viewport,
        { width: frameMetrics.frameWidth, height: frameMetrics.frameHeight },
        style,
      ]}
      testID={testID}
    >
      <Animated.Image
        source={asset.source}
        resizeMode="stretch"
        style={[
          styles.sheet,
          {
            width: frameMetrics.sheetWidth,
            height: frameMetrics.sheetHeight,
          },
          frameMetrics.samplingStyle,
          sheetStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: "hidden",
  },
  sheet: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
