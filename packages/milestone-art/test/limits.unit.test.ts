import { describe, expect, it } from "vitest";

import { sanitizeDrawing } from "../src/index.ts";
import { ns, policy, wrap } from "./support.ts";

describe("the policy limits", () => {
  it("refuse a drawing larger than the byte limit, before reading it", () => {
    const drawing = wrap("<g/>");
    const result = sanitizeDrawing(drawing, {
      ...policy,
      maxBytes: drawing.length - 1,
    });
    expect(result).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("count bytes, not characters", () => {
    const drawing = wrap("<g/>");
    // Multi-byte text is refused as a character problem, but the size check comes first and counts bytes.
    const wide = drawing.replace("<g/>", '<g id="é"/>');
    const exactBytes = new TextEncoder().encode(wide).length;
    expect(
      sanitizeDrawing(wide, { ...policy, maxBytes: exactBytes - 1 }),
    ).toMatchObject({ reason: "too-large" });
    expect(
      sanitizeDrawing(wide, { ...policy, maxBytes: exactBytes }),
    ).toMatchObject({ reason: "forbidden-character" });
  });

  it("refuse too many elements, at the limit and one over", () => {
    const body = (count: number) => "<g/>".repeat(count - 1);
    expect(
      sanitizeDrawing(wrap(body(5)), { ...policy, maxElements: 5 }).ok,
    ).toBe(true);
    expect(
      sanitizeDrawing(wrap(body(6)), { ...policy, maxElements: 5 }),
    ).toMatchObject({
      ok: false,
      reason: "too-complex",
    });
  });

  it("refuse nesting deeper than the limit, at the limit and one over", () => {
    const nested = (levels: number) =>
      "<g>".repeat(levels) + "</g>".repeat(levels);
    expect(
      sanitizeDrawing(wrap(nested(3)), { ...policy, maxDepth: 4 }).ok,
    ).toBe(true);
    expect(
      sanitizeDrawing(wrap(nested(4)), { ...policy, maxDepth: 4 }),
    ).toMatchObject({
      ok: false,
      reason: "too-complex",
    });
  });

  it("refuse an attribute value longer than the limit, at the limit and one over", () => {
    // The root's namespace is 26 characters, so the limit under test must be above that.
    const path = (length: number) =>
      wrap(`<path d="M${"0".repeat(length - 1)}"/>`);
    expect(
      sanitizeDrawing(path(30), { ...policy, maxAttributeLength: 30 }).ok,
    ).toBe(true);
    expect(
      sanitizeDrawing(path(31), { ...policy, maxAttributeLength: 30 }),
    ).toMatchObject({
      ok: false,
      reason: "too-complex",
    });
  });

  it("refuse a drawing that is within the limit but grows when cleaned", () => {
    // A self-closed root is written out with a closing tag, so the cleaned form is longer than what was sent.
    const selfClosed = `<svg xmlns="${ns}" viewBox="0 0 10 10"/>`;
    const limit = { ...policy, maxBytes: selfClosed.length };
    expect(sanitizeDrawing(selfClosed, limit)).toMatchObject({
      ok: false,
      reason: "too-large",
    });
    expect(
      sanitizeDrawing(selfClosed, { ...limit, maxBytes: selfClosed.length + 6 })
        .ok,
    ).toBe(true);
  });

  it("is built with positive whole limits", () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      for (const key of [
        "maxAttributeLength",
        "maxBytes",
        "maxDepth",
        "maxElements",
      ] as const) {
        expect(() =>
          sanitizeDrawing(wrap("<g/>"), { ...policy, [key]: bad }),
        ).toThrow(key);
      }
    }
  });
});
