import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readGameCover } from "../src/server/metadata/game-cover";
import {
  shareCardColors,
  shareCardResponse,
} from "../src/server/metadata/share-card";

const tokens = readFileSync(
  new URL("../../../packages/ui/src/tokens.css", import.meta.url),
  "utf8",
);
const token = (name: string) =>
  new RegExp(`--arcade-${name}:\\s*(#[0-9a-f]{6})`, "iu").exec(tokens)?.[1];

describe("the share card's colours", () => {
  it("are the arcade's own, so the picture cannot drift from the page", () => {
    expect(shareCardColors).toEqual({
      accent: token("cyan"),
      background: token("canvas"),
      border: token("border-strong"),
      highlight: token("yellow"),
      muted: token("text-muted"),
      surface: token("surface-raised"),
      text: token("text"),
    });
  });
});

describe("the share card", () => {
  async function png(picture: string | null) {
    const response = shareCardResponse(
      {
        kicker: "Game",
        picture,
        subtitle: "x".repeat(300),
        title: "t".repeat(200),
      },
      "public, max-age=1",
    );
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      response,
    };
  }

  it("is a 1200 by 630 PNG that carries the cache policy it was given", async () => {
    const { bytes, response } = await png(null);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=1");
    const view = new DataView(bytes.buffer);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
  });

  it("draws with a picture, and still within size, when it has one", async () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>').toString("base64")}`;
    const { bytes } = await png(svg);
    const view = new DataView(bytes.buffer);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
  });
});

describe("a game's cover for the card", () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cover-"));
    const assets = path.join(root, "play", "a-game", "assets");
    await mkdir(assets, { recursive: true });
    await writeFile(path.join(assets, "cover.svg"), "<svg/>");
    await writeFile(path.join(assets, "cover.png"), Buffer.from([1, 2, 3]));
    await writeFile(path.join(assets, "cover.webp"), Buffer.from([1]));
    await writeFile(path.join(assets, "huge.png"), Buffer.alloc(2_000_001));
    await writeFile(path.join(root, "secret.png"), Buffer.from([9]));
    await symlink(path.join(root, "secret.png"), path.join(assets, "link.png"));
  });
  afterAll(() => rm(root, { force: true, recursive: true }));

  it("is read from the game's assets as a data address", async () => {
    expect(await readGameCover("a-game", "cover.svg", root)).toBe(
      `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
    );
    expect(await readGameCover("a-game", "cover.png", root)).toBe(
      "data:image/png;base64,AQID",
    );
  });

  it("is left out when it is missing, too large, or a kind the card cannot draw", async () => {
    expect(await readGameCover("a-game", "absent.png", root)).toBeNull();
    expect(await readGameCover("other-game", "cover.png", root)).toBeNull();
    expect(await readGameCover("a-game", "huge.png", root)).toBeNull();
    expect(await readGameCover("a-game", "cover.webp", root)).toBeNull();
  });

  it("never leaves the game's own assets folder", async () => {
    expect(
      await readGameCover("a-game", "../../../secret.png", root),
    ).toBeNull();
    expect(await readGameCover("a-game", "../cover.png", root)).toBeNull();
    expect(await readGameCover("../a-game", "cover.png", root)).toBeNull();
    expect(await readGameCover("a-game", "link.png", root)).toBeNull();
  });
});
