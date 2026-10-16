import { describe, expect, it } from "vitest";

import { sanitizeDrawing } from "../src/index.ts";
import { ns, policy } from "./support.ts";

// What the contract checks (`rewards_core::art::validate`), restated as an oracle: whatever the sanitiser lets through must also
// pass the contract, because the contract is the last check before a drawing is stored.
function contractAccepts(svg: string): boolean {
  const lower = svg.toLowerCase();
  const forbidden = [
    "<script",
    "<foreignobject",
    "<iframe",
    "javascript:",
    "<!entity",
    "<!doctype",
  ];
  return (
    lower.startsWith("<svg") &&
    lower.endsWith("</svg>") &&
    lower.split("<svg").length === 2 &&
    lower.split("</svg>").length === 2 &&
    forbidden.every((fragment) => !lower.includes(fragment))
  );
}

// A small deterministic generator, so a failure can be replayed.
function random(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

const body = [
  "<g>",
  "</g>",
  "<g/>",
  '<rect width="3" height="3"/>',
  '<circle r="2" fill="#fff"/>',
  '<path d="M0 0L5 5z"/>',
  '<g id="a">',
  '<rect fill="url(#a)"/>',
  '<rect fill="url(#b)"/>',
  '<g transform="rotate(10)">',
];

const hostile = [
  "<script>",
  "</script>",
  "<script/>",
  "<foreignObject/>",
  '<a href="javascript:x">',
  "<!--",
  "-->",
  "<![CDATA[",
  "<!DOCTYPE svg>",
  "<?x?>",
  "&amp;",
  "&#x3c;",
  "<",
  ">",
  '"',
  "'",
  "=",
  "é",
  "\u0000",
  "<SVG>",
  "</svg>",
  "<Script>",
  '<rect onload="x"/>',
  '<svg xmlns="x">',
  "<style/>",
  '<rect fill="javascript:x"/>',
];

const open = `<svg xmlns="${ns}" viewBox="0 0 10 10">`;

// A mostly valid drawing, sometimes with a hostile fragment spliced in or a character deleted or doubled.
function generate(next: () => number): string {
  const count = Math.floor(next() * 8);
  let inner = "";
  for (let index = 0; index < count; index += 1) {
    inner += body[Math.floor(next() * body.length)] ?? "";
  }
  let drawing = `${open}${inner}</svg>`;
  const roll = next();
  const at = Math.floor(next() * drawing.length);
  if (roll < 0.3) {
    drawing =
      drawing.slice(0, at) +
      (hostile[Math.floor(next() * hostile.length)] ?? "") +
      drawing.slice(at);
  } else if (roll < 0.4) {
    drawing = drawing.slice(0, at) + drawing.slice(at + 1);
  } else if (roll < 0.5) {
    drawing = drawing.slice(0, at) + (drawing[at] ?? "") + drawing.slice(at);
  }
  return drawing;
}

describe("random drawings, mostly valid and sometimes damaged or hostile", () => {
  it("are either refused or come out in a form the contract accepts and that cleans to itself", () => {
    const next = random(20261016);
    let accepted = 0;
    let refused = 0;
    for (let run = 0; run < 6000; run += 1) {
      const drawing = generate(next);
      const result = sanitizeDrawing(drawing, policy);
      if (!result.ok) {
        refused += 1;
        continue;
      }
      accepted += 1;
      expect(contractAccepts(result.svg), drawing).toBe(true);
      expect(sanitizeDrawing(result.svg, policy), drawing).toEqual({
        ok: true,
        svg: result.svg,
      });
    }
    // Both paths must be reached, or the loop above checks nothing.
    expect(accepted).toBeGreaterThan(200);
    expect(refused).toBeGreaterThan(200);
  });
});
