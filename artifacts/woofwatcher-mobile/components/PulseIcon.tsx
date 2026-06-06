import React from "react";
import Svg, { Path, Circle, Ellipse, Rect, G } from "react-native-svg";

export type PulseIconName =
  | "bowl"
  | "paw"
  | "drop"
  | "star"
  | "heart"
  | "bone"
  | "candy"
  | "bolt"
  | "sad"
  | "vomit"
  | "house"
  | "scale"
  | "pill";

export const PULSE_COLORS: Record<PulseIconName, string> = {
  bowl: "#3F7D5C",
  paw: "#3F7D5C",
  drop: "#5AA0E0",
  star: "#E8902F",
  heart: "#4E9E6A",
  bone: "#B07A3D",
  candy: "#9B7BD4",
  bolt: "#ECC23E",
  sad: "#9B7BD4",
  vomit: "#E0903E",
  house: "#6E9BD0",
  scale: "#7A8FA6",
  pill: "#A05C9A",
};

interface Props {
  name: PulseIconName;
  size?: number;
  color?: string;
}

export function PulseIcon({ name, size = 32, color }: Props) {
  const c = color ?? PULSE_COLORS[name];
  const white = "#FFFFFF";

  const body = () => {
    switch (name) {
      case "bowl":
        return (
          <G>
            <Path d="M6 24 C8 35 40 35 42 24 Z" fill={c} />
            <Ellipse cx={24} cy={24} rx={18} ry={6} fill={c} />
            <Ellipse cx={24} cy={23} rx={12} ry={3.5} fill="#E7C79A" />
          </G>
        );
      case "paw":
        return (
          <G fill={c}>
            <Path d="M24 27 C17 27 13 32 15 38 C16 42 32 42 33 38 C35 32 31 27 24 27 Z" />
            <Ellipse cx={14} cy={23} rx={3.6} ry={4.4} />
            <Ellipse cx={20} cy={18} rx={3.6} ry={4.6} />
            <Ellipse cx={28} cy={18} rx={3.6} ry={4.6} />
            <Ellipse cx={34} cy={23} rx={3.6} ry={4.4} />
          </G>
        );
      case "drop":
        return (
          <G>
            <Path
              d="M24 5 C24 5 39 23 39 31 A15 15 0 0 1 9 31 C9 23 24 5 24 5 Z"
              fill={c}
            />
            <Ellipse cx={19} cy={30} rx={3.5} ry={5} fill={white} opacity={0.45} />
          </G>
        );
      case "star":
        return (
          <Path
            d="M24 4 L29.6 17.4 L44 18.6 L33 28.1 L36.4 42 L24 34.6 L11.6 42 L15 28.1 L4 18.6 L18.4 17.4 Z"
            fill={c}
          />
        );
      case "heart":
        return (
          <Path
            d="M24 41 C5 28 7 12 17.5 12 C21.5 12 24 15 24 17.5 C24 15 26.5 12 30.5 12 C41 12 43 28 24 41 Z"
            fill={c}
          />
        );
      case "bone":
        return (
          <G fill={c}>
            <Circle cx={13} cy={18} r={6.5} />
            <Circle cx={13} cy={30} r={6.5} />
            <Circle cx={35} cy={18} r={6.5} />
            <Circle cx={35} cy={30} r={6.5} />
            <Rect x={11} y={18} width={26} height={12} rx={4} />
          </G>
        );
      case "candy":
        return (
          <G>
            <Path d="M16 24 L5 16 L5 32 Z" fill={c} />
            <Path d="M32 24 L43 16 L43 32 Z" fill={c} />
            <Circle cx={24} cy={24} r={9} fill={c} />
            <Circle cx={21} cy={21} r={2.4} fill={white} opacity={0.5} />
          </G>
        );
      case "bolt":
        return (
          <Path
            d="M28 4 L11 27 L21 27 L18 44 L37 19 L26 19 L31 4 Z"
            fill={c}
          />
        );
      case "sad":
        return (
          <G>
            <Circle cx={24} cy={24} r={18} fill={c} />
            <Circle cx={18} cy={22} r={2.6} fill="#4A3A6B" />
            <Circle cx={30} cy={22} r={2.6} fill="#4A3A6B" />
            <Path
              d="M13.5 16.5 L20 19"
              stroke="#4A3A6B"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <Path
              d="M34.5 16.5 L28 19"
              stroke="#4A3A6B"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <Path
              d="M16 33 Q24 27 32 33"
              stroke="#4A3A6B"
              strokeWidth={2.8}
              strokeLinecap="round"
              fill="none"
            />
          </G>
        );
      case "vomit":
        return (
          <G fill={c}>
            <Path d="M13 21 C11 14 20 12 24 16 C28 11 38 15 35 23 C41 26 39 34 32 34 C31 39 23 40 21 35 C15 37 10 30 13 24 Z" />
            <Circle cx={17} cy={40} r={2.4} />
            <Circle cx={26} cy={42} r={1.8} />
          </G>
        );
      case "house":
        return (
          <G>
            <Path d="M24 7 L43 24 L5 24 Z" fill={c} />
            <Rect x={10} y={23} width={28} height={17} rx={2.5} fill={c} />
            <Rect x={20} y={29} width={8} height={11} rx={1.5} fill={white} opacity={0.8} />
          </G>
        );
      case "scale":
        return (
          <G>
            <Circle cx={24} cy={28} r={14} fill={c} />
            <Rect x={20} y={10} width={8} height={10} rx={3} fill={c} />
            <Rect x={15} y={7} width={18} height={6} rx={3} fill={c} />
            <Ellipse cx={24} cy={28} rx={9} ry={5.5} fill={white} opacity={0.2} />
          </G>
        );
      case "pill":
        return (
          <G>
            <Rect x={16} y={9} width={16} height={30} rx={8} fill={c} />
            <Rect x={16} y={9} width={8} height={30} rx={8} fill={white} opacity={0.35} />
            <Rect x={16} y={23} width={16} height={2.5} fill={white} opacity={0.55} />
          </G>
        );
      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {body()}
    </Svg>
  );
}
