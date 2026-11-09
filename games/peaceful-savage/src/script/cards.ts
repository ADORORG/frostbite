import { gardenBeds } from "../rules/layout.ts";
import type { News, PlayState } from "../rules/types.ts";

// The words on a share card, made at each turning point of the story: a title and a line. The lit tree's card is the last. Every word
// here is a draft for the owner.
export interface CardWords {
  readonly line: string;
  readonly title: string;
}

const found: Readonly<Record<string, CardWords>> = {
  ali: {
    line: "He leads the way, and he is learning it is safe to be soft.",
    title: "Daddy is found",
  },
  heerah: {
    line: "She senses what is coming, and she is learning to say what she needs.",
    title: "Mama is found",
  },
  kai: {
    line: "He can build anything, and he is learning to be kind to his own mind.",
    title: "Kai is found",
  },
  zora: {
    line: "She makes and mixes anything, and she is learning to love the land.",
    title: "Zora is found",
  },
};

export function cardFor(news: News, state: PlayState): CardWords | null {
  switch (news.kind) {
    case "sparky":
      return {
        line: "The ancestors' whisper, made visible, grinning out of the light.",
        title: "Sparky is found",
      };
    case "found":
      return found[news.detail] ?? null;
    case "tower":
      return {
        line: "Built again a step at a time, with a breath in the middle.",
        title: "Kai's tower stands",
      };
    case "bloomed":
      return state.garden.length === gardenBeds.length &&
        state.garden.every((stage) => stage === 2)
        ? {
            line: "Plant it, tend it, love it, and the land loves you back.",
            title: "Zora's garden blooms",
          }
        : null;
    case "drawer":
      return {
        line: "What was handed down in pain is passed on as joy.",
        title: "The drawer is open",
      };
    case "jackets":
      return {
        line: "Six maridium threads, one loom, a whole family in light.",
        title: "The jackets are woven",
      };
    case "lit":
      return {
        line: "The third strand shines gold, the ancestors come home, and the family holds on tight.",
        title: "The tree is lit",
      };
    default:
      return null;
  }
}

// The show's card: the family singing on the stage.
export const showCard: CardWords = {
  line: "On a stage under the stars, the family sings and dances with the ancestors.",
  title: "The family sings",
};

// The farewell's last card: the family lifting off.
export const flyingCard: CardWords = {
  line: "Jackets lit, hand in hand, then up and away, one by one.",
  title: "The family flies",
};
