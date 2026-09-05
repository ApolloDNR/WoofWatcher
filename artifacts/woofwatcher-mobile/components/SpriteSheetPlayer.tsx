import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
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
  const totalFrames = Math.max(
    1,
    Math.min(track.frameCount, (asset?.columns ?? 0) * (asset?.rows ?? 0)),
  );
  const durationMs = Math.max(
    160,
    Math.round((totalFrames / Math.max(1, track.fps)) * 1000),
  );

  // Asset or track changes start a new strip at frame zero. A temporary
  // `playing=false` pause deliberately does not run this reset, so scrolling
  // and tab focus changes never snap the dog back to its first pose.
  useEffect(() => {
    cancelAnimation(frameProgress);
    frameProgress.value = 0;
  }, [asset, frameProgress, totalFrames, track.key]);

  useEffect(() => {
    cancelAnimation(frameProgress);
    if (!asset || !playing) {
      return () => cancelAnimation(frameProgress);
    }
    // Honor Reduce Motion: never run the perpetual sprite loop. Hold a single
    // static frame so the care twin still reads as present without continuous
    // motion. Brief one-shot tracks still resolve to their end pose.
    if (reduced) {
      if (!track.loop) frameProgress.value = totalFrames - 0.001;
      return () => cancelAnimation(frameProgress);
    }

    // Loop over a full strip from the current progress. Frame selection uses
    // modulo below, so a resumed loop keeps the paused pose and still visits
    // every frame instead of looping only the tail of the strip.
    const target = track.loop
      ? Number(frameProgress.value) + totalFrames
      : totalFrames - 0.001;
    frameProgress.value = track.loop
      ? withRepeat(
          withTiming(target, { duration: durationMs, easing: Easing.linear }),
          -1,
          false,
        )
      : withTiming(target, { duration: durationMs, easing: Easing.linear });
    return () => cancelAnimation(frameProgress);
  }, [
    asset,
    durationMs,
    frameProgress,
    playing,
    totalFrames,
    track.key,
    track.loop,
    reduced,
  ]);

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
    const rawIndex = Math.floor(frameProgress.value);
    const index = track.loop
      ? ((rawIndex % totalFrames) + totalFrames) % totalFrames
      : Math.max(0, Math.min(totalFrames - 1, rawIndex));
    const column = index % frameMetrics.columns;
    const row = Math.floor(index / frameMetrics.columns);

    return {
      transform: [
        { translateX: -column * frameMetrics.frameWidth },
        { translateY: -row * frameMetrics.frameHeight },
      ],
    };
  }, [frameMetrics, totalFrames, track.loop]);

  if (!asset || !frameMetrics) return null;

  return (
    <View
      aria-hidden
      pointerEvents="none"
      style={[styles.viewport, { width, height }, style]}
      testID={testID}
    >
      <Animated.Image
        accessible={false}
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
