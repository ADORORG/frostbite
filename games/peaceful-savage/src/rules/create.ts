import { type HeroId, points } from "./constants.ts";
import { type Point, zoneAt } from "./geometry.ts";
import { familySpots, places } from "./layout.ts";
import type { MomentKind } from "./moments.ts";
import { family, withColour, withNews, withPoints } from "./state.ts";
import type { PlayState } from "./types.ts";

// What each of the family makes once their lesson is learned, for the family to keep: Kai builds a brilliant holographic structure on his
// workbench over the tower he built again, Zora mixes a masterpiece at her easel by the swing, Mama sings her song where she
// stood by the tree, and Daddy lets a relic go from the drawer he opened. Each is a moment of hand-keys and breath; each, once made, is
// kept for the rest of the run (and is a milestone of its own).
export type CreationId = "hologram" | "masterpiece" | "release" | "song";

export interface Creation {
  readonly at: Point;
  readonly hero: HeroId;
  readonly id: CreationId;
  // What must be done first: Kai's tower built, Daddy's drawer opened, Sparky found for the others.
  readonly after: (state: PlayState) => boolean;
}

export const creations: readonly Creation[] = [
  {
    after: (state) => state.tower,
    at: places.bench,
    hero: "kai",
    id: "hologram",
  },
  {
    after: (state) => state.sparky,
    at: places.easel,
    hero: "zora",
    id: "masterpiece",
  },
  {
    after: (state) => state.sparky,
    at: familySpots.heerah,
    hero: "heerah",
    id: "song",
  },
  {
    after: (state) => state.drawer,
    at: places.drawer,
    hero: "ali",
    id: "release",
  },
];

const creationIds: readonly string[] = creations.map(({ id }) => id);
export const isCreation = (id: string): id is CreationId =>
  creationIds.includes(id);
export const creationOf = (id: string): Creation | undefined =>
  creations.find((creation) => creation.id === id);

// Whether a creation can be made now: its maker is with the family, it is not made yet, and what comes first is done.
export const canMake = (state: PlayState, creation: Creation): boolean =>
  family(state).includes(creation.hero) &&
  !state.made.includes(creation.hero) &&
  creation.after(state);

// A creation made: the family keeps it, and a little colour comes back where it was made.
export function make(state: PlayState, kind: MomentKind): PlayState {
  const creation = creationOf(kind);
  if (creation === undefined) return state;
  const kept = { ...state, made: [...state.made, creation.hero] };
  return withNews(
    withColour(withPoints(kept, points.made), zoneAt(creation.at), 10),
    "made",
    creation.hero,
  );
}
