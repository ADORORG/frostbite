import { heroIds } from "../rules/constants.ts";
import type { News } from "../rules/types.ts";
import { heroCards, skillCards } from "./cast.ts";
import { madeWords } from "./creations.ts";
import { clueLines, relicLines } from "./lines.ts";

// The line over the screen when something happens: Sparky found, a sly snake healed, a skill mastered. Small, frequent things (a gathered
// mote of plasma, a lamp switched, a thing touched) say nothing; their sound is enough.
export function toastOf(news: News): string | null {
  const index = Number(news.detail);
  switch (news.kind) {
    case "sparky":
      return "Sparky! The ancestors' whisper, made visible.";
    case "found": {
      const hero = heroIds.find((each) => each === news.detail);
      return hero === undefined
        ? null
        : `${heroCards[hero].name} walks with you now.`;
    }
    case "healed":
      return "The sly snake turns gold and lets its thread fall.";
    case "thread":
      return "A maridium thread, warm in your hand.";
    case "jackets":
      return "The maridium jackets are woven!";
    case "drawer":
      return "What was locked away is let go: generational hurt, turned to generational joy.";
    case "lit":
      return "The tree is lit, and the colour comes home!";
    case "touch":
      return news.detail === "again"
        ? "The tree shows you the way."
        : "The tree wakes. Savage Vision is yours: press vision.";
    case "level":
      return `Level ${news.detail}: the tree gives you more light.`;
    case "power":
      return "The tree powers you up.";
    case "mastered":
      return `${skillCards[index]?.name ?? "A skill"} mastered!`;
    case "mirror":
      return "Steady again, with a charge of mirror force.";
    case "reflected":
      return "Mirror force turns the trick back! Choose again.";
    case "tricked":
      return "That was the trick talking. Breathe, and try again.";
    case "beat-perfect":
      return "Perfect!";
    case "beat-good":
      return "Good!";
    case "beat-miss":
      return "Again, on the beat.";
    case "breath-miss":
      return "Four counts in, then let go. Once more.";
    case "deck":
      return "The family card deck: a card for every feeling.";
    case "pancakes":
      return "Pancakes! The kitchen warms up.";
    case "rise":
      return "The ancestors call the whole family to the hill, where the giant sly snake rises.";
    case "planted":
      return "Seeds in the earth. Give them time, then come back and tend them.";
    case "bloomed":
      return "The bed blooms! Love the land, and it loves you back.";
    case "tower":
      return "Kai's tower stands again: a step at a time, with a breath in the middle.";
    case "made":
      return madeWords(news.detail)?.toast ?? null;
    case "sensed":
      return "Mama senses a sly snake close by.";
    case "greying":
      return news.detail === "1"
        ? "That trick took some of your colour. Breathe, and answer true."
        : "You are going grey. A breath, a true word or a mirror brings it back.";
    case "joined":
      return "Gone grey: the sly snakes took you into their coil.";
    case "clue":
      return clueLines[index] ?? null;
    case "relic":
      return relicLines[index] ?? null;
    default:
      return null;
  }
}
