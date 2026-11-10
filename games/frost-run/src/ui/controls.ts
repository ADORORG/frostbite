import { attachKeys, standardKeys } from "@frostbite/game-sdk/controls";
import {
  attachTouchButtons,
  type TouchButton,
} from "@frostbite/game-sdk/touch-buttons";

import { button } from "../rules/constants.ts";
import { touchLabels } from "../words.ts";
import { createPadReader, type Mode, type PadEvents } from "./pad.ts";
import { wayOf, wayOfStick } from "./steer.ts";

// Every way the player's hands reach the game: the keys, a drag anywhere on the screen to steer (a stick appears where the finger lands),
// four thumb buttons on a touch screen, and a gamepad. What they come to is one direction and the buttons held, which the page hands to the
// run; on the hero select the same hands turn the ring and choose (a swipe anywhere on the stage, the card included, turns it).
export type { Mode } from "./pad.ts";

export interface ControlEvents extends PadEvents {
  // Which of the last round's powers is ready, so the one power button offers the right one.
  readonly ready: () => { readonly grow: boolean; readonly vision: boolean };
}

export interface Controls {
  readonly buttons: () => number;
  readonly way: () => number;
  // Reads the gamepad and keeps the power button's label true. Called once a frame.
  readonly poll: () => void;
  // Which thumb buttons the round has taught: hop and duck from the first, shoot from the second, the power button in the last. The
  // others stay where they are, dimmed, so the cluster never moves under a thumb.
  readonly forRound: (round: number) => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  KeyA: "left",
  KeyC: "duck",
  KeyD: "right",
  KeyE: "vision",
  KeyF: "shoot",
  KeyG: "grow",
  KeyJ: "shoot",
  KeyK: "grow",
  KeyL: "vision",
  KeyS: "down",
  KeyV: "vision",
  KeyW: "up",
  ShiftLeft: "duck",
  ShiftRight: "duck",
  Space: "hop",
} as const;
type Action = (typeof keys)[keyof typeof keys];
const bitOf: Partial<Record<Action, number>> = {
  duck: button.duck,
  grow: button.grow,
  hop: button.hop,
  shoot: button.shoot,
  vision: button.vision,
};
// The round from which each thumb button is taught: hop, duck, shoot, power.
const taughtFrom = [0, 0, 1, 2] as const;

export function attachControls(
  stage: HTMLElement,
  main: HTMLElement,
  events: ControlEvents,
): Controls {
  const held = new Set<Action>();
  let keyWay = -1;
  let touchWay = -1;
  let touchBits = 0;
  let pad = { buttons: 0, way: -1 };
  let armed: "grow" | "vision" = "grow";
  const readPad = createPadReader(events);

  attachKeys(window, keys, (action, phase) => {
    const mode: Mode = events.mode();
    if (phase === "down") {
      if (action === "start" || (mode !== "play" && action === "hop"))
        return events.start();
      if (action === "pause") return events.pause();
      if (mode === "select" && (action === "left" || action === "right"))
        return events.turn(action === "left" ? -1 : 1);
      held.add(action);
    } else held.delete(action);
    const dx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    const dy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
    keyWay = wayOf(dx, dy, -1);
  });

  // A drag anywhere on the screen steers: where the finger lands is the middle of a stick drawn there.
  const stick = stage.querySelector<HTMLElement>(".stick");
  const knob = stick?.querySelector<HTMLElement>(".knob") ?? null;
  let finger: { id: number; x: number; y: number; moved: boolean } | null =
    null;
  // A swipe that turned the ring is not also a tap: the click a browser may send after it goes no further.
  let swiped = false;
  stage.addEventListener(
    "click",
    (event) => {
      if (swiped) event.stopPropagation();
      swiped = false;
    },
    true,
  );
  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" || finger !== null) return;
    swiped = false;
    finger = {
      id: event.pointerId,
      moved: false,
      x: event.clientX,
      y: event.clientY,
    };
    if (stick !== null && events.mode() === "play") {
      const box = stage.getBoundingClientRect();
      stick.style.left = `${String(event.clientX - box.left)}px`;
      stick.style.top = `${String(event.clientY - box.top)}px`;
      stick.classList.add("on");
    }
  });
  window.addEventListener("pointermove", (event) => {
    if (finger === null || event.pointerId !== finger.id) return;
    const dx = event.clientX - finger.x;
    const dy = event.clientY - finger.y;
    if (events.mode() === "select") {
      if (!finger.moved && Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
        finger.moved = true;
        swiped = true;
        events.turn(dx < 0 ? 1 : -1);
      }
      return;
    }
    touchWay = wayOfStick(dx, dy, 14, touchWay);
    const reach = Math.min(1, Math.hypot(dx, dy) / 56);
    const angle = Math.atan2(dy, dx);
    if (knob !== null)
      knob.style.transform = `translate(${String(Math.cos(angle) * reach * 34)}px, ${String(Math.sin(angle) * reach * 34)}px)`;
  });
  const lift = (event: PointerEvent): void => {
    if (finger === null || event.pointerId !== finger.id) return;
    finger = null;
    touchWay = -1;
    stick?.classList.remove("on");
    if (knob !== null) knob.style.transform = "";
  };
  window.addEventListener("pointerup", lift);
  window.addEventListener("pointercancel", lift);

  const hold = (bit: number, label: string): TouchButton => ({
    label,
    press: () => (touchBits |= bit),
    release: () => (touchBits &= ~bit),
  });
  const power: TouchButton = {
    label: touchLabels.grow,
    press: () => (touchBits |= armed === "grow" ? button.grow : button.vision),
    release: () => {
      touchBits &= ~(button.grow | button.vision);
      armed = armed === "grow" ? "vision" : "grow";
    },
  };
  attachTouchButtons(main, [
    hold(button.hop, touchLabels.hop),
    hold(button.duck, touchLabels.duck),
    hold(button.shoot, touchLabels.shoot),
    power,
  ]);
  const thumbs = [
    ...main.querySelectorAll<HTMLButtonElement>(".touch-buttons button"),
  ];

  return {
    buttons: () => {
      let bits = touchBits | pad.buttons;
      for (const action of held) bits |= bitOf[action] ?? 0;
      return bits;
    },
    forRound(round) {
      thumbs.forEach((thumb, at) =>
        thumb.setAttribute(
          "aria-disabled",
          String(round < (taughtFrom[at] ?? 0)),
        ),
      );
    },
    poll() {
      // The power button names what it will do, and moves on to the other power when this one must wait.
      const ready = events.ready();
      if (!ready[armed] && ready[armed === "grow" ? "vision" : "grow"])
        armed = armed === "grow" ? "vision" : "grow";
      const label = armed === "grow" ? touchLabels.grow : touchLabels.see;
      const powerButton = thumbs[3];
      if (powerButton !== undefined && powerButton.textContent !== label) {
        powerButton.textContent = label;
        powerButton.setAttribute("aria-label", label);
      }
      pad = readPad(
        typeof navigator.getGamepads === "function"
          ? [...navigator.getGamepads()]
          : [],
      );
    },
    way: () => (touchWay >= 0 ? touchWay : pad.way >= 0 ? pad.way : keyWay),
  };
}
