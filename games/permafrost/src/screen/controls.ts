import { attachKeys, standardKeys } from "@frostbite/game-sdk/controls";

// What the player's hands can do: slide the piece (while an arrow is down), speed its fall (while the soft drop is down), turn it, drop it at
// once, hold it, and the keys every game shares (Enter starts, P pauses). Held keys are told when they go down and when they come up; the
// rest act when pressed.
export interface Controls {
  readonly hard: () => void;
  readonly hold: () => void;
  readonly left: (on: boolean) => void;
  readonly pause: () => void;
  readonly right: (on: boolean) => void;
  readonly soft: (on: boolean) => void;
  readonly start: () => void;
  readonly turnLeft: () => void;
  readonly turnRight: () => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "soft",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "turnRight",
  KeyC: "hold",
  KeyX: "turnRight",
  KeyZ: "turnLeft",
  ShiftLeft: "hold",
  ShiftRight: "hold",
  Space: "hard",
} as const;

// Keys on the page. Returns a function that stops listening.
export function attachControls(controls: Controls): () => void {
  return attachKeys(window, keys, (action, phase) => {
    if (action === "left" || action === "right" || action === "soft")
      controls[action](phase === "down");
    else if (phase === "down") controls[action]();
  });
}
