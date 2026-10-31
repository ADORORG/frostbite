import type { Guide } from "@ador/game-sdk/guide";

import type { ChapterId } from "./rules/constants.ts";

// What the first screen of each chapter says before a run: the chapter, what the player does, and how to begin. It is drawn by the SDK
// over the chapter's idle screen. `instructions` is the same advice in a sentence, for the note under the screen when a run begins.
export const guides: Readonly<Record<ChapterId, Guide>> = {
  castle: {
    lines: [
      "ARROWS: WALK   SPACE: TALK, PICK UP, CHOOSE",
      "F: BREATHE FIRE   FIND WHAT EACH FRIEND WANTS",
      "BUILD A GUILD, CHEER UP THE GUARDS, RAISE THE BANNER",
    ],
    start: "ENTER TO START CHAPTER 3",
    title: "THE GUILD AND THE CASTLE",
  },
  hills: {
    lines: [
      "ARROWS OR A D: RUN   SPACE OR UP: JUMP",
      "EAT THE FIRE BERRY, THEN F OR X: BREATHE FIRE",
      "CATCH EGGS, MELT ICE, CHEER UP THE GLOOMLINGS",
    ],
    start: "ENTER TO START CHAPTER 1",
    title: "EGG HILLS",
  },
  woods: {
    lines: [
      "UP AND DOWN: WALK   LEFT AND RIGHT: TURN",
      "SPACE OR F: BREATHE FIRE ON LANTERNS AND ICE",
      "READ THREE CLUE STONES TO OPEN THE GATE",
    ],
    start: "ENTER TO START CHAPTER 2",
    title: "THE WHISPERING WOODS",
  },
};

export const instructions: Readonly<Record<ChapterId, string>> = {
  castle:
    "Walk with the arrow keys and press space to talk, pick things up and choose a show; F breathes fire. Help four friends, then cheer up the castle guards.",
  hills:
    "Run with the arrow keys or A and D, jump with space or up. Catch eggs, find the fire berry and breathe fire with F, and reach the glowing portal at the end of each of the three stages.",
  woods:
    "Walk with up and down, turn with left and right, breathe fire with space or F. Read the three clue stones to open the gate, and open chests on the way.",
};
