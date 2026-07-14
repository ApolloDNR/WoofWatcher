// Palette locked to Apollo's WoofWatcher premium neo-retro pixel reference
// boards (2026-07 storybook mockups): warm parchment surfaces, deep forest
// green as the primary action color, copper reserved for brand accents.
const lightTheme = {
  text: "#2A2519",
  tint: "#C85A2A",

  background: "#F7F1E1",
  foreground: "#2A2519",

  card: "#FDF9EE",
  cardForeground: "#2A2519",

  primary: "#33582F",
  primaryForeground: "#F9F4E4",

  secondary: "#E6EDDA",
  secondaryForeground: "#2A2519",

  muted: "#EDE5CF",
  mutedForeground: "#6E6753",

  accent: "#F6F0DE",
  accentForeground: "#2A2519",

  destructive: "#B4432E",
  destructiveForeground: "#FFFFFF",

  border: "#E8DFC7",
  input: "#E8DFC7",

  // Deep amber tuned for small status text: >=4.5:1 (WCAG AA) on cream,
  // ivory/card, amberSoft, and muted surfaces while staying warm, not muddy.
  amber: "#8A5A0C",
  amberSoft: "#F6EAD1",
  rose: "#C96358",
  sage: "#4D8A56",
  sageSoft: "#E2EFDD",
  copper: "#C85A2A",
  copperBright: "#E07A2F",
  forest: "#33582F",
  forestBright: "#3C7A4E",
  blue: "#5B7FA6",
  blueSignal: "#5B7FA6",
  blueSoft: "#E3EBF4",
  stone: "#EDE5CF",
  ink: "#2A2519",
  navy: "#081424",
  midnight: "#0D182A",
  brandNavy: "#081424",
  shellNavy: "#0D182A",
  cream: "#F7F1E1",
  ivory: "#FDF9EE",

  // Care Sense meter tones, sampled from Apollo's 2026-07 mock boards.
  // Decorative fills only - adjacent labels keep AA ink colors.
  meterMood: "#3D6C33",
  meterEnergy: "#3D6C33",
  meterHunger: "#DE7A14",
  meterAlone: "#4E9CC7",
  meterSleep: "#6B4E93",
  // Empty Care Sense pip track. On cream the muted parchment already reads as
  // crisp chunky pips, so this matches it.
  meterTrack: "#EDE5CF",
  gold: "#BC833D",
  goldSoft: "#F2E4C8",
};

const darkTheme = {
  text: "#F3ECDA",
  tint: "#E07A2F",

  background: "#081424",
  foreground: "#F3ECDA",

  card: "#0D182A",
  cardForeground: "#F3ECDA",

  primary: "#5E9A6C",
  primaryForeground: "#081424",

  secondary: "#12301F",
  secondaryForeground: "#F3ECDA",

  muted: "#102C40",
  mutedForeground: "#B7C0C8",

  accent: "#102C40",
  accentForeground: "#F3ECDA",

  destructive: "#C96358",
  destructiveForeground: "#FFFFFF",

  border: "#243044",
  input: "#243044",

  amber: "#D8A852",
  amberSoft: "#33290F",
  rose: "#C96358",
  sage: "#6DA36F",
  sageSoft: "#233C2E",
  copper: "#E07A2F",
  copperBright: "#E07A2F",
  forest: "#5E9A6C",
  forestBright: "#6DA36F",
  blue: "#A8CBE8",
  blueSignal: "#A8CBE8",
  blueSoft: "#122236",
  stone: "#243044",
  ink: "#F3ECDA",
  navy: "#F3ECDA",
  midnight: "#0D182A",
  brandNavy: "#081424",
  shellNavy: "#0D182A",
  cream: "#F3ECDA",
  ivory: "#FBF6E7",

  meterMood: "#6DA36F",
  meterEnergy: "#6DA36F",
  meterHunger: "#E8963C",
  meterAlone: "#6FB3D8",
  meterSleep: "#9B7FC0",
  // Empty Care Sense pip track. Lifted well above the card (#0D182A) so the
  // seven chunky pips still read as a segmented track in dark mode; muted
  // (#102C40) sat too close to the card and the empty pips disappeared.
  meterTrack: "#223A52",
  gold: "#D8A852",
  goldSoft: "#33290F",
};

// Softened toward Apollo's 2026-07 storybook mockups: large calm radii,
// hairline warm borders, soft diffuse shadows. Pixel style stays in the art
// and accents, not in the container chrome.
const pixelUi = {
  radius: {
    card: 20,
    panel: 24,
    scene: 18,
    chip: 12,
    pill: 999,
  },
  // Mock boards draw the Care Sense meters as 7 chunky rounded pips.
  statusSegments: 7,
  borderWidth: 1,
  hairline: "#E5DCC3",
  shadow: {
    opacity: 0.06,
    radius: 16,
    y: 8,
  },
};

const colors = {
  light: lightTheme,
  dark: darkTheme,
  pixelUi,
  radius: pixelUi.radius.panel,
};

export default colors;
