import type { HeroId } from "../rules/constants.ts";
import type { CreationId } from "../rules/create.ts";
import type { CardWords } from "./cards.ts";

// The words for what each of the family makes and the family keeps: its title, the prompt that offers it, the line when it is made and
// its share card. A draft for the owner.
export interface CreationWords {
  readonly card: CardWords;
  readonly prompt: string;
  readonly title: string;
  readonly toast: string;
}

export const creationWords: Readonly<Record<CreationId, CreationWords>> = {
  hologram: {
    card: {
      line: "Line by line of light, the builder built something brilliant.",
      title: "Kai's hologram",
    },
    prompt: "Build a hologram with Kai",
    title: "Kai's hologram",
    toast: "Kai built something brilliant out of light. It's yours to keep!",
  },
  masterpiece: {
    card: {
      line: "Split the colours, swirl them, breathe, and let them go.",
      title: "Zora's masterpiece",
    },
    prompt: "Mix a masterpiece with Zora",
    title: "Zora's masterpiece",
    toast: "Zora mixed every colour into a masterpiece. It's yours to keep!",
  },
  release: {
    card: {
      line: "What the drawer kept is let go, and now it shines for everyone.",
      title: "Daddy's relic",
    },
    prompt: "Release the relic with Daddy",
    title: "Daddy's relic",
    toast:
      "Daddy let the relic go, and it shines for the whole family. It's yours to keep!",
  },
  song: {
    card: {
      line: "She breathed in deep, held the note, and let it go.",
      title: "Mama's song",
    },
    prompt: "Sing Mama's song with her",
    title: "Mama's song",
    toast:
      "Mama let her song go, and the whole house listened. It's yours to keep!",
  },
};

// Who makes which.
export const creationBy: Readonly<Record<HeroId, CreationId>> = {
  ali: "release",
  heerah: "song",
  kai: "hologram",
  zora: "masterpiece",
};

// The words for a creation made by the one a news item names, if it names one of the family.
export function madeWords(detail: string): CreationWords | null {
  const pair = Object.entries(creationBy).find(([hero]) => hero === detail);
  return pair === undefined ? null : creationWords[pair[1]];
}
