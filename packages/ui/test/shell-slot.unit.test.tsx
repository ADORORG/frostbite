import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell, ShellSlotsProvider } from "../src/arcade.ts";

const shell = (
  <AppShell
    brand="Test arcade"
    footerLabel="Test foundation"
    homeHref="#top"
    navigation={[{ area: "main", href: "#launches", label: "Launches" }]}
    notices={["Foundation in progress"]}
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
