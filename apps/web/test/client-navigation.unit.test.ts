// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { clientNavigationTarget } from "../src/client-navigation.ts";

const here = {
  href: "http://app.test/games?tab=a",
  origin: "http://app.test",
  pathname: "/games",
  search: "?tab=a",
};

// Clicks a link of this shape the way a browser delivers it: the event's target is the link (or something inside it).
function click(
  attributes: Record<string, string>,
  init: MouseEventInit = {},
  inner = false,
) {
  const anchor = document.createElement("a");
  for (const [name, value] of Object.entries(attributes))
    anchor.setAttribute(name, value);
  const child = document.createElement("span");
  anchor.append(child);
  document.body.append(anchor);
  let result: ReturnType<typeof clientNavigationTarget> = null;
  anchor.addEventListener("click", (event) => {
    result = clientNavigationTarget(event, here);
  });
  (inner ? child : anchor).dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
  );
  anchor.remove();
  return result;
}

describe("which link clicks the app navigates by itself", () => {
  it("takes an ordinary click on a link to another page, keeping its query and heading", () => {
    expect(click({ href: "/collections" })).toBe("/collections");
    expect(click({ href: "/games/example-game?x=1#dock" })).toBe(
      "/games/example-game?x=1#dock",
    );
    expect(click({ href: "http://app.test/creators" })).toBe("/creators");
    expect(click({ href: "/launches", target: "_self" })).toBe("/launches");
  });

  it("takes a click on something inside the link", () => {
    expect(click({ href: "/collections" }, {}, true)).toBe("/collections");
  });

  it("leaves a click that is not a plain left click to the browser", () => {
    for (const init of [
      { button: 1 },
      { button: 2 },
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
    ])
      expect(click({ href: "/collections" }, init)).toBeNull();
  });

  it("leaves a click already handled by someone else to them", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "/collections");
    document.body.append(anchor);
    let result: string | null = "unset";
    document.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
      capture: true,
    });
    anchor.addEventListener("click", (event) => {
      result = clientNavigationTarget(event, here);
    });
    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    anchor.remove();
    expect(result).toBeNull();
  });

  it("leaves links that open elsewhere, download, or leave the site to the browser", () => {
    expect(click({ href: "/collections", target: "_blank" })).toBeNull();
    expect(click({ href: "/collections", target: "other" })).toBeNull();
    expect(click({ href: "/collections", download: "" })).toBeNull();
    expect(
      click({ href: "/collections", rel: "noreferrer external" }),
    ).toBeNull();
    expect(click({ href: "https://elsewhere.test/collections" })).toBeNull();
    expect(click({ href: "http://app.test:8080/collections" })).toBeNull();
  });

  it("leaves paths that are not pages to the browser", () => {
    expect(click({ href: "/api/v1/auth/methods" })).toBeNull();
    expect(click({ href: "/play/example-game/index.html" })).toBeNull();
    // A page whose name merely starts like one is still a page.
    expect(click({ href: "/playground" })).toBe("/playground");
    expect(click({ href: "/apiary" })).toBe("/apiary");
  });

  it("leaves a jump within the current page to the browser", () => {
    expect(click({ href: "#main-content" })).toBeNull();
    expect(click({ href: "/games?tab=a#dock" })).toBeNull();
    expect(click({ href: "/games?tab=a" })).toBeNull();
    // The same path with another query is another page.
    expect(click({ href: "/games?tab=b" })).toBe("/games?tab=b");
  });

  it("ignores a click that is not on a link at all", () => {
    const text = document.createElement("p");
    document.body.append(text);
    let result: string | null = "unset";
    text.addEventListener("click", (event) => {
      result = clientNavigationTarget(event, here);
    });
    text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    text.remove();
    expect(result).toBeNull();
    const bare = document.createElement("a");
    bare.addEventListener("click", (event) => {
      result = clientNavigationTarget(event, here);
    });
    bare.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(result).toBeNull();
  });
});
