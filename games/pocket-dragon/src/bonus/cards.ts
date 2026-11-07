import { spriteScaled } from "../screen/kit-sprites.ts";
import { colour } from "../screen/palette.ts";
import { glitchyColours, glitchyFront } from "../screen/sprites.ts";
import { dragonKey, inkColours, paintDots, sky } from "./nursery-draw.ts";
import type { NurseryState } from "./nursery.ts";

// The Sky Nursery's own cards to share, each drawn whole on a picture of any of the card sizes: the dragon family (Glitchy and every
// baby dragon hatched, with their names), the sky art (the stars painted, framed like a painting), and the dance party (Glitchy dancing
// in a ring of the baby dragons). Each says what it is in big letters and comes from the secret nursery of Pocket Dragon.
export const nurseryCards = ["family", "art", "dance"] as const;
export type NurseryCard = (typeof nurseryCards)[number];
export const nurseryCardNames: Readonly<Record<NurseryCard, string>> = {
  art: "Sky art",
  dance: "Dance party",
  family: "Dragon family",
};

const font = '"Courier New", ui-monospace, monospace';

function words(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
): void {
  context.font = `bold ${String(Math.round(size))}px ${font}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = colour.deep;
  context.fillText(text, x + size / 14, y + size / 14);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

const plural = (count: number, one: string, many: string): string =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

function family(
  context: CanvasRenderingContext2D,
  state: NurseryState,
  width: number,
  height: number,
): string {
  const crew = [{ look: -1, name: "GLITCHY" }, ...state.dragons];
  const across = Math.ceil(Math.sqrt(crew.length * (width / height)));
  const down = Math.ceil(crew.length / across);
  const cell = Math.min((width * 0.86) / across, (height * 0.62) / down);
  const scale = Math.max(1, Math.floor(cell / 22));
  const left = (width - across * cell) / 2;
  const top = height * 0.2 + (height * 0.62 - down * cell) / 2;
  crew.forEach((one, at) => {
    const x = left + (at % across) * cell + (cell - 16 * scale) / 2;
    const y = top + Math.floor(at / across) * cell;
    const key = one.look < 0 ? glitchyColours : dragonKey(one.look);
    spriteScaled(context, glitchyFront, key, x, y, scale);
    words(
      context,
      one.name,
      x + 8 * scale,
      y + 17.5 * scale,
      scale * 2.6,
      colour.cream,
    );
  });
  return plural(
    state.dragons.length,
    "BABY DRAGON HATCHED",
    "BABY DRAGONS HATCHED",
  );
}

function art(
  context: CanvasRenderingContext2D,
  state: NurseryState,
  width: number,
  height: number,
): string {
  const scale = Math.min((width * 0.84) / 256, (height * 0.6) / 144);
  const left = (width - 256 * scale) / 2;
  const top = height * 0.2;
  context.fillStyle = colour.gold;
  context.fillRect(
    left - scale * 4,
    top - scale * 4,
    256 * scale + scale * 8,
    144 * scale + scale * 8,
  );
  context.save();
  context.translate(left, top);
  context.scale(scale, scale);
  sky(context, 0);
  context.restore();
  paintDots(context, state, Math.max(2, scale * 2), scale, left, top);
  return plural(state.paint.length, "STAR PAINTED", "STARS PAINTED");
}

function dance(
  context: CanvasRenderingContext2D,
  state: NurseryState,
  width: number,
  height: number,
): string {
  const middle = { x: width / 2, y: height * 0.52 };
  const big = Math.max(2, Math.floor(Math.min(width, height) / 70));
  const ring = Math.min(width, height) * 0.3;
  state.dragons.forEach((one, at) => {
    const angle = (at / Math.max(1, state.dragons.length)) * Math.PI * 2;
    const x = middle.x + Math.cos(angle) * ring - 8 * big * 0.6;
    const y = middle.y + Math.sin(angle) * ring * 0.7 - 8 * big * 0.6;
    spriteScaled(
      context,
      glitchyFront,
      dragonKey(one.look),
      x,
      y,
      Math.max(1, Math.floor(big * 0.6)),
    );
  });
  spriteScaled(
    context,
    glitchyFront,
    glitchyColours,
    middle.x - 8 * big,
    middle.y - 8 * big,
    big,
  );
  for (let bit = 0; bit < 80; bit += 1) {
    context.fillStyle = inkColours[bit % inkColours.length] ?? colour.gold;
    context.fillRect(
      (bit * 137) % width,
      height * 0.18 + ((bit * 89) % Math.round(height * 0.6)),
      big * 2,
      big * 3,
    );
  }
  return `GLITCHY AND ${plural(state.dragons.length, "DRAGON", "DRAGONS")} DANCING`;
}

const titles: Readonly<Record<NurseryCard, string>> = {
  art: "SKY ART BY GLITCHY",
  dance: "DANCE PARTY IN THE SKY",
  family: "MY DRAGON FAMILY",
};

// Draws the card and gives the words that say what it shows, for those who cannot see it.
export function paintNurseryCard(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: NurseryState,
  kind: NurseryCard,
): string {
  context.save();
  context.scale(width / 256, height / 144);
  sky(context, state.tick);
  context.restore();
  const size = Math.min(width, height);
  words(
    context,
    titles[kind],
    width / 2,
    height * 0.1,
    size * 0.07,
    colour.gold,
  );
  const caption = { art, dance, family }[kind](context, state, width, height);
  words(context, caption, width / 2, height * 0.87, size * 0.045, colour.white);
  words(
    context,
    "POCKET DRAGON: GLITCHY'S QUEST  ·  THE SECRET SKY NURSERY",
    width / 2,
    height * 0.94,
    size * 0.025,
    colour.lavender,
  );
  return `${titles[kind]}: ${caption.toLowerCase()}, from the secret Sky Nursery in Pocket Dragon.`;
}
