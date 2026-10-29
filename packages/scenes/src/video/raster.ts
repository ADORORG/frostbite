import { sceneHeight, sceneWidth, type Surface } from "../engine/index.ts";

interface Colour {
  readonly alpha: number;
  readonly blue: number;
  readonly green: number;
  readonly red: number;
}

const hex = /^#[0-9a-f]{6}$/iu;
const rgb = /^rgb\(\d+ \d+ \d+(?: \/ \d+(?:\.\d+)?%)?\)$/u;

// The two spellings the palette uses. Anything else is refused rather than drawn as a guess, so a new spelling cannot quietly render
// wrong in a video that a canvas would have drawn right.
export function parseColour(text: string): Colour {
  if (hex.test(text))
    return {
      alpha: 1,
      blue: Number.parseInt(text.slice(5, 7), 16),
      green: Number.parseInt(text.slice(3, 5), 16),
      red: Number.parseInt(text.slice(1, 3), 16),
    };
  if (!rgb.test(text))
    throw new Error(`The video renderer cannot read the colour "${text}".`);
  const [channels = "", alpha] = text.slice(4, -1).split(" / ");
  const [red, green, blue] = channels.split(" ").map(Number);
  return {
    alpha: alpha === undefined ? 1 : Number.parseFloat(alpha) / 100,
    blue: Number(blue),
    green: Number(green),
    red: Number(red),
  };
}

export interface Raster {
  // The picture so far, row after row, four bytes (red, green, blue, alpha) to a pixel.
  readonly pixels: Uint8Array;
  readonly surface: Surface;
  // Back to empty, ready for the next frame.
  readonly clear: () => void;
}

// A surface that draws into memory, for rendering scenes outside a page. It does what a canvas does for the only call scenes make
// (a filled rectangle, in a colour, at an opacity) with the edges snapped to whole pixels, which is how scenes are drawn anyway.
export function createRaster(): Raster {
  const pixels = new Uint8Array(sceneWidth * sceneHeight * 4);
  const surface: Surface = {
    fillStyle: "#000000",
    globalAlpha: 1,
    fillRect(x, y, width, height) {
      if (typeof surface.fillStyle !== "string")
        throw new Error("The video renderer draws in plain colours only.");
      const colour = parseColour(surface.fillStyle);
      const source = colour.alpha * surface.globalAlpha;
      const left = Math.max(0, Math.round(x));
      const right = Math.min(sceneWidth, Math.round(x + width));
      const top = Math.max(0, Math.round(y));
      const bottom = Math.min(sceneHeight, Math.round(y + height));
      for (let row = top; row < bottom; row += 1) {
        for (let column = left; column < right; column += 1) {
          const at = (row * sceneWidth + column) * 4;
          const below = Number(pixels[at + 3]) / 255;
          const alpha = source + below * (1 - source);
          const mix = (over: number, under: number) =>
            alpha === 0
              ? 0
              : Math.round(
                  (over * source + under * below * (1 - source)) / alpha,
                );
          pixels[at] = mix(colour.red, Number(pixels[at]));
          pixels[at + 1] = mix(colour.green, Number(pixels[at + 1]));
          pixels[at + 2] = mix(colour.blue, Number(pixels[at + 2]));
          pixels[at + 3] = Math.round(alpha * 255);
        }
      }
    },
  };
  return { clear: () => pixels.fill(0), pixels, surface };
}
