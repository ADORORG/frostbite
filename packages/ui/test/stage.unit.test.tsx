import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArcadeInfoCard, ArcadeInfoRow, ArcadeStage } from "../src/arcade.ts";

describe("the stage pattern", () => {
  it("holds the bar above the stage, and draws an overlay only when there is one", () => {
    const plain = renderToStaticMarkup(
      <ArcadeStage bar={<b>controls</b>}>
        <i>screen</i>
      </ArcadeStage>,
    );
    expect(plain.indexOf("controls")).toBeLessThan(plain.indexOf("screen"));
    expect(plain).toContain('class="arcade-stage__bar"');
    expect(plain).not.toContain("arcade-stage__overlay");
    const over = renderToStaticMarkup(
      <ArcadeStage bar="b" overlay={<u>toast</u>}>
        s
      </ArcadeStage>,
    );
    expect(over).toContain('class="arcade-stage__overlay"><u>toast</u>');
  });

  it("makes small named cards in a row", () => {
    const markup = renderToStaticMarkup(
      <ArcadeInfoRow>
        <ArcadeInfoCard title="About">text</ArcadeInfoCard>
      </ArcadeInfoRow>,
    );
    expect(markup).toContain('class="arcade-info-row"');
    expect(markup).toContain('aria-label="About"');
    expect(markup).toContain(
      '<h3 class="arcade-info-card__title">About</h3>text',
    );
  });
});
