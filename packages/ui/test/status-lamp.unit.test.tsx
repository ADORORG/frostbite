import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusLamp } from "../src/arcade.ts";

describe("the status lamp", () => {
  it("says its label with the tone it was given, as a status", () => {
    const markup = renderToStaticMarkup(
      <StatusLamp label="Signed in" tone="ready" />,
    );
    expect(markup).toContain("status-lamp--ready");
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Signed in");
  });

  it("is a line in the body type only when the label is a sentence to read, and not otherwise", () => {
    const sentence = renderToStaticMarkup(
      <StatusLamp label="Changes are recorded." plain />,
    );
    expect(sentence).toContain('data-plain="true"');
    expect(renderToStaticMarkup(<StatusLamp label="Live" />)).not.toContain(
      "data-plain",
    );
  });
});
