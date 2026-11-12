import { refuse } from "@frostbite/game-sdk/run-inputs";
import type { Stepped } from "@frostbite/game-sdk/run-record";

import { clues, clueSpot, mirrors, relics } from "./collect.ts";
import { canMake, type CreationId, creations, isCreation } from "./create.ts";
import { type HeroId, heroIds, points, reach, talkReach } from "./constants.ts";
import {
  distanceSquared,
  headingTo,
  type Point,
  wholeRoot,
  zoneAt,
} from "./geometry.ts";
import { greyAt, greyHomes } from "./greys.ts";
import { bare, plant, sprouted, tend } from "./garden.ts";
import { familySpots, gardenBeds, places, treeReach } from "./layout.ts";
import { beginMoment } from "./moment.ts";
import { family, has, withColour, withNews, withPoints } from "./state.ts";
import { lamps, things } from "./things.ts";
import { gather, pickThread } from "./take.ts";
import { touchTree } from "./tree.ts";
import type { PlayState } from "./types.ts";

// What the act key would do where the lead stands: the nearest thing in reach in the lead's own room (never through a wall). The story,
// the family, the mirrors and the grey ones pull a little harder than the rest of the house. The page shows its name before a press.
export type Target =
  | { readonly kind: "story"; readonly id: StoryId }
  | { readonly kind: "family"; readonly id: HeroId }
  | {
      readonly kind:
        | "bed"
        | "clue"
        | "grey"
        | "lamp"
        | "mirror"
        | "relic"
        | "thing"
        | "thread";
      readonly index: number;
    };

export type StoryId =
  "bench" | "deck" | "drawer" | "lamp" | "loom" | "stove" | "tree" | CreationId;

export interface Candidate {
  readonly at: Point;
  readonly pull: number;
  readonly reach: number;
  readonly target: Target;
}

const pull = 300;
const indexed = (
  kind: Exclude<Target["kind"], "family" | "story">,
  index: number,
  at: Point,
  far = reach,
  lean = 0,
): Candidate => ({ at, pull: lean, reach: far, target: { index, kind } });

function storyCandidates(state: PlayState): Candidate[] {
  const story = (
    id: Exclude<StoryId, CreationId>,
    open: boolean,
    far = reach,
  ): Candidate[] =>
    open
      ? [{ at: places[id], pull, reach: far, target: { id, kind: "story" } }]
      : [];
  return [
    ...story("tree", true, treeReach),
    ...story("lamp", state.touchedTree && !state.sparky),
    ...story("deck", state.touchedTree && !state.deck),
    ...story("stove", !state.pancakes),
    ...story(
      "loom",
      !state.jackets && state.threads >= 6 && has(state, "heerah"),
    ),
    ...story("drawer", !state.drawer && has(state, "ali")),
    ...story("bench", !state.tower && family(state).includes("kai")),
    ...creations
      .filter((creation) => canMake(state, creation))
      .map((creation): Candidate => {
        const target = { id: creation.id, kind: "story" } as const;
        return { at: creation.at, pull, reach, target };
      }),
    ...heroIds
      .filter((hero) => !family(state).includes(hero))
      .map((id): Candidate => ({
        at: familySpots[id],
        pull,
        reach: talkReach,
        target: { id, kind: "family" },
      })),
    ...mirrors.map((mirror, index) =>
      indexed("mirror", index, mirror, reach, pull),
    ),
  ];
}

function foundCandidates(state: PlayState): Candidate[] {
  const greys = state.greys.flatMap((grey, index): Candidate[] => {
    const home = greyHomes[index];
    if (home === undefined) return [];
    if (grey.thread === 1)
      return [indexed("thread", index, { x: grey.dropX, z: grey.dropZ })];
    if (!grey.seen || grey.healed) return [];
    return [
      indexed(
        "grey",
        index,
        greyAt(home, grey.spot, grey.phase, state.tick),
        talkReach,
        pull,
      ),
    ];
  });
  const seenClues = clues.flatMap((clue, index): Candidate[] =>
    state.cluesSeen[index] === true && state.cluesTaken[index] === false
      ? [indexed("clue", index, clueSpot(clue, state.clueAt[index]))]
      : [],
  );
  const relicsLeft = relics.flatMap((relic, index): Candidate[] =>
    state.relicsTaken[index] === false ? [indexed("relic", index, relic)] : [],
  );
  // Zora's garden: a bare bed to plant, or a sprouted one to tend, once she is with the family.
  const beds = family(state).includes("zora")
    ? gardenBeds.flatMap((bed, index): Candidate[] =>
        state.garden[index] === bare || sprouted(state, index)
          ? [indexed("bed", index, bed)]
          : [],
      )
    : [];
  return [...greys, ...seenClues, ...relicsLeft, ...beds];
}

