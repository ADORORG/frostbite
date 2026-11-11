import { button } from "../rules/constants.ts";
import { wayOfStick } from "./steer.ts";

// A gamepad, read once a frame (it has no events of its own): the left stick or the cross steers; A hops, B ducks, X shoots, Y grows and
// either shoulder is frost vision. Start pauses a run; on the hero select the stick turns the ring and A or Start chooses.
export type Mode = "play" | "select" | "wait";

export interface PadEvents {
  readonly mode: () => Mode;
  readonly pause: () => void;
  readonly start: () => void;
  readonly turn: (step: number) => void;
}

export interface PadHands {
  readonly way: number;
  readonly buttons: number;
}

interface PadLike {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly connected: boolean;
}

const startButton = 9;
const startBit = 32;

// Returns the function to call each frame, with the pads the browser lists, which hands back what the pad holds.
export function createPadReader(
  events: PadEvents,
): (pads: readonly (PadLike | null)[]) => PadHands {
  let way = -1;
  let before = 0;
  let turnBefore = 0;
  return (pads) => {
    const pad = pads.find((each) => each !== null && each.connected) ?? null;
    if (pad === null) {
      way = -1;
      return { buttons: 0, way };
    }
    const pressed = (index: number): boolean =>
      pad.buttons[index]?.pressed === true;
    const dx =
      (pad.axes[0] ?? 0) + (pressed(15) ? 1 : 0) - (pressed(14) ? 1 : 0);
    const dy =
      (pad.axes[1] ?? 0) + (pressed(13) ? 1 : 0) - (pressed(12) ? 1 : 0);
    const startNow = pressed(startButton) ? startBit : 0;
    const bits =
      (pressed(0) ? button.hop : 0) |
      (pressed(1) ? button.duck : 0) |
      (pressed(2) ? button.shoot : 0) |
      (pressed(3) ? button.grow : 0) |
      (pressed(4) || pressed(5) ? button.vision : 0);
    const mode = events.mode();
    let held = 0;
    if (mode === "play") {
      way = wayOfStick(dx, dy, 0.35, way);
      held = bits;
      if (startNow !== 0 && (before & startBit) === 0) events.pause();
    } else {
      way = -1;
      const turn = dx > 0.6 ? 1 : dx < -0.6 ? -1 : 0;
      if (mode === "select" && turn !== 0 && turn !== turnBefore)
        events.turn(turn);
      turnBefore = turn;
      const go = (bits & button.hop) | startNow;
      if (go !== 0 && (before & (button.hop | startBit)) === 0) events.start();
    }
    before = (bits & button.hop) | startNow;
    return { buttons: held, way };
  };
}
