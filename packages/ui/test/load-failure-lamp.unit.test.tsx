import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoadFailureLamp } from "../src/arcade.ts";

describe("the lamp for a list that failed to load", () => {
  it("says what could not be loaded when there is nothing earlier to show", () => {
    const markup = renderToStaticMarkup(
      <LoadFailureLamp hasEarlier={false} subject="Your collections" />,
    );
    expect(markup).toContain("Your collections could not be loaded.");
    expect(markup).toContain("status-lamp--unavailable");
  });

  it("says it could not refresh, and that the earlier answer is still shown, when there is one", () => {
    const markup = renderToStaticMarkup(
      <LoadFailureLamp hasEarlier subject="Your collections" />,
    );
    expect(markup).toContain(
      "Could not refresh. Showing what was loaded earlier.",
    );
    expect(markup).not.toContain("Your collections");
  });
});
