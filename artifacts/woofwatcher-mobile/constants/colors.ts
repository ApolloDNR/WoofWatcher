// Palette locked to Apollo's WoofWatcher premium neo-retro pixel reference
// boards (2026-07 storybook mockups): warm parchment surfaces, deep forest
// green as the primary action color, copper reserved for brand accents.
const lightTheme = {
  text: "#2A2519",
  tint: "#C85A2A",

  background: "#F3ECDA",
  foreground: "#2A2519",

  card: "#FBF6E7",
  cardForeground: "#2A2519",

  primary: "#2E5B3C",
  primaryForeground: "#F9F4E4",

  secondary: "#E5EEDC",
  secondaryForeground: "#2A2519",

  muted: "#E9E0CA",
  mutedForeground: "#6E6753",

  accent: "#F6F0DE",
  accentForeground: "#2A2519",

  destructive: "#C96358",
  destructiveForeground: "#FFFFFF",

  border: "#E4DAC2",
  input: "#E4DAC2",

  amber: "#C98A2D",
  amberSoft: "#F6EAD1",
  rose: "#C96358",
  sage: "#4D8A56",
  sageSoft: "#E2EFDD",
  copper: "#C85A2A",
  copperBright: "#E07A2F",
  forest: "#2E5B3C",
  forestBright: "#3C7A4E",
  blue: "#5B7FA6",
  blueSignal: "#5B7FA6",
  blueSoft: "#E3EBF4",
  stone: "#E9E0CA",
  ink: "#2A2519",
  navy: "#081424",
  midnight: "#0D182A",
  brandNavy: "#081424",
  shellNavy: "#0D182A",
  cream: "#F3ECDA",
  ivory: "#FBF6E7",
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
  statusSegments: 10,
  borderWidth: 1,
  hairline: "#E0D5BC",
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
