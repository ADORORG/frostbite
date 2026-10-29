// What the player's hands can do: one key or one touch, anywhere on the screen, drops the block.
export interface Controls {
  readonly drop: () => void;
}

const dropKeys = new Set(["Space", "Enter", "ArrowDown", "KeyS"]);

// Keys on the page, and touches on the screen. Returns a function that stops listening.
export function attachControls(
  target: HTMLElement,
  controls: Controls,
): () => void {
  const onKey = (event: KeyboardEvent): void => {
    if (event.repeat || !dropKeys.has(event.code)) return;
    controls.drop();
    event.preventDefault();
  };
  const onPointer = (event: PointerEvent): void => {
    controls.drop();
    event.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  target.addEventListener("pointerdown", onPointer);
  return () => {
    window.removeEventListener("keydown", onKey);
    target.removeEventListener("pointerdown", onPointer);
  };
}
