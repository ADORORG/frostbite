import type { HeroId } from "../rules/constants.ts";
import { lineOf } from "../view/family-farewell.ts";
import { farewell } from "../view/farewell.ts";
import { cruise, home, inRange, range, type Ride } from "../view/ride.ts";
import { onStage, singAt, type StageControl } from "../view/show.ts";
import type { Hands } from "./controls.ts";

// The player's hands in the show at the end (see view/show.ts), which changes nothing in the run: the run is over. The player takes one
// of the family at a time and moves them about the stage. On a keyboard: Q, Tab or left and right with Shift pass to the next of them,
// the arrows or WASD walk them, and E or Space gives a big move (a spin and a jump). On a touch screen: a drag walks them, and a tap
// passes to the next, who answers with a big move. After the show the family rides the hover car, and the same hands drive it: the
// arrows or a drag fly it about the meadow, and E, Space or a tap lifts it higher for a while. Until the player takes it, it cruises
// by itself.
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
// How fast the one moved walks about the stage, in metres a second; and how fast the car flies, how much a lift raises it, and how
// fast it sinks back.
const speed = 1.7;
const carSpeed = 6.5;
const lift = 1.7;
const sink = 0.55;

export function createStageHands(
  showing: () => boolean,
  now: () => number,
): StageHands {
  let who: HeroId = "kai";
  let push: { readonly x: number; readonly y: number } | null = null;
  let moveAt = Number.NEGATIVE_INFINITY;
  let last: number | null = null;
  let moved: Record<string, { x: number; z: number }> = {};
  // The ride: when the ending began, where the player has driven the car (null until they take it), and how fast it goes.
  let began = 0;
  let ride: Ride | null = null;
  let going = { x: 0, z: 0 };
  const riding = (time: number): boolean => {
    const since = (time - began) / 1000;
    return since >= farewell.ride[0] && since < farewell.ride[1];
  };
  const drive = (time: number, dt: number): void => {
    const pushed = push !== null && (push.x !== 0 || push.y !== 0);
    if (ride === null) {
      // The player takes it from where it has cruised to.
      if (!pushed) return;
      ride = cruise((time - began) / 1000 - farewell.ride[0]);
    }
    const length = pushed && push !== null ? Math.hypot(push.x, push.y) : 1;
    const want = {
      x: pushed && push !== null ? (-push.x / length) * carSpeed : 0,
      z: pushed && push !== null ? (push.y / length) * carSpeed : 0,
    };
    const ease = 1 - Math.exp(-2.5 * dt);
    going = {
      x: going.x + (want.x - going.x) * ease,
      z: going.z + (want.z - going.z) * ease,
    };
    const kept = inRange(ride.x + going.x * dt, ride.z + going.z * dt);
    const fast = Math.hypot(going.x, going.z);
    const turn =
      fast < 0.4
        ? 0
        : Math.atan2(
            Math.sin(Math.atan2(going.x, going.z) - ride.yaw),
            Math.cos(Math.atan2(going.x, going.z) - ride.yaw),
          );
    ride = {
      high: Math.max(home.high + 0.5, ride.high - sink * dt),
      x: kept.x,
      yaw: ride.yaw + turn * (1 - Math.exp(-5 * dt)),
      z: kept.z,
    };
  };
  const raise = (time: number): boolean => {
    if (!riding(time)) return false;
    ride ??= cruise((time - began) / 1000 - farewell.ride[0]);
    ride = { ...ride, high: Math.min(range.top, ride.high + lift) };
    return true;
  };
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
      began = now();
      ride = null;
      going = { x: 0, z: 0 };
    },
    frame(time) {
      if (!showing()) {
        last = null;
        return null;
      }
      const dt = last === null ? 0 : Math.min(0.1, (time - last) / 1000);
      last = time;
      if (riding(time)) {
        drive(time, dt);
        return { at: { ...moved }, moveAt, ride, walking: false, who };
      }
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
      return { at: { ...moved }, moveAt, ride, walking: push !== null, who };
    },
    wrap(hands, touch) {
      return {
        ...hands,
        act: (down) => {
          if (!showing()) return hands.act(down);
          if (!down || raise(now())) return;
          if (touch) next(1);
          moveAt = now();
        },
        jump: () => {
          if (!showing()) hands.jump();
          else if (!raise(now())) moveAt = now();
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
