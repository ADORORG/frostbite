import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ArcadeActionButton,
  ArcadeBadge,
  ArcadeButton,
  ArcadeProgress,
} from "../src/arcade.js";

describe("arcade link button", () => {
  it("names a link on its own when the visible words repeat, and adds no label otherwise", () => {
    const named = renderToStaticMarkup(
      <ArcadeButton ariaLabel="Continue: First light" href="/a">
        Continue
      </ArcadeButton>,
    );
    expect(named).toContain('aria-label="Continue: First light"');
    expect(named).toContain(">Continue</a>");
    expect(
      renderToStaticMarkup(<ArcadeButton href="/a">Continue</ArcadeButton>),
    ).not.toContain("aria-label");
  });
});

describe("arcade action button", () => {
  it("renders a real button with the arcade look, defaulting to a non-submitting cyan button", () => {
    const markup = renderToStaticMarkup(
      <ArcadeActionButton>Retry</ArcadeActionButton>,
    );
    expect(markup).toContain("<button");
    expect(markup).toContain('type="button"');
    expect(markup).toContain("arcade-button arcade-button--cyan");
    expect(markup).not.toContain("disabled");
  });

  it("supports tone, submit type, and disabled", () => {
    const markup = renderToStaticMarkup(
      <ArcadeActionButton disabled tone="red" type="submit">
        Go
      </ArcadeActionButton>,
    );
    expect(markup).toContain('type="submit"');
    expect(markup).toContain("arcade-button--red");
    expect(markup).toContain("disabled");
  });
});

describe("arcade progress", () => {
  it("exposes an accessible progress element and the percentage as text", () => {
    const markup = renderToStaticMarkup(
      <ArcadeProgress label="Uploading" value={0.426} />,
    );
    expect(markup).toContain('aria-label="Uploading"');
    expect(markup).toContain('value="43"');
    expect(markup).toContain('max="100"');
    expect(markup).toContain(">43%<");
  });

  it.each([
    [-1, "0"],
    [0, "0"],
    [1, "100"],
    [7, "100"],
  ])("clamps %s to %s percent", (value, percent) => {
    expect(
      renderToStaticMarkup(<ArcadeProgress label="x" value={value} />),
    ).toContain(`value="${percent}"`);
  });
});

describe("arcade badge", () => {
  it("renders a toned inline label with no live-region role", () => {
    const markup = renderToStaticMarkup(
      <ArcadeBadge tone="mint">Ready</ArcadeBadge>,
    );
    expect(markup).toContain("arcade-badge--mint");
    expect(markup).toContain("Ready");
    expect(markup).not.toContain("role=");
    expect(renderToStaticMarkup(<ArcadeBadge>x</ArcadeBadge>)).toContain(
      "arcade-badge--cyan",
    );
  });
});
