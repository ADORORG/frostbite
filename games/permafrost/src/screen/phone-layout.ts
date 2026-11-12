import { previewFor } from "../rules/difficulty.ts";
import {
  holdLeft,
  nextLeft,
  panelGap,
  panelHeight,
  panelTop,
  panelWidth,
  screenHeight,
  screenWidth,
} from "./layout.ts";

// On a phone held upright the screen fills the frame and the platform lays the readouts and buttons over it. The screen's own side columns
// (the piece held on the left, the pieces to come on the right) are empty below their boxes, so the readouts and the buttons are put there,
// clear of the board. Where those columns are depends on the frame, so it is measured: the screen is drawn as large as fits and in the middle
// of its box (`object-fit: contain`), and the numbers below, in pixels, are what the stylesheet places things by.
export interface Box {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

// Where the picture lies inside a box, and how many pixels one unit of the screen is.
export function drawnIn(box: Pick<Box, "height" | "width">): {
  readonly left: number;
  readonly scale: number;
  readonly top: number;
} {
  const scale = Math.min(box.width / screenWidth, box.height / screenHeight);
  return {
    left: (box.width - screenWidth * scale) / 2,
    scale,
    top: (box.height - screenHeight * scale) / 2,
  };
}

const px = (value: number): string =>
  `${String(Math.round(value * 10) / 10)}px`;

// The properties for the page, measured from the page's top left: where each side column starts and how wide its boxes are, and where the
// free part of each begins (below the held piece; below the most pieces ever shown to come).
export function placementOf(
  screen: Box,
  page: Pick<Box, "left" | "top">,
): Readonly<Record<string, string>> {
  const drawn = drawnIn(screen);
  const left = screen.left - page.left + drawn.left;
  const top = screen.top - page.top + drawn.top;
  const shown = previewFor(1);
  return {
    "--pf-below-hold": px(top + (panelTop + panelHeight) * drawn.scale),
    "--pf-below-next": px(
      top +
        (panelTop + shown * panelHeight + (shown - 1) * panelGap) * drawn.scale,
    ),
    "--pf-hold-x": px(left + holdLeft * drawn.scale),
    "--pf-next-x": px(left + nextLeft * drawn.scale),
    "--pf-scale": px(drawn.scale),
    "--pf-side-w": px(panelWidth * drawn.scale),
  };
}

// Keeps the properties on `page` right as the screen's box changes (a rotation, a window resized, the platform's bars coming and going).
// Returns a function that stops.
export function attachPlacement(
  page: HTMLElement,
  screen: HTMLElement,
): () => void {
  const apply = (): void => {
    const box = screen.getBoundingClientRect();
    const origin = page.getBoundingClientRect();
    for (const [name, value] of Object.entries(placementOf(box, origin)))
      page.style.setProperty(name, value);
  };
  apply();
  const watcher = new ResizeObserver(apply);
  watcher.observe(screen);
  window.addEventListener("resize", apply);
  return () => {
    watcher.disconnect();
    window.removeEventListener("resize", apply);
  };
}
