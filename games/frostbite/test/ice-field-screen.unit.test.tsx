// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  button,
  clearBoard,
  click,
  clickButton,
  clickTile,
  container,
  host,
  mines,
  open,
  panel,
  press,
  safeTiles,
  seeds,
  show,
  startRun,
  status,
  tile,
} from "./support/screen.tsx";

describe("the launcher and the panel", () => {
  it("is a button on the page with no panel until it is opened, and says whether it is open", async () => {
    await show();
    const launcher = button("Ice field");
    expect(launcher?.getAttribute("aria-expanded")).toBe("false");
    expect(panel()).toBeNull();
    await click(launcher);
    expect(launcher?.getAttribute("aria-expanded")).toBe("true");
    expect(panel()?.getAttribute("aria-label")).toBe("Ice field cabinet");
    await click(launcher);
    expect(panel()).toBeNull();
  });

  it("takes focus when opened, and closes with Escape or Close, putting focus back on the launcher", async () => {
    await open();
    expect(document.activeElement).toBe(panel());
    await press("a");
    expect(panel()).not.toBeNull();
    await press("Escape");
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(button("Ice field"));
    await clickButton("Ice field");
    await clickButton("Close");
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(button("Ice field"));
  });

  it("explains itself before a run starts, and offers to start one", async () => {
    await open();
    expect(panel()?.textContent).toContain("Pick safe tiles");
    expect(button("Start a run")).toBeDefined();
    expect(container.querySelector(".if-board")).toBeNull();
  });
});

describe("playing a board", () => {
  it("starts a run with a seed from the game, and shows a field of 25 tiles that each say what they are", async () => {
    await startRun();
    expect(seeds).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".if-tile")).toHaveLength(25);
    expect(tile(0)?.getAttribute("aria-label")).toBe(
      "Tile 1 of 25, not picked",
    );
    expect(status()).toBe(
      "Pick a tile. A mine ends the board. This run is on a local seed, so its milestones are the game's own report. The platform cannot check runs here.",
    );
    expect(container.querySelector(".if-stats")?.textContent).toContain(
      "Icicles0",
    );
  });

  it("shows a safe tile as safe, with how many mines are next to it", async () => {
    await startRun();
    const [safe] = safeTiles();
    await clickTile(safe ?? 0);
    expect(tile(safe ?? 0)?.dataset.state).toBe("safe");
    expect(tile(safe ?? 0)?.getAttribute("aria-label")).toMatch(
      /safe, \d mines next to it/u,
    );
    expect(status()).toMatch(/^Safe: \d mines next to it\.$/u);
    expect(tile(safe ?? 0)?.disabled).toBe(true);
  });

  it("ends the board on a mine, shows the other mines, and stops further picks until it is settled", async () => {
    await startRun();
    const [mine] = mines();
    await clickTile(mine ?? 0);
    expect(tile(mine ?? 0)?.dataset.state).toBe("mine");
    expect(status()).toBe("Mine! Settle the board to move on.");
    const others = mines().filter((m) => m !== mine);
    for (const other of others)
      expect(tile(other)?.dataset.state).toBe("revealed-mine");
    for (const index of safeTiles()) expect(tile(index)?.disabled).toBe(true);
    await clickButton("Settle board");
    expect(status()).toBe("Mine struck: nothing banked.");
    expect(
      container.querySelector(".if-board")?.hasAttribute("data-busted"),
    ).toBe(false);
    expect(tile(0)?.disabled).toBe(false);
  });

  it("banks the safe picks when the board is settled, tells the game once, and moves to the next board", async () => {
    await startRun();
    for (const index of safeTiles().slice(0, 3)) await clickTile(index);
    expect(host.milestone).not.toHaveBeenCalled();
    await clickButton("Settle board");
    expect(status()).toBe("Board won: +83 icicles.");
    expect(host.milestone.mock.calls).toEqual([["firstWin"]]);
    expect(container.querySelector(".if-stats")?.textContent).toContain(
      "Board2",
    );
    expect(container.querySelector(".if-stats")?.textContent).toContain(
      "Icicles83",
    );
    for (const index of safeTiles(1).slice(0, 1)) await clickTile(index);
    await clickButton("Settle board");
    expect(host.milestone).toHaveBeenCalledTimes(1);
  });

  it("says a board with no picks was skipped", async () => {
    await startRun();
    await clickButton("Settle board");
    expect(status()).toBe("Board skipped.");
    expect(host.milestone).not.toHaveBeenCalled();
  });
});

describe("glaciers", () => {
  it("cannot be bought until the icicles pay for them, and then are, once, telling the game", async () => {
    await startRun();
    const build = () => button("Build glacier");
    expect(build()?.textContent).toBe("Build glacier (300 icicles)");
    expect(build()?.disabled).toBe(true);
    await clearBoard(0);
    await clickButton("Settle board");
    expect(status()).toBe("Board won: +825 icicles.");
    expect(build()?.disabled).toBe(false);
    await click(build());
    expect(status()).toBe("Glacier tier 1 built.");
    expect(host.milestone.mock.calls).toEqual([["firstWin"], ["firstGlacier"]]);
    expect(build()?.textContent).toBe("Build glacier (1200 icicles)");
    expect(build()?.disabled).toBe(true);
    expect(container.querySelector(".if-stats")?.textContent).toContain(
      "Glaciertier 1",
    );
  });
});
