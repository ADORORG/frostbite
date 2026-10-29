// What the player's hands can do: one key or touch for each of the two actions.
export interface Controls {
  readonly jump: () => void;
  readonly slide: () => void;
}

const jumpKeys = new Set(["ArrowUp", "KeyW", "Space"]);
const slideKeys = new Set(["ArrowDown", "KeyS", "ShiftLeft", "ShiftRight"]);

// Keys on the page, and touches on the screen: the top half jumps and the bottom half slides. Returns a function that stops listening.
export function attachControls(
  target: HTMLElement,
  controls: Controls,
): () => void {
  const onKey = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (jumpKeys.has(event.code)) controls.jump();
    else if (slideKeys.has(event.code)) controls.slide();
    else return;
    event.preventDefault();
  };
  const onPointer = (event: PointerEvent): void => {
    const box = target.getBoundingClientRect();
    if (event.clientY - box.top < box.height / 2) controls.jump();
    else controls.slide();
    event.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  target.addEventListener("pointerdown", onPointer);
  return () => {
    window.removeEventListener("keydown", onKey);
    target.removeEventListener("pointerdown", onPointer);
  };
}
