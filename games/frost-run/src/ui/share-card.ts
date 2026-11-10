import { perRound, roundCount } from "../rules/constants.ts";
import { leads } from "../rules/leads.ts";
import { milestones } from "../rules/milestones.ts";
import { needed, totals } from "../rules/round.ts";
import type { ItemKind, RunState } from "../rules/types.ts";
import { heroWords, kindWords, words } from "../words.ts";

// The share card: a picture of the run to post or keep, square or as tall as a story. The hero as the camera last saw them, the verdict, the
// treasure against the 90% line, and the milestones. It is drawn on a canvas of its own, in the game's colours (no orange: that is the
// crystal's moment only).
export type CardShape = "square" | "story";

const colours = {
  crystal: "#3FE0A0",
  egg: "#C9BDEA",
  ice: "#BFEAFF",
  key: "#BFEAFF",
  night: "#0B0A08",
  text: "#EAF6FF",
  dim: "#8FB3C9",
};
const kinds: readonly ItemKind[] = ["crystal", "egg", "key"];
const body = 'ui-monospace, "Cascadia Mono", Menlo, "Courier New", monospace';

function icon(
  context: CanvasRenderingContext2D,
  kind: ItemKind,
  x: number,
  y: number,
  size: number,
): void {
  context.save();
  context.translate(x, y);
  context.fillStyle = colours[kind];
  context.shadowColor = colours[kind];
  context.shadowBlur = size * 0.6;
  context.beginPath();
  if (kind === "crystal") {
    context.moveTo(0, -size);
    context.lineTo(size * 0.55, -size * 0.3);
    context.lineTo(size * 0.4, size * 0.8);
    context.lineTo(-size * 0.4, size * 0.8);
    context.lineTo(-size * 0.55, -size * 0.3);
  } else if (kind === "egg") {
    context.ellipse(0, size * 0.1, size * 0.62, size * 0.82, 0, 0, Math.PI * 2);
  } else {
    context.arc(0, -size * 0.45, size * 0.38, 0, Math.PI * 2);
    context.rect(-size * 0.09, -size * 0.2, size * 0.18, size * 1.05);
    context.rect(size * 0.05, size * 0.45, size * 0.32, size * 0.14);
    context.rect(size * 0.05, size * 0.7, size * 0.24, size * 0.12);
  }
  context.fill();
  context.restore();
}

function backdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0d1822");
  sky.addColorStop(0.55, colours.night);
  sky.addColorStop(1, "#08131b");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  // An aurora across the top, mint into ice.
  for (let band = 0; band < 3; band += 1) {
    const glow = context.createLinearGradient(0, 0, width, 0);
    glow.addColorStop(0, "rgba(63,224,160,0)");
    glow.addColorStop(0.4, `rgba(63,224,160,${String(0.16 - band * 0.04)})`);
    glow.addColorStop(0.75, `rgba(150,220,255,${String(0.14 - band * 0.03)})`);
    glow.addColorStop(1, "rgba(150,220,255,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.moveTo(0, height * (0.08 + band * 0.05));
    context.bezierCurveTo(
      width * 0.3,
      height * (0.02 + band * 0.04),
      width * 0.6,
      height * (0.2 + band * 0.03),
      width,
      height * (0.06 + band * 0.05),
    );
    context.lineTo(width, height * (0.16 + band * 0.05));
    context.bezierCurveTo(
      width * 0.6,
      height * (0.28 + band * 0.03),
      width * 0.3,
      height * (0.1 + band * 0.04),
      0,
      height * (0.18 + band * 0.05),
    );
    context.fill();
  }
  // Snow, on a pattern that looks scattered and is the same every time.
  context.fillStyle = "rgba(220,240,255,0.55)";
  for (let flake = 0; flake < 140; flake += 1) {
    const x = ((flake * 0.7548776662) % 1) * width;
    const y = ((flake * 0.5698402909) % 1) * height;
    const r = 1 + ((flake * 0.3819660113) % 1) * 3;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
}

function portrait(
  context: CanvasRenderingContext2D,
  picture: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  context.save();
  context.beginPath();
  context.roundRect(x, y, w, h, 36);
  context.clip();
  context.fillStyle = "#0e1b25";
  context.fillRect(x, y, w, h);
  if (picture !== null && picture.width > 0) {
    const scale = Math.max(w / picture.width, h / picture.height);
    const pw = picture.width * scale;
    const ph = picture.height * scale;
    context.drawImage(picture, x + (w - pw) / 2, y + (h - ph) / 2, pw, ph);
  }
  const fade = context.createLinearGradient(0, y + h * 0.6, 0, y + h);
  fade.addColorStop(0, "rgba(11,10,8,0)");
  fade.addColorStop(1, "rgba(11,10,8,0.85)");
  context.fillStyle = fade;
  context.fillRect(x, y, w, h);
  context.restore();
  context.strokeStyle = "rgba(191,234,255,0.45)";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(x, y, w, h, 36);
  context.stroke();
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  state: RunState,
  picture: HTMLImageElement | null,
  shape: CardShape,
): void {
  const width = 1080;
  const height = shape === "square" ? 1080 : 1920;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) return;
  backdrop(context, width, height);
  const lead = leads[state.lead];
  const hero = lead === undefined ? null : heroWords[lead.id];
  const tall = shape === "story";
  const top = tall ? 150 : 70;
  context.textAlign = "center";
  context.fillStyle = colours.dim;
  context.font = `600 34px ${body}`;
  context.fillText(words.brand, width / 2, top);
  context.fillStyle = colours.text;
  context.font = `bold ${tall ? 120 : 96}px ${body}`;
  context.fillText(
    words.title.toUpperCase(),
    width / 2,
    top + (tall ? 130 : 100),
  );

  const pictureTop = top + (tall ? 190 : 140);
  const pictureHeight = tall ? 820 : 430;
  portrait(context, picture, 90, pictureTop, width - 180, pictureHeight);
  context.font = `bold ${tall ? 84 : 64}px ${body}`;
  context.fillStyle = state.won ? colours.crystal : colours.ice;
  context.fillText(
    (state.won ? words.win : words.lose).toUpperCase(),
    width / 2,
    pictureTop + pictureHeight - 40,
  );

  const rowTop = pictureTop + pictureHeight + (tall ? 120 : 80);
  context.font = `600 ${tall ? 44 : 36}px ${body}`;
  context.fillStyle = colours.text;
  context.fillText(
    `${hero?.name ?? ""} · ${hero?.kind ?? ""}`,
    width / 2,
    rowTop - (tall ? 30 : 24),
  );
  const sum = totals(state.tallies);
  const column = (width - 180) / 3;
  kinds.forEach((kind, index) => {
    const centre = 90 + column * index + column / 2;
    const y = rowTop + (tall ? 90 : 60);
    icon(context, kind, centre, y, tall ? 34 : 28);
    context.fillStyle =
      sum[kind] >= needed(kind) ? colours[kind] : colours.text;
    context.font = `bold ${tall ? 64 : 52}px ${body}`;
    context.fillText(
      `${String(sum[kind])}/${String(perRound[kind] * roundCount)}`,
      centre,
      y + (tall ? 110 : 84),
    );
    context.fillStyle = colours.dim;
    context.font = `500 ${tall ? 30 : 26}px ${body}`;
    context.fillText(
      kindWords[kind].many.toUpperCase(),
      centre,
      y + (tall ? 156 : 120),
    );
  });
  const earned = milestones.filter((milestone) =>
    milestone.earned(state),
  ).length;
  context.fillStyle = colours.text;
  context.font = `500 ${tall ? 34 : 30}px ${body}`;
  const footY = height - (tall ? 170 : 70);
  context.fillText(
    `${String(state.score)} points · ${String(earned)}/${String(milestones.length)} milestones`,
    width / 2,
    footY,
  );
  context.fillStyle = colours.dim;
  context.font = `500 ${tall ? 28 : 24}px ${body}`;
  context.fillText(words.goal, width / 2, footY + (tall ? 56 : 40));
}
