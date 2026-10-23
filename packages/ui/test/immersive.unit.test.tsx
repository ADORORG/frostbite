import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell } from "../src/patterns/app-shell.tsx";
import { ArcadeStage } from "../src/patterns/stage.tsx";

const shell = (immersive?: boolean) =>
  renderToStaticMarkup(
    <AppShell
      brand="Test"
      footerLabel="Footer"
      homeHref="/"
      navigation={[]}
      notices={["Notice"]}
      {...(immersive === undefined ? {} : { immersive })}
    >
      <p>Page</p>
    </AppShell>,
  );

describe("a page that is one thing to play", () => {
  it("is marked immersive, so the notices strip above the header can give up its room", () => {
    expect(shell(true)).toContain('data-immersive="true"');
  });

  it("is not marked on an ordinary page, which keeps its notices", () => {
    expect(shell()).not.toContain("data-immersive");
    expect(shell(false)).not.toContain("data-immersive");
    expect(shell()).toContain("arcade-marquee");
  });
});

describe("the stage", () => {
  const stage = (theatre?: boolean) =>
    renderToStaticMarkup(
      <ArcadeStage
        bar={<span>bar</span>}
        {...(theatre === undefined ? {} : { theatre })}
      >
        <iframe title="game" />
      </ArcadeStage>,
    );

  it("covers the whole window only when theatre is on", () => {
    expect(stage(true)).toContain('data-theatre="true"');
    expect(stage()).not.toContain("data-theatre");
    expect(stage(false)).not.toContain("data-theatre");
  });

  it("puts the bar above the game, and the game in the screen", () => {
    const markup = stage();
    expect(markup.indexOf("arcade-stage__bar")).toBeLessThan(
      markup.indexOf("arcade-stage__screen"),
    );
    expect(markup).toContain("<iframe");
  });
});
