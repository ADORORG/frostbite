import { Group, Vector3 } from "three";

import { type HeroId, heroIds } from "../rules/constants.ts";
import { headings } from "../rules/geometry.ts";
import { familyFacing, familySpots } from "../rules/layout.ts";
import { stepOf } from "../rules/moment.ts";
import type { PlayState } from "../rules/types.ts";
import {
  type Acting,
  companionActing,
  leadActing,
  lostActing,
} from "./acting.ts";
import { buildCharacter, type Character } from "./body/character.ts";
import { idle } from "./body/poses.ts";
import { placeWith, walkingPlaces } from "./beside.ts";
import { playFarewell, type Played } from "./family-farewell.ts";
import { farewell } from "./farewell.ts";
import type { StageControl } from "./show.ts";
import type { Ending } from "./world.ts";
import { groundAt } from "./world/meadow.ts";

// The family in the world: the lead where the rules put them (eased between ticks), the found close at the lead's sides (on the lead's
// path through doorways) or round them in a huddle, the lost at their own places, busy and troubled; and before anyone leads, a line-up.
export interface Placed {
  readonly at: Vector3;
  readonly height: number;
  readonly hero: HeroId;
  readonly yaw: number;
}

export interface FamilyFrame {
  readonly alpha: number;
  readonly camera: Vector3;
  readonly dt: number;
  // How the run ended, if it has, and the seconds since.
  readonly ending: Ending;
  readonly lookAt: Vector3 | null;
  readonly previous: PlayState;
  // The one stepped out of the line-up while nobody leads.
  readonly select: HeroId;
  // The show at the end: who the player moves on the stage, and where (see show.ts).
  readonly stage?: StageControl | null;
  readonly state: PlayState;
  readonly time: number;
}

export interface Family {
  readonly characters: Readonly<Record<HeroId, Character>>;
  readonly group: Group;
  // The lead, and the found who walk with them.
  companions(): readonly Placed[];
  lead(): Placed | null;
  // Where the line-up stands, and where the chosen one steps out to.
  stand(): Placed;
  // The middle of the four of them, where they stand.
  middle(): Vector3;
  // What the farewell did this frame (where Sparky is, who the player moves on the stage), while it plays.
  played(): Played | null;
  chosen(hero: HeroId): Placed;
  update(frame: FamilyFrame): void;
}

const ease = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

export const yawOf = (facing: number): number => {
  const [x, z] = headings[((facing % 16) + 16) % 16] ?? [0, 1000];
  return Math.atan2(x, z);
};

const turnToward = (
  from: number,
  to: number,
  rate: number,
  dt: number,
): number => {
  const gap = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + gap * (1 - Math.exp(-rate * dt));
};
// The line-up stands in the meadow before the front door, the house behind it.
const standAt = new Vector3(0, 0, -7);

