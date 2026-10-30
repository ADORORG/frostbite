import { afterEach, describe, expect, it } from "vitest";

import { guide } from "../src/guide.ts";
import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

describe("Icicle Drop's first screen", () => {
  it("tells the player what to do, over the board, until the first run starts, and then stays out of the way", async () => {
    const { window } = await play();
    await settle();
    const box = window.document.getElementById("guide");
    expect(box?.hidden).toBe(false);
    expect(
      [...(box?.children ?? [])].map((child) => child.textContent),
    ).toEqual([guide.title, ...guide.lines, guide.start]);
    window.document
      .getElementById("start")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(box?.hidden).toBe(true);
  });
});
