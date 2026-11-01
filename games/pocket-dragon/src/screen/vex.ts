import { colour } from "./palette.ts";
import { glitchySide } from "./sprites.ts";

// The boss of Egg Hills and her helpers, as pixel pictures (one character a pixel, `.` clear). Madame Vex: deep brown skin, a tall
// fro-hawk, gold hoops, and a turquoise two-piece (a V-neck top and wide trousers slit at one side). Her eyes glow red when she is about
// to fire. Her baby ghost dragons are pale and see-through with red eyes; her guards wear turquoise caps; her rocket is full of eggs.
export const vexRows = [
  ".......kk.......",
  "......khhk......",
  "......khHk......",
  ".....khhHhk.....",
  ".....khhhhk.....",
  ".....khhhhk.....",
  "....kkhhhhkk....",
  "....kssssssk....",
  "...gksesseskg...",
  "...gkssssssk....",
  "....kssmmssk....",
  ".....kssssk.....",
  "......kssk......",
  "...ksttsssttsk..",
  "..ksstttsttttsk.",
  "..ks.ktttttk.sk.",
  "..ks..kssssk.sk.",
  "..gs..kssssk.sg.",
  "..ks.kTTTTTTk.k.",
  ".....kttttttk...",
  ".....kttktttk...",
  ".....kttkstsk...",
  ".....kttktssk...",
  ".....kttktssk...",
  ".....kttktstk...",
  ".....kttktttk...",
  ".....kssk.ssk...",
  "....kkkkk.kkkk..",
] as const;

export const vexKey = (eyesRed: boolean): Readonly<Record<string, string>> => ({
  H: "#4a2a6a",
  S: "#4a2a18",
  T: "#169a8e",
  e: eyesRed ? "#ff2a3a" : colour.white,
  g: colour.gold,
  h: "#140c1c",
  k: colour.ink,
  m: "#b8323f",
  s: "#6b3f24",
  t: "#2ed8c3",
});

// A ghost dragon is Glitchy's shape in ghostly colours, with a wisp for legs.
export const ghostRows = [
  ...glitchySide.jump.slice(0, 13),
  ".d.kmmmmmmk.....",
  "..ddkmmmmk......",
  "....dddd........",
];

export const ghostKey = (hurt: boolean): Readonly<Record<string, string>> => ({
  b: "#ff8fc4",
  c: "#efe9ff",
  d: "#8f86c4",
  e: "#ff2a3a",
  g: "#c9c3e6",
  h: "#ffffff",
  k: hurt ? "#ffffff" : "#5d5490",
  l: "#b9b0e6",
  m: hurt ? "#ffffff" : "#c9c3e6",
  p: "#8f86c4",
  w: "#efe9ff",
});

export const guardRows = [
  "..kkkkkk..",
  ".kttttttk.",
  "kttttttttk",
  ".kkkkkkkk.",
  ".kssssssk.",
  ".ksesseskk",
  ".kssssssk.",
  "..kssssk..",
  ".kbbbbbbk.",
  "kbbgbbbbbk",
  "kbbbbbbbbk",
  ".kbbbbbbk.",
  ".kbbk.kbbk",
  ".kkk..kkk.",
] as const;

export const guardKey: Readonly<Record<string, string>> = {
  b: "#2a2f5a",
  e: colour.eye,
  g: colour.gold,
  k: colour.ink,
  s: "#8a5a3a",
  t: "#2ed8c3",
};

export const rocketRows = [
  "......kkkkkkkkkkkkk.....",
  "...kkkrrrrrrrrrrrrrkk...",
  ".kkrrrwwwrrwwwrrwwwrrkk.",
  "kfrrrwweewwweewwweewrrrk",
  "kffrrwweewwweewwweewrrrk",
  "kfrrrwwwwrrwwwwrrwwwrrrk",
  ".kkrrrrrrrrrrrrrrrrrrkk.",
  "...kkkrrrrrrrrrrrrrkk...",
  "......kkkkkkkkkkkkk.....",
  "....kk..........kk......",
  "...kffk........kffk.....",
  "....kk..........kk......",
] as const;

export const rocketKey = (hurt: boolean): Readonly<Record<string, string>> => ({
  e: colour.belly,
  f: colour.fire,
  k: colour.ink,
  r: hurt ? colour.white : "#c83a5a",
  w: "#9fe8ff",
});
