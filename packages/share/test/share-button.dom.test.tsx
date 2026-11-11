import { click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { shareControlCopy } from "../src/copy.ts";
import { ShareButton } from "../src/share-button.tsx";
import { config } from "./fixtures.ts";

const url = "https://play.example/s/abc";
const props = { heading: "Frost Walker", kicker: "Milestone", text: "Look" };
const trigger = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("button.share-trigger");
const tiles = (container: HTMLElement) => [
  ...container.querySelectorAll(".share-tile"),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the share control", () => {
  it("is a small button that makes no link until it is pressed", async () => {
    const makeLink = vi.fn(async () => url);
    const container = await mount(
      <ShareButton config={config} makeLink={makeLink} {...props} />,
    );
    expect(makeLink).not.toHaveBeenCalled();
    expect(textOf(trigger(container) as HTMLElement)).toBe(
      shareControlCopy.button,
    );
  });

  it("opens a sheet that says what is shared, shows its tiles at once, and turns them into links when the link is made", async () => {
    let resolve: (value: string) => void = () => undefined;
    const makeLink = vi.fn(() => new Promise<string>((ok) => (resolve = ok)));
    const container = await mount(
      <ShareButton
        art={<b>art</b>}
        config={config}
        makeLink={makeLink}
        {...props}
      />,
    );
    click(trigger(container));
    await settle(() => expect(tiles(container)).toHaveLength(2));
    expect(textOf(container)).toContain("Frost Walker");
    expect(textOf(container)).toContain("Milestone");
    expect(textOf(container)).toContain(shareControlCopy.preparing);
    // Waiting: the tiles are there but are not links yet.
    expect(container.querySelectorAll("a.share-tile")).toHaveLength(0);
    expect(makeLink).toHaveBeenCalledTimes(1);
    resolve(url);
    await settle(() =>
      expect(container.querySelectorAll("a.share-tile")).toHaveLength(2),
    );
    const first = container.querySelector<HTMLAnchorElement>("a.share-tile");
    expect(new URL(first?.href ?? "").searchParams.get("url")).toBe(url);
    expect(first?.target).toBe("_blank");
    expect(first?.rel).toBe("noopener noreferrer");
    expect(
      container.querySelector<HTMLInputElement>(".share-link input")?.value,
    ).toBe(url);
  });

  it("gives each tile its colour and a readable mark", async () => {
    const container = await mount(
      <ShareButton config={config} makeLink={async () => url} {...props} />,
    );
    click(trigger(container));
    await settle(() => expect(tiles(container)).toHaveLength(2));
    const marks = [
      ...container.querySelectorAll<HTMLElement>(".share-tile__mark"),
    ];
    expect(marks.map((mark) => mark.textContent)).toEqual(["X", "ch"]);
    expect(marks.map((mark) => mark.dataset.ink)).toEqual(["light", "dark"]);
  });

  it("says so when the link could not be made, or came back empty", async () => {
    const failing = await mount(
      <ShareButton
        config={config}
        makeLink={async () => Promise.reject(new Error("down"))}
        {...props}
      />,
    );
    click(trigger(failing));
    await settle(() =>
      expect(failing.querySelector('[role="alert"]')?.textContent).toBe(
        shareControlCopy.linkFailed,
      ),
    );
    const empty = await mount(
      <ShareButton config={config} makeLink={async () => null} {...props} />,
    );
    click(trigger(empty));
    await settle(() =>
      expect(textOf(empty)).toContain(shareControlCopy.linkFailed),
    );
    expect(empty.querySelector("a.share-tile")).toBeNull();
  });

  it("copies the link and says so; when copying is refused it says that instead", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const container = await mount(
      <ShareButton config={config} makeLink={async () => url} {...props} />,
    );
    click(trigger(container));
    const copy = () =>
      container.querySelector<HTMLButtonElement>(".share-link button");
    await settle(() => expect(copy()).not.toBeNull());
    click(copy());
    await settle(() =>
      expect(textOf(container)).toContain(shareControlCopy.copied),
    );
    expect(writeText).toHaveBeenCalledWith(url);
    expect(copy()?.dataset.copied).toBe("true");
    writeText.mockRejectedValueOnce(new Error("blocked"));
    click(copy());
    await settle(() =>
      expect(textOf(container)).toContain(shareControlCopy.copyFailed),
    );
  });

  it("offers the device's own sheet first on a touch screen, and shares the words and the link", async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: {}, share });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(pointer: coarse)",
    }));
    const container = await mount(
      <ShareButton config={config} makeLink={async () => url} {...props} />,
    );
    click(trigger(container));
    await settle(() =>
      expect(container.querySelector(".share-tile--native")).not.toBeNull(),
    );
    expect(tiles(container)[0]?.className).toContain("share-tile--native");
    click(container.querySelector(".share-tile--native"));
    expect(share).toHaveBeenCalledWith({
      text: "Look",
      title: shareControlCopy.nativeTitle,
      url,
    });
  });

  it("does not offer the device's sheet on a pointer screen, and is quiet when a person closes it", async () => {
    vi.stubGlobal("navigator", { clipboard: {}, share: vi.fn() });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const pointer = await mount(
      <ShareButton config={config} makeLink={async () => url} {...props} />,
    );
    click(trigger(pointer));
    await settle(() =>
      expect(pointer.querySelectorAll("a.share-tile")).toHaveLength(2),
    );
    expect(pointer.querySelector(".share-tile--native")).toBeNull();

    const share = vi.fn(async () => {
      throw new DOMException("closed", "AbortError");
    });
    vi.stubGlobal("navigator", { clipboard: {}, share });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const touch = await mount(
      <ShareButton config={config} makeLink={async () => url} {...props} />,
    );
    click(trigger(touch));
    await settle(() =>
      expect(touch.querySelector(".share-tile--native")).not.toBeNull(),
    );
    click(touch.querySelector(".share-tile--native"));
    expect(touch.querySelector('[role="alert"]')).toBeNull();
  });

  it("can be a round button with the mark alone, named for a screen reader", async () => {
    const container = await mount(
      <ShareButton
        config={config}
        makeLink={async () => url}
        variant="icon"
        {...props}
      />,
    );
    const button = trigger(container);
    expect(button?.dataset.variant).toBe("icon");
    expect(button?.getAttribute("aria-label")).toBe(shareControlCopy.button);
    expect(button?.textContent).toBe("");
  });
});
