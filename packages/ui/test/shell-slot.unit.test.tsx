import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AppShell,
  ShellSlotsProvider,
  ShellStatusProvider,
} from "../src/arcade.ts";

const shell = (
  <AppShell
    brand="Test arcade"
    footerLabel="Test foundation"
    homeHref="#top"
    navigation={[{ area: "main", href: "#launches", label: "Launches" }]}
  >
    <h1>Home</h1>
  </AppShell>
);

describe("the header slot", () => {
  it("puts what the app supplies at the end of the header, after the navigation", () => {
    const markup = renderToStaticMarkup(
      <ShellSlotsProvider headerEnd={<button type="button">Wallet</button>}>
        {shell}
      </ShellSlotsProvider>,
    );
    const header = markup.slice(
      markup.indexOf("<header"),
      markup.indexOf("</header>"),
    );
    expect(header).toContain('<div class="app-header__end">');
    expect(header.indexOf("</nav>")).toBeLessThan(
      header.indexOf("app-header__end"),
    );
    expect(header).toContain("Wallet");
  });

  it("adds nothing when the app supplies nothing", () => {
    expect(renderToStaticMarkup(shell)).not.toContain("app-header__end");
    expect(
      renderToStaticMarkup(
        <ShellSlotsProvider headerEnd={null}>{shell}</ShellSlotsProvider>,
      ),
    ).not.toContain("app-header__end");
  });
});

describe("the header status slot", () => {
  const header = (markup: string) =>
    markup.slice(markup.indexOf("<header"), markup.indexOf("</header>"));

  it("puts what the app supplies in the header after the navigation and before the end slot", () => {
    const markup = renderToStaticMarkup(
      <ShellStatusProvider status={<p>Chain in sync</p>}>
        <ShellSlotsProvider headerEnd={<button type="button">Wallet</button>}>
          {shell}
        </ShellSlotsProvider>
      </ShellStatusProvider>,
    );
    const bar = header(markup);
    expect(bar).toContain('<div class="app-header__status">');
    expect(bar.indexOf("</nav>")).toBeLessThan(
      bar.indexOf("app-header__status"),
    );
    expect(bar.indexOf("app-header__status")).toBeLessThan(
      bar.indexOf("app-header__end"),
    );
    expect(bar).toContain("Chain in sync");
  });

  it("adds nothing when the app supplies nothing, and does not need the end slot", () => {
    expect(renderToStaticMarkup(shell)).not.toContain("app-header__status");
    expect(
      renderToStaticMarkup(
        <ShellStatusProvider status={null}>{shell}</ShellStatusProvider>,
      ),
    ).not.toContain("app-header__status");
    const alone = renderToStaticMarkup(
      <ShellStatusProvider status={<p>Chain in sync</p>}>
        {shell}
      </ShellStatusProvider>,
    );
    expect(alone).toContain("app-header__status");
    expect(alone).not.toContain("app-header__end");
  });
});
