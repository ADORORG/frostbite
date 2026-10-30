import { colour } from "./palette.ts";

// The pictures, one character a pixel. The hero is twelve pixels wide and fourteen high, like the box the rules give it.
export const heroKey = {
  b: colour.deep,
  f: colour.face,
  h: colour.parkaDark,
  k: colour.deep,
  p: colour.parka,
  s: colour.scarf,
} as const;

const top = [
  "....hhhh....",
  "...hhhhhh...",
  "...hffffh...",
  "...fkffkf...",
  "...ffffff...",
  "..ssssssss..",
  ".pppppppppp.",
  ".ppppppppsp.",
  ".pppppppppp.",
  ".pppppppppp.",
] as const;

export const heroFrames = {
  jump: [
    ...top,
    "..pp....pp..",
    "..pp....pp..",
    ".bb......bb.",
    ".bb......bb.",
  ],
  run: [
    [...top, "..pp....pp..", "..pp....pp..", "..bb....bb..", ".bbb....bbb."],
    [...top, "...pp..pp...", "...pp..pp...", "...bb..bb...", "..bbb..bbb.."],
  ],
  stand: [
    ...top,
    "..pp....pp..",
    "..pp....pp..",
    "..bb....bb..",
    ".bbb....bbb.",
  ],
} as const;

export const slimeKey = {
  d: colour.slimeDark,
  g: colour.slime,
  k: colour.deep,
  w: colour.white,
} as const;

export const slimeFrames = [
  [
    "....gggggg....",
    "..gggggggggg..",
    ".ggwkggggwkgg.",
    ".ggwkggggwkgg.",
    "gggggggggggggg",
    "gggggggggggggg",
    "dgggggggggggdg",
    ".dddddddddddd.",
  ],
  [
    "..............",
    "....gggggg....",
    ".gggggggggggg.",
    "ggwkggggwkgggg",
    "ggwkggggwkgggg",
    "gggggggggggggg",
    "dgggggggggggdg",
    ".dddddddddddd.",
  ],
] as const;

export const urchinKey = {
  d: colour.spikeDark,
  k: colour.deep,
  s: colour.spike,
} as const;
export const urchinRows = [
  "s....s....s.",
  ".s..sss..s..",
  "..ssssssss..",
  ".ssskssksss.",
  "sssssssssssd",
  ".ssssssssss.",
  "..dddddddd..",
] as const;

export const coinKey = {
  c: colour.coin,
  d: colour.coinDark,
  w: colour.white,
} as const;
export const coinFrames = [
  ["..cc..", ".cwcc.", "cwccdc", "cccddc", ".cddc.", "..cc.."],
  ["..cc..", "..cc..", "..cc..", "..cd..", "..dc..", "..cc.."],
] as const;
