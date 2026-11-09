import type { Target } from "../rules/act.ts";
import type { HeroId } from "../rules/constants.ts";
import type { PlayState } from "../rules/types.ts";

// What the act key would do, as the prompt over the screen says it before a press: "Open the fridge", "Go to Mama". The rules decide
// what is in reach (`aimOf`); this only names it.
const thingWords: Readonly<Record<string, string>> = {
  armchair: "Sit in the armchair",
  bench: "Sit on the bench",
  bigbed: "Fluff the pillows",
  bluebells: "Smell the bluebells",
  books: "Pull out a book",
  chair: "Pull out a chair",
  clock: "Wind the clock",
  coats: "Hang up the coats",
  couch: "Plump the cushions",
  curtain: "Open the curtains",
  drum: "Play the drum",
  fridge: "Open the fridge",
  globe: "Spin the globe",
  hallplant: "Water the fern",
  ice: "Get some ice",
  juice: "Pour some juice",
  kaibed: "Make Kai's bed",
  monitor: "Wake the monitor",
  musicbox: "Wind the music box",
  photos: "Look at the family photos",
  plant: "Water the plant",
  poppies: "Smell the poppies",
  postbox: "Check the post",
  projector: "Switch on the star projector",
  records: "Play a record",
  rocket: "Launch the toy rocket",
  swing: "Have a swing",
  tap: "Run the tap",
  toaster: "Pop the toaster",
  toychest: "Open the toy chest",
  trafficlight: "Change the traffic light",
  vanity: "Tidy the vanity",
  wardrobe: "Open the wardrobe",
  whiteboard: "Draw on the whiteboard",
  window: "Open the window",
  zorabed: "Make Zora's bed",
};

const familyWords: Readonly<Record<HeroId, string>> = {
  ali: "Go to Daddy",
  heerah: "Go to Mama",
  kai: "Sit with Kai",
  zora: "Knock on Zora's cube",
};

export const relicNames: readonly string[] = [
  "Banneker's clock",
  "McCoy's oil cup",
  "Jones's cooler",
  "Woods's telegraph key",
  "Walker's hair tin",
  "Morgan's signal",
];

export function promptFor(
  target: Target,
  state: PlayState,
  thingIds: readonly string[],
): string {
  switch (target.kind) {
    case "story":
      return {
        bench: "Build the tower again with Kai",
        deck: "Pick up the family card deck",
        drawer: "Knock on Daddy's drawer",
        lamp: "Help the lamp that would not go out",
        loom: "Weave the jackets with Mama",
        stove: "Make pancakes",
        tree: state.touchedTree ? "Touch the tree" : "Touch the ancestor tree",
      }[target.id];
    case "family":
      return familyWords[target.id];
    case "grey":
      return "Listen to the sly snake";
    case "thread":
      return "Pick up the maridium thread";
    case "clue":
      return "Take the clue";
    case "bed":
      return state.garden[target.index] === 0
        ? "Plant seeds with Zora"
        : "Tend the seedlings";
    case "relic":
      return `Take ${relicNames[target.index] ?? "the relic"}`;
    case "mirror":
      return target.index === 4
        ? "Look into the still pond"
        : "Look into the mirror";
    case "lamp":
      return state.lamps[target.index] === true
        ? "Switch off the lamp"
        : target.index === 6
          ? "Light the porch lamp"
          : "Switch on the lamp";
    case "thing":
      return thingWords[thingIds[target.index] ?? ""] ?? "Touch it";
  }
}
