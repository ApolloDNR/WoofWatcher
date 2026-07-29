import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import type { CareTwinSpriteAsset } from "@/lib/careTwinAssets";
import { pixelImageStyle } from "@/lib/pixelRendering";

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
  const reduced = useReducedMotion();
  const frameProgress = useSharedValue(0);
  const totalFrames = Math.max(1, Math.min(track.frameCount, (asset?.columns ?? 0) * (asset?.rows ?? 0)));
  const durationMs = Math.max(160, Math.round((totalFrames / Math.max(1, track.fps)) * 1000));

  useEffect(() => {
    frameProgress.value = 0;
    if (!asset || !playing) return;
    // Honor Reduce Motion: never run the perpetual sprite loop. Hold a single
    // static frame so the care twin still reads as present without continuous
    // motion. Brief one-shot tracks still resolve to their end pose.
    if (reduced) {
      if (!track.loop) frameProgress.value = totalFrames - 0.001;
      return;
    }

    const target = track.loop ? totalFrames : totalFrames - 0.001;
    frameProgress.value = track.loop
      ? withRepeat(withTiming(target, { duration: durationMs, easing: Easing.linear }), -1, false)
      : withTiming(target, { duration: durationMs, easing: Easing.linear });
  }, [asset, durationMs, frameProgress, playing, totalFrames, track.loop, reduced]);

  const frameMetrics = useMemo(() => {
    if (!asset) return null;

    const scaleX = width / asset.frameWidth;
    const scaleY = height / asset.frameHeight;

    return {
      sheetWidth: asset.columns * asset.frameWidth * scaleX,
      sheetHeight: asset.rows * asset.frameHeight * scaleY,
      frameWidth: width,
      frameHeight: height,
      columns: asset.columns,
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
      aria-hidden
      pointerEvents="none"
      style={[styles.viewport, { width, height }, style]}
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
          pixelImageStyle,
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
