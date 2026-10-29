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
});
