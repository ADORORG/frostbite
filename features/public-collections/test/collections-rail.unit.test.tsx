import { ScenesProvider } from "@ador/scenes/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PublicCard } from "../src/application/public-model.ts";
import { homeRailCopy } from "../src/domain-copy.ts";
import { CollectionsRail } from "../src/ui/collections-rail.tsx";
import { collectionsUnavailable, noCollections } from "../src/ui/states.tsx";

const card = (n: number, withCover: boolean): PublicCard => ({
  chainLabel: "Bitcoin signet",
  cover: withCover
    ? {
        alt: `Cover ${String(n)}`,
        height: 100,
        src: `https://img.test/${String(n)}.webp`,
        width: 100,
      }
    : null,
  description: `About ${String(n)}`,
  id: `0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f0${String(n)}`,
  itemCount: n,
  name: `Collection ${String(n)}`,
  plannedSupply: 1000,
});
const show = (cards: readonly PublicCard[] | null) =>
  renderToStaticMarkup(
    <ScenesProvider>
      <CollectionsRail cards={cards} />
    </ScenesProvider>,
  );

describe("the rail of collections", () => {
  it("shows no more than the rail holds, and says how many there are in all", () => {
    const cards = Array.from({ length: 9 }, (_, at) => card(at + 1, true));
    const markup = show(cards);
    expect(markup.match(/class="cover-card"/gu)).toHaveLength(6);
    expect(markup).toContain(homeRailCopy.link(9));
    expect(markup).toContain("Collection 6");
    expect(markup).not.toContain("Collection 7");
  });

  it("lays a scene over a collection with no picture of its own, and leaves one with a picture uncovered", () => {
    expect(show([card(1, true)])).not.toContain("scene-overlay");
    expect(show([card(1, false)])).toContain("scene-overlay");
    expect(
      show([card(1, false), card(2, true)]).match(/class="scene-overlay/gu),
    ).toHaveLength(1);
  });

  it("sits over a moving background", () => {
    expect(show([card(1, true)])).toContain("scene-backdrop");
  });

  it("says there are none, in the catalog's own words", () => {
    const markup = show([]);
    expect(markup).toContain(noCollections.title);
    expect(markup).toContain(homeRailCopy.link(0));
    expect(markup).not.toContain("cover-grid");
  });

  it("says it could not read the catalog, and does not call that empty", () => {
    const markup = show(null);
    expect(markup).toContain(collectionsUnavailable.title);
    expect(markup).toContain("Catalog unavailable");
    expect(markup).toContain(homeRailCopy.link(0));
    expect(markup).not.toContain(noCollections.title);
  });

  it("never says there are none in its link, and says the number once there are several", () => {
    expect(homeRailCopy.link(0)).toBe("See all collections");
    expect(homeRailCopy.link(1)).toBe("See all collections");
    expect(homeRailCopy.link(9)).toBe("See all 9 collections");
  });

  it("uses a scene at full strength as the picture of a collection that has none, with no initials and no missing-preview note", () => {
    const markup = show([card(1, false)]);
    expect(markup).toContain("scene-overlay--art");
    expect(markup).not.toContain("Preview unavailable");
    expect(markup).not.toMatch(/arcade-preview__stand-in[^>]*>[A-Z]{1,2}</u);
    expect(show([card(1, true)])).not.toContain("scene-overlay");
  });

  it("draws every card wide and compact", () => {
    const markup = show([card(1, true), card(2, false)]);
    expect(markup).not.toContain('data-ratio="square"');
    expect(markup).not.toContain("data-featured");
  });
});
