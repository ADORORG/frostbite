import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildGame,
  buildGames,
  bundleGameStyles,
  checkGameHtml,
} from "../src/build.ts";

let scratch = "";
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "game-build-"));
});
afterEach(async () => rm(scratch, { force: true, recursive: true }));

const goodHtml =
  '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><script src="main.js"></script></body></html>';

async function makeGame(name: string, html = goodHtml) {
  const directory = join(scratch, "games", name);
  await mkdir(join(directory, "src"), { recursive: true });
  await mkdir(join(directory, "assets"), { recursive: true });
  await writeFile(join(directory, "index.html"), html);
  await writeFile(join(directory, "styles.css"), "body{}");
  await writeFile(join(directory, "assets", "a.txt"), "asset");
  await writeFile(
    join(directory, "src", "main.ts"),
    "const x: number = 1; document.title = String(x);",
  );
  await writeFile(join(directory, "notes.md"), "not published");
  return directory;
}

describe("checking a game's page", () => {
  it("accepts a page that loads only its own styles and script", () => {
    expect(checkGameHtml(goodHtml)).toEqual([]);
  });

  it.each([
    [
      "a script from another address",
      goodHtml.replace('src="main.js"', 'src="https://cdn.example.com/x.js"'),
      "another address",
    ],
    [
      "a stylesheet from a protocol-relative address",
      goodHtml.replace('href="styles.css"', 'href="//cdn.example.com/s.css"'),
      "another address",
    ],
    [
      "an inline script",
      goodHtml.replace("</body>", "<script>alert(1)</script></body>"),
      "inline script",
    ],
    [
      "a frame",
      goodHtml.replace("</body>", '<iframe src="x"></iframe></body>'),
      "frame, form or object",
    ],
    [
      "a form",
      goodHtml.replace("</body>", "<form></form></body>"),
      "frame, form or object",
    ],
    [
      "an inline handler",
      goodHtml.replace("<body>", '<body onload="x()">'),
      "inline event handler",
    ],
    ["no main script", "<html><body></body></html>", 'src="main.js"'],
  ])("refuses a page with %s", (_why, html, message) => {
    expect(checkGameHtml(html).join(" ")).toContain(message);
  });
});

describe("building a game", () => {
  it("publishes the page, styles, assets and one bundled script, and nothing else", async () => {
    const directory = await makeGame("alpha");
    const out = join(scratch, "out", "alpha");
    await buildGame({ directory, outDirectory: out });
    expect((await readdir(out)).sort()).toEqual([
      "assets",
      "index.html",
      "main.js",
      "styles.css",
    ]);
    expect(await readFile(join(out, "main.js"), "utf8")).toContain(
      "document.title",
    );
    expect(await readFile(join(out, "assets", "a.txt"), "utf8")).toBe("asset");
  });

  it("replaces what was there before", async () => {
    const directory = await makeGame("alpha");
    const out = join(scratch, "out", "alpha");
    await mkdir(out, { recursive: true });
    await writeFile(join(out, "stale.txt"), "old");
    await buildGame({ directory, outDirectory: out });
    expect(await readdir(out)).not.toContain("stale.txt");
  });

  it("builds no game whose page reaches beyond itself, and says which page", async () => {
    const directory = await makeGame(
      "bad",
      goodHtml.replace('src="main.js"', 'src="https://cdn.example.com/x.js"'),
    );
    await expect(
      buildGame({ directory, outDirectory: join(scratch, "out", "bad") }),
    ).rejects.toThrow(/index\.html.*another address/su);
  });

  it("works without a styles file or assets folder", async () => {
    const directory = await makeGame("plain");
    await rm(join(directory, "styles.css"));
    await rm(join(directory, "assets"), { recursive: true });
    const out = join(scratch, "out", "plain");
    await buildGame({ directory, outDirectory: out });
    expect((await readdir(out)).sort()).toEqual(["index.html", "main.js"]);
  });

  it("builds every game folder under a directory, by folder name, and skips loose files", async () => {
    await makeGame("one");
    await makeGame("two");
    await writeFile(join(scratch, "games", "README.md"), "not a game");
    const built = await buildGames({
      gamesDirectory: join(scratch, "games"),
      outRoot: join(scratch, "out"),
    });
    expect(built.sort()).toEqual(["one", "two"]);
    expect((await readdir(join(scratch, "out"))).sort()).toEqual([
      "one",
      "two",
    ]);
  });
});

describe("bundling a game's styles", () => {
  it("inlines what the stylesheet imports and publishes its fonts beside it under hashed names", async () => {
    const directory = await makeGame("styled");
    await writeFile(join(directory, "base.css"), ".a{color:red}");
    await writeFile(join(directory, "font.woff2"), "not really a font");
    await writeFile(
      join(directory, "styles.css"),
      '@import "./base.css";@font-face{font-family:F;src:url("./font.woff2") format("woff2")}.b{font-family:F}',
    );
    const out = join(scratch, "out", "styled");
    await buildGame({ directory, outDirectory: out });
    const css = await readFile(join(out, "styles.css"), "utf8");
    expect(css).toContain(".a{color:red}");
    expect(css).not.toContain("@import");
    const font = (await readdir(out)).find((name) => name.endsWith(".woff2"));
    expect(font).toMatch(/^font-[A-Z0-9]+\.woff2$/u);
    expect(css).toMatch(new RegExp(`url\\("?\\./${font ?? ""}"?\\)`, "u"));
    expect(await readFile(join(out, font ?? ""), "utf8")).toBe(
      "not really a font",
    );
  });

  it.each([
    ["an import by address", '@import "https://fonts.example.com/f.css";'],
    ["an import by url()", '@import url("https://fonts.example.com/f.css");'],
    [
      "a background by address",
      "body{background:url(https://x.example.com/a.png)}",
    ],
  ])("refuses styles with %s", async (_why, css) => {
    const directory = await makeGame("remote");
    await writeFile(join(directory, "styles.css"), css);
    await expect(
      bundleGameStyles(join(directory, "styles.css")),
    ).rejects.toThrow(/another address/u);
  });

  it("refuses an import of a file that is not there", async () => {
    const directory = await makeGame("missing");
    await writeFile(join(directory, "styles.css"), '@import "./nope.css";');
    await expect(
      bundleGameStyles(join(directory, "styles.css")),
    ).rejects.toThrow();
  });
});
