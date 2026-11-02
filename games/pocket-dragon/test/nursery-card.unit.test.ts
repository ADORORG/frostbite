// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startNursery } from "../src/bonus/nursery.ts";
import { createCardPanel } from "../src/page/card-panel.ts";
import { element } from "../src/page/elements.ts";
import { surface } from "./support/canvas.ts";
import { facts } from "./support/card-facts.ts";

const page = readFileSync(join(import.meta.dirname, "../index.html"), "utf8");
const click = (target: Element | null | undefined) =>
  target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/u.exec(page)?.[1] ?? "";
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    surface().context,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,AAAA",
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
    done(new Blob(["png"], { type: "image/png" })),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("the Sky Nursery's cards in the card panel", () => {
  it("offers the dragon family, the sky art and the dance party, each drawn when picked, and the player's card again after", () => {
    const panel = createCardPanel(() => undefined);
    const visit = { ...startNursery(2), dragons: [{ look: 1, name: "PIP" }] };
    panel.openNursery(visit);
    const kinds = element("card-kinds", "div");
    const image = element("card-image", "img");
    expect(kinds.hidden).toBe(false);
    expect(element("card-link-row", "div").hidden).toBe(true);
    expect(image.alt).toContain("MY DRAGON FAMILY");
    expect(document.activeElement?.getAttribute("data-kind")).toBe("family");
    click(kinds.querySelector('[data-kind="art"]'));
    expect(image.alt).toContain("SKY ART BY GLITCHY");
    expect(
      kinds.querySelector('[data-kind="art"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    click(kinds.querySelector('[data-kind="dance"]'));
    expect(image.alt).toContain("DANCE PARTY");
    panel.update(facts);
    expect(image.alt).toContain("DANCE PARTY");
    panel.close();
    panel.open(facts);
    expect(kinds.hidden).toBe(true);
    expect(image.alt).toContain("I cleared Egg Hills");
  });
});
