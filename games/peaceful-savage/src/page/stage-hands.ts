import type { HeroId } from "../rules/constants.ts";
import { lineOf } from "../view/family-farewell.ts";
import { onStage, singAt, type StageControl } from "../view/show.ts";
import type { Hands } from "./controls.ts";

// The player's hands in the show at the end (see view/show.ts), which changes nothing in the run: the run is over. The player takes one
// of the family at a time and moves them about the stage. On a keyboard: Q, Tab or left and right with Shift pass to the next of them,
// the arrows or WASD walk them, and E or Space gives a big move (a spin and a jump). On a touch screen: a drag walks them, and a tap
// passes to the next, who answers with a big move.
export interface StageHands {
  // The show begins, with the run's lead to move first.
  readonly begin: (lead: HeroId) => void;
  // What the view needs this frame, while the show plays (null when it does not).
  readonly frame: (now: number) => StageControl | null;
  // The player's hands with the show's moves in them while it plays: for the keyboard, or for a touch screen.
  readonly wrap: (hands: Hands, touch: boolean) => Hands;
}

// From the screen's left: Daddy, Kai, Zora, Mama.
const order: readonly HeroId[] = ["ali", "kai", "zora", "heerah"];
// How fast the one moved walks about the stage, in metres a second.
const speed = 1.7;

export function createStageHands(
  showing: () => boolean,
  now: () => number,
): StageHands {
  let who: HeroId = "kai";
  let push: { readonly x: number; readonly y: number } | null = null;
  let moveAt = Number.NEGATIVE_INFINITY;
  let last: number | null = null;
  let moved: Record<string, { x: number; z: number }> = {};
  const next = (by: number): void => {
    const at = order.indexOf(who);
    who = order[(at + by + order.length) % order.length] ?? who;
  };
  return {
    begin(lead) {
      who = lead;
      push = null;
      moveAt = Number.NEGATIVE_INFINITY;
      last = null;
      moved = {};
    },
    frame(time) {
      if (!showing()) {
        last = null;
        return null;
      }
      const dt = last === null ? 0 : Math.min(0.1, (time - last) / 1000);
      last = time;
      if (push !== null && (push.x !== 0 || push.y !== 0)) {
        const length = Math.hypot(push.x, push.y);
        const home = singAt(lineOf[who]);
        const from = moved[who] ?? { x: 0, z: 0 };
        // Seen from the front of the stage, right on the screen is -x and up the screen is further back (+z).
        const kept = onStage(
          home.x + from.x - (push.x / length) * speed * dt,
          home.z + from.z + (push.y / length) * speed * dt,
        );
        moved[who] = { x: kept.x - home.x, z: kept.z - home.z };
      }
      return { at: { ...moved }, moveAt, walking: push !== null, who };
    },
    wrap(hands, touch) {
      return {
        ...hands,
        act: (down) => {
          if (!showing()) return hands.act(down);
          if (!down) return;
          if (touch) next(1);
          moveAt = now();
        },
        running: () => showing() || hands.running(),
        steer: (to, fast) => {
          if (showing()) push = to;
          else hands.steer(to, fast);
        },
        turn: (by) => {
          if (showing()) next(by);
          else hands.turn(by);
        },
        vision: () => {
          if (showing()) next(1);
          else hands.vision();
        },
      };
    },
  };
}
