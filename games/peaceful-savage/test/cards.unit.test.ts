// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCardPanel } from "../src/page/card-panel.ts";
import {
  type Card,
  createCardMaker,
  flightMs,
  hugMs,
  showMs,
  paintCard,
  settleMs,
  sizes,
  wrap,
} from "../src/page/cards.ts";
import type { News } from "../src/rules/types.ts";
import { cardFor } from "../src/script/cards.ts";
import { byId, loadPage } from "./support/dom.ts";
import { led } from "./support/states.ts";

const news = (kind: News["kind"], detail = ""): News => ({
  detail,
  kind,
  tick: 1,
});

// jsdom cannot draw: a 2D context here is a stand-in that measures text at 20 pixels a letter and notes what is written.
function drawing() {
  const written: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const context = {
    createLinearGradient: () => gradient,
    drawImage: () => undefined,
    fillRect: () => undefined,
    fillText: (text: string) => written.push(text),
    measureText: (text: string) => ({ width: text.length * 20 }),
    strokeRect: () => undefined,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
    () => "data:image/png;base64,AAAA",
  );
  return written;
}

beforeEach(loadPage);
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the words on a share card", () => {
  it("has a card for Sparky, each of the family found, the tower, the whole garden, the drawer, the jackets and the lit tree", () => {
    const state = led();
    for (const kind of ["sparky", "tower", "drawer", "jackets", "lit"] as const)
      expect(cardFor(news(kind), state)?.title).toMatch(/\w/);
    for (const hero of ["ali", "heerah", "kai", "zora"])
      expect(cardFor(news("found", hero), state)?.line).toMatch(/learning/);
    expect(cardFor(news("found", "nobody"), state)).toBeNull();
    expect(cardFor(news("bloomed", "0"), state)).toBeNull();
    expect(
      cardFor(news("bloomed", "2"), { ...state, garden: [2, 2, 2] })?.title,
    ).toBe("Zora's garden blooms");
    expect(cardFor(news("plasma"), state)).toBeNull();
    expect(cardFor(news("joined"), state)).toBeNull();
  });
});

describe("making share cards", () => {
  it("takes a picture a moment after a turning point (the lit tree three times: the big hug, the show, and lifting off), and none for small news", () => {
    drawing();
    const maker = createCardMaker();
    const state = led({ lead: "zora" });
    maker.hear(news("plasma"), state, 0);
    maker.hear(news("sparky"), state, 0);
    maker.hear(news("lit"), state, 100);
    const screen = document.createElement("canvas");
    expect(maker.snap(screen, settleMs - 1)).toBeNull();
    const first = maker.snap(screen, settleMs);
    expect(first?.words.title).toBe("Sparky is found");
    expect(first?.lead).toBe("Zora");
    expect(maker.snap(screen, settleMs + 1)).toBeNull();
    expect(maker.snap(null, 100 + hugMs)?.words.title).toBe("The tree is lit");
    expect(maker.snap(null, 100 + showMs)?.words.title).toBe(
      "The family sings",
    );
    expect(maker.snap(null, 100 + flightMs - 1)).toBeNull();
    expect(maker.snap(null, 100 + flightMs)?.words.title).toBe(
      "The family flies",
    );
    expect(maker.cards()).toHaveLength(4);
    maker.clear();
    expect(maker.cards()).toHaveLength(0);
    maker.hear(news("sparky"), { ...state, lead: null }, 0);
    expect(maker.snap(screen, settleMs)?.lead).toBe("");
  });

  it("takes no picture where there is no canvas to draw on", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null,
    );
    const maker = createCardMaker();
    maker.hear(news("sparky"), led(), 0);
    expect(maker.snap(null, settleMs)).toBeNull();
  });

  it("draws a card in either shape: the title, the line broken to fit, and the game with who led", () => {
    const written = drawing();
    const card: Card = {
      lead: "Kai",
      photo: document.createElement("canvas"),
      words: {
        line: "He can build anything, and he is learning to be kind to his own mind.",
        title: "Kai is found",
      },
    };
    const canvas = document.createElement("canvas");
    expect(paintCard(canvas, card, "square")).toBe(true);
    expect([canvas.width, canvas.height]).toEqual(sizes.square);
    expect(written[0]).toBe("Kai is found");
    expect(written.at(-1)).toContain("LED BY KAI");
    expect(written.length).toBeGreaterThan(3);
    expect(paintCard(canvas, { ...card, lead: "" }, "story")).toBe(true);
    expect([canvas.width, canvas.height]).toEqual(sizes.story);
    expect(written.at(-1)).toBe("PEACEFUL SAVAGE: LIGHT THE TREE");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("no context");
    expect(wrap(context, "one two three four", 200)).toEqual([
      "one two",
      "three four",
    ]);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null,
    );
    expect(paintCard(canvas, card, "square")).toBe(false);
  });
});

describe("the share card panel", () => {
  const cardsOf = (titles: readonly string[]): Card[] =>
    titles.map((title) => ({
      lead: "Mama Heerah",
      photo: document.createElement("canvas"),
      words: { line: "A line.", title },
    }));

  it("opens on the newest card, turns through them, and changes shape", () => {
    drawing();
    const panel = createCardPanel();
    panel.open([]);
    expect(panel.isOpen()).toBe(false);
    panel.open(cardsOf(["Sparky is found", "Kai is found", "The tree is lit"]));
    expect(panel.isOpen()).toBe(true);
    expect(byId("card-count").textContent).toBe("3 of 3");
    expect(byId<HTMLButtonElement>("card-next").disabled).toBe(true);
    expect(byId<HTMLImageElement>("card-image").alt).toBe(
      "The tree is lit. A line.",
    );
    byId("card-previous").click();
    byId("card-previous").click();
    expect(byId("card-count").textContent).toBe("1 of 3");
    expect(byId<HTMLButtonElement>("card-previous").disabled).toBe(true);
    byId("card-next").click();
    expect(byId("card-count").textContent).toBe("2 of 3");
    const story = document.querySelector<HTMLButtonElement>(
      'button[data-shape="story"]',
    );
    story?.click();
    expect(story?.getAttribute("aria-pressed")).toBe("true");
    expect(byId("card-hint").textContent).toContain("press and hold");
    byId("card-close").click();
    expect(panel.isOpen()).toBe(false);
    panel.close();
  });

  it("tries a download, and says how to save the picture by hand when the frame forbids it", () => {
    drawing();
    const clicked = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const panel = createCardPanel();
    panel.open(cardsOf(["Kai's tower stands"]));
    byId("card-download").click();
    expect(clicked).toHaveBeenCalledOnce();
    expect(byId("card-hint").textContent).toContain("If nothing was saved");
  });

  it("shares the card where the browser can, and says so where it cannot", async () => {
    drawing();
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (done) => {
        done(new Blob(["card"], { type: "image/png" }));
      },
    );
    const panel = createCardPanel();
    panel.open(cardsOf(["The jackets are woven"]));
    byId("card-share").click();
    expect(byId("card-hint").textContent).toContain("Sharing is not offered");
    const shared = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { canShare: () => true, share: shared });
    byId("card-share").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(shared).toHaveBeenCalledOnce();
    expect(byId("card-hint").textContent).toContain("Shared");
    Object.assign(navigator, { share: () => Promise.reject(new Error("no")) });
    byId("card-share").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(byId("card-hint").textContent).toContain("press and hold");
  });

  it("says so when the browser cannot draw a card", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null,
    );
    const panel = createCardPanel();
    panel.open(cardsOf(["Mama is found"]));
    expect(byId("card-hint").textContent).toBe(
      "This browser could not draw the card.",
    );
  });
});
