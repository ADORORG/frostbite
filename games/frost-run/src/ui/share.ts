import type { RunState } from "../rules/types.ts";
import { words } from "../words.ts";
import { drawShareCard, type CardShape } from "./share-card.ts";

// The share card's window: the card as a picture, square or story. The frame the platform runs a game in allows no downloads and no share
// sheet, so the picture is the way out: a long press on a phone, or a right click on a computer, saves it anywhere.
export interface ShareWindow {
  readonly open: (state: RunState, picture: string) => Promise<void>;
  readonly close: () => void;
}

export function createShare(panel: HTMLElement): ShareWindow {
  const part = <T extends HTMLElement>(name: string, type: new () => T): T => {
    const found = panel.querySelector(`[data-part="${name}"]`);
    if (!(found instanceof type)) throw new Error(`Missing ${name}`);
    return found;
  };
  const image = part("card", HTMLImageElement);
  const square = part("square", HTMLButtonElement);
  const story = part("story", HTMLButtonElement);
  const close = part("close", HTMLButtonElement);
  square.textContent = words.shareSquare;
  story.textContent = words.shareStory;
  close.textContent = words.close;
  part("hint", HTMLElement).textContent = words.holdHint;

  const canvas = document.createElement("canvas");
  let shape: CardShape = "square";
  let state: RunState | null = null;
  let picture: HTMLImageElement | null = null;

  const redraw = (): void => {
    if (state === null) return;
    drawShareCard(canvas, state, picture, shape);
    image.src = canvas.toDataURL("image/png");
    image.alt = state.won ? words.win : words.lose;
    panel.dataset.shape = shape;
    square.setAttribute("aria-pressed", String(shape === "square"));
    story.setAttribute("aria-pressed", String(shape === "story"));
  };
  const pick = (next: CardShape): void => {
    shape = next;
    redraw();
  };
  square.addEventListener("click", () => pick("square"));
  story.addEventListener("click", () => pick("story"));
  close.addEventListener("click", () => {
    panel.hidden = true;
  });

  return {
    close() {
      panel.hidden = true;
    },
    async open(next, shot) {
      state = next;
      shape = "square";
      panel.hidden = false;
      picture = await new Promise<HTMLImageElement | null>((done) => {
        const loaded = new Image();
        loaded.onload = () => done(loaded);
        loaded.onerror = () => done(null);
        loaded.src = shot;
      });
      redraw();
    },
  };
}
