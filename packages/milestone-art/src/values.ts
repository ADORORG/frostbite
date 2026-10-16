// What each allowed attribute may hold. A value is accepted only if it is exactly one of these shapes; nothing is trimmed or
// rewritten, so the cleaned drawing carries the values as written.

const number = String.raw`-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?`;
const numberOnly = new RegExp(`^${number}$`, "u");
const numberList = new RegExp(`^${number}(?:[ ,]+${number})*$`, "u");
const unit = new RegExp(`^(?:0|1|0?\\.\\d+|1\\.0+)$`, "u");
const hexColour =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u;
const identifier = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/u;
const reference = /^url\(#([A-Za-z][A-Za-z0-9_-]{0,31})\)$/u;
const pathData = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\- \t\n\r]+$/u;
const transformFunction = new RegExp(
  `^(?:translate|scale|rotate|skewX|skewY|matrix)\\(${number}(?:[ ,]+${number})*\\)$`,
  "u",
);
const percentage = new RegExp(`^${number}%?$`, "u");

export type Check = (value: string) => boolean;

function oneOf(...allowed: readonly string[]): Check {
  return (value) => allowed.includes(value);
}

const transform: Check = (value) => {
  const parts = value
    .trim()
    .split(/(?<=\))\s*,?\s*/u)
    .filter((part) => part !== "");
  return (
    parts.length > 0 &&
    parts.every((part) => transformFunction.test(part.trim()))
  );
};

const viewBox: Check = (value) => {
  if (!numberList.test(value)) return false;
  const parts = value.split(/[ ,]+/u).map(Number);
  return parts.length === 4 && (parts[2] ?? 0) > 0 && (parts[3] ?? 0) > 0;
};

// `fill`, `stroke`, `stop-color`: none, a hex colour, or a reference to a gradient in the same drawing.
const paint: Check = (value) =>
  value === "none" || hexColour.test(value) || reference.test(value);
const colour: Check = (value) => hexColour.test(value);

// The references a drawing makes, collected while it is checked so each can be matched to an id.
export function referencedId(value: string): string | null {
  return reference.exec(value)?.[1] ?? null;
}

export const attributeChecks: Readonly<Record<string, Check>> = {
  "clip-path": (value) => reference.test(value),
  "clip-rule": oneOf("nonzero", "evenodd"),
  cx: (value) => percentage.test(value),
  cy: (value) => percentage.test(value),
  d: (value) => pathData.test(value),
  fill: paint,
  "fill-opacity": (value) => unit.test(value),
  "fill-rule": oneOf("nonzero", "evenodd"),
  fx: (value) => percentage.test(value),
  fy: (value) => percentage.test(value),
  gradientTransform: transform,
  gradientUnits: oneOf("userSpaceOnUse", "objectBoundingBox"),
  height: (value) => percentage.test(value),
  id: (value) => identifier.test(value),
  offset: (value) => percentage.test(value),
  opacity: (value) => unit.test(value),
  points: (value) => numberList.test(value),
  preserveAspectRatio: (value) =>
    /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max))(?: (?:meet|slice))?$/u.test(
      value,
    ),
  r: (value) => percentage.test(value),
  rx: (value) => percentage.test(value),
  ry: (value) => percentage.test(value),
  spreadMethod: oneOf("pad", "reflect", "repeat"),
  "stop-color": colour,
  "stop-opacity": (value) => unit.test(value),
  stroke: paint,
  "stroke-dasharray": (value) => value === "none" || numberList.test(value),
  "stroke-dashoffset": (value) => numberOnly.test(value),
  "stroke-linecap": oneOf("butt", "round", "square"),
  "stroke-linejoin": oneOf("miter", "round", "bevel"),
  "stroke-miterlimit": (value) => numberOnly.test(value),
  "stroke-opacity": (value) => unit.test(value),
  "stroke-width": (value) => numberOnly.test(value),
  transform,
  viewBox,
  width: (value) => percentage.test(value),
  x: (value) => percentage.test(value),
  x1: (value) => percentage.test(value),
  x2: (value) => percentage.test(value),
  y: (value) => percentage.test(value),
  y1: (value) => percentage.test(value),
  y2: (value) => percentage.test(value),
};
