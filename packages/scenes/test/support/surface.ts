import type { Surface } from "../../src/engine/index.ts";

export interface Drawn {
  readonly alpha: number;
  readonly colour: string;
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

// A surface that records what is drawn on it, so a test can say what a scene put where.
export function recordingSurface(): Surface & { readonly drawn: Drawn[] } {
  const drawn: Drawn[] = [];
  const surface = {
    drawn,
    fillRect(x: number, y: number, width: number, height: number) {
      drawn.push({
        alpha: surface.globalAlpha,
        colour: String(surface.fillStyle),
        height,
        width,
        x,
        y,
      });
    },
    fillStyle: "#000" as string | CanvasGradient | CanvasPattern,
    globalAlpha: 1,
  };
  return surface;
}