const houseCandidates = (): Candidate[] => [
  ...lamps.map((lamp, index) => indexed("lamp", index, lamp)),
  ...things.map((thing, index) => indexed("thing", index, thing)),
];

// The nearest thing in reach, and where it is.
export function aimOf(state: PlayState): Candidate | null {
  if (state.lead === null || state.moment !== null || state.ended) return null;
  const room = zoneAt(state);
  let best: Candidate | null = null;
  let bestFar = Number.POSITIVE_INFINITY;
  for (const candidate of [
    ...storyCandidates(state),
    ...foundCandidates(state),
    ...houseCandidates(),
  ]) {
    if (zoneAt(candidate.at) !== room) continue;
    const far = distanceSquared(state, candidate.at);
    if (far > candidate.reach * candidate.reach) continue;
    const pulled = wholeRoot(far) - candidate.pull;
    if (pulled < bestFar) {
      best = candidate;
      bestFar = pulled;
    }
  }
  return best;
}

export const targetOf = (state: PlayState): Target | null =>
  aimOf(state)?.target ?? null;

function story(state: PlayState, id: Exclude<StoryId, CreationId>): PlayState {
  switch (id) {
    case "tree":
      return touchTree(state);
    case "deck":
      return withNews(
        withPoints({ ...state, deck: true }, points.deck),
        "deck",
      );
    case "stove":
      return withNews(
        withColour(
          withPoints({ ...state, pancakes: true }, points.pancakes),
          "kitchen",
          10,
        ),
        "pancakes",
      );
    case "lamp":
      return beginMoment(state, "forge");
    case "loom":
      return beginMoment(state, "weave");
    case "drawer":
      return beginMoment(state, "drawer");
    case "bench":
      return beginMoment(state, "build");
  }
}

function toggleLamp(state: PlayState, index: number): PlayState {
  const lit = state.lamps.map((on, at) => (at === index ? !on : on));
  const first = lit[index] === true && !state.lampsAllOn;
  const turned = {
    ...state,
    lamps: lit,
    lampsAllOn: state.lampsAllOn || lit.every(Boolean),
  };
  return withNews(
    first ? withPoints(turned, points.lamp) : turned,
    "lamp",
    String(index),
  );
}

function touchThing(state: PlayState, index: number): PlayState {
  const thing = things[index];
  const toggled = {
    ...state,
    thingsOn: state.thingsOn.map((on, at) => (at === index ? !on : on)),
  };
  if (thing === undefined || state.thingsTouched[index] === true)
    return withNews(toggled, "thing", String(index));
  const touched = {
    ...toggled,
    thingsTouched: state.thingsTouched.map((was, at) => was || at === index),
  };
  return withNews(
    withColour(withPoints(touched, points.thing), zoneAt(thing), 2),
    "thing",
    String(index),
  );
}

// The act key, outside a moment: whatever `targetOf` names. The lead turns to what they reach for.
export function act(state: PlayState): Stepped<PlayState> {
  const aimed = aimOf(state);
  if (aimed === null) return refuse("there is nothing in reach to act on");
  const { target } = aimed;
  const facing = { ...state, facing: headingTo(state, aimed.at) };
  const done = (next: PlayState): Stepped<PlayState> => ({
    ok: true,
    state: next,
  });
  switch (target.kind) {
    case "story":
      return done(
        isCreation(target.id)
          ? beginMoment(facing, target.id)
          : story(facing, target.id),
      );
    case "family":
      return done(beginMoment(facing, target.id));
    case "grey":
      return done(beginMoment(facing, "grey", target.index));
    case "mirror":
      return done(beginMoment(facing, "mirror", target.index));
    case "thread":
      return done(pickThread(facing, target.index));
    case "clue":
    case "relic":
      return done(gather(facing, target.kind, target.index));
    case "lamp":
      return done(toggleLamp(facing, target.index));
    case "thing":
      return done(touchThing(facing, target.index));
    case "bed":
      return done(
        facing.garden[target.index] === bare
          ? plant(facing, target.index)
          : tend(facing, target.index),
      );
  }
}
