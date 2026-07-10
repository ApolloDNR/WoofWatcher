import { Platform, type ImageStyle } from "react-native";

export const pixelImageStyle =
  Platform.OS === "web"
    ? ({ imageRendering: "pixelated" } as unknown as ImageStyle)
    : undefined;

// react-native-web's ImageBackground leaves the inner <img> at its natural
// pixel size when the wrapper has no explicit width/height (minHeight-only
// stages), so the card clips a giant top-left corner of the art instead of
// scaling it. Every stage ImageBackground must include this in imageStyle so
// the art fills the card and crops from the center on web and native alike.
export const stageImageFill: ImageStyle = {
  width: "100%",
  height: "100%",
  resizeMode: "cover",
  // react-native-web drops the resizeMode style key on the inner <img>, so
  // the CSS object-fit has to be set directly for the web preview/exports.
  ...(Platform.OS === "web" ? ({ objectFit: "cover" } as unknown as ImageStyle) : null),
};
