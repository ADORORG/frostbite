// The colours of the screen: the platform's neon on its deep violet, with snow. The sky changes every few levels.
export const colour = {
  ball: "#f4f9ff",
  ballShade: "#a8dcff",
  cyan: "#38e8ff",
  danger: "#ff4757",
  ground: "#1b1250",
  hill: "#2a1a63",
  hillFar: "#201350",
  ice: "#8fe9ff",
  pit: "#05020f",
  pitGlow: "#38e8ff",
  outline: "#0b0720",
  rock: "#5f78c4",
  rockDark: "#2c3a86",
  rockLight: "#a9c1ff",
  scarf: "#ff4f8b",
  scarfDark: "#c2336a",
  shadow: "rgba(0, 0, 0, 0.35)",
  snow: "#e6f2ff",
  snowDark: "#a8dcff",
  star: "#9d8cff",
  text: "#ece8ff",
  yellow: "#ffd23f",
} as const;

// The sky from the top of the screen down to the horizon, for each stretch of the slope; one every three levels, round again after the last.
export const skies: readonly (readonly [string, string])[] = [
  ["#150b3a", "#2a1a63"],
  ["#2b1060", "#6a2a8a"],
  ["#0a2a4a", "#14507a"],
  ["#1a0a2e", "#4a1040"],
];
