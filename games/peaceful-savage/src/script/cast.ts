import type { HeroId } from "../rules/constants.ts";

// Who the player can choose to lead, as the hero select shows them: a name, who they are, what they bring (the rules' stats, in
// `rules/cast.ts`, are what it really does), and a few lines of their story. Every word here is a draft for the owner.
export interface HeroCard {
  // What they can do, which the rules make real (`rules/cast.ts` and the moments).
  readonly ability: string;
  // What they learn on the way.
  readonly lesson: string;
  readonly name: string;
  readonly story: string;
  readonly tag: string;
}

export const heroCards: Readonly<Record<HeroId, HeroCard>> = {
  ali: {
    ability: "Leads the way: the most give on the beat, and the fastest walk.",
    lesson:
      "Learns to turn generational hurt into generational joy, and that it is safe to be soft.",
    name: "Dr. Ali Savage",
    story:
      "Daddy built a glowing atom when he was eleven. Tonight he sits in the fog of his office with his fists shut, and the house has gone grey around him. Lead with him to open his hands, let go of what was locked away, and make home a safe place to feel.",
    tag: "Daddy · the leader",
  },
  heerah: {
    ability:
      "Senses and predicts: she feels a sly snake near before anyone sees it, and her breath has the most give.",
    lesson:
      "Learns to say what she needs, answers the ancestors' call, and gathers the family into one.",
    name: "Mama Heerah",
    story:
      "Mama's markings light up to protect the ones she loves, and she can sense what is coming before it comes. She has gone still by the ancestor tree, holding everyone up and never resting. Lead with her and the family gathers round her.",
    tag: "Mama · the weaver",
  },
  kai: {
    ability:
      "Builds anything, and keeps the beat: his perfect beats have a little more time.",
    lesson:
      "Learns that a mind needs care too: a breath, a plan, a step at a time, and rest.",
    name: "Kai",
    story:
      "Kai is eleven and can build anything. He is out on the porch with his crystal tower cracked, wearing the cool smirk he wears when something hurts. Lead with him to build it again, step by step, with a breath in the middle.",
    tag: "11 · the builder",
  },
  zora: {
    ability:
      "Makes and mixes anything, and sees farthest: her Savage Vision lasts longest.",
    lesson:
      "Learns to love the land: to plant seeds with her family and tend them until they bloom.",
    name: "Zora",
    story:
      "Zora is eight, with galaxies in her afro puffs. She is out in the meadow, drawing a silly cube in the air and climbing inside it where nobody can follow. Lead with her and you see what the others miss.",
    tag: "8 · the maker",
  },
};

// What each stat means, for the bars on a hero's card.
export const statNames = {
  calm: "Calm",
  heart: "Heart",
  speed: "Speed",
  vision: "Vision",
} as const;

// The skills a lead practises: the six hand-keys, the breath, and the family huddle, each with what it does.
export interface SkillCard {
  readonly does: string;
  readonly name: string;
}

export const skillCards: readonly SkillCard[] = [
  { does: "listen first", name: "Cup" },
  { does: "sweep for the signal", name: "Comb" },
  { does: "tie yourself to home", name: "Knot" },
  { does: "ask before you enter", name: "Knock" },
  { does: "open the way", name: "Split" },
  { does: "come home safe", name: "Let-Go" },
  { does: "four in, six out", name: "Breath" },
  { does: "arms round each other", name: "Huddle" },
];
