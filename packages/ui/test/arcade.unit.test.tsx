import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccessState, ArcadeButton, StatusLamp } from "../src/arcade.js";

describe("arcade controls", () => {
  it("renders an anchor with its requested tone and destination", () => {
    const markup = renderToStaticMarkup(
      <ArcadeButton href="#games" tone="cyan">
        Games
      </ArcadeButton>,
    );

    expect(markup).toContain('href="#games"');
    expect(markup).toContain("arcade-button--cyan");
    expect(markup).toContain("Games");
  });

  it("keeps the decorative lamp hidden from assistive technology", () => {
    const markup = renderToStaticMarkup(<StatusLamp label="Building" />);

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("status-lamp--attention");
    expect(markup).toContain("Building");
  });

  it.each([
    ["ready", "status-lamp--ready"],
    ["attention", "status-lamp--attention"],
    ["unavailable", "status-lamp--unavailable"],
    ["neutral", "status-lamp--neutral"],
  ] as const)("shows the %s tone as %s", (tone, className) => {
    expect(
      renderToStaticMarkup(<StatusLamp label="Chain" tone={tone} />),
    ).toContain(className);
  });

  it("is a plain lamp unless asked to be compact, and can be reached by keyboard only when it has a detail to give", () => {
    const plain = renderToStaticMarkup(<StatusLamp label="Chain" />);
    expect(plain).not.toContain("data-compact");
    expect(plain).not.toContain("tabindex");
    expect(plain).not.toContain("status-lamp__detail");
    const compact = renderToStaticMarkup(
      <StatusLamp compact detail="Block 5 of 9." label="Chain" tone="ready" />,
    );
    expect(compact).toContain('data-compact="true"');
    expect(compact).toContain('tabindex="0"');
    // The detail is in the markup, so it is read out with the label.
    expect(compact).toMatch(
      /<span class="status-lamp__detail">Block 5 of 9\.<\/span>/u,
    );
  });

  it.each([
    ["unauthenticated", "Authentication required"],
    ["forbidden", "Access denied"],
    ["unavailable", "Verification unavailable"],
  ] as const)("renders the %s protected-route state", (state, label) => {
    const markup = renderToStaticMarkup(<AccessState state={state} />);
    expect(markup).toContain(label);
    expect(markup).toContain("arcade-panel");
  });

  it("uses the protected route for an unavailable-state retry", () => {
    const markup = renderToStaticMarkup(
      <AccessState retryHref="/studio" state="unavailable" />,
    );

    expect(markup).toContain('href="/studio"');
  });
});
