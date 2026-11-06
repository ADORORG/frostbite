// @vitest-environment jsdom

import { ScenesProvider } from "@frostbite/scenes/react";
import {
  button,
  click,
  fieldByLabel,
  installReactTestEnvironment,
  mount,
  textOf,
  typeInto,
} from "@frostbite/test-kit/dom";
import { act, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { emptyGameQuery, type GameQuery } from "../src/domain/game-query.ts";
import { searchCopy } from "../src/domain/search-copy.ts";
import { GamesBrowser } from "../src/ui/games-browser.tsx";
import { shelf } from "./support/search-games.ts";

// Stands in for the server drawing the page afresh: pressing the button hands the browser a new `initial`, as a navigation does.
function Navigating({ to }: { readonly to: GameQuery }) {
  const [initial, setInitial] = useState<GameQuery>(emptyGameQuery);
  return (
    <ScenesProvider>
      <button onClick={() => setInitial({ ...to })} type="button">
        navigate
      </button>
      <GamesBrowser games={shelf} initial={initial} />
    </ScenesProvider>
  );
}

const browser = (initial: GameQuery = emptyGameQuery) =>
  mount(
    <ScenesProvider>
      <GamesBrowser games={shelf} initial={initial} />
    </ScenesProvider>,
  );

const cards = (container: HTMLElement) =>
  container.querySelectorAll(".cover-card");
const box = (container: HTMLElement) =>
  fieldByLabel(container, searchCopy.fieldLabel);
const status = (container: HTMLElement) =>
  container.querySelector('[role="status"]')?.textContent;
const press = (target: Element | Document, init: KeyboardEventInit) =>
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
const toggle = (container: HTMLElement, label: string) => {
  const chip = [...container.querySelectorAll("button[aria-pressed]")].find(
    (each) => each.textContent?.startsWith(label),
  );
  if (chip === undefined) throw new Error(`no filter "${label}"`);
  return chip;
};

// This feature's setup does not unmount trees between tests; the page listens on the document, so each test needs its own clean one.
installReactTestEnvironment();
afterEach(() => {
  window.history.replaceState(null, "", "/games");
});

describe("searching the games page", () => {
  it("shows every game, each with its place, before anything is asked", async () => {
    const container = await browser();
    expect(cards(container)).toHaveLength(shelf.length);
    expect(container.querySelector("[data-featured='true']")).not.toBeNull();
    expect(container.querySelector("h2")?.textContent).toContain(
      String(shelf.length),
    );
    expect(status(container)).toBe("");
    expect(box(container).type).toBe("search");
  });

  it("narrows the wall as words are typed and says how many it found", async () => {
    const container = await browser();
    await typeInto(box(container), "puzzle");
    expect(cards(container)).toHaveLength(2);
    expect(container.querySelector("h2")?.textContent).toContain(
      `2 of ${String(shelf.length)}`,
    );
    expect(status(container)).toBe("2 games found");
    await typeInto(box(container), "shard");
    expect(cards(container)).toHaveLength(1);
    expect(status(container)).toBe("1 game found");
  });

  it("no longer promotes a first game or numbers the places once it is narrowed", async () => {
    const container = await browser();
    await typeInto(box(container), "puzzle");
    expect(container.querySelector("[data-featured='true']")).toBeNull();
    expect(container.querySelector(".cover-card__rank")).toBeNull();
  });

  it("puts what was typed in the address without adding to the history", async () => {
    const container = await browser();
    const before = window.history.length;
    await typeInto(box(container), "snow dash");
    expect(window.location.search).toBe("?q=snow+dash");
    await typeInto(box(container), "");
    expect(window.location.search).toBe("");
    expect(window.history.length).toBe(before);
  });

  it("opens already narrowed from an address, with the box filled in", async () => {
    const container = await browser({
      playable: false,
      tags: ["puzzle"],
      text: "ice",
    });
    expect(box(container).value).toBe("ice");
    expect(toggle(container, "Puzzle").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(cards(container)).toHaveLength(1);
    expect(textOf(container)).toContain("Icicle Drop");
  });

  it("takes the query of a page the server draws afresh, so a link pressed while narrowed shows what its address says", async () => {
    const container = await mount(<Navigating to={emptyGameQuery} />);
    await typeInto(box(container), "puzzle");
    expect(cards(container)).toHaveLength(2);
    await click(button(container, "navigate"));
    expect(box(container).value).toBe("");
    expect(cards(container)).toHaveLength(shelf.length);
  });

  it("leaves what was typed alone while the server has sent nothing new", async () => {
    const container = await mount(<Navigating to={emptyGameQuery} />);
    await typeInto(box(container), "puzzle");
    await typeInto(box(container), "puzzle d");
    expect(box(container).value).toBe("puzzle d");
    expect(cards(container)).toHaveLength(1);
  });

  it("treats a box of spaces as no search: nothing narrowed, nothing to clear", async () => {
    const container = await browser();
    await typeInto(box(container), "   ");
    expect(cards(container)).toHaveLength(shelf.length);
    expect(container.querySelector("[data-featured='true']")).not.toBeNull();
    expect(status(container)).toBe("");
    expect(button(container, searchCopy.clearAll)).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("filters by kind, any of those chosen, and by playable", async () => {
    const container = await browser();
    await click(toggle(container, "Puzzle"));
    expect(cards(container)).toHaveLength(2);
    expect(window.location.search).toBe("?tag=puzzle");
    await click(toggle(container, "Strategy"));
    expect(cards(container)).toHaveLength(4);
    // Kinds are written in the platform's order, not the order they were switched on.
    expect(window.location.search).toBe("?tag=puzzle&tag=strategy");
    await click(toggle(container, searchCopy.playableOnly));
    expect(cards(container)).toHaveLength(3);
    expect(textOf(container)).not.toContain("Icicle Drop");
    await click(toggle(container, "Puzzle"));
    expect(window.location.search).toBe("?tag=strategy&playable=1");
  });

  it("offers only the kinds some game has, each with how many", async () => {
    const container = await browser();
    expect(toggle(container, "Puzzle").textContent).toBe("Puzzle2");
    expect(
      [...container.querySelectorAll("button[aria-pressed]")].some((each) =>
        each.textContent?.startsWith("Rhythm"),
      ),
    ).toBe(false);
  });

  it("says plainly when nothing matches and offers the way back", async () => {
    const container = await browser();
    await typeInto(box(container), "zzzzz");
    expect(cards(container)).toHaveLength(0);
    expect(textOf(container)).toContain("No games match");
    expect(textOf(container)).toContain("“zzzzz”");
    expect(status(container)).toBe("0 games found");
    const again = [...container.querySelectorAll(".arcade-empty button")].find(
      (each) => each.textContent === searchCopy.clearAll,
    );
    await click(again ?? null);
    expect(cards(container)).toHaveLength(shelf.length);
    expect(box(container).value).toBe("");
    expect(window.location.search).toBe("");
  });

  it("offers to clear everything only while something is set", async () => {
    const container = await browser();
    expect(button(container, searchCopy.clearAll)).toBeNull();
    await click(toggle(container, "Puzzle"));
    await click(button(container, searchCopy.clearAll));
    expect(cards(container)).toHaveLength(shelf.length);
    expect(toggle(container, "Puzzle").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("jumps to the box on /, but not while typing in another field", async () => {
    const container = await browser();
    await press(document.body, { key: "/" });
    expect(document.activeElement).toBe(box(container));
    box(container).blur();

    const other = document.createElement("input");
    document.body.append(other);
    other.focus();
    await press(other, { key: "/" });
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("leaves / alone in every kind of field a person types in", async () => {
    const container = await browser();
    const area = document.createElement("textarea");
    const choice = document.createElement("select");
    const editor = document.createElement("div");
    // jsdom does not work out whether an element is editable; a browser does.
    Object.defineProperty(editor, "isContentEditable", { value: true });
    document.body.append(area, choice, editor);
    for (const field of [area, choice, editor]) {
      await press(field, { key: "/" });
      expect(document.activeElement).not.toBe(box(container));
    }
    area.remove();
    choice.remove();
    editor.remove();
  });

  it("leaves a modified / alone", async () => {
    const container = await browser();
    await press(document.body, { ctrlKey: true, key: "/" });
    await press(document.body, { key: "/", metaKey: true });
    expect(document.activeElement).not.toBe(box(container));
  });

  it("empties the box on Escape, and leaves it on a second one", async () => {
    const container = await browser();
    box(container).focus();
    await typeInto(box(container), "frost");
    await press(box(container), { key: "Escape" });
    expect(box(container).value).toBe("");
    expect(cards(container)).toHaveLength(shelf.length);
    expect(document.activeElement).toBe(box(container));
    await press(box(container), { key: "Escape" });
    expect(document.activeElement).not.toBe(box(container));
  });

  it("lets Escape on a filter alone: only the box is emptied or left", async () => {
    const container = await browser();
    await typeInto(box(container), "frost");
    await press(toggle(container, "Puzzle"), { key: "Escape" });
    expect(box(container).value).toBe("frost");
  });

  it("says no game fits the filters when only filters are set and nothing matches", async () => {
    const container = await browser({
      playable: false,
      tags: ["rhythm"],
      text: "",
    });
    expect(cards(container)).toHaveLength(0);
    expect(textOf(container)).toContain("No game fits these filters.");
    expect(textOf(container)).not.toContain("Nothing matches");
  });

  it("does not leave the page when Enter is pressed in the box", async () => {
    const container = await browser();
    const form = container.querySelector("form");
    const submit = new Event("submit", { bubbles: true, cancelable: true });
    await act(() => {
      form?.dispatchEvent(submit);
    });
    expect(submit.defaultPrevented).toBe(true);
  });
});
