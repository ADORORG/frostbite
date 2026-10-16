import { describe, expect, it } from "vitest";

import { sanitizeDrawing, type Refusal } from "../src/index.ts";
import { ns, policy, wrap } from "./support.ts";

// Each hostile or unsupported drawing, and why it is refused.
const cases: readonly (readonly [string, string, Refusal])[] = [
  ["empty", "", "missing-root"],
  ["only space", "   \n", "missing-root"],
  ["not an svg root", `<g xmlns="${ns}"/>`, "missing-root"],
  ["no namespace", '<svg viewBox="0 0 1 1"/>', "bad-value"],
  [
    "wrong namespace",
    '<svg xmlns="http://evil.test/" viewBox="0 0 1 1"/>',
    "bad-value",
  ],
  ["no viewBox", `<svg xmlns="${ns}"/>`, "bad-value"],
  ["zero-size viewBox", wrap("", ' viewBox="0 0 0 5"'), "bad-value"],
  ["viewBox with three numbers", wrap("", ' viewBox="0 0 5"'), "bad-value"],
  ["script", wrap("<script/>"), "unknown-element"],
  ["script with text", wrap("<script>alert(1)</script>"), "malformed"],
  ["foreignObject", wrap("<foreignObject/>"), "unknown-element"],
  ["image", wrap('<image href="data:,x"/>'), "unknown-element"],
  ["use", wrap('<use href="#a"/>'), "unknown-element"],
  ["style", wrap("<style/>"), "unknown-element"],
  ["animation", wrap('<animate attributeName="x"/>'), "unknown-element"],
  ["text", wrap("<text/>"), "unknown-element"],
  ["a nested svg", wrap("<svg/>"), "unknown-element"],
  ["event handler", wrap('<rect onload="alert(1)"/>'), "unknown-attribute"],
  ["style attribute", wrap('<rect style="fill:red"/>'), "unknown-attribute"],
  [
    "href attribute",
    wrap('<rect href="http://evil.test"/>'),
    "unknown-attribute",
  ],
  ["namespaced attribute", wrap('<rect xlink:href="#a"/>'), "malformed"],
  ["xmlns off the root", wrap(`<g xmlns="${ns}"/>`), "bad-value"],
  [
    "javascript in a paint",
    wrap('<rect fill="javascript:alert(1)"/>'),
    "bad-value",
  ],
  [
    "external url",
    wrap('<rect fill="url(http://evil.test/a#b)"/>'),
    "bad-value",
  ],
  ["named colour", wrap('<rect fill="red"/>'), "bad-value"],
  ["short hex colour with junk", wrap('<rect fill="#12345"/>'), "bad-value"],
  ["opacity above one", wrap('<rect opacity="1.5"/>'), "bad-value"],
  ["a length with units", wrap('<rect width="5px"/>'), "bad-value"],
  [
    "path data with a script-like word",
    wrap('<path d="M0 0 alert(1)"/>'),
    "bad-value",
  ],
  [
    "transform with a function call",
    wrap('<g transform="translate(1) alert(1)"/>'),
    "bad-value",
  ],
  ["a bad linecap", wrap('<path stroke-linecap="arrow"/>'), "bad-value"],
  ["a bad id", wrap('<g id="1bad"/>'), "bad-value"],
  [
    "a bad preserveAspectRatio",
    wrap("<g/>", ' viewBox="0 0 1 1" preserveAspectRatio="stretch"'),
    "bad-value",
  ],
  [
    "a reference to nothing",
    wrap('<rect fill="url(#nope)"/>'),
    "bad-reference",
  ],
  ["two elements with one id", wrap('<g id="a"/><g id="a"/>'), "bad-reference"],
  ["a comment", wrap("<!-- hi -->"), "forbidden-markup"],
  ["CDATA", wrap("<![CDATA[x]]>"), "forbidden-markup"],
  ["a doctype", `<!DOCTYPE svg>${wrap("")}`, "forbidden-markup"],
  [
    "a processing instruction",
    `<?xml version="1.0"?>${wrap("")}`,
    "forbidden-markup",
  ],
  ["an entity", wrap('<rect fill="&amp;"/>'), "forbidden-markup"],
  [
    "a character outside printable ASCII",
    wrap('<g id="é"/>'),
    "forbidden-character",
  ],
  ["a control character", wrap("<g/>\u0001"), "forbidden-character"],
  ["the delete character", wrap("<g/>\u007f"), "forbidden-character"],
  ["opacity of two", wrap('<rect opacity="2"/>'), "bad-value"],
  ["a viewBox with no height", wrap("<g/>", ' viewBox="0 0 5 0"'), "bad-value"],
  [
    "a viewBox with five numbers",
    wrap("<g/>", ' viewBox="0 0 5 5 5"'),
    "bad-value",
  ],
  ["an empty transform", wrap('<g transform=""/>'), "bad-value"],
  [
    "a stop colour that is a reference",
    wrap(
      '<linearGradient id="g"><stop stop-color="url(#g)"/></linearGradient>',
    ),
    "bad-value",
  ],
  ["a skipped character after a close", wrap("<g></g!<rect/>"), "malformed"],
  ["text between elements", wrap("hello"), "malformed"],
  ["an unquoted attribute", wrap("<g id=a/>"), "malformed"],
  ["an unclosed attribute", wrap('<g id="a/>'), "malformed"],
  ["an attribute without a value", wrap("<g id/>"), "malformed"],
  ["a repeated attribute", wrap('<g id="a" id="b"/>'), "malformed"],
  ["a less-than in a value", wrap('<g id="a<b"/>'), "malformed"],
  ["a bad attribute name", wrap('<g 1="a"/>'), "malformed"],
  ["a bad element name", wrap("<1/>"), "malformed"],
  [
    "an unclosed element",
    `<svg xmlns="${ns}" viewBox="0 0 1 1"><g>`,
    "malformed",
  ],
  ["a mismatched close", wrap("<g></rect>"), "malformed"],
  ["a close without the bracket", wrap("<g></g"), "malformed"],
  ["content after the root", `${wrap("")}<g/>`, "malformed"],
  ["a second root", `${wrap("")}${wrap("")}`, "malformed"],
];

// What a person is told, for the refusals whose code alone would not say which rule was broken.
const details: readonly (readonly [string, string, string])[] = [
  [
    "an element never closed",
    `<svg xmlns="${ns}" viewBox="0 0 1 1"><g>`,
    "never closed",
  ],
  ["an unquoted attribute", wrap("<g id=a/>"), "not quoted"],
  ["an attribute without a value", wrap("<g id/>"), "has no value"],
  ["text between elements", wrap("hello"), "Text is not allowed"],
  ["a mismatched close", wrap("<g></rect>"), "closed by something else"],
  ["content after the root", `${wrap("")}<g/>`, "after the drawing"],
  ["a repeated attribute", wrap('<g id="a" id="b"/>'), "repeated"],
];

describe("what the refusal says", () => {
  it.each(details)("%s", (_name, drawing, words) => {
    const result = sanitizeDrawing(drawing, policy);
    expect(!result.ok && result.detail).toContain(words);
  });
});

describe("a drawing outside the allow-list", () => {
  it.each(cases)("is refused: %s", (_name, drawing, reason) => {
    const result = sanitizeDrawing(drawing, policy);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe(reason);
    expect(!result.ok && result.detail.length).toBeGreaterThan(0);
  });
});
