import { colour } from "./palette.ts";

// The pictures. A runner is six pixels wide; its colours are named by a character each.
const runnerKey = {
  c: colour.cyan,
  d: colour.cyanDark,
  k: colour.deep,
  w: colour.core,
  y: colour.yellow,
} as const;
const deadKey = {
  ...runnerKey,
  c: colour.red,
  d: colour.redDark,
} as const;

export const runnerKeys = { alive: runnerKey, dead: deadKey } as const;

// Two frames of running (legs apart, legs together), the tuck of a jump, and the low slide.
export const runnerFrames = {
  jump: ["..cc..", ".cwwc.", ".cccc.", "ycccdd", ".cddc.", ".c..c.", "cc..cc"],
  run: [
    [
      "..cc..",
      ".cwwc.",
      ".cccc.",
      "ycccdd",
      ".cccc.",
      ".cddc.",
      ".c..c.",
      ".c..c.",
      "kk..kk",
    ],
    [
      "..cc..",
      ".cwwc.",
      ".cccc.",
      "ycccdd",
      ".cccc.",
      ".cddc.",
      "..cc..",
      "..cc..",
      "..kk..",
    ],
  ],
  slide: ["ycccww", ".cccc.", ".cddc.", "kk..kk"],
} as const;

export const spikeRows = [
  "..pw..",
  "..pp..",
  ".pppr.",
  ".pppr.",
  "pppppr",
] as const;
export const spikeKey = {
  p: colour.pink,
  r: colour.red,
  w: colour.core,
} as const;

export const shardFrames = [
  [".y.", "yww", ".y."],
  [".w.", "wyw", ".w."],
] as const;
export const shardKey = { w: colour.core, y: colour.yellow } as const;
