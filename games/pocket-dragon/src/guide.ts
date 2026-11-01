import type { Guide } from "@ador/game-sdk/guide";

import type { PlayId } from "./rules/constants.ts";

// What the first screen of the quest and of each level says before a run: which it is, what the player does, and how to begin. It is drawn by the SDK
// over the chapter's idle screen. `instructions` is the same advice in a sentence, for the note under the screen when a run begins.
export const guides: Readonly<Record<PlayId, Guide>> = {
  castle: {
    lines: [
      "ARROWS: WALK ANYWHERE   SPACE: TALK   F: BREATHE FIRE",
      "CHALLENGES: 1-5 SHOWS  Q QUICK  E EVADE  C CHARM",
      "BUILD A GUILD, CHEER UP THE GUARDS, RAISE THE BANNER",
    ],
    start: "ENTER TO PRACTISE LEVEL 2",
    title: "THE GUILD AND THE CASTLE",
  },
  hills: {
    lines: [
      "ARROWS OR A D: RUN   SPACE OR UP: JUMP",
      "EAT THE FIRE BERRY, THEN F OR X: BREATHE FIRE",
      "BEAT DEFU'S GHOST DRAGONS TO OPEN THE PORTAL",
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
    "Arrows walk, space talks and picks up, F breathes fire. Help four friends join your guild. In a challenge: 1 to 5 shows, Q quick cheer, E evade, C charm.",
  hills:
    "Arrows or A and D run, space or up jumps, F breathes fire. Beat DeFu's ghost dragons to unseal each portal; dodge the spots she marks in red.",
  quest:
    "The whole quest in one run: Egg Hills, then the Guild and the Castle, then the Whispering Woods. Your hearts carry from level to level, and the clock never stops.",
  woods:
    "Up and down walk, left and right turn, space or F breathes fire. Find three clue stones and four launcher parts, then launch eggs at the targets.",
};
