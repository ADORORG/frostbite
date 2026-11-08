import { click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { shareControlCopy } from "../src/copy.ts";
import { ShareButton } from "../src/share-button.tsx";
import { config } from "./fixtures.ts";

const url = "https://play.example/s/abc";
const triggerOf = (container: HTMLElement) => {
  const trigger = container.querySelector("button");
  if (trigger === null) throw new Error("no trigger");
  return trigger;
};
const items = (container: HTMLElement) =>
  [...container.querySelectorAll(".menu-list .menu-link")].map(
    (item) => item.textContent,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "share");
});

describe("the share control", () => {
  it("makes no link until it is pressed, then one, and shows the destinations", async () => {
    const makeLink = vi.fn(async () => url);
    const container = await mount(
      <ShareButton config={config} makeLink={makeLink} text="Look" />,
    );
    expect(makeLink).not.toHaveBeenCalled();
    expect(textOf(container)).toBe(shareControlCopy.button);
    await click(triggerOf(container));
    await settle(() =>
      expect(items(container)).toEqual(["X", "Chat", shareControlCopy.copy]),
    );
    expect(makeLink).toHaveBeenCalledTimes(1);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.href);
    expect(new URL(hrefs[0] ?? "").searchParams.get("url")).toBe(url);
    for (const a of container.querySelectorAll("a")) {
      expect(a.target).toBe("_blank");
      expect(a.rel).toBe("noopener noreferrer");
    }
  });

  it("says so while the link is being made, and when it could not be", async () => {
    let fail: () => void = () => undefined;
    const makeLink = vi.fn(
      () =>
        new Promise<string | null>(
          (_ok, reject) => (fail = () => reject(new Error("down"))),
        ),
    );
    const container = await mount(
      <ShareButton config={config} makeLink={makeLink} text="Look" />,
    );
    await click(triggerOf(container));
    expect(textOf(container)).toContain(shareControlCopy.preparing);
    fail();
    await settle(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        shareControlCopy.linkFailed,
      ),
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("treats a link that came back empty as a failure", async () => {
    const container = await mount(
      <ShareButton config={config} makeLink={async () => null} text="Look" />,
    );
    await click(triggerOf(container));
    await settle(() =>
      expect(textOf(container)).toContain(shareControlCopy.linkFailed),
    );
  });

  it("copies the link and says so; when copying is refused it shows the address to copy by hand", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const container = await mount(
      <ShareButton config={config} makeLink={async () => url} text="Look" />,
    );
    await click(triggerOf(container));
    await settle(() =>
      expect(items(container)).toContain(shareControlCopy.copy),
    );
    const copy = () =>
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === shareControlCopy.copy,
      ) ?? null;
    await click(copy());
    await settle(() =>
      expect(textOf(container)).toContain(shareControlCopy.copied),
    );
    expect(writeText).toHaveBeenCalledWith(url);

    writeText.mockRejectedValueOnce(new Error("blocked"));
    await click(copy());
    await settle(() =>
      expect(textOf(container)).toContain(shareControlCopy.copyFailed),
    );
    expect(container.querySelector("input")?.value).toBe(url);
  });

  it("offers the device's own sheet first on a touch screen, and shares the words and the link", async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: {}, share });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(pointer: coarse)",
    }));
    const container = await mount(
      <ShareButton config={config} makeLink={async () => url} text="Look" />,
    );
    await click(triggerOf(container));
    await settle(() =>
      expect(items(container)[0]).toBe(shareControlCopy.nativeTitle),
    );
    await click(container.querySelector(".menu-list button"));
    expect(share).toHaveBeenCalledWith({
      text: "Look",
      title: shareControlCopy.nativeTitle,
      url,
    });
  });

  it("does not offer the device's sheet on a pointer screen, even when the browser has one", async () => {
    vi.stubGlobal("navigator", { clipboard: {}, share: vi.fn() });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const container = await mount(
      <ShareButton config={config} makeLink={async () => url} text="Look" />,
    );
    await click(triggerOf(container));
    await settle(() => expect(items(container)[0]).toBe("X"));
  });

  it("is quiet when a person closes the device's sheet", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("closed", "AbortError");
    });
    vi.stubGlobal("navigator", { clipboard: {}, share });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const container = await mount(
      <ShareButton config={config} makeLink={async () => url} text="Look" />,
    );
    await click(triggerOf(container));
    await settle(() =>
      expect(items(container)[0]).toBe(shareControlCopy.nativeTitle),
    );
    await click(container.querySelector(".menu-list button"));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
