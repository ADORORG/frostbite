import { colour } from "./palette.ts";

// How the woods look up close: each wall and each thing is a small picture, sixteen by sixteen, read one column at a time by the
// raycaster. A wall picture is a function from a texel to a colour; a thing is rows of text, one character a texel.
export type Texel = (u: number, v: number) => string;

const bark = ["#6b4226", "#7a4d2c", "#5a3720"] as const;
const leaves = ["#2f8a4a", "#3fae5a", "#257040"] as const;

export const treeTexel: Texel = (u, v) => {
  if (v < 6)
    return (
      leaves[(u * 5 + v * 3) % 7 === 0 ? 1 : (u + v) % 5 === 0 ? 2 : 0] ??
      "#2f8a4a"
    );
  if (u === 3 || u === 10 || (u === 13 && v > 9)) return bark[2] ?? "#5a3720";
  return (u * 3 + v) % 11 === 0
    ? (bark[1] ?? "#7a4d2c")
    : (bark[0] ?? "#6b4226");
};

export const frozenTexel: Texel = (u, v) => {
  if (u === v || u === v + 1 || u + v === 15) return colour.white;
  return (u + v) % 4 === 0 ? colour.iceDark : colour.ice;
};

export const gateTexel =
  (open: boolean): Texel =>
  (u, v) => {
    const moon =
      (u - 8) * (u - 8) + (v - 8) * (v - 8) < 16 &&
      (u - 10) * (u - 10) + (v - 7) * (v - 7) >= 9;
    if (moon) return open ? colour.fireHot : colour.cream;
    if (u < 2 || u > 13 || v < 2) return open ? colour.cyan : colour.stoneDark;
    return open
      ? v % 3 === 0
        ? colour.white
        : colour.lavender
      : v % 4 === 0
        ? colour.stoneDark
        : colour.stone;
  };

export const thingKey: Readonly<Record<string, string>> = {
  b: "#8a5a2e",
  c: colour.cyan,
  d: colour.woodDark,
  f: colour.fire,
  g: colour.gold,
  h: colour.fireHot,
  i: colour.ice,
  k: colour.ink,
  l: colour.lavender,
  m: colour.mint,
  p: colour.pink,
  r: "#e8344e",
  s: colour.stone,
  t: colour.stoneDark,
  w: colour.white,
};

export const chestShut = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "..kkkkkkkkkkkk..",
  ".kbbbbbbbbbbbbk.",
  ".kbbbbbggbbbbbk.",
  ".kggggggwgggggk.",
  ".kbbbbbggbbbbbk.",
  ".kbbbbbbbbbbbbk.",
  ".kbbbbbbbbbbbbk.",
  ".kddddddddddddk.",
  "..kkkkkkkkkkkk..",
  "................",
];
export const chestOpen = [
  "................",
  "..kkkkkkkkkkkk..",
  ".kbbbbbbbbbbbbk.",
  ".kggggggggggggk.",
  "..kkkkkkkkkkkk..",
  "...h..c..p..h...",
  "..kkhkkckkpkkk..",
  ".kghcgpcgggcgpk.",
  ".kbbbbbbbbbbbbk.",
  ".kggggggwgggggk.",
  ".kbbbbbggbbbbbk.",
  ".kbbbbbbbbbbbbk.",
  ".kbbbbbbbbbbbbk.",
  ".kddddddddddddk.",
  "..kkkkkkkkkkkk..",
  "................",
];
export const moonChestPicture = chestShut.map((row) =>
  row.replace(/b/gu, "i").replace(/g/gu, "w"),
);
export const moonChestOpen = chestOpen.map((row) => row.replace(/b/gu, "i"));

export const stoneLit = [
  "................",
  "................",
  ".....kkkkkk.....",
  "....kssssssk....",
  "...kssscsssk....",
  "...ksscccssk....",
  "...kssscsssk....",
  "...kssssssssk...",
  "...ksscssscsk...",
  "...ksssccccsk...",
  "...kssssssssk...",
  "..ksssssssssk...",
  "..kssssssssssk..",
  "..ktttttttttttk.",
  "..kkkkkkkkkkkkk.",
  "................",
];
export const stoneRead = stoneLit.map((row) => row.replace(/c/gu, "t"));

export const lanternDark = [
  "......kkkk......",
  ".....kttttk.....",
  "....kkkkkkkk....",
  "....kssssssk....",
  "....ks....sk....",
  "....ks....sk....",
  "....ks....sk....",
  "....kssssssk....",
  ".....kkkkkk.....",
  ".......dd.......",
  ".......dd.......",
  ".......dd.......",
  ".......dd.......",
  ".......dd.......",
  ".....dddddd.....",
  "................",
];
export const lanternLit = lanternDark.map((row, at) =>
  at >= 4 && at <= 6 ? row.replace(/\.\.\.\./u, "hffh") : row,
);
