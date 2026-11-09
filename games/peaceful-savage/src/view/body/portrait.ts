import {
  CanvasTexture,
  Color,
  DataTexture,
  SRGBColorSpace,
  type Texture,
} from "three";

import { noise, srgb } from "../palette.ts";
import { at, css, faceSize, glow, type Ink, softLine, span } from "./brush.ts";
import { type Expression, eyeApart, eyeLine } from "./head.ts";
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
  for (let step = 0; step <= 40; step += 1) {
    const t = step / 40;
    const x =
      (1 - t) ** 2 * inner[0] + 2 * (1 - t) * t * peak[0] + t * t * outer[0];
    const y =
      (1 - t) ** 2 * inner[1] + 2 * (1 - t) * t * peak[1] + t * t * outer[1];
    const thick = weight * (0.055 - t * 0.04);
    const [px, py] = at(x, y);
    ink.strokeStyle = css(colour, 0.55 + (1 - t) * 0.35);
    ink.lineWidth = Math.max(1.2, span(thick) * 0.35);
    ink.beginPath();
    ink.moveTo(px - side * span(thick) * 0.5, py + span(thick) * 0.7);
    ink.lineTo(px + side * span(thick) * 0.6, py - span(thick) * 0.6);
    ink.stroke();
  }
}

// The nose: a soft shade down the side of the bridge, curved wings round the nostrils, the shadow beneath, a touch of light on the tip.
function nose(
  ink: Ink,
  eyes: number,
  young: number,
  shade: Color,
  line: Color,
): void {
  const wide = 0.1 + (1 - young) * 0.015;
  softLine(
    ink,
    [-0.07, eyes + 0.06],
    [-0.075, eyes - 0.1],
    [-0.06, eyes - 0.24],
    0.02,
    shade,
    0.22,
  );
  for (const side of [1, -1]) {
    softLine(
      ink,
      [side * wide * 0.7, eyes - 0.26],
      [side * wide * 1.15, eyes - 0.31],
      [side * wide * 0.55, eyes - 0.355],
      0.011,
      line,
      0.5,
    );
    glow(ink, side * 0.055, eyes - 0.35, 0.022, line, 0.7);
  }
  softLine(
    ink,
    [-wide * 0.6, eyes - 0.36],
    [0, eyes - 0.395],
    [wide * 0.6, eyes - 0.36],
    0.018,
    shade,
    0.4,
  );
  glow(ink, 0.012, eyes - 0.25, 0.045, new Color("#ffffff"), 0.16);
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
    const y = centre + 0.1 - random() * 0.5;
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
  const eyes = eyeLine(young);
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
      for (let dab = 0; dab < 90; dab += 1) {
        const x = (random() - 0.5) * 1.2;
        const y = eyes + (random() - 0.55) * 1.4;
        const light = random() > 0.5;
        glow(
          ink,
          x,
          y,
          0.04 + random() * 0.08,
          light ? new Color("#ffffff") : shade,
          (light ? 0.03 : 0.04) + random() * 0.04,
        );
      }
      glow(ink, 0, eyes - 0.28, 0.12, new Color("#c0452f"), 0.1);
      for (const side of [1, -1] as const) {
        glow(ink, side * eyeApart, eyes, 0.26, shade, 0.28);
        // The crease of the upper lid, gold-touched on Mama.
        const gold = look.marks ? new Color("#e2a63c") : line;
        softLine(
          ink,
          [side * (eyeApart - 0.17), eyes + 0.1],
          [side * eyeApart, eyes + 0.245],
          [side * (eyeApart + 0.19), eyes + 0.11],
          0.01,
          gold,
          look.marks ? 0.6 : 0.3,
        );
        if (feminine || young > 0)
          glow(
            ink,
            side * 0.42,
            eyes - 0.28,
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
      nose(ink, eyes, young, shade, line);
      const centre = eyes - (young > 0 ? 0.47 : 0.5);
      if (look.beard) beard(ink, centre, hair, random);
      paintMouth(
        ink,
        expression,
        centre,
        young > 0 ? 0.13 : feminine ? 0.135 : 0.15,
        lips,
        line,
      );
      texture.needsUpdate = true;
    },
    texture,
  };
}
