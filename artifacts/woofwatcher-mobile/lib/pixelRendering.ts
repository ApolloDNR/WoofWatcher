import { Platform, type ImageStyle } from "react-native";

export const pixelImageStyle =
  Platform.OS === "web"
    ? ({ imageRendering: "pixelated" } as unknown as ImageStyle)
    : undefined;