export function buildFamily(detail: number, hairAmount: number): Family {
  // Each of the family has a colour of their own, so a lead greyed by poor choices greys alone.
  const tones = {
    ali: { value: 1 },
    heerah: { value: 1 },
    kai: { value: 1 },
    zora: { value: 1 },
  };
  const characters = Object.fromEntries(
    heroIds.map((hero) => [
      hero,
      buildCharacter(hero, { detail, hairAmount, tone: tones[hero] }),
    ]),
  ) as Record<HeroId, Character>;
  const group = new Group();
  group.name = "family";
  for (const hero of heroIds) group.add(characters[hero].root);
  // Where each is and faces, eased frame by frame.
  const spots = Object.fromEntries(
    heroIds.map((hero) => [hero, { at: new Vector3(), set: false, yaw: 0 }]),
  ) as Record<HeroId, { at: Vector3; set: boolean; yaw: number }>;
  const trail: Vector3[] = [];
  let leadPlaced: Placed | null = null;
  let walking: Placed[] = [];
  let played: Played | null = null;
  // Puts one of the family at a place and a facing: `ease` glides both there, `follow` takes the place as it is (already eased between
  // ticks) and turns toward the facing, `snap` jumps to both.
  const move = (
    hero: HeroId,
    to: Vector3,
    yaw: number,
    acting: Acting,
    frame: FamilyFrame,
    how: "ease" | "follow" | "snap",
  ): Placed => {
    const spot = spots[hero];
    const was = spot.at.clone();
    const known = spot.set;
    const jump = how === "snap" || !known;
    if (jump || how === "follow") spot.at.copy(to);
    else spot.at.lerp(to, 1 - Math.exp(-9 * frame.dt));
    const before = spot.yaw;
    spot.yaw = jump ? yaw : turnToward(spot.yaw, yaw, 9, frame.dt);
    spot.set = true;
    const speed =
      known && !jump ? was.distanceTo(spot.at) / Math.max(1e-3, frame.dt) : 0;
    const character = characters[hero];
    character.place(spot.at.x, spot.at.z, spot.yaw);
    character.update({
      dt: frame.dt,
      expression: acting.expression,
      ground: groundAt,
      lookAt: frame.lookAt ?? frame.camera,
      pose: acting.pose,
      poseArms: acting.arms,
      speed: Math.min(4, speed),
      time: frame.time,
      turn: (spot.yaw - before) / Math.max(1e-3, frame.dt),
    });
    // The ancestors pour into the family's jackets once the tree is lit, and light them up.
    const lit = frame.ending.kind === "lit";
    const shine = lit
      ? ease(farewell.shine[0], farewell.shine[1], frame.ending.since)
      : 0;
    character.glow(lit ? 1 : frame.state.spark / 100);
    character.dress(frame.state.jackets, shine);
    return {
      at: spot.at.clone(),
      height: character.height,
      hero,
      yaw: spot.yaw,
    };
  };
  return {
    characters,
    companions: () => walking,
    group,
    lead: () => leadPlaced,
    played: () => played,
    middle: () =>
      heroIds
        .reduce((sum, hero) => sum.add(spots[hero].at), new Vector3())
        .divideScalar(heroIds.length),
    stand() {
      return {
        at: standAt.clone(),
        height: 1.5,
        hero: heroIds[0],
        yaw: Math.PI,
      };
    },
    // Where the chosen one stands in the line-up.
    chosen(hero) {
      const at = heroIds.indexOf(hero);
      return {
        at: new Vector3((at - 1.5) * 1.3, 0, -1.3).add(standAt),
        height: characters[hero].height,
        hero,
        yaw: Math.PI,
      };
    },
    update(frame) {
      const { state, previous } = frame;
      const lead = state.lead;
      played = null;
      if (lead === null) {
        // The line-up: the four side by side before the house, the chosen one stepping forward, smiling.
        heroIds.forEach((hero, at) => {
          const chosen = hero === frame.select;
          const to = new Vector3((at - 1.5) * 1.3, 0, chosen ? -1.3 : 0).add(
            standAt,
          );
          const acting: Acting = {
            arms: false,
            expression: chosen ? (hero === "kai" ? "smirk" : "smile") : "calm",
            pose: idle(hero, frame.time, true),
          };
          move(hero, to, Math.PI, acting, frame, "ease");
        });
        leadPlaced = null;
        walking = [];
        trail.length = 0;
        return;
      }
      if (frame.ending.kind === "lit") {
        played = playFarewell(lead, frame, characters, move);
        leadPlaced = played.lead;
        walking = [];
        return;
      }
      const x = (previous.x + (state.x - previous.x) * frame.alpha) / 1000;
      const z = (previous.z + (state.z - previous.z) * frame.alpha) / 1000;
      const here = new Vector3(x, 0, z);
      const last = trail[0];
      if (last === undefined || last.distanceTo(here) > 0.2)
        trail.unshift(here.clone());
      if (trail.length > 80) trail.length = 80;
      const moving = state.moving >= 0 && state.moment === null;
      // The lead's own colour, greyed a step for each poor choice, and all of it when they have gone grey.
      for (const hero of heroIds) tones[hero].value = 1;
      tones[lead].value =
        frame.ending.kind === "grey"
          ? 1 - ease(0, 2.5, frame.ending.since) * 0.95
          : 1 - state.greyed * 0.27;
      leadPlaced = move(
        lead,
        here,
        yawOf(state.facing),
        leadActing(lead, state, frame.time, moving),
        frame,
        previous.lead === null ? "snap" : "follow",
      );
      const party = state.party.filter((hero) => hero !== lead);
      const huddling =
        stepOf(state)?.kind === "huddle" || state.moment?.kind === "finale";
      const facing = leadPlaced?.yaw ?? 0;
      const besides = walkingPlaces(lead, here, facing, party);
      walking = party.map((hero, order) => {
        let to: Vector3;
        let yaw: number;
        if (huddling) {
          const angle =
            facing + ((order + 1) / (party.length + 1)) * Math.PI * 2;
          to = here
            .clone()
            .add(
              new Vector3(Math.sin(angle) * 0.75, 0, Math.cos(angle) * 0.75),
            );
          yaw = Math.atan2(here.x - to.x, here.z - to.z);
        } else {
          // At the lead's side (beside.ts), or close on their path where there is no room.
          const place = Math.max(0, placeWith(lead, hero));
          const side = besides.get(hero) ?? null;
          const behind =
            trail[Math.min(trail.length - 1, (place + 1) * 3)] ?? here;
          to = (side ?? behind).clone();
          const away = here.clone().sub(spots[hero].at);
          yaw =
            side !== null && moving
              ? facing
              : away.lengthSq() > 0.01
                ? Math.atan2(away.x, away.z)
                : spots[hero].yaw;
        }
        const strolling = spots[hero].at.distanceTo(to) > 0.05;
        return move(
          hero,
          to,
          yaw,
          companionActing(hero, state, frame.time, strolling),
          frame,
          "ease",
        );
      });
      for (const hero of heroIds) {
        if (hero === lead || party.includes(hero)) continue;
        const home = familySpots[hero];
        const at = new Vector3(home.x / 1000, 0, home.z / 1000);
        const talking = state.moment?.kind === hero;
        const facing = talking
          ? Math.atan2(here.x - at.x, here.z - at.z)
          : yawOf(familyFacing[hero]);
        move(
          hero,
          at,
          facing,
          lostActing(hero, state, frame.time, characters[hero].height * 0.48),
          frame,
          "ease",
        );
      }
    },
  };
}
