// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ArcadeDock, type DockSection } from "../src/arcade.ts";

const sections: DockSection[] = [
  {
    badge: "1/3",
    content: <p>milestone words</p>,
    id: "m",
    label: "Milestones",
  },
  { badge: null, content: <p>about words</p>, id: "a", label: "About" },
];

let root: Root | null = null;
afterEach(async () => {
  await act(() => root?.unmount());
  document.body.innerHTML = "";
});

async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() =>
    root?.render(<ArcadeDock label="About this game" sections={sections} />),
  );
  return container;
}
const button = (container: HTMLElement, name: string) => {
  const found = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.startsWith(name),
  );
  if (found === undefined) throw new Error(`No button "${name}".`);
  return found;
};
const panels = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>(".arcade-dock__panel"),
];
const click = (element: Element) =>
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("the dock", () => {
  it("starts closed, with every section behind its button and the figure beside the label", async () => {
    const container = await mount();
    expect(panels(container).map((panel) => panel.hidden)).toEqual([
      true,
      true,
    ]);
    expect(button(container, "Milestones").getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(button(container, "Milestones").textContent).toBe("Milestones1/3");
    expect(button(container, "About").textContent).toBe("About");
    expect(
      container.querySelector(".arcade-dock")?.getAttribute("data-open"),
    ).toBe("false");
    expect(container.textContent).not.toContain("Hide");
  });

  it("opens one section at a time and ties each button to its own panel", async () => {
    const container = await mount();
    await click(button(container, "Milestones"));
    expect(panels(container).map((panel) => panel.hidden)).toEqual([
      false,
      true,
    ]);
    const opened = button(container, "Milestones");
    expect(opened.getAttribute("aria-expanded")).toBe("true");
    expect(opened.getAttribute("aria-controls")).toBe(panels(container)[0]?.id);
    await click(button(container, "About"));
    expect(panels(container).map((panel) => panel.hidden)).toEqual([
      true,
      false,
    ]);
    expect(button(container, "Milestones").getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(
      container.querySelector(".arcade-dock")?.getAttribute("data-open"),
    ).toBe("true");
  });

  it("closes with its own button and with Hide", async () => {
    const container = await mount();
    await click(button(container, "About"));
    await click(button(container, "About"));
    expect(panels(container).every((panel) => panel.hidden)).toBe(true);
    await click(button(container, "About"));
    await click(button(container, "Hide"));
    expect(panels(container).every((panel) => panel.hidden)).toBe(true);
    expect(container.textContent).not.toContain("Hide");
  });

  it("closes on Escape and hands the focus back to the button that opened it", async () => {
    const container = await mount();
    await click(button(container, "About"));
    await act(() =>
      panels(container)[1]?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      ),
    );
    expect(panels(container).every((panel) => panel.hidden)).toBe(true);
    expect(document.activeElement).toBe(button(container, "About"));
  });

  it("ignores other keys, and Escape when nothing is open", async () => {
    const container = await mount();
    await act(() =>
      button(container, "About").dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      ),
    );
    expect(document.activeElement).not.toBe(button(container, "About"));
    await click(button(container, "About"));
    await act(() =>
      button(container, "About").dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "a" }),
      ),
    );
    expect(panels(container)[1]?.hidden).toBe(false);
  });

  it("closes when the player clicks into the game, which takes the focus from the page", async () => {
    const container = await mount();
    const frame = document.createElement("iframe");
    document.body.append(frame);
    await click(button(container, "About"));
    // The page keeps the focus while the player is on its own controls.
    await act(() => window.dispatchEvent(new Event("blur")));
    expect(panels(container)[1]?.hidden).toBe(false);
    frame.focus();
    await act(() => window.dispatchEvent(new Event("blur")));
    expect(panels(container).every((panel) => panel.hidden)).toBe(true);
  });

  it("stops listening for the game's focus once closed", async () => {
    const container = await mount();
    await click(button(container, "About"));
    await click(button(container, "About"));
    const frame = document.createElement("iframe");
    document.body.append(frame);
    frame.focus();
    await act(() => window.dispatchEvent(new Event("blur")));
    await click(button(container, "About"));
    expect(panels(container)[1]?.hidden).toBe(false);
  });
});
