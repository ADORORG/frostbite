// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { layoutOf } from "../src/card/layout.ts";
import { createCardPanel } from "../src/page/card-panel.ts";
import { element } from "../src/page/elements.ts";
import { surface } from "./support/canvas.ts";
import { facts, link } from "./support/card-facts.ts";

const page = readFileSync(join(import.meta.dirname, "../index.html"), "utf8");
const picture = "data:image/png;base64,AAAA";
const hint = () => element("card-hint", "p").textContent;
const click = (target: Element | null | undefined) =>
  target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const extras = ["share", "canShare", "clipboard"] as const;
const give = (name: (typeof extras)[number], value: unknown) =>
  Object.defineProperty(navigator, name, { configurable: true, value });

beforeEach(() => {
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/u.exec(page)?.[1] ?? "";
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    surface().context,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(picture);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
    done(new Blob(["png"], { type: "image/png" })),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const name of extras) Reflect.deleteProperty(navigator, name);
});

describe("the card panel", () => {
  it("opens over the page with the card as a square post, the page behind it inert and the size picked in focus", () => {
    const panel = createCardPanel(() => undefined);
    expect(panel.isOpen()).toBe(false);
    panel.open(facts);
    expect(panel.isOpen()).toBe(true);
    expect(element("card-panel", "div").hidden).toBe(false);
    expect(document.querySelector("main")?.hasAttribute("inert")).toBe(true);
    const image = element("card-image", "img");
    expect([image.hidden, image.src, image.alt]).toEqual([
      false,
      picture,
      expect.stringContaining("I cleared Egg Hills"),
    ]);
    expect(document.activeElement?.getAttribute("data-shape")).toBe("square");
    expect(hint()).toContain("right-click (or press and hold)");
    expect(element("card-link", "input").value).toBe(link);
    expect(element("card-link-row", "div").hidden).toBe(false);
  });

  it("draws the card again in the size picked, says which is picked, and puts the foil over the card where it is", () => {
    const panel = createCardPanel(() => undefined);
    panel.open(facts);
    click(document.querySelector('[data-shape="story"]'));
    const pressed = [...document.querySelectorAll("[data-shape]")].map(
      (button) => button.getAttribute("aria-pressed"),
    );
    expect(pressed).toEqual(["false", "true", "false"]);
    const { card, height, width } = layoutOf("story");
    const holo = element("card-holo", "div");
    expect(holo.style.getPropertyValue("--card-left")).toBe(
      `${String((card.x / width) * 100)}%`,
    );
    expect(holo.style.getPropertyValue("--card-height")).toBe(
      `${String((card.height / height) * 100)}%`,
    );
    click(document.querySelector('[data-shape="story"]'));
    expect(
      vi.mocked(HTMLCanvasElement.prototype.getContext),
    ).toHaveBeenCalledTimes(2);
  });

  it("downloads the picture under a name for its size, and says how to save it by hand if the frame stops the download", () => {
    const saved: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this);
    });
    createCardPanel(() => undefined).open(facts);
    click(document.querySelector('[data-shape="wide"]'));
    click(document.getElementById("card-download"));
    expect(saved.map((anchor) => [anchor.download, anchor.href])).toEqual([
      ["pocket-dragon-card-16x9.png", picture],
    ]);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(hint()).toContain("If the download did not start");
  });

  it("shares the picture with its words where the browser can, and says what to do where it cannot", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    give("share", share);
    give("canShare", () => true);
    const panel = createCardPanel(() => undefined);
    expect(element("card-send", "button").hidden).toBe(false);
    panel.open(facts);
    click(document.getElementById("card-send"));
    await settle();
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(link),
        title: "Pocket Dragon: Glitchy's Quest",
      }),
    );
    const [shared] = share.mock.calls[0] ?? [];
    expect(shared).toMatchObject({
      files: [
        expect.objectContaining({
          name: "pocket-dragon-card-1x1.png",
          type: "image/png",
        }),
      ],
    });
    expect(hint()).toContain("Shared!");
    share.mockRejectedValueOnce(new DOMException("no", "NotAllowedError"));
    click(document.getElementById("card-send"));
    await settle();
    expect(hint()).toContain("Sharing is not available here");
    share.mockRejectedValueOnce(new DOMException("stop", "AbortError"));
    click(document.getElementById("card-send"));
    await settle();
    expect(hint()).toContain("right-click (or press and hold)");
    give("canShare", () => false);
    click(document.getElementById("card-send"));
    await settle();
    expect(share).toHaveBeenCalledTimes(3);
    expect(hint()).toContain("Sharing is not available here");
  });

  it("offers no share button where the browser cannot share", () => {
    createCardPanel(() => undefined);
    expect(element("card-send", "button").hidden).toBe(true);
  });

  it("copies the invite link, or selects it to copy by hand, and offers no link where there is none", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    give("clipboard", { writeText });
    const panel = createCardPanel(() => undefined);
    panel.open(facts);
    click(document.getElementById("card-copy"));
    await settle();
    expect(writeText).toHaveBeenCalledWith(link);
    expect(hint()).toBe("Invite link copied.");
    writeText.mockRejectedValueOnce(new Error("not allowed"));
    click(document.getElementById("card-copy"));
    await settle();
    expect(document.activeElement?.id).toBe("card-link");
    expect(hint()).toContain("Ctrl+C");
    panel.close();
    panel.open({ ...facts, invite: null });
    expect(element("card-copy", "button").hidden).toBe(true);
    expect(element("card-link-row", "div").hidden).toBe(true);
    click(document.getElementById("card-copy"));
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("closes on Escape, its button or a click outside the card, and keeps its keys from the game while open", () => {
    const closed = vi.fn();
    const gameKeys = vi.fn();
    window.addEventListener("keydown", gameKeys);
    const panel = createCardPanel(closed);
    panel.open(facts);
    const button = document.getElementById("card-download");
    button?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        code: "Enter",
        key: "Enter",
      }),
    );
    button?.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        code: "Enter",
        key: "Enter",
      }),
    );
    expect(gameKeys).not.toHaveBeenCalled();
    button?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
    expect(panel.isOpen()).toBe(false);
    expect(document.querySelector("main")?.hasAttribute("inert")).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
    panel.close();
    expect(closed).toHaveBeenCalledTimes(1);
    panel.open(facts);
    click(document.querySelector(".card-sheet"));
    expect(panel.isOpen()).toBe(true);
    click(document.getElementById("card-panel"));
    expect(panel.isOpen()).toBe(false);
    panel.open(facts);
    click(document.getElementById("card-close"));
    expect(closed).toHaveBeenCalledTimes(3);
    window.removeEventListener("keydown", gameKeys);
  });

  it("says so when the browser cannot draw, offers nothing to save, and draws again only while open", () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const panel = createCardPanel(() => undefined);
    panel.update(facts);
    expect(
      vi.mocked(HTMLCanvasElement.prototype.getContext),
    ).not.toHaveBeenCalled();
    panel.open(facts);
    expect(hint()).toBe("This browser could not draw the card.");
    expect(element("card-image", "img").hidden).toBe(true);
    expect(element("card-download", "button").disabled).toBe(true);
    click(document.getElementById("card-download"));
    expect(document.querySelectorAll("a")).toHaveLength(0);
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(
      surface().context,
    );
    panel.update({ ...facts, milestones: 5 });
    expect(element("card-image", "img").alt).toContain("5/40");
    expect(element("card-download", "button").disabled).toBe(false);
  });
});
