import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { checkGameConformance } from "../src/game-conformance.ts";
import { game } from "./support/game-host.ts";

const fixture = (name: string) =>
  join(import.meta.dirname, "fixtures/games", name);
const check = (name: string) =>
  checkGameConformance({ folder: fixture(name), game });

describe("the conformance check for a game folder", () => {
  it("passes a game that connects, saves, unlocks a declared milestone and reads its state", async () => {
    expect(await check("good")).toEqual([]);
  });

  it("reports a folder with no page", async () => {
    expect(await check("../no-such-folder")).toEqual([
      "The game has no index.html.",
    ]);
  });

  it("reports a page the frame could not serve, in the author's words", async () => {
    const problems = await check("bad-html");
    expect(problems).toContain(
      "The page loads something from another address; everything must be bundled with the game.",
    );
  });

  it("reports a script that does not bundle, and does not try to run it", async () => {
    const problems = await check("bad-script");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^The script does not bundle: /u);
  });

  it("reports a game that never says it is ready", async () => {
    expect(await check("no-ready")).toEqual([
      "The game never told the platform it was ready.",
    ]);
  });

  it("reports what the platform refused", async () => {
    expect(await check("refused")).toEqual([
      'The platform refused "milestones.unlock" (unknown_milestone).',
    ]);
  });

  it("reports an error the game did not catch", async () => {
    const problems = await check("throws");
    expect(problems).toEqual([
      "The game never told the platform it was ready.",
      expect.stringContaining("The game threw an error nobody caught:"),
    ]);
  });

  it("waits only as long as it is told", async () => {
    const started = Date.now();
    await checkGameConformance({ folder: fixture("good"), game, settleMs: 5 });
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("passes a game whose manifest names a cover that is in its assets", async () => {
    expect(
      await checkGameConformance({
        cover: { alt: "A picture.", image: "cover.svg", video: null },
        folder: fixture("good"),
        game,
      }),
    ).toEqual([]);
  });

  it("reports each cover file the manifest names that the game does not have", async () => {
    expect(
      await checkGameConformance({
        cover: { alt: "A picture.", image: "gone.png", video: "gone.mp4" },
        folder: fixture("good"),
        game,
      }),
    ).toEqual([
      "The manifest's cover names assets/gone.png, which is missing.",
      "The manifest's cover names assets/gone.mp4, which is missing.",
    ]);
  });

  it("does not take a folder for a file", async () => {
    expect(
      await checkGameConformance({
        cover: { alt: "A picture.", image: "folder", video: null },
        folder: join(fixture("good")),
        game,
      }),
    ).toEqual(["The manifest's cover names assets/folder, which is missing."]);
  });
});
