import { colour, friendColours } from "./palette.ts";

// Glitchy and friends as pixel pictures, one character a pixel (a `.` is clear). Glitchy is the baby dragon from the explainer: mint,
// with a white belly, cream horns, pink spikes, lavender wings, and a tail that breaks into pixels.
const glitchyKey = {
  b: colour.blush,
  c: colour.cream,
  d: colour.mintDark,
  e: colour.eye,
  g: colour.cyan,
  h: colour.white,
  k: colour.ink,
  l: colour.lavender,
  m: colour.mint,
  p: colour.pink,
  w: colour.belly,
} as const;
export const keyFor = (
  body: string,
  shade: string,
): Readonly<Record<string, string>> => ({ ...glitchyKey, d: shade, m: body });
export const glitchyColours = glitchyKey;

// Side on, facing right; flipped for facing left.
const sideTop = [
  "......c...c.....",
  "......cp.pc.....",
  ".....kkkkkkk....",
  "....kmmmmmmmk...",
  "...kmmmmmmmmmk..",
  "...kmmmmmkhmmk..",
  "...kmmmmmeemmmk.",
  "...kmbmmmmmwwwk.",
  "....kmmmmmwwkwk.",
  ".l..kkmmmmmkkk..",
  "lll.kmmwwwmk....",
  ".llkmmwwwwmk....",
  "...kmmmwwwmk....",
] as const;
export const glitchySide = {
  breathe: [
    ...sideTop.slice(0, 7),
    "...kmbmmmmmwwwkk",
    "....kmmmmmwkkpk.",
    ...sideTop.slice(9),
    "gd.kmmmmmmk.....",
    ".dddkmk.kmk.....",
    "....kkk.kkk.....",
  ],
  jump: [
    ...sideTop,
    "gd.kmmmmmmk.....",
    ".dddkmkkmk......",
    "...kkk.kkk......",
  ],
  run: [
    [...sideTop, "gd.kmmmmmmk.....", ".dddkmk..kmk....", "...kkk...kkk...."],
    [...sideTop, "gd.kmmmmmmk.....", ".ddd.kmkkmk.....", "....kkkkkk......"],
  ],
  stand: [
    ...sideTop,
    "gd.kmmmmmmk.....",
    ".dddkmk.kmk.....",
    "....kkk.kkk.....",
  ],
} as const;

// From above, facing down (towards the player), up (back turned) and to the side.
export const glitchyFront = [
  "....c......c....",
  "....cp.pp.pc....",
  "...kkkkkkkkkk...",
  "..kmmmmmmmmmmk..",
  ".kmmmmmmmmmmmmk.",
  ".kmheemmmmeehmk.",
  ".kmeeemmmmeeemk.",
  ".kbmmmwwwwmmmbk.",
  "..kmmwwkkwwmmk..",
  ".lkkmmmmmmmmkkl.",
  "lllkmmwwwwmmklll",
  ".llkmmwwwwmmkll.",
  "...kmmwwwwmmk...",
  "...kmmmmmmmmk...",
  "...kmmk..kmmk...",
  "...kkkk..kkkk...",
] as const;
export const glitchyBack = [
  "....c......c....",
  "....c.pppp.c....",
  "...kkkkkkkkkk...",
  "..kmmmmpmmmmmk..",
  ".kmmmmmmmmmmmmk.",
  ".kmmmmmpmmmmmmk.",
  ".kmmmmmmmmmmmmk.",
  ".kdmmmmmmmmmmdk.",
  "..kdmmmmmmmmdk..",
  ".lkkmmmpmmmmkkl.",
  "lllkmmmmmmmmklll",
  ".llkmmmmmmmmkll.",
  "...kmmmmmmmmk...",
  "...kmmmddmmmk...",
  "...kmmk.gkmmk...",
  "...kkkk..kkkk...",
] as const;

export const friendKey = (friend: number): Readonly<Record<string, string>> => {
  const [body, shade] = friendColours[friend] ??
    friendColours[0] ?? ["#ff9f43", "#c4661c"];
  return keyFor(body, shade);
};

// A castle keeper: a grumpy stone golem, or a happy one once cheered up. The king wears a crown.
const golemBody = [
  "...kkkkkkkkkk...",
  "..kssssssssssk..",
  ".kssssssssssssk.",
  ".ksbbssssssbbsk.",
  ".ksseesssseessk.",
  ".kssssssssssssk.",
  ".kssskkkkkkssk..",
  "..kssssssssssk..",
  ".kkssssssssssskk",
  "kssksssssssskssk",
  "kssksssssssskssk",
  ".kkssssssssssskk",
  "...kssssssssk...",
  "...ksssk.ksssk..",
  "...kkkkk.kkkkk..",
] as const;
export const golemGrumpy = golemBody;
export const golemHappy = [
  ...golemBody.slice(0, 3),
  ".ksssssssssssssk",
  ".ksseesssseessk.",
  ".kspssssssssspk.",
  ".kssskssssksssk.",
  "..ksssskkkssssk.",
  ...golemBody.slice(8),
];
export const crown = ["..g..g..g..", "..gg.gg.gg.", "..ggggggggg"] as const;
export const golemKey = {
  b: colour.ink,
  e: colour.cyan,
  g: colour.gold,
  k: colour.ink,
  p: colour.blush,
  s: colour.stone,
} as const;
