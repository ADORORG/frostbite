// Everything the rules measure, in whole numbers. A place is in millimetres on the floor plan (x to the east, z to the south), a time is
// in ticks (thirty a second), and a heading is one of sixteen. Nothing here is a float, so every engine plays a run out the same way.
export const gameId = "peaceful-savage";
export const verifierId = "peaceful-savage";
export const verifierVersion = 1;

export const ticksPerSecond = 30;
// The longest a run may last (forty minutes), and so a bound on the work one replay does.
export const maxTicks = 72_000;

// How near the lead must stand to act on a thing, to talk to a person or a grey one, and to pick up a thread.
export const reach = 1_700;
export const talkReach = 2_300;
// The lead's body, as the walls see it.
export const bodyRadius = 260;

// A walk is this many millimetres a tick, and more for each point of the lead's speed.
export const walkBase = 38;
export const walkPerPoint = 6;

// Savage Vision: how long it lasts and how far it shows, before the lead's own vision; and how long it rests after.
export const visionBaseTicks = 240;
export const visionTicksPerPoint = 30;
export const visionBaseRadius = 4_200;
export const visionRadiusPerPoint = 700;
export const visionRestTicks = 150;
// Mama Heerah senses a sly snake this near, seen or not, while she is with the lead (or leads).
export const senseRadius = 2_600;

// A beat comes this long after its step begins; a press within the window of it lands. The window widens with the lead's heart.
export const beatLead = 45;
export const goodWindowBase = 6;
export const perfectWindow = 3;

// The Savage Breath: in for four counts, out for six. The breath in is held, and lands if it is near enough four counts long (nearer
// still for a calm lead); the breath out is counted for the player.
export const breathInTicks = 120;
export const breathOutTicks = 180;
export const breathSlackBase = 15;
export const breathSlackPerPoint = 5;

// Colour, per room, from grey (0) to full (100). The world starts almost grey, and only the lit tree brings the last of it.
export const startColour = 8;
export const colourBeforeTheEnd = 90;

// Points, which the best is kept in.
export const points = {
  beatGood: 15,
  beatPerfect: 30,
  bloomed: 60,
  breath: 60,
  deck: 50,
  drawer: 100,
  firstAnswer: 50,
  found: 150,
  healed: 100,
  jackets: 200,
  lamp: 10,
  lit: 1_000,
  pancakes: 50,
  planted: 20,
  sparky: 200,
  thread: 50,
  thing: 10,
  touch: 50,
  tower: 150,
} as const;
// Time left over adds a point a second, counted down from twenty minutes.
export const timeBonusSeconds = 1_200;

export const heroIds = ["kai", "zora", "heerah", "ali"] as const;
export type HeroId = (typeof heroIds)[number];

export const handKeys = [
  "cup",
  "comb",
  "knot",
  "knock",
  "split",
  "letgo",
] as const;
export type HandKey = (typeof handKeys)[number];

export const zoneIds = [
  "meadow",
  "hall",
  "kitchen",
  "kids",
  "office",
  "parents",
] as const;
export type ZoneId = (typeof zoneIds)[number];
