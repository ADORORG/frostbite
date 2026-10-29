import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ConsoleCard,
  ConsolePage,
  ConsoleRow,
  productName,
} from "../src/arcade.ts";

const page = (props: Partial<Parameters<typeof ConsolePage>[0]> = {}) =>
  renderToStaticMarkup(
    <ConsolePage
      eyebrow="Player profile"
      heading="Account"
      intro="Every way in."
      navigation={[]}
      {...props}
    >
      <p>body</p>
    </ConsolePage>,
  );

describe("the console page", () => {
  it("opens with the header: what the page is, in one line, and the live-session lamp when there is one", () => {
    const markup = page({ status: { label: "Signed in", tone: "ready" } });
    expect(markup).toContain("Player profile");
    expect(markup).toContain("<h1>Account</h1>");
    expect(markup).toContain("Every way in.");
    expect(markup).toContain("Signed in");
    expect(page()).not.toContain("status-lamp");
  });

  it("draws a picture from the seed it is given, and none without one", () => {
    expect(page({ avatarSeed: "account-1" })).toContain(
      "console-hero__picture",
    );
    expect(page()).not.toContain("console-hero__picture");
  });

  it("names the platform in the footer", () => {
    expect(page()).toContain(`<span>${productName}</span>`);
  });
});

describe("the console card", () => {
  const card = (props: Partial<Parameters<typeof ConsoleCard>[0]> = {}) =>
    renderToStaticMarkup(
      <ConsoleCard glyph="◈" title="Wallets" {...props}>
        <p>inside</p>
      </ConsoleCard>,
    );

  it("shows its title, its contents, and a count only when there is one worth showing, which is read out", () => {
    expect(card()).toContain("<h2>Wallets</h2>");
    expect(card()).toContain("inside");
    expect(card()).not.toContain("console-card__count");
    expect(card({ count: 0 })).toContain('aria-label="0 in total"');
    expect(card({ count: 3 })).toContain('aria-label="3 in total"');
  });

  it("hides its symbol from assistive technology, says what it is for when told, and can take the whole row", () => {
    expect(card()).toContain('aria-hidden="true"');
    expect(card({ lead: "What it is for." })).toContain("What it is for.");
    expect(card()).not.toContain("data-wide");
    expect(card({ wide: true })).toContain('data-wide="true"');
  });
});

describe("a row of a card's list", () => {
  it("shows its name, and its detail, picture and action only when it has them", () => {
    const bare = renderToStaticMarkup(
      <ul>
        <ConsoleRow name="ada" />
      </ul>,
    );
    expect(bare).toContain("ada");
    expect(bare).not.toMatch(/console-row__(detail|leading|action)/u);
    const full = renderToStaticMarkup(
      <ul>
        <ConsoleRow
          action={<button>Remove</button>}
          detail="Signet"
          leading={<i>i</i>}
          name="ada"
        />
      </ul>,
    );
    expect(full).toContain("Signet");
    expect(full).toContain("Remove");
    expect(full).toContain("console-row__leading");
  });
});
