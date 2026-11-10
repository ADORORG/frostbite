import { type HeroId, heroIds } from "./constants.ts";
import { box, type Box } from "./geometry.ts";
import { familySpots, walls } from "./layout.ts";
import { family } from "./state.ts";
import type { PlayState } from "./types.ts";

// What a body cannot walk through: the walls and the furniture, and each of the family not yet found, who stands (or sits) in their own
// place until the lead comes for them.
const half = 150;
const around = (hero: HeroId): Box => {
  const spot = familySpots[hero];
  return box(spot.x - half, spot.z - half, spot.x + half, spot.z + half);
};
const standing: Readonly<Record<HeroId, Box>> = {
  ali: around("ali"),
  heerah: around("heerah"),
  kai: around("kai"),
  zora: around("zora"),
};

export function solids(state: PlayState): readonly Box[] {
  const found = family(state);
  const lost = heroIds.filter((hero) => !found.includes(hero));
  return lost.length === 0
    ? walls
    : [...walls, ...lost.map((hero) => standing[hero])];
}
