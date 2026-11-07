import type { Guide } from "@frostbite/game-sdk/guide";
import { byInput } from "@frostbite/game-sdk/touch";

import type { PlayId } from "./rules/constants.ts";

// What the first screen of the quest and of each level says before a run: which it is, what the player does, and how to begin. The SDK
// draws it over the chapter's idle screen, sharp, on a layer of its own (`page/view.ts`), and on a touch screen it says the touch lines
// (thumbs on the screen, the Levels and Bag tab) and the touch start instead. `instructions` is the same advice in one short line, for
// the note under the screen when a run begins.
const backpackKeys = "BACKPACK: B BERRY  R MUSHROOM  G PINEAPPLE";
const backpackBag = "BAG TAB: BERRY, MUSHROOM, PINEAPPLE";

export const guides: Readonly<Record<PlayId, Guide>> = {
  castle: {
    lines: [
      "ARROWS: WALK   SPACE: TALK AND OPEN   F: FIRE",
      "BUILD THE GUILD, SAVE THE EGGS, STORM THE CASTLE",
      backpackKeys,
    ],
    start: "ENTER TO PRACTISE LEVEL 2",
    title: "THE GUILD AND THE CASTLE",
    touchLines: [
      "LEFT THUMB: WALK   RIGHT THUMB: TALK AND FIRE",
      "BUILD THE GUILD, SAVE THE EGGS, STORM THE CASTLE",
      backpackBag,
    ],
    touchStart: "TAP TO PRACTISE LEVEL 2",
  },
  hills: {
    lines: [
      "ARROWS: RUN   SPACE OR UP: JUMP   DOWN: DIG IN",
      "F: FIRE   WINGS: JUMP IN THE AIR TO FLY",
      backpackKeys,
    ],
    start: "ENTER TO PRACTISE LEVEL 1",
    title: "EGG HILLS",
    touchLines: [
      "LEFT THUMB: RUN, PUSH UP TO JUMP, DOWN TO DIG",
      "RIGHT THUMB: JUMP AND FIRE, AS MARKED",
      backpackBag,
    ],
    touchStart: "TAP TO PRACTISE LEVEL 1",
  },
  quest: {
    lines: [
      "EGG HILLS, THEN THE CASTLE, THEN THE WOODS IN 3D",
      "HEARTS AND BACKPACK CARRY ON, ONE CLOCK",
      "WIN FAST FOR THE HALL OF FAME   1-3: PRACTISE",
    ],
    start: "ENTER TO START THE QUEST",
    title: "GLITCHY'S QUEST",
    touchLines: [
      "EGG HILLS, THEN THE CASTLE, THEN THE WOODS IN 3D",
      "HEARTS AND BACKPACK CARRY ON, ONE CLOCK",
      "LEVELS TAB: PRACTISE ONE LEVEL",
    ],
    touchStart: "TAP TO START THE QUEST",
  },
  woods: {
    lines: [
      "MAZE: UP/DOWN WALK  LEFT/RIGHT TURN  F: FIRE",
      "OUTSIDE: E/Q FLY  V FROST VISION  H SPARKY",
      backpackKeys,
    ],
    start: "ENTER TO PRACTISE LEVEL 3",
    title: "THE WHISPERING WOODS",
    touchLines: [
      "MAZE: LEFT THUMB WALKS AND TURNS, RIGHT FIRES",
      "OUTSIDE: FLY, VISION AND SPARKY BUTTONS",
      backpackBag,
    ],
    touchStart: "TAP TO PRACTISE LEVEL 3",
  },
};

const questLine =
  "Three levels on one clock: your hearts and your backpack carry on.";

// One short line for each, for a keyboard and for thumbs; the guide and the README say the rest.
const lines: Readonly<
  Record<PlayId, { readonly keys: string; readonly thumbs: string }>
> = {
  castle: {
    keys: "Arrows walk, space talks and opens, F breathes fire; in a challenge, 1 to 5, Q, E and C pick a move.",
    thumbs: "Left thumb walks; right thumb talks, opens and breathes fire.",
  },
  hills: {
    keys: "Arrows run, space or up jumps, down digs in, F breathes fire; B, R and G use the backpack.",
    thumbs: "Left thumb runs, jumps and digs; right thumb jumps and fires.",
  },
  quest: { keys: questLine, thumbs: questLine },
  woods: {
    keys: "Arrows walk and turn, F fires, space uses; outside, E and Q fly, V sees futures, H sends Sparky.",
    thumbs:
      "Left thumb walks; right thumb uses and fires; outside, the buttons fly.",
  },
};

export const instructions = (id: PlayId): string =>
  byInput(lines[id].keys, lines[id].thumbs);
