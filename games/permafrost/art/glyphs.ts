import { cells, grey, piece, polygon, square, white } from "./svg.ts";

// The pictures, one for each kind of milestone. A picture is drawn in the middle of the frame, in a box from 24 to 104 across and from 20 to 104
// down. Each takes how many of a thing to show, which says how far along the family it is.
const cell = 8;
const left = 24;
const floor = 104;

// A well with `count` full rows at its bottom, each of them lit from above.
export function rows(count: number): string {
  const byKind = new Map<number, string[]>();
  for (let r = 0; r < count; r += 1)
    for (let c = 0; c < 10; c += 1) {
      const kind = ((c + r) % 7) + 1;
      byKind.set(kind, [
        ...(byKind.get(kind) ?? []),
        square(left + c * cell, floor - (r + 1) * cell, cell - 1),
      ]);
    }
  const filled = [...byKind]
    .map(([kind, list]) => cells(list, piece(kind)))
    .join("");
  const top = floor - count * cell - 5;
  return `<path d="M${left} 22v${floor - 22}h80V22" fill="none" stroke="#3a2a78" stroke-width="2"/>${filled}${polygon(
    [
      [left, top],
      [left + 80, top],
      [left + 80, top - 3],
      [left, top - 3],
    ],
    white,
    ' fill-opacity="0.8"',
  )}`;
}

// A stair of `count` steps with a flag on the top.
export function stairs(count: number): string {
  const width = Math.floor(72 / count);
  const steps = Array.from({ length: count }, (_, at) =>
    square(28 + at * width, floor - (at + 1) * 12, width - 1).replace(
      /v\d+(\.\d+)?/,
      `v${String((at + 1) * 12)}`,
    ),
  );
  const top = floor - count * 12;
  const x = 28 + (count - 1) * width + width / 2;
  return `${cells(steps, piece(4))}<path d="M${x} ${top}v-22" stroke="${white}" stroke-width="2" fill="none"/>${polygon(
    [
      [x, top - 22],
      [x + 14, top - 17],
      [x, top - 12],
    ],
    piece(2),
  )}`;
}

// `count` cut stones in a row, as many as the score is a step up.
export function gems(count: number): string {
  const gap = 78 / count;
  return Array.from({ length: count }, (_, at) => {
    const x = 25 + gap * at + gap / 2;
    const size = Math.min(14, gap / 2 + 3);
    return polygon(
      [
        [x, 56 - size],
        [x + size, 66],
        [x, 76 + size],
        [x - size, 66],
      ],
      piece((at % 7) + 1),
      ' stroke="#ece8ff" stroke-width="1.5"',
    );
  }).join("");
}

// `count` upright long pieces side by side: four rows cleared at once.
export function fours(count: number): string {
  const gap = Math.min(18, 76 / count);
  const x0 = 64 - (gap * (count - 1)) / 2 - 4;
  const squares = Array.from({ length: count }, (_, at) =>
    [0, 1, 2, 3].map((r) => square(x0 + at * gap, 44 + r * 10, 8)).join(""),
  );
  return `${cells(squares, piece(1))}${polygon(
    [
      [64, 24],
      [74, 38],
      [54, 38],
    ],
    white,
  )}`;
}

// `count` links of a chain.
export function chain(count: number): string {
  const step = Math.min(16, 76 / count);
  const x0 = 64 - (step * (count - 1)) / 2;
  return Array.from(
    { length: count },
    (_, at) =>
      `<rect x="${String(Math.round((x0 + at * step - 12) * 10) / 10)}" y="52" width="24" height="26" rx="9" fill="none" stroke="${piece((at % 7) + 1)}" stroke-width="4"/>`,
  ).join("");
}

// Two long pieces joined by a bar, and `count` small ones behind for the longer streaks.
export function pair(count: number): string {
  return `${fours(Math.max(2, count))}<path d="M30 92h68" stroke="${piece(2)}" stroke-width="3" fill="none"/>`;
}

// An empty well with a star in it.
export function empty(): string {
  const star = polygon(
    [
      [64, 34],
      [70, 54],
      [90, 56],
      [74, 68],
      [80, 88],
      [64, 76],
      [48, 88],
      [54, 68],
      [38, 56],
      [58, 54],
    ],
    piece(2),
  );
  return `<path d="M${left} 22v${floor - 22}h80V22" fill="none" stroke="#3a2a78" stroke-width="2"/>${star}`;
}

// A box with a piece in it and an arrow that swaps it out.
export function hold(): string {
  const tee = cells(
    [
      square(46, 52, 12),
      square(58, 52, 12),
      square(70, 52, 12),
      square(58, 40, 12),
    ],
    piece(3),
  );
  return `<rect x="34" y="30" width="60" height="50" rx="6" fill="none" stroke="#3a2a78" stroke-width="2"/>${tee}${polygon(
    [
      [40, 94],
      [88, 94],
      [88, 88],
      [100, 98],
      [88, 108],
      [88, 102],
      [40, 102],
    ],
    white,
    ' fill-opacity="0.85"',
  )}`;
}

// A stopwatch with `fraction` of its face filled: a quarter of the time left is a quicker run.
export function watch(fraction: number): string {
  const angle = fraction * Math.PI * 2;
  const x = 64 + 28 * Math.sin(angle);
  const y = 68 - 28 * Math.cos(angle);
  const big = fraction > 0.5 ? 1 : 0;
  const face = `M64 68L64 40A28 28 0 ${String(big)} 1 ${String(Math.round(x * 10) / 10)} ${String(Math.round(y * 10) / 10)}z`;
  return `<circle cx="64" cy="68" r="32" fill="none" stroke="${white}" stroke-width="3"/><path d="${face}" fill="${piece(4)}" fill-opacity="0.8"/><rect x="58" y="26" width="12" height="6" fill="${white}"/>`;
}

// `count` grey rows pushing up from below, with an arrow.
export function rising(count: number): string {
  const squares = Array.from({ length: count }, (_, r) =>
    Array.from({ length: 8 }, (_, c) =>
      c === (r * 3) % 8
        ? ""
        : square(left + c * cell, floor - (r + 1) * cell, cell - 1),
    ).join(""),
  );
  return `${cells(squares, grey)}${polygon(
    [
      [94, 30],
      [104, 44],
      [98, 44],
      [98, 60],
      [90, 60],
      [90, 44],
      [84, 44],
    ],
    piece(5),
  )}`;
}
