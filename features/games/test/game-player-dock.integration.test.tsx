// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it } from "vitest";

import {
  flush,
  game,
  harness as h,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";

registerHarness();

const dockButton = (name: string) =>
  [
    ...h.container.querySelectorAll<HTMLButtonElement>(".arcade-dock button"),
  ].find((button) => button.textContent.startsWith(name));
const click = (element: Element | undefined) =>
  act(() => element?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const panel = (name: string) => {
  const id = dockButton(name)?.getAttribute("aria-controls");
  return id === null || id === undefined ? null : document.getElementById(id);
};

describe("the dock under the game", () => {
  it("puts the milestones first, with how many are reached beside the label, and the page's own sections after", async () => {
    await mount(undefined, {
      sections: [
        {
          badge: null,
          content: <p>about words</p>,
          id: "about",
          label: "About",
        },
      ],
    });
    const labels = [
      ...h.container.querySelectorAll(".arcade-dock__strip button"),
    ].map((button) => button.textContent);
    expect(labels).toEqual(["Milestones0/2", "About"]);
    expect(panel("About")?.textContent).toBe("about words");
  });

  it("counts a milestone as reached when the game reports it, and shows how it is earned once opened", async () => {
    const { target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    expect(dockButton("Milestones")?.textContent).toBe("Milestones0/2");
    send(target, "milestones.unlock", { id: "first-level" }, "b");
    await flush();
    expect(dockButton("Milestones")?.textContent).toBe("Milestones1/2");
    expect(panel("Milestones")?.hidden).toBe(true);
    await click(dockButton("Milestones"));
    expect(panel("Milestones")?.hidden).toBe(false);
    expect(panel("Milestones")?.textContent).toContain("1 of 2 reached");
  });

  it("has no milestones section, and no figure to read, for a game that declares none", async () => {
    await mount(undefined, { game: { id: game.id, milestones: [] } });
    expect(dockButton("Milestones")).toBeUndefined();
    expect(
      h.container.querySelector(".arcade-dock__strip")?.children,
    ).toHaveLength(0);
  });

  it("puts the title and the facts in the bar over the game", async () => {
    await mount(undefined, { meta: <span>v9</span> });
    expect(
      h.container.querySelector(".arcade-stage__bar h2")?.textContent,
    ).toBe("Embedded game");
    expect(h.container.querySelector(".arcade-stage__facts")?.textContent).toBe(
      "v9",
    );
  });

  it("leaves the facts out of the bar when there are none", async () => {
    await mount();
    expect(h.container.querySelector(".arcade-stage__facts")).toBeNull();
  });
});
