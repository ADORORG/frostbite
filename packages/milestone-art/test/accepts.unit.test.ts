import { describe, expect, it } from "vitest";

import { sanitizeDrawing } from "../src/index.ts";
import { ns, policy, wrap } from "./support.ts";

describe("a drawing that stays inside the allow-list", () => {
  it("comes out unchanged when it is already in canonical form", () => {
    const drawing = wrap('<circle cx="5" cy="5" r="4" fill="#f60"/>');
    expect(sanitizeDrawing(drawing, policy)).toEqual({
      ok: true,
      svg: drawing,
    });
  });

  it("is written fresh: whitespace between elements goes and single quotes become double", () => {
    const messy = `  <svg xmlns='${ns}'   viewBox='0 0 10 10' >\n  <g>\n <rect  width='3' height="4"/>\n</g>\n</svg>\n `;
    expect(sanitizeDrawing(messy, policy)).toEqual({
      ok: true,
      svg: wrap('<g><rect width="3" height="4"/></g>'),
    });
  });

  it("always ends with a closing svg tag, even with nothing inside", () => {
    const empty = wrap("");
    expect(sanitizeDrawing(empty, policy)).toEqual({ ok: true, svg: empty });
    expect(
      sanitizeDrawing(`<svg xmlns="${ns}" viewBox="0 0 10 10"/>`, policy),
    ).toEqual({ ok: true, svg: empty });
  });

  it("may use every allowed shape, gradient, clip and transform", () => {
    const drawing = wrap(
      '<defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox" spreadMethod="pad"><stop offset="0%" stop-color="#fff" stop-opacity=".5"/></linearGradient>' +
        '<radialGradient id="g2" cx="50%" cy="50%" r="50%" fx="1" fy="1" gradientTransform="rotate(45)"><stop offset="1" stop-color="#000000ff"/></radialGradient>' +
        '<clipPath id="c1"><rect x="0" y="0" width="5" height="5"/></clipPath></defs>' +
        '<g clip-path="url(#c1)" opacity="1" transform="translate(1,2) scale(2)"><ellipse cx="1" cy="1" rx="2" ry="3" fill="url(#g1)" stroke="url(#g2)" stroke-width="0.5"/>' +
        '<line x1="0" y1="0" x2="5" y2="5" stroke="#abc" stroke-linecap="round" stroke-linejoin="bevel" stroke-dasharray="1 2" stroke-dashoffset="-1" stroke-miterlimit="4" stroke-opacity="0.3"/>' +
        '<polyline points="0,0 1,1 2,0" fill="none"/><polygon points="0 0 4 0 4 4" fill-rule="evenodd" clip-rule="nonzero"/>' +
        '<path d="M0 0L5 5z" fill="#f60" fill-opacity="1"/></g>',
      ` viewBox="0 0 10 10" preserveAspectRatio="xMidYMid meet" width="100%" height="100"`,
    );
    expect(sanitizeDrawing(drawing, policy)).toEqual({
      ok: true,
      svg: drawing,
    });
  });

  it("accepts a dash array of none", () => {
    const drawing = wrap('<path stroke-dasharray="none" d="M0 0L1 1"/>');
    expect(sanitizeDrawing(drawing, policy)).toEqual({
      ok: true,
      svg: drawing,
    });
  });

  it("accepts a viewBox with commas and a drawing at the exact size limit", () => {
    expect(
      sanitizeDrawing(wrap("<g/>", ` viewBox="0,0,10,10"`), policy).ok,
    ).toBe(true);
    const drawing = wrap("<g/>");
    const exact = {
      ...policy,
      maxBytes: new TextEncoder().encode(drawing).length,
    };
    expect(sanitizeDrawing(drawing, exact)).toEqual({ ok: true, svg: drawing });
  });
});
