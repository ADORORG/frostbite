import { colour } from "../screen/palette.ts";
import type { CardContent } from "./content.ts";
import type { Box } from "./layout.ts";
import { big, fitted, letterWidth, panel, say } from "./paint.ts";
import type { Trophy, TrophyKind } from "./trophy-list.ts";

// The trophy shelf on a card picture: the milestones the run earned (or all the player holds, on a card of the quest so far), each a
// little plaque with a pixel cup coloured by where it was won (gold for Egg Hills, ice for the woods, pink for the castle, lavender for
// the marks of every chapter, and a fiery cup for the masterful charm). What does not fit is counted at the end.
export const cupRows = [
  "ggggggggg",
  "g.gggwg.g",
  "g.ggggg.g",
  ".ggggggg.",
  "..ggggg..",
  "...ggg...",
  "....d....",
  "...ddd...",
  "..ddddd..",
] as const;

const cupColours: Readonly<Record<TrophyKind, readonly [string, string]>> = {
  castle: [colour.pink, "#a8247a"],
  hills: [colour.gold, colour.goldDark],
  masterful: [colour.fireHot, colour.fire],
  shared: [colour.lavender, colour.lavenderDark],
  woods: [colour.ice, colour.iceDark],
};

export const cupKey = (kind: TrophyKind): Readonly<Record<string, string>> => {
  const [light, dark] = cupColours[kind];
  return { d: dark, g: light, w: colour.white };
};

interface Plaque {
  readonly kind: TrophyKind | null;
  readonly size: number;
  readonly text: string;
  readonly width: number;
}

// Where plaques go, row by row, or null when they do not all fit in `rows`.
function placed(
  plaques: readonly Plaque[],
  width: number,
  rows: number,
  gap: number,
): readonly (readonly [number, number])[] | null {
  const spots: (readonly [number, number])[] = [];
  let x = 0;
  let row = 0;
  for (const plaque of plaques) {
    if (x > 0 && x + plaque.width > width) {
      x = 0;
      row += 1;
    }
    if (row >= rows) return null;
    spots.push([x, row]);
    x += plaque.width + gap;
  }
  return spots;
}

export function drawTrophies(
  context: CanvasRenderingContext2D,
  box: Box,
  card: CardContent,
): void {
  const head = Math.min(box.height * 0.17, 34);
  say(
    context,
    card.trophyHeading,
    box.x,
    box.y,
    fitted(card.trophyHeading, box.width * 0.68, head, 1),
    colour.gold,
  );
  say(
    context,
    card.milestones,
    box.x + box.width,
    box.y,
    fitted(card.milestones, box.width * 0.28, head, 1),
    colour.cream,
    "right",
  );
  const gap = Math.max(6, head * 0.3);
  const top = box.y + head * 1.5;
  const room = box.y + box.height - top;
  // A narrow shelf has more, smaller rows, so two plaques can share one.
  const wanted = box.width < 500 ? 5 : 3;
  const high = Math.min(48, Math.max(26, (room - (wanted - 1) * gap) / wanted));
  const rows = Math.max(1, Math.floor((room + gap) / (high + gap)));
  const size = high * 0.48;
  const scale = Math.max(1, Math.round((high * 0.62) / 9));
  const pad = high * 0.25;
  const fixed = pad * 2.8 + 9 * scale;
  const most = Math.max(
    4,
    Math.floor((box.width - fixed) / (size * letterWidth)),
  );
  // A long title is written a little smaller to fit its plaque, and cut short only past that.
  const plaque = (trophy: Trophy): Plaque => {
    const fits = (box.width - fixed) / (trophy.title.length * letterWidth);
    const small = Math.min(size, Math.max(size * 0.8, fits));
    const text =
      trophy.title.length > most && small === size * 0.8
        ? `${trophy.title.slice(0, Math.floor((box.width - fixed) / (small * letterWidth)) - 1)}…`
        : trophy.title;
    return {
      kind: trophy.kind,
      size: small,
      text,
      width: fixed + text.length * small * letterWidth,
    };
  };
  const more = (count: number): Plaque => {
    const text = `+${String(count)} MORE`;
    return {
      kind: null,
      size,
      text,
      width: pad * 2 + text.length * size * letterWidth,
    };
  };
  if (card.trophies.length === 0) {
    const none =
      card.outcome === "journey"
        ? "NO TROPHIES YET: THE QUEST AWAITS"
        : "NO NEW TROPHIES THIS RUN";
    say(
      context,
      none,
      box.x,
      top,
      fitted(none, box.width, size, 1),
      colour.lavender,
    );
    return;
  }
  const all = card.trophies.map(plaque);
  let shown = all.length;
  let plaques: readonly Plaque[] = all;
  let spots = placed(plaques, box.width, rows, gap);
  while (spots === null && shown > 0) {
    shown -= 1;
    plaques = [...all.slice(0, shown), more(all.length - shown)];
    spots = placed(plaques, box.width, rows, gap);
  }
  plaques.forEach((item, at) => {
    const [x, row] = spots?.[at] ?? [0, 0];
    const left = box.x + x;
    const y = top + row * (high + gap);
    const edge =
      item.kind === null ? colour.lavenderDark : cupColours[item.kind][0];
    panel(
      context,
      { height: high, width: item.width, x: left, y },
      "#2b1a66",
      edge,
      2,
      Math.max(2, high / 8),
    );
    if (item.kind !== null)
      big(
        context,
        cupRows,
        cupKey(item.kind),
        left + pad,
        y + (high - 9 * scale) / 2,
        scale,
      );
    const textX =
      item.kind === null ? left + pad : left + pad * 1.8 + 9 * scale;
    say(
      context,
      item.text,
      textX,
      y + (high - item.size) / 2,
      item.size,
      item.kind === null ? colour.lavender : colour.white,
    );
  });
}
