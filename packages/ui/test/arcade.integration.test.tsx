import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell, ArcadeButton, ArcadePanel } from "../src/arcade.js";

describe("arcade panel composition", () => {
  it("preserves its heading and nested interactive content", () => {
    const markup = renderToStaticMarkup(
      <ArcadePanel eyebrow="System status" title="The Well">
        <ArcadeButton href="#launches" tone="yellow">
          Launches
        </ArcadeButton>
      </ArcadePanel>,
    );

    expect(markup).toContain("<article");
    expect(markup).toContain("<h2>The Well</h2>");
    expect(markup).toContain("arcade-button--yellow");
  });

  it("keeps navigation and a skip target available in the shared shell", () => {
    const markup = renderToStaticMarkup(
      <AppShell
        brand="Test arcade"
        footerLabel="Test foundation"
        homeHref="#top"
        navigation={[{ area: "main", href: "#launches", label: "Launches" }]}
      >
        <h1>Home</h1>
      </AppShell>,
    );

    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain('aria-label="Primary navigation"');
    expect(markup).toContain('aria-label="Test arcade home"');
    expect(markup).toContain('href="#launches"');
    expect(markup).not.toContain("Platform status");
    expect(markup).toContain("Test foundation");
  });
});
