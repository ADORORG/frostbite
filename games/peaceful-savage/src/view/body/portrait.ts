import {
  CanvasTexture,
  Color,
  DataTexture,
  SRGBColorSpace,
  type Texture,
} from "three";

import { noise, srgb } from "../palette.ts";
import { at, css, faceSize, glow, type Ink, softLine, span } from "./brush.ts";
import type { Expression } from "./head.ts";
import type { Layout } from "./head-shape.ts";
import type { Look } from "./looks.ts";
import { paintMouth } from "./mouth.ts";

// The painted face: skin with the soft unevenness of oil paint, warmth on the cheeks and nose, shade round the eyes, hair-stroked brows,
// the nose drawn with its wings and the shadow under it, and a mouth painted for each feeling. It is repainted only when the feeling or
// the brows change.
export interface Portrait {
  paint(expression: Expression, browLift: number): void;
  readonly texture: Texture;
}

// A brow: a tapered sweep, thick at its inner end, laid down in short hair strokes.
function brow(
  ink: Ink,
  side: 1 | -1,
  eyes: number,
  lift: number,
  colour: Color,
  weight: number,
): void {
  const worry = Math.max(0, -lift);
  const raise = Math.max(0, lift) * 0.06;
  const inner = [side * 0.13, eyes + 0.25 + raise + worry * 0.08] as const;
  const peak = [side * 0.38, eyes + 0.34 + raise - worry * 0.02] as const;
  const outer = [side * 0.57, eyes + 0.24 + raise - worry * 0.04] as const;
  // A soft body of colour first, thick at the inner end, then the hairs over it.
  const half = [
    (inner[0] + peak[0]) / 2,
    (inner[1] + peak[1]) / 2 + 0.012,
  ] as const;
  softLine(ink, inner, half, peak, 0.034 * weight, colour, 0.55);
  softLine(
    ink,
    peak,
    [(peak[0] + outer[0]) / 2, (peak[1] + outer[1]) / 2 + 0.01],
    outer,
    0.02 * weight,
    colour,
    0.45,
  );
  for (let step = 0; step <= 40; step += 1) {
    const t = step / 40;
    const x =
      (1 - t) ** 2 * inner[0] + 2 * (1 - t) * t * peak[0] + t * t * outer[0];
    const y =
      (1 - t) ** 2 * inner[1] + 2 * (1 - t) * t * peak[1] + t * t * outer[1];
    const thick = weight * (0.055 - t * 0.04);
    const [px, py] = at(x, y);
    ink.strokeStyle = css(colour, 0.4 + (1 - t) * 0.3);
    ink.lineWidth = Math.max(1.2, span(thick) * 0.35);
    ink.beginPath();
    ink.moveTo(px - side * span(thick) * 0.35, py + span(thick) * 0.4);
    ink.lineTo(px + side * span(thick) * 0.45, py - span(thick) * 0.4);
    ink.stroke();
  }
}

// The nose: a soft shade down the side of the bridge, curved wings round the nostrils, the shadow beneath, a touch of light on the tip.
function nose(
  ink: Ink,
  layout: Layout,
  young: number,
  shade: Color,
  line: Color,
): void {
  const base = layout.nose;
  const wide = 0.1 + (1 - young) * 0.015;
  softLine(
    ink,
    [-0.07, layout.eyes + 0.06],
    [-0.08, (layout.eyes + base) / 2],
    [-0.06, base + 0.115],
    0.02,
    shade,
    0.22,
  );
  for (const side of [1, -1]) {
    softLine(
      ink,
      [side * wide * 0.7, base + 0.095],
      [side * wide * 1.15, base + 0.045],
      [side * wide * 0.55, base],
      0.011,
      line,
      0.5,
    );
    glow(ink, side * 0.055, base + 0.005, 0.022, line, 0.7);
  }
  softLine(
    ink,
    [-wide * 0.6, base - 0.005],
    [0, base - 0.04],
    [wide * 0.6, base - 0.005],
    0.018,
    shade,
    0.4,
  );
  glow(ink, 0.012, base + 0.105, 0.045, new Color("#ffffff"), 0.16);
}

