import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const gamesDirectory = join(import.meta.dirname, "../../../games");

// The page of a game with a list of earned milestones is a grid; a list that does not wrap (or any long line) makes an unconstrained grid column
// as wide as it is, which widened the page and the screen with it (found in Bro Maria, Frost Runner, Icicle Drop and Tower Stacker once they had
// earned many milestones). The page must say its one column may be narrower than its content.
describe("the page of a game", () => {
  it("is one column that may be narrower than what is in it, so earned milestones never widen the screen", async () => {
    const checked: string[] = [];
    for (const game of await readdir(gamesDirectory)) {
      const html = await readFile(
        join(gamesDirectory, game, "index.html"),
        "utf8",
      ).catch(() => "");
      if (!html.includes('id="earned"')) continue;
      const css = await readFile(
        join(gamesDirectory, game, "styles.css"),
        "utf8",
      );
      const main = /(?:^|\n)main \{([^}]*)\}/u.exec(css)?.[1] ?? "";
      expect(main, `${game}: main`).toMatch(
        /grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
      );
      checked.push(game);
    }
    expect(checked.length).toBeGreaterThanOrEqual(5);
  });
});
