import { attachKeys } from "@frostbite/game-sdk/controls";
import { attachTouchButtons } from "@frostbite/game-sdk/touch-buttons";

import { type Held, pushOf } from "./steer.ts";

// The player's hands. On a keyboard: the arrows or WASD walk (and, before a run, turn to who leads), Shift held runs, E acts (held, it
// breathes in), Space jumps (in a moment it acts, as E does: a beat lands easier under the big key), Q opens Savage Vision, 1 to 8
// practise a skill (1 and 2 answer, when there is a choice), Enter starts and P pauses. On a touch screen: a swipe turns to who leads and
// a tap starts; in a run a finger dragged on the screen walks (dragged further, it runs), a tap acts (held, it breathes in), and four
// buttons in the corner jump, open vision, practise and open the share cards.
export interface Hands {
  readonly act: (down: boolean) => void;
  // Opens the run's share cards.
  readonly cards: () => void;
  readonly choose: (option: number) => void;
  readonly choosing: () => boolean;
  // Ends the run where it stands.
  readonly end: () => void;
  readonly inMoment: () => boolean;
  // A jump, which is only seen: it changes nothing in the run.
  readonly jump: () => void;
  readonly pause: () => void;
  // A skill by its number, or -1 for the one most worth practising now.
  readonly practise: (skill: number) => void;
  readonly running: () => boolean;
  readonly start: () => void;
  // Where the player pushes (right and up), or null to stand still; and whether they run.
  readonly steer: (
    push: { readonly x: number; readonly y: number } | null,
    fast: boolean,
  ) => void;
  readonly turn: (by: number) => void;
  readonly vision: () => void;
}

type Action =
  | "act"
  | "down"
  | "jump"
  | "left"
  | "pause"
  | "right"
  | "run"
  | "start"
  | "up"
  | "vision"
  | `skill${number}`;

const keys: Readonly<Record<string, Action>> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  Enter: "start",
  KeyA: "left",
  KeyD: "right",
  KeyE: "act",
  KeyP: "pause",
  KeyQ: "vision",
  KeyS: "down",
  KeyV: "vision",
  KeyW: "up",
  NumpadEnter: "start",
  ShiftLeft: "run",
  ShiftRight: "run",
  Space: "jump",
  ...Object.fromEntries(
    Array.from({ length: 8 }, (_, at) => [
      `Digit${String(at + 1)}`,
      `skill${String(at)}`,
    ]),
  ),
};

const ways = ["up", "down", "left", "right"] as const;

// The jump key (and the Jump button): walking about, it jumps; in a moment it is the act key, down and up.
export function leaper(hands: Hands): (down: boolean) => void {
  let acting = false;
  return (down) => {
    if (!down) {
      if (acting) hands.act(false);
      acting = false;
      return;
    }
    acting = hands.inMoment();
    if (acting) hands.act(true);
    else hands.jump();
  };
}

export function attachKeyboard(hands: Hands): () => void {
  const held: Record<(typeof ways)[number], boolean> = {
    down: false,
    left: false,
    right: false,
    up: false,
  };
  let fast = false;
  const leap = leaper(hands);
  const steer = (): void => {
    const push = pushOf(held satisfies Held);
    hands.steer(push.x === 0 && push.y === 0 ? null : push, fast);
  };
  // On the game's window: where a key pressed in the frame lands, and where the platform plays a key it forwards.
  return attachKeys(window, keys, (action, phase) => {
    const down = phase === "down";
    if (action === "run") {
      fast = down;
      if (hands.running()) steer();
      return;
    }
    const way = ways.find((each) => each === action);
    if (way !== undefined) {
      held[way] = down;
      if (hands.running()) steer();
      else if (down && (way === "left" || way === "right"))
        hands.turn(way === "left" ? -1 : 1);
      return;
    }
    if (action === "act" || action === "jump") {
      if (!hands.running()) return;
      if (action === "act") hands.act(down);
      else leap(down);
      return;
    }
    if (!down) return;
    if (action === "start") hands.start();
    else if (action === "pause") hands.pause();
    else if (action === "vision") hands.vision();
    else {
      const skill = Number(action.slice("skill".length));
      if (hands.choosing() && skill < 2) hands.choose(skill);
      else hands.practise(skill);
    }
  });
}

// How far a finger must travel to be a drag or a swipe, and how long a still finger takes to be a hold, not a tap.
export const dragPixels = 14;
// A finger dragged this far from where it went down runs.
export const runPixels = 70;
export const swipePixels = 40;
export const holdMs = 250;

export function attachTouch(
  screen: HTMLElement,
  main: HTMLElement,
  hands: Hands,
  now: () => number = () => performance.now(),
): () => void {
  let finger: number | null = null;
  let fromX = 0;
  let fromY = 0;
  let since = 0;
  let dragging = false;
  let holding = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const settle = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const down = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" || finger !== null) return;
    finger = event.pointerId;
    fromX = event.clientX;
    fromY = event.clientY;
    since = now();
    dragging = false;
    holding = false;
    if (!hands.running()) return;
    // In a moment the lead stands still, so a finger down is the act key down, on time for a beat.
    if (hands.inMoment()) {
      holding = true;
      hands.act(true);
      return;
    }
    timer = setTimeout(() => {
      holding = true;
      hands.act(true);
    }, holdMs);
  };
  const move = (event: PointerEvent): void => {
    if (event.pointerId !== finger || !hands.running() || holding) return;
    const x = event.clientX - fromX;
    const y = fromY - event.clientY;
    if (!dragging && Math.hypot(x, y) < dragPixels) return;
    dragging = true;
    settle();
    hands.steer({ x, y }, Math.hypot(x, y) >= runPixels);
  };
  const up = (event: PointerEvent): void => {
    if (event.pointerId !== finger) return;
    finger = null;
    settle();
    const x = event.clientX - fromX;
    const y = event.clientY - fromY;
    if (!hands.running()) {
      if (Math.abs(x) >= swipePixels && Math.abs(x) > Math.abs(y))
        hands.turn(x < 0 ? 1 : -1);
      else if (Math.hypot(x, y) < dragPixels) hands.start();
      return;
    }
    if (holding) hands.act(false);
    else if (dragging) hands.steer(null, false);
    else if (now() - since < holdMs) {
      hands.act(true);
      hands.act(false);
    }
  };
  screen.addEventListener("pointerdown", down);
  screen.addEventListener("pointermove", move);
  screen.addEventListener("pointerup", up);
  screen.addEventListener("pointercancel", up);
  const leap = leaper(hands);
  const buttons = attachTouchButtons(main, [
    {
      label: "Jump",
      press: () => {
        leap(true);
      },
      release: () => {
        leap(false);
      },
    },
    {
      label: "Vision",
      press: () => {
        hands.vision();
      },
      release: () => undefined,
    },
    {
      label: "Practise",
      press: () => {
        hands.practise(-1);
      },
      release: () => undefined,
    },
    {
      label: "Cards",
      press: () => {
        hands.cards();
      },
      release: () => undefined,
    },
  ]);
  return () => {
    settle();
    buttons();
    screen.removeEventListener("pointerdown", down);
    screen.removeEventListener("pointermove", move);
    screen.removeEventListener("pointerup", up);
    screen.removeEventListener("pointercancel", up);
  };
}
