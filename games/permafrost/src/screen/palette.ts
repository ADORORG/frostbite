// The colours of the screen: the platform's neon on its deep violet, one for each piece, and a cold grey for the rows that rise.
export const colour = {
  background: "#0c0620",
  danger: "#ff4fa3",
  frame: "#3a2a78",
  garbage: "#7a7f99",
  ghost: "#ece8ff",
  grid: "#150a35",
  panel: "#1b1046",
  text: "#ece8ff",
  yellow: "#ffd23f",
} as const;

// Pieces 1 to 7 (long, square, T, S, Z, J, L), then the grey of a garbage row.
export const pieceColour: readonly string[] = [
  colour.background,
  "#4de1ff",
  "#ffd23f",
  "#b68cff",
  "#56f5a6",
  "#ff4fa3",
  "#5b8cff",
  "#ff9a3c",
  colour.garbage,
];
