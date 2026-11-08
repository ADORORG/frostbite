// The twelve preset pictures a player may choose for their profile, drawn as 10x10 pixel sprites. Each sprite is written as its left half
// (five characters a row, ten rows) and mirrored, so every picture is symmetrical and a new one is 50 characters. A letter is a colour of
// the sprite's palette (`.` is empty): `o` the outline, `w` white, `e` an eye, `k` the darkest ink, then the sprite's own `a`, `b`, `y`,
// `r` and `p`. The ids are the ones `@frostbite/shared/profiles` lists; a test in the profiles feature fails if the two drift apart.

export interface AvatarSprite {
  // The colour the picture's frame and glow take on a profile card.
  readonly accent: string;
  readonly colours: Readonly<Record<string, string>>;
  // The left half, ten rows of five characters.
  readonly rows: readonly string[];
}

const ink = "#1b1038";
// The outline is a shade lighter than the ink, so a picture keeps its shape on the arcade's dark panels.
const base = { e: ink, k: ink, o: "#4a3590", w: "#ffffff" } as const;

export const avatarSprites = {
  alien: {
    accent: "#4dffa8",
    colours: { ...base, a: "#4dffa8", b: "#1fb878", p: "#ff5fd2" },
    rows: [
      "..ooo",
      ".oaaa",
      "oaaaa",
      "oaaaa",
      "oweea",
      "oweea",
      "oaaaa",
      ".oabb",
      "..oaa",
      "...oo",
    ],
  },
  bear: {
    accent: "#ffb066",
    colours: { ...base, a: "#a8683a", b: "#e0b085", p: "#ff9aa8" },
    rows: [
      "oo...",
      "obo..",
      "oaaao",
      "oaaaa",
      "oaeaa",
      "oaaaa",
      "oabbb",
      ".obwk",
      "..obb",
      "...oo",
    ],
  },
  cat: {
    accent: "#ff5fd2",
    colours: {
      ...base,
      a: "#8b6bd9",
      b: "#c7b4ff",
      p: "#ff5fd2",
      y: "#ffd23f",
    },
    rows: [
      "o...o",
      "oo..o",
      "opoaa",
      "oaaaa",
      "oayea",
      "oaaaa",
      "oaabp",
      ".oaww",
      "..oaa",
      "...oo",
    ],
  },
  dragon: {
    accent: "#ff3355",
    colours: {
      ...base,
      a: "#ff4d63",
      b: "#ffb3bd",
      y: "#ffd23f",
      r: "#b3122c",
    },
    rows: [
      "o.y.o",
      "oryro",
      "orarr",
      "oaaaa",
      "oayea",
      "oaaaa",
      "oabbb",
      ".obwb",
      "..obb",
      "...oo",
    ],
  },
  fox: {
    accent: "#ff8a24",
    colours: { ...base, a: "#ff8a24", b: "#ffd2a1" },
    rows: [
      "oo...",
      "oaoo.",
      "oabba",
      "oaaaa",
      "oaeaa",
      "oaaaa",
      "obwww",
      ".owww",
      "..owk",
      "...oo",
    ],
  },
  frog: {
    accent: "#8cff4d",
    colours: { ...base, a: "#5fd13a", b: "#b9f08f", p: "#ff7a8a" },
    rows: [
      "oooo.",
      "owwwo",
      "oweeo",
      "oaaaa",
      "oaaaa",
      "oaaaa",
      "oakkk",
      "oaaaa",
      ".oaaa",
      "..ooo",
    ],
  },
  ghost: {
    accent: "#2be7ff",
    colours: { ...base, a: "#dff6ff", b: "#9fd8f0", p: "#ff9ad6" },
    rows: [
      "..ooo",
      ".oaaa",
      "oaaaa",
      "oaeea",
      "oaeea",
      "oapaa",
      "oaaak",
      "oaaaa",
      "oabab",
      "o.o.o",
    ],
  },
  owl: {
    accent: "#ffd23f",
    colours: { ...base, a: "#a8743a", b: "#e6c288", y: "#ffd23f" },
    rows: [
      "oo...",
      "oaaaa",
      "oaaaa",
      "oawww",
      "oawew",
      "oawww",
      "oaaay",
      "oabbb",
      ".oabb",
      "..ooo",
    ],
  },
  penguin: {
    accent: "#6f7bff",
    colours: { ...base, a: "#2b2f77", b: "#4b50b0", y: "#ffb02e" },
    rows: [
      "..ooo",
      ".oaaa",
      "oaaaa",
      "oaewa",
      "oaaay",
      "oawww",
      "oawww",
      "oawww",
      ".oaww",
      "..yyy",
    ],
  },
  robot: {
    accent: "#9aa8c7",
    colours: {
      ...base,
      a: "#9aa8c7",
      b: "#d3dcf0",
      r: "#ff3355",
      y: "#ffd23f",
    },
    rows: [
      "....y",
      "....o",
      "ooooo",
      "oaaaa",
      "oerer",
      "oaaaa",
      "obbbb",
      "oakak",
      "oaaaa",
      ".oooo",
    ],
  },
  snowman: {
    accent: "#cfe8ff",
    colours: {
      ...base,
      a: "#ffffff",
      b: "#cfe8ff",
      r: "#ff3355",
      y: "#ff9f1c",
    },
    rows: [
      "..ooo",
      "..ooo",
      "ooooo",
      ".owww",
      "owewb",
      "owwwy",
      "orrrr",
      "owwww",
      "owbww",
      ".oooo",
    ],
  },
  yeti: {
    accent: "#8fe3ff",
    colours: {
      ...base,
      a: "#e8f4ff",
      b: "#9fc9e8",
      p: "#ff9ad6",
      y: "#2be7ff",
    },
    rows: [
      "..ooo",
      ".oaaa",
      "oaaaa",
      "oabbb",
      "oabeb",
      "oabbb",
      "oabkk",
      "oabww",
      ".oaaa",
      "..ooo",
    ],
  },
} as const satisfies Record<string, AvatarSprite>;

export type AvatarSpriteId = keyof typeof avatarSprites;
export const avatarSpriteIds = Object.keys(avatarSprites) as AvatarSpriteId[];

// A sprite's rows as ten full-width rows: the left half, then its mirror image.
export function spriteRows(sprite: AvatarSprite): string[] {
  return sprite.rows.map((half) => half + [...half].reverse().join(""));
}
