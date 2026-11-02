import type { Guide } from "@ador/game-sdk/guide";

import type { PlayId } from "./rules/constants.ts";

// What the first screen of the quest and of each level says before a run: which it is, what the player does, and how to begin. It is drawn by the SDK
// over the chapter's idle screen. `instructions` is the same advice in a sentence, for the note under the screen when a run begins.
export const guides: Readonly<Record<PlayId, Guide>> = {
  castle: {
    lines: [
      "ARROWS: WALK   SPACE: TALK AND OPEN   F: FIRE",
      "DAY: BUILD THE GUILD  NIGHT: SAVE THE EGGS",
      "WINTER: STORM THE CASTLE FOR THE GOLDEN EGG",
    ],
    start: "ENTER TO PRACTISE LEVEL 2",
    title: "THE GUILD AND THE CASTLE",
  },
  hills: {
    lines: [
      "ARROWS: RUN   SPACE OR UP: JUMP   DOWN: DIG IN",
      "F: FIRE   WINGS: JUMP IN THE AIR TO FLY",
      "FIND THE SECRET TUNNEL AND SKY, BEAT DEFU",
    ],
    start: "ENTER TO PRACTISE LEVEL 1",
    title: "EGG HILLS",
  },
  quest: {
    lines: [
      "EGG HILLS, THEN THE CASTLE, THEN THE WOODS IN 3D",
      "ONE CLOCK AND THREE HEARTS FOR THE WHOLE QUEST",
      "WIN FAST FOR THE HALL OF FAME   1-3: PRACTISE",
    ],
    start: "ENTER TO START THE QUEST",
    title: "GLITCHY'S QUEST",
  },
  woods: {
    lines: [
      "UP AND DOWN: WALK   LEFT AND RIGHT: TURN",
      "SPACE OR F: BREATHE FIRE ON LANTERNS AND ICE",
      "READ 3 CLUES, BUILD THE EGG LAUNCHER, GET OUT",
    ],
    start: "ENTER TO PRACTISE LEVEL 3",
    title: "THE WHISPERING WOODS",
  },
};

export const instructions: Readonly<Record<PlayId, string>> = {
  castle:
    "Arrows walk, space talks and opens, F breathes fire. By day, help four friends join your guild and search the houses for gear and clues; by night, save the eggs from DeFu's guards; in winter, storm the castle. In a challenge: 1 to 5 shows, Q quick cheer, E evade, C charm.",
  hills:
    "Arrows or A and D run, space or up jumps, F breathes fire, down digs into a burrow. Take the wings to fly and the bubble for a forcefield, bounce a spring into the sky, and beat DeFu's ghost dragons to unseal each portal.",
  quest:
    "The whole quest in one run: Egg Hills, then the Guild and the Castle, then the Whispering Woods. Your hearts carry from level to level, and the clock never stops.",
  woods:
    "Up and down walk, left and right turn, space or F breathes fire. Find three clue stones and four launcher parts, then launch eggs at the targets.",
};
