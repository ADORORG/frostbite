// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { HomeShelf, ShelfTile } from "../src/patterns/home-shelf.tsx";
import { show } from "./support/render.tsx";

afterEach(() => document.body.replaceChildren());

const shelf = () => (
  <HomeShelf
    href="/collections"
    id="collections"
    linkLabel="See all 2 collections"
    title="Collections"
  >
    <ShelfTile
      href="/collections/a"
      label="View Alpha"
      media={<i data-testid="picture" />}
      meta="3 of 100 items"
      title="Alpha"
    />
    <ShelfTile
      href="/collections/b"
      label="View Beta"
      media={<i />}
      meta="1 of 5 items"
      title="Beta"
    />
  </HomeShelf>
);

describe("a slim landing page row", () => {
  it("is a named region with the link to the full list beside its title", async () => {
    const container = await show(shelf());
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-labelledby")).toBe(
      container.querySelector("h2")?.id,
    );
    expect(container.querySelector("h2")?.textContent).toBe("Collections");
    const link = container.querySelector(".home-shelf__head a");
    expect(link?.getAttribute("href")).toBe("/collections");
    expect(link?.textContent).toBe("See all 2 collections");
  });

  it("lists one tile for each thing, each a single link named for it with its picture, name and line", async () => {
    const container = await show(shelf());
    const tiles = [...container.querySelectorAll("li > a")];
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual([
      "/collections/a",
      "/collections/b",
    ]);
    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
      "View Alpha",
      "View Beta",
    ]);
    expect(tiles[0]?.querySelector('[data-testid="picture"]')).not.toBeNull();
    expect(tiles[0]?.querySelector("b")?.textContent).toBe("Alpha");
    expect(tiles[0]?.querySelector("small")?.textContent).toBe(
      "3 of 100 items",
    );
  });
});
