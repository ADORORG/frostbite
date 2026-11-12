import { Vector3 } from "three";

import { type HeroId, heroIds } from "../rules/constants.ts";
import { headings } from "../rules/geometry.ts";
import { familyFacing, familySpots } from "../rules/layout.ts";
import { stepOf } from "../rules/moment.ts";
import { companionActing, leadActing, lostActing } from "./acting.ts";
import { placeWith, walkingPlaces } from "./beside.ts";
import type { Character } from "./body/character.ts";
import type { FamilyFrame, Move, Placed, Spot } from "./family.ts";
import { leaping, seated, type Shown } from "./family-seat.ts";
import { createSeating, type Sitting } from "./seats.ts";

// The family while someone leads: the lead where the rules put them (eased between ticks), the found close at the lead's sides (on the
// lead's path through doorways) or round them in a huddle, the lost at their own places, busy and troubled. And what is only seen: all
// of them sitting down together where the lead sits, the lead riding the swing, and a jump that the found copy a beat later.
export interface Led {
  play(
    lead: HeroId,
    frame: FamilyFrame,
  ): {
    readonly lead: Placed;
    readonly sitting: Sitting | null;
    readonly walking: readonly Placed[];
  };
  // Nobody leads: forget the lead's path.
  reset(): void;
}

// The way a body turned to one of the rules' sixteen headings faces, in radians (0 is south, toward +z).
export const yawOf = (facing: number): number => {
  const [x, z] = headings[((facing % 16) + 16) % 16] ?? [0, 1000];
  return Math.atan2(x, z);
};

// How long after the lead each of the found jumps, one after another.
const beat = 0.14;

export function createLed(
  characters: Readonly<Record<HeroId, Character>>,
  spots: Readonly<Record<HeroId, Spot>>,
  move: Move,
): Led {
  const trail: Vector3[] = [];
  const seating = createSeating();
  // How far the lead is shown from where the rules have them: on a seat, and for a moment after getting up from one.
  const away = new Vector3();
  return {
    play(lead, frame) {
      const { state, previous } = frame;
      const x = (previous.x + (state.x - previous.x) * frame.alpha) / 1000;
      const z = (previous.z + (state.z - previous.z) * frame.alpha) / 1000;
      const here = new Vector3(x, 0, z);
      const last = trail[0];
      if (last === undefined || last.distanceTo(here) > 0.2)
        trail.unshift(here.clone());
      if (trail.length > 80) trail.length = 80;
      const moving = state.moving >= 0 && state.moment === null;
      const sitting = seating.update(state, frame.dt);
      const jumped =
        sitting === null && state.moment === null && !state.ended
          ? (frame.jumped ?? null)
          : null;
      const running = state.hurrying;
      const acting = leadActing(lead, state, frame.time, moving);
      const onSeat =
        sitting === null
          ? null
          : seated(lead, sitting, characters[lead], acting.expression);
      // Getting up, the lead is back where the rules have them within a moment, not at once.
      away.multiplyScalar(Math.exp(-8 * frame.dt));
      const standing: Shown = leaping(
        { acting, to: here.clone().add(away), yaw: yawOf(state.facing) },
        jumped,
        characters[lead],
        running,
      );
      const shown = onSeat ?? standing;
      const leadPlaced = move(
        lead,
        shown.to,
        shown.yaw,
        shown.acting,
        frame,
        previous.lead === null ? "snap" : onSeat === null ? "follow" : "ease",
        shown,
      );
      if (onSeat !== null) away.copy(leadPlaced.at).sub(here);
      const party = state.party.filter((hero) => hero !== lead);
      const huddling =
        stepOf(state)?.kind === "huddle" || state.moment?.kind === "finale";
      const facing = leadPlaced.yaw;
      const besides = walkingPlaces(lead, here, facing, party);
      const walking = party.map((hero, order) => {
        const sat =
          sitting === null
            ? null
            : seated(hero, sitting, characters[hero], "smile");
        if (sat !== null)
          return move(hero, sat.to, sat.yaw, sat.acting, frame, "ease", sat);
        const watch = sitting?.watching.get(hero);
        let to: Vector3;
        let yaw: number;
        if (watch !== undefined) {
          // Standing by, clear of the swing, to watch.
          to = new Vector3(watch.x, 0, watch.z);
          yaw = watch.yaw;
        } else if (huddling) {
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
          const toLead = here.clone().sub(spots[hero].at);
          yaw =
            side !== null && moving
              ? facing
              : toLead.lengthSq() > 0.01
                ? Math.atan2(toLead.x, toLead.z)
                : spots[hero].yaw;
        }
        const strolling = spots[hero].at.distanceTo(to) > 0.05;
        const walked = leaping(
          {
            acting: companionActing(hero, state, frame.time, strolling),
            to,
            yaw,
          },
          jumped === null ? null : jumped - beat * (order + 1),
          characters[hero],
          running,
        );
        return move(
          hero,
          walked.to,
          walked.yaw,
          walked.acting,
          frame,
          "ease",
          walked,
        );
      });
      for (const hero of heroIds) {
        if (hero === lead || party.includes(hero)) continue;
        const home = familySpots[hero];
        const at = new Vector3(home.x / 1000, 0, home.z / 1000);
        const talking = state.moment?.kind === hero;
        move(
          hero,
          at,
          talking
            ? Math.atan2(here.x - at.x, here.z - at.z)
            : yawOf(familyFacing[hero]),
          lostActing(hero, state, frame.time, characters[hero].legs),
          frame,
          "ease",
        );
      }
      return { lead: leadPlaced, sitting, walking };
    },
    reset() {
      trail.length = 0;
      away.set(0, 0, 0);
    },
  };
}
