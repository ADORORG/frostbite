// The colours of the screen: the platform's deep violet, with the greens and pinks of an aurora. Each lane has a colour of its own.
export const colour = {
  back: "#0c0620",
  danger: "#ff4757",
  good: "#9d8cff",
  great: "#38e8ff",
  line: "#ece8ff",
  panel: "#140c38",
  panelLine: "#3a2870",
  perfect: "#ffd23f",
  text: "#ece8ff",
  textDim: "#9d8cff",
} as const;

export const laneColours = [
  "#56f5a6",
  "#38e8ff",
  "#ff4f8b",
  "#ffd23f",
] as const;

// The bands of the aurora behind the lanes.
export const auroraBands = ["#1b2a6b", "#14507a", "#3a1a63"] as const;
