// The colours of the screen (the platform's neon on its deep violet, as the scenes use).
export const colour = {
  aurora: "rgba(86, 245, 166, 0.16)",
  auroraCool: "rgba(56, 232, 255, 0.13)",
  background: "#0c0620",
  core: "#ece8ff",
  cyan: "#38e8ff",
  deep: "#1b1046",
  frost: "#a8dcff",
  ghost: "rgba(168, 220, 255, 0.1)",
  ground: "#262040",
  groundLight: "#34305a",
  groundLine: "#56f5a6",
  hill: "#2a1a63",
  night: "#150b3a",
  ridge: "#3a2a78",
  shadow: "rgba(0, 0, 0, 0.35)",
  skyLow: "#2a1a63",
  star: "#5b4aa8",
  starBright: "#9d8cff",
} as const;

// Each block of the tower is lit ice of one of these, going up: a face, its lit top edge and its shaded foot.
interface Slab {
  readonly face: string;
  readonly foot: string;
  readonly top: string;
}

const first: Slab = { face: "#38e8ff", foot: "#1b9fc0", top: "#c8f8ff" };

export const slabColours: readonly Slab[] = [
  first,
  { face: "#7fd0ff", foot: "#3f8fc9", top: "#d9f0ff" },
  { face: "#b05cff", foot: "#7236b8", top: "#e2c4ff" },
  { face: "#ff4fa3", foot: "#b0276f", top: "#ffc0de" },
  { face: "#ffd23f", foot: "#c79a14", top: "#fff0b0" },
  { face: "#56f5a6", foot: "#2aa870", top: "#c4ffe2" },
];

// The colours of block `row` (0 is the first), going round again for a tall tower.
export const slabPalette = (row: number): Slab =>
  slabColours[row % slabColours.length] ?? first;
