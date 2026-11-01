import type { Guide } from "@ador/game-sdk/guide";

import type { ChapterId } from "./rules/constants.ts";

// What the first screen of each chapter says before a run: the chapter, what the player does, and how to begin. It is drawn by the SDK
// over the chapter's idle screen. `instructions` is the same advice in a sentence, for the note under the screen when a run begins.
export const guides: Readonly<Record<ChapterId, Guide>> = {
  castle: {
    lines: [
      "ARROWS: WALK   SPACE: TALK   F: BREATHE FIRE",
      "CHALLENGES: 1-5 SHOWS  Q QUICK  E EVADE  C CHARM",
      "BUILD A GUILD, CHEER UP THE GUARDS, RAISE THE BANNER",
    ],
    start: "ENTER TO START CHAPTER 3",
    title: "THE GUILD AND THE CASTLE",
  },
  hills: {
    lines: [
      "ARROWS OR A D: RUN   SPACE OR UP: JUMP",
      "EAT THE FIRE BERRY, THEN F OR X: BREATHE FIRE",
      "BEAT MADAME VEX'S GHOST DRAGONS TO OPEN THE PORTAL",
    ],
    start: "ENTER TO START CHAPTER 1",
    title: "EGG HILLS",
  },
  woods: {
    lines: [
      "UP AND DOWN: WALK   LEFT AND RIGHT: TURN",
      "SPACE OR F: BREATHE FIRE ON LANTERNS AND ICE",
      "READ 3 CLUES, BUILD THE EGG LAUNCHER, GET OUT",
    ],
    start: "ENTER TO START CHAPTER 2",
    title: "THE WHISPERING WOODS",
  },
};

export const instructions: Readonly<Record<ChapterId, string>> = {
  castle:
    "Arrows walk, space talks and picks up, F breathes fire. Help four friends join your guild. In a challenge: 1 to 5 shows, Q quick cheer, E evade, C charm.",
  hills:
    "Arrows or A and D run, space or up jumps, F breathes fire. Beat Madame Vex's ghost dragons to unseal each portal; dodge the spots she marks in red.",
  woods:
    "Up and down walk, left and right turn, space or F breathes fire. Find three clue stones and four launcher parts, then launch eggs at the targets.",
};
