// Where everything goes on a card picture, for each of its three sizes: a square post (1:1), a story (9:16) and a wide post (16:9). The
// trading card itself is always 5:7, like a real one; around it go the headline, the trophy shelf, the three chapters and the invitation.
export const shapes = ["square", "story", "wide"] as const;
export type Shape = (typeof shapes)[number];

export const shapeNames: Readonly<Record<Shape, string>> = {
  square: "1:1",
  story: "9:16",
  wide: "16:9",
};

export interface Box {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface Layout {
  readonly badges: Box;
  readonly card: Box;
  readonly headline: Box;
  readonly height: number;
  readonly invite: Box;
  // The three chapters: tiles side by side (`across`) or one above another (`down`), or long rows one above another (`rows`).
  readonly stack: "across" | "down" | "rows";
  readonly trophies: Box;
  readonly width: number;
}

const box = (x: number, y: number, width: number, height: number): Box => ({
  height,
  width,
  x,
  y,
});

// A 5:7 card `height` tall at (x, y), its width a whole number of pixels.
const card = (x: number, y: number, height: number): Box =>
  box(x, y, Math.round((height * 5) / 7), height);

const layouts: Readonly<Record<Shape, Layout>> = {
  square: {
    badges: box(712, 176, 308, 330),
    card: card(60, 176, 860),
    headline: box(60, 40, 960, 116),
    height: 1080,
    invite: box(712, 800, 308, 236),
    stack: "down",
    trophies: box(712, 526, 308, 254),
    width: 1080,
  },
  story: {
    badges: box(80, 1560, 920, 186),
    card: card(190, 340, 980),
    headline: box(80, 72, 920, 252),
    height: 1920,
    invite: box(80, 1764, 920, 140),
    stack: "rows",
    trophies: box(80, 1344, 920, 196),
    width: 1080,
  },
  wide: {
    badges: box(880, 340, 930, 190),
    card: card(110, 70, 940),
    headline: box(880, 70, 930, 250),
    height: 1080,
    invite: box(880, 794, 930, 200),
    stack: "across",
    trophies: box(880, 552, 930, 222),
    width: 1920,
  },
};

export const layoutOf = (shape: Shape): Layout => layouts[shape];

// The file a card is saved as, by its size.
export const fileNameOf = (shape: Shape): string =>
  `pocket-dragon-card-${shapeNames[shape].replace(":", "x")}.png`;
