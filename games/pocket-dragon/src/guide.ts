import type { Guide } from "@ador/game-sdk/guide";

import type { PlayId } from "./rules/constants.ts";

// What the first screen of the quest and of each level says before a run: which it is, what the player does, and how to begin. It is drawn by the SDK
// over the chapter's idle screen. `instructions` is the same advice in a sentence, for the note under the screen when a run begins.
export const guides: Readonly<Record<PlayId, Guide>> = {
  castle: {
    lines: [
      "ARROWS: WALK   SPACE: TALK AND OPEN   F: FIRE",
      "BUILD THE GUILD, SAVE THE EGGS, STORM THE CASTLE",
      "BACKPACK: B BERRY  R MUSHROOM  G PINEAPPLE",
    ],
    start: "ENTER TO PRACTISE LEVEL 2",
    title: "THE GUILD AND THE CASTLE",
  },
  hills: {
    lines: [
      "ARROWS: RUN   SPACE OR UP: JUMP   DOWN: DIG IN",
      "F: FIRE   WINGS: JUMP IN THE AIR TO FLY",
      "BACKPACK: B BERRY  R MUSHROOM  G PINEAPPLE",
    ],
    start: "ENTER TO PRACTISE LEVEL 1",
    title: "EGG HILLS",
  },
  quest: {
    lines: [
      "EGG HILLS, THEN THE CASTLE, THEN THE WOODS IN 3D",
      "HEARTS AND BACKPACK CARRY ON, ONE CLOCK",
      "WIN FAST FOR THE HALL OF FAME   1-3: PRACTISE",
    ],
    start: "ENTER TO START THE QUEST",
    title: "GLITCHY'S QUEST",
  },
  woods: {
    lines: [
      "MAZE: UP/DOWN WALK  LEFT/RIGHT TURN  F: FIRE",
      "OUTSIDE: SPACE FREES, OPENS AND FITS KEYS",
      "BACKPACK: B BERRY  R MUSHROOM  G PINEAPPLE",
    ],
    start: "ENTER TO PRACTISE LEVEL 3",
    title: "THE WHISPERING WOODS",
  },
};

const backpack =
  " Your backpack keeps what you find: B eats a berry for fire that reaches farther, R rolls a mushroom's glitch blast, and G eats a pineapple to grow big, so the next bump only shrinks you.";

export const instructions: Readonly<Record<PlayId, string>> = {
  castle:
    "Arrows walk, space talks and opens, F breathes fire. By day, help four friends join your guild and search the houses for gear and clues; by night, save the eggs from DeFu's guards; in winter, storm the castle. In a challenge: 1 to 5 shows, Q quick cheer, E evade, C charm." +
    backpack,
  hills:
    "Arrows or A and D run, space or up jumps, F breathes fire, down digs into a burrow. Take the wings to fly and the bubble for a forcefield, bounce a spring into the sky, and beat DeFu's ghost dragons to unseal each portal." +
    backpack,
  quest:
    "The whole quest in one run: Egg Hills, then the Guild and the Castle, then the Whispering Woods. Your hearts and your backpack carry from level to level, and the clock never stops.",
  woods:
    "In the maze, up and down walk, left and right turn, and F breathes fire: read three clue stones and find four launcher parts to open the moon gate. Outside, the arrows walk, F breathes fire, and space frees caged dragons, opens chests for three rocket keys and fits them into DeFu's rocket once her factory's valves are broken. Dodge her laser and shockwave." +
    backpack,
};
