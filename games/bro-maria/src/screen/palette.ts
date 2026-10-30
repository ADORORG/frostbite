// The colours of the screen, by what they are.
// The sky and the two ridges of mountains behind each stage, from the first (dusk) to the last (a storm night): high sky, low sky, near
// mountains, far mountains.
export const themes = [
  ["#1b0f4a", "#6f5cc9", "#5b6bb5", "#3d4a8c"],
  ["#0f2a4a", "#3f8fb0", "#4f7fa8", "#2f5a80"],
  ["#2a0f3a", "#b0507a", "#8a4f9a", "#5a2f78"],
  ["#0f3a30", "#3fa08a", "#3f8a78", "#2a6458"],
  ["#3a1a0f", "#c0703f", "#9a5a3a", "#6a3a28"],
  ["#050210", "#2a1a4a", "#3a3a6a", "#222244"],
] as const;

export const colour = {
  cloud: "#f4fbff",
  coin: "#ffd23f",
  coinDark: "#c98a14",
  crate: "#e8a33d",
  crateDark: "#a8641c",
  crateUsed: "#8a8fa8",
  deep: "#0c0620",
  face: "#ffd9b3",
  ice: "#9fe8ff",
  iceDark: "#3a7fb8",
  iceDeep: "#25507f",
  mountain: "#5b6bb5",
  mountainFar: "#3d4a8c",
  parka: "#e24f6b",
  parkaDark: "#a82c47",
  scarf: "#38e8ff",
  shadow: "rgb(0 0 0 / 0.25)",
  skyHigh: "#1b0f4a",
  skyLow: "#6f5cc9",
  slime: "#56f5a6",
  slimeDark: "#1f9e66",
  snow: "#ffffff",
  spike: "#c7d0ff",
  spikeDark: "#6a74b8",
  white: "#ffffff",
  wood: "#c98a14",
} as const;
