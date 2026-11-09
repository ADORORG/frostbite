import { type HandKey, handKeys } from "./constants.ts";

// The story's moments, each a short script of steps the lead plays where they stand (they cannot walk off in the middle of one):
//
// - a beat: one of the six hand-keys, pressed on the beat (the closer, the better; a press off the beat, or none, and the beat comes again);
// - a breath: the Savage Breath, held in for about four counts and let go, then six counts out;
// - a choice: two things to say, one of them the grey's trick and one of them true (which is which, and in which order, the seed decides);
// - a lean: the lead leans in beside someone, to sit with it, which is the first thing a helper does;
// - a huddle: the family gathers close, arms round each other;
// - a centre: the lead looks into a mirror, steady, and comes back to themselves.
export type Step =
  | { readonly kind: "beat"; readonly key: HandKey; readonly six?: true }
  | { readonly kind: "breath" }
  | { readonly kind: "choose"; readonly choice: ChoiceId }
  | { readonly kind: "lean" }
  | { readonly kind: "huddle" }
  | { readonly kind: "centre" };

export const choiceIds = [
  "grey-0",
  "grey-1",
  "grey-2",
  "grey-3",
  "grey-4",
  "grey-5",
  "kai",
  "zora",
  "heerah",
  "ali",
  "serpent-ask",
  "serpent-feel",
] as const;
export type ChoiceId = (typeof choiceIds)[number];

export const momentKinds = [
  "forge",
  "kai",
  "zora",
  "heerah",
  "ali",
  "grey",
  "weave",
  "drawer",
  "finale",
  "practice",
  "mirror",
  "build",
] as const;
export type MomentKind = (typeof momentKinds)[number];

const beat = (key: HandKey): Step => ({ key, kind: "beat" });
const six = (key: HandKey): Step => ({ key, kind: "beat", six: true });
const choose = (choice: ChoiceId): Step => ({ choice, kind: "choose" });
const breath: Step = { kind: "breath" };
const huddle: Step = { kind: "huddle" };

const greyChoices: readonly ChoiceId[] = choiceIds.slice(0, 6);

// The steps of a moment. A grey one's moment is the one choice its whisper asks for (`arg` names the grey one); a practice is three
// beats of one hand-key, or one breath (`arg` names the skill, 6 for the breath).
export function script(kind: MomentKind, arg = 0): readonly Step[] {
  const grey = arg;
  switch (kind) {
    case "practice": {
      const key = handKeys[arg];
      if (key !== undefined) return [beat(key), beat(key), beat(key)];
      // The huddle: gather close, hold on, breathe together. The breath and the body: one breath.
      return arg === handKeys.length + 1
        ? [huddle, beat("knot"), breath]
        : [breath];
    }
    // At a mirror: breathe, then look, and come back to centre.
    case "mirror":
      return [breath, { kind: "centre" }];
    // At the lamp that would not go out: three hand-keys, a gold ring for each, and Sparky grins out of the light.
    case "forge":
      return [beat("cup"), beat("comb"), beat("split")];
    // Kai's crystal tower lies cracked: find the pieces, hold them together, breathe (being kind to yourself first), and let him be sad
    // about it.
    case "kai":
      return [beat("comb"), beat("knot"), breath, choose("kai")];
    // Kai's lesson: anything can be built, a step at a time, with a rest in the middle: the base, the frame, a breath, and the spire.
    case "build":
      return [beat("knot"), beat("comb"), breath, beat("split")];
    // Zora draws the silly cube in the air: split it open, push its corners out, and get in.
    case "zora":
      return [beat("split"), beat("split"), choose("zora")];
    // Mama Heerah has gone still at her loom: breathe with her, and let her name it.
    case "heerah":
      return [breath, choose("heerah")];
    // Daddy sits in the fog with his fists shut: sit with him, show him the knock, breathe, and let him name it.
    case "ali":
      return [{ kind: "lean" }, beat("knock"), breath, choose("ali")];
    case "grey":
      return [choose(greyChoices[grey] ?? "grey-0")];
    // At the loom, with all six threads: the jackets are woven.
    case "weave":
      return [beat("comb"), beat("knot"), beat("cup")];
    // Daddy's locked drawer: knock, and let go of what was put away in it.
    case "drawer":
      return [beat("knock"), beat("letgo")];
    // On the hill, the giant grey snake: ask it in, huddle, breathe the power within, the six keys, name what you feel, open the hand.
    case "finale":
      return [
        choose("serpent-ask"),
        huddle,
        breath,
        six("cup"),
        six("comb"),
        six("knot"),
        six("knock"),
        six("split"),
        six("letgo"),
        choose("serpent-feel"),
        beat("knock"),
      ];
  }
}
