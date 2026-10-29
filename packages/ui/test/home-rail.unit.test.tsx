// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { HomeRail } from "../src/patterns/home-rail.tsx";
import { show } from "./support/render.tsx";

afterEach(() => document.body.replaceChildren());

const rail = (backdrop?: React.ReactNode) => (
  <HomeRail
    backdrop={backdrop}
    href="/games"
    id="games"
    linkLabel="See all games"
    summary="Play in the browser."
    title="Games"
  >
    <p data-testid="inside">cards</p>
  </HomeRail>
);

describe("a landing page rail", () => {
  it("is a named region: the title labels the section, and the link goes to the full list", async () => {
    const container = await show(rail());
    const section = container.querySelector("section");
    expect(section?.getAttribute("id")).toBe("games");
    const heading = container.querySelector("h2");
    expect(section?.getAttribute("aria-labelledby")).toBe(heading?.id);
    expect(heading?.textContent).toBe("Games");
    expect(container.textContent).toContain("Play in the browser.");
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/games");
    expect(link?.textContent).toBe("See all games");
  });

  it("holds what the feature puts inside it", async () => {
    const container = await show(rail());
    expect(container.querySelector('[data-testid="inside"]')?.textContent).toBe(
      "cards",
    );
  });

  it("puts a background behind it that screen readers skip, or none when there is none", async () => {
    const without = await show(rail());
    expect(without.querySelector(".home-rail__backdrop")).toBeNull();
    document.body.replaceChildren();
    const withBackdrop = await show(rail(<i data-testid="moving" />));
    const backdrop = withBackdrop.querySelector(".home-rail__backdrop");
    expect(backdrop?.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop?.querySelector('[data-testid="moving"]')).not.toBeNull();
  });

  it("leaves out the link when there is nothing behind it", async () => {
    const container = await show(
      <HomeRail href="/games" id="games" summary="Soon." title="Games">
        <p>cards</p>
      </HomeRail>,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Soon.");
  });
});

describe("a compact landing page rail", () => {
  const tile = (
    props: { backdrop?: React.ReactNode; linkLabel?: string } = {},
  ) => (
    <HomeRail
      {...props}
      compact
      href="/launches"
      id="launches"
      summary="Nothing is open."
      title="Launches"
    >
      <p data-testid="inside">cards</p>
    </HomeRail>
  );

  it("is a small named tile: a title and one line, and nothing else", async () => {
    const container = await show(tile());
    const section = container.querySelector("section");
    expect(section?.className).toContain("home-rail--compact");
    expect(section?.getAttribute("aria-labelledby")).toBe(
      container.querySelector("h2")?.id,
    );
    expect(container.querySelector("h2")?.textContent).toBe("Launches");
    expect(container.querySelector("p")?.textContent).toBe("Nothing is open.");
    expect(container.querySelector("a")).toBeNull();
  });

  it("takes no background and no cards, because it has nothing to show", async () => {
    const container = await show(
      tile({ backdrop: <i data-testid="moving" /> }),
    );
    expect(container.querySelector(".home-rail__backdrop")).toBeNull();
    expect(container.querySelector('[data-testid="moving"]')).toBeNull();
    expect(container.querySelector('[data-testid="inside"]')).toBeNull();
  });

  it("links to the full list only when it is given a label", async () => {
    const container = await show(tile({ linkLabel: "See all launches" }));
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/launches");
    expect(link?.textContent).toBe("See all launches");
  });
});
