import { pieceColour } from "../src/screen/palette.ts";

// The pieces of every milestone drawing: the frame in the colour of its tier, squares merged into one path each, and the small dots that
// say how hard it is. A drawing may use only what the platform's checker allows (shapes, paths and gradients, hex colours, no text), so
// numbers are shown by counting things, never by writing them.
export const tiers = [
  { colour: "#38e8ff", name: "easy" },
  { colour: "#56f5a6", name: "medium" },
  { colour: "#ffd23f", name: "hard" },
  { colour: "#ff4fa3", name: "elite" },
] as const;

export type Tier = 1 | 2 | 3 | 4;

const round = (n: number): string => String(Math.round(n * 10) / 10);

// A square of `size` at x, y, as path data.
export const square = (x: number, y: number, size: number): string =>
  `M${round(x)} ${round(y)}h${round(size)}v${round(size)}h${round(-size)}z`;

// Squares of one colour, as one path.
export const cells = (squares: readonly string[], fill: string): string =>
  squares.length === 0 ? "" : `<path d="${squares.join("")}" fill="${fill}"/>`;

export const polygon = (
  points: readonly (readonly [number, number])[],
  fill: string,
  extra = "",
): string =>
  `<polygon points="${points.map(([x, y]) => `${round(x)},${round(y)}`).join(" ")}" fill="${fill}"${extra}/>`;

// The colour of piece 1 to 7, and the grey of a rising row.
export const piece = (kind: number): string => pieceColour[kind] ?? "#7a7f99";
export const grey = pieceColour[8] ?? "#7a7f99";
export const white = "#ece8ff";

// The frame: a dark rounded square with the tier's colour round it and glow behind, the picture, and a dot for each step of the tier.
export function frame(tier: Tier, picture: string): string {
  const colour = tiers[tier - 1]?.colour ?? "#ffffff";
  const dots = Array.from(
    { length: tier },
    (_, at) =>
      `<circle cx="${round(64 + (at - (tier - 1) / 2) * 12)}" cy="116" r="3" fill="${colour}"/>`,
  ).join("");
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">',
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c0620"/><stop offset="1" stop-color="#1b1046"/></linearGradient>',
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${colour}" stop-opacity="0.35"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect x="2" y="2" width="124" height="124" rx="14" fill="url(#bg)" stroke="${colour}" stroke-width="3"/>`,
    '<rect x="2" y="2" width="124" height="124" rx="14" fill="url(#glow)"/>',
    picture,
    dots,
    "</svg>",
  ].join("");
}
