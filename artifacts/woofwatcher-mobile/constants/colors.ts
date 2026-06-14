// Palette locked to Apollo's WoofWatcher premium neo-retro pixel reference boards.
const lightTheme = {
  text: "#142033",
  tint: "#C85A2A",

  background: "#F7F2E8",
  foreground: "#142033",

  card: "#FFF9EF",
  cardForeground: "#142033",

  primary: "#4D8A56",
  primaryForeground: "#FFFFFF",

  secondary: "#E8F3E7",
  secondaryForeground: "#142033",

  muted: "#E6DED2",
  mutedForeground: "#667085",

  accent: "#F4EDDC",
  accentForeground: "#142033",

  destructive: "#C96358",
  destructiveForeground: "#FFFFFF",

  border: "#E6DED2",
  input: "#E6DED2",

  amber: "#D8A852",
  rose: "#C96358",
  sage: "#4D8A56",
  sageSoft: "#D9BAA7",
  copper: "#C85A2A",
  copperBright: "#E07A2F",
  forest: "#4D8A56",
  blue: "#A8CBE8",
  blueSignal: "#A8CBE8",
  stone: "#E6DED2",
  ink: "#142033",
  navy: "#081424",
  midnight: "#0D182A",
  brandNavy: "#081424",
  shellNavy: "#0D182A",
  cream: "#F7F2E8",
  ivory: "#FFF9EF",
};

const darkTheme = {
  text: "#F7F2E8",
  tint: "#E07A2F",

  background: "#081424",
  foreground: "#F7F2E8",

  card: "#0D182A",
  cardForeground: "#F7F2E8",

  primary: "#6DA36F",
  primaryForeground: "#081424",

  secondary: "#102C40",
  secondaryForeground: "#F7F2E8",

  muted: "#102C40",
  mutedForeground: "#B7C0C8",

  accent: "#102C40",
  accentForeground: "#F7F2E8",

  destructive: "#C96358",
  destructiveForeground: "#FFFFFF",

  border: "#243044",
  input: "#243044",

  amber: "#D8A852",
  rose: "#C96358",
  sage: "#6DA36F",
  sageSoft: "#233C2E",
  copper: "#E07A2F",
  copperBright: "#E07A2F",
  forest: "#6DA36F",
  blue: "#A8CBE8",
  blueSignal: "#A8CBE8",
  stone: "#243044",
  ink: "#F7F2E8",
  navy: "#081424",
  midnight: "#0D182A",
  brandNavy: "#081424",
  shellNavy: "#0D182A",
  cream: "#102C40",
  ivory: "#0D182A",
};

const pixelUi = {
  radius: {
    card: 8,
    panel: 12,
    scene: 10,
    chip: 8,
    pill: 999,
  },
  statusSegments: 10,
  borderWidth: 1,
  hairline: "#D7CEC0",
  shadow: {
    opacity: 0.08,
    radius: 10,
    y: 5,
  },
};

const colors = {
  light: lightTheme,
  dark: darkTheme,
  pixelUi,
  radius: pixelUi.radius.panel,
};

export default colors;
