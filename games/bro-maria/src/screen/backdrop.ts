import { colour } from "./palette.ts";
import { block, wrap } from "@ador/game-sdk/pixels";

// The sky and the mountains behind the level, which scroll more slowly than the ground, and the snow that falls in front of it.
export function sky(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colour.skyHigh);
  gradient.addColorStop(1, colour.skyLow);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

// A ridge of triangular peaks, one pixel column at a time, repeating every `period` pixels.
function ridge(
  context: CanvasRenderingContext2D,
  fill: string,
  scroll: number,
  base: number,
  peak: number,
  period: number,
  width: number,
): void {
  for (let x = 0; x < width; x += 1) {
    const along = wrap(x + scroll, period) / period;
    const rise = along < 0.5 ? along * 2 : (1 - along) * 2;
    block(
      context,
      fill,
      x,
      base - Math.round(rise * peak),
      1,
      Math.round(rise * peak) + 40,
    );
  }
}

export function mountains(
  context: CanvasRenderingContext2D,
  camera: number,
  width: number,
): void {
  ridge(context, colour.mountainFar, camera * 0.15, 96, 44, 120, width);
  ridge(context, colour.mountain, camera * 0.3, 112, 30, 80, width);
}

export function snow(
  context: CanvasRenderingContext2D,
  tick: number,
  width: number,
  height: number,
): void {
  for (let flake = 0; flake < 36; flake += 1) {
    const x = wrap(flake * 53 + Math.sin(flake + tick / 40) * 6, width);
    const y = wrap(flake * 31 + tick * (0.4 + (flake % 3) * 0.2), height);
    block(context, colour.snow, x, y, 1, 1);
  }
}