// A close beard's shadow round the mouth and jaw, and the moustache over the lip.
function beard(
  ink: Ink,
  centre: number,
  colour: Color,
  random: () => number,
): void {
  for (let hair = 0; hair < 900; hair += 1) {
    const x = (random() - 0.5) * 1.15;
    const y = centre + 0.1 - random() * 0.56;
    if (Math.abs(x) > 0.58 - (centre - y) * 0.2) continue;
    const [px, py] = at(x, y);
    ink.fillStyle = css(colour, 0.18 + random() * 0.2);
    ink.fillRect(px, py, 2, 2);
  }
  for (const side of [1, -1])
    softLine(
      ink,
      [side * 0.2, centre - 0.02],
      [side * 0.1, centre + 0.1],
      [0, centre + 0.085],
      0.032,
      colour,
      0.9,
    );
}

export function buildPortrait(
  look: Look,
  layout: Layout,
  young: number,
  seed: number,
): Portrait {
  const skin = new Color(look.skin);
  const canvas =
    typeof document === "undefined" ? null : document.createElement("canvas");
  const ink = canvas?.getContext("2d") ?? null;
  if (canvas === null || ink === null) {
    const plain = new DataTexture(new Uint8Array([...srgb(skin), 255]), 1, 1);
    plain.colorSpace = SRGBColorSpace;
    plain.needsUpdate = true;
    return { paint: () => undefined, texture: plain };
  }
  canvas.width = faceSize;
  canvas.height = faceSize;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const eyes = layout.eyes;
  const feminine = look.skirt || look.hair === "puffs";
  const lips = skin
    .clone()
    .lerp(
      new Color(feminine && young === 0 ? "#7d2c35" : "#6b2a26"),
      feminine && young === 0 ? 0.45 : 0.32,
    );
  const line = skin.clone().lerp(new Color("#1a0705"), 0.7);
  const shade = skin.clone().lerp(new Color("#2a1030"), 0.35);
  const hair = new Color(look.galaxy ? "#1c120c" : look.hairColour).lerp(
    new Color("#120a07"),
    0.4,
  );
  let drawn = "";
  return {
    paint(expression, browLift) {
      const key = `${expression}:${browLift.toFixed(1)}`;
      if (key === drawn) return;
      drawn = key;
      const random = noise(seed);
      ink.fillStyle = css(skin);
      ink.fillRect(0, 0, faceSize, faceSize);
      // Oil-paint unevenness, kept off the edges so the painted face meets the plain skin without a seam.
      for (let dab = 0; dab < 40; dab += 1) {
        const x = (random() - 0.5) * 1.2;
        const y = eyes + 0.6 - random() * (0.6 - layout.chin + eyes);
        const light = random() > 0.5;
        glow(
          ink,
          x,
          y,
          0.04 + random() * 0.08,
          light ? new Color("#ffffff") : shade,
          (light ? 0.02 : 0.02) + random() * 0.025,
        );
      }
      glow(ink, 0, layout.nose + 0.08, 0.12, new Color("#c0452f"), 0.1);
      for (const side of [1, -1] as const) {
        glow(ink, side * layout.apart, eyes + 0.07, 0.22, shade, 0.18);
        // The crease of the upper lid, gold-touched on Mama.
        const gold = look.marks ? new Color("#e2a63c") : line;
        softLine(
          ink,
          [side * (layout.apart - 0.17), eyes + 0.1],
          [side * layout.apart, eyes + 0.245],
          [side * (layout.apart + 0.19), eyes + 0.11],
          0.01,
          gold,
          look.marks ? 0.6 : 0.3,
        );
        if (feminine || young > 0)
          glow(
            ink,
            side * 0.43,
            layout.nose + 0.1,
            0.14,
            new Color("#ff5f55"),
            young > 0 ? 0.22 : 0.15,
          );
        brow(
          ink,
          side,
          eyes,
          browLift,
          hair,
          look.hair === "afro" && !look.galaxy ? 1.25 : 1,
        );
      }
      nose(ink, layout, young, shade, line);
      const centre = layout.mouth;
      if (look.beard) beard(ink, centre, hair, random);
      paintMouth(
        ink,
        expression,
        centre,
        layout.mouthWide * (feminine && young === 0 ? 0.92 : 0.95),
        lips,
        line,
      );
      texture.needsUpdate = true;
    },
    texture,
  };
}
