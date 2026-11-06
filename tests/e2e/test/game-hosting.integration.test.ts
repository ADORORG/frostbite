import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  auditGameDirectory,
  serveGame,
  type HostedGame,
} from "../src/game-hosting.ts";

const fixtures = new URL("../fixtures/", import.meta.url).pathname;
let hosts: HostedGame[] = [];
let scratch = "";

async function host(directory: string, basePath?: string) {
  const hosted = await serveGame(directory, { basePath });
  hosts.push(hosted);
  return hosted;
}
const get = async (url: string) => {
  const response = await fetch(url);
  return {
    body: await response.text(),
    status: response.status,
    type: response.headers.get("content-type"),
  };
};

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "game-hosting-"));
});
afterEach(async () => {
  await Promise.all(hosts.map((hosted) => hosted.close()));
  hosts = [];
  await rm(scratch, { force: true, recursive: true });
});

describe("hosting a game", () => {
  it("gives a game the whole host (subdomain style) and serves each file with its type", async () => {
    const hosted = await host(`${fixtures}hosted-game`);
    expect(hosted.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/u);
    expect(await get(hosted.url)).toMatchObject({
      status: 200,
      type: "text/html; charset=utf-8",
    });
    expect(await get(`${hosted.url}styles.css`)).toMatchObject({
      type: "text/css; charset=utf-8",
    });
    expect(await get(`${hosted.url}main.js`)).toMatchObject({
      type: "text/javascript; charset=utf-8",
    });
    expect(await get(`${hosted.url}data/levels.json`)).toMatchObject({
      type: "application/json; charset=utf-8",
    });
    expect(await get(`${hosted.url}assets/art.svg`)).toMatchObject({
      type: "image/svg+xml",
    });
    expect((await get(`${hosted.url}nope.html`)).status).toBe(404);
  });

  it("answers only under the base path when the game lives under one (domain-path style)", async () => {
    const hosted = await host(`${fixtures}hosted-game`, "/hosted");
    expect(hosted.url.endsWith("/hosted/")).toBe(true);
    expect((await get(hosted.url)).status).toBe(200);
    expect((await get(`${hosted.url}main.js`)).status).toBe(200);
    const origin = new URL(hosted.url).origin;
    // The same files are not there at the root, nor under a path that merely starts the same.
    expect((await get(`${origin}/main.js`)).status).toBe(404);
    expect((await get(`${origin}/`)).status).toBe(404);
    expect((await get(`${origin}/hosted-other/main.js`)).status).toBe(404);
    expect((await get(`${origin}/hosted`)).status).toBe(200);
  });

  it("serves identical bytes in both styles, so one build serves both", async () => {
    const whole = await host(`${fixtures}hosted-game`);
    const under = await host(`${fixtures}hosted-game`, "/play/hosted");
    for (const file of [
      "",
      "styles.css",
      "main.js",
      "data/levels.json",
      "assets/art.svg",
    ])
      expect((await get(`${under.url}${file}`)).body).toBe(
        (await get(`${whole.url}${file}`)).body,
      );
  });

  it("never reads a file outside the game's directory", async () => {
    await mkdir(join(scratch, "game"));
    await writeFile(join(scratch, "game", "index.html"), "game");
    await writeFile(join(scratch, "secret.txt"), "secret");
    // A file the game does serve, so a bad request read as this one would show up as a 200.
    await writeFile(join(scratch, "game", "ok"), "ok");
    const hosted = await host(join(scratch, "game"));
    const origin = new URL(hosted.url).origin;
    for (const path of [
      "/../secret.txt",
      "/%2e%2e/secret.txt",
      "/..%2fsecret.txt",
      "/%E0%A4%A",
    ])
      expect((await get(`${origin}${path}`)).status).toBe(404);
    expect((await get(hosted.url)).body).toBe("game");
  });

  it("needs no options to give a game the whole host", async () => {
    const hosted = await serveGame(`${fixtures}hosted-game`);
    hosts.push(hosted);
    expect((await get(hosted.url)).status).toBe(200);
  });

  it("serves a file of a type it does not know as plain bytes", async () => {
    await mkdir(join(scratch, "game"));
    await writeFile(join(scratch, "game", "data.bin"), "bytes");
    const hosted = await host(join(scratch, "game"));
    expect(await get(`${hosted.url}data.bin`)).toMatchObject({
      body: "bytes",
      type: "application/octet-stream",
    });
  });

  it("records every request and the answer it was given", async () => {
    const hosted = await host(`${fixtures}hosted-game`);
    await get(hosted.url);
    await get(`${hosted.url}missing.js`);
    expect(hosted.requests).toEqual([
      { path: "/", status: 200 },
      { path: "/missing.js", status: 404 },
    ]);
  });
});

describe("auditing a game's addresses", () => {
  it("finds nothing in a game that names everything relative to its page", async () => {
    expect(await auditGameDirectory(`${fixtures}hosted-game`)).toEqual({
      externalHosts: [],
      rootAddresses: [],
    });
  });

  it("finds every form of root address, with its file and line", async () => {
    await writeFile(
      join(scratch, "index.html"),
      '<link rel="stylesheet" href="/a.css">\n<script src=\'/b.js\'></script>\n<a href="//cdn.example.com/x">protocol-relative is not root</a>\n<a href="/">home</a>\n<form action="/submit"></form>',
    );
    await writeFile(
      join(scratch, "style.css"),
      "body { background: url(/img.png); }\n.x { background: url('/y.png') }\n.ok { background: url(img/z.png) }",
    );
    await writeFile(
      join(scratch, "app.js"),
      'fetch("/api/run", {});\nconst u = new URL("/x", base);\nimport("/m.js");\nxhr.open("POST", "/post");\nlocation.href = "/home";\nlocation.assign("/next");\nfetch("relative/ok");',
    );
    const { rootAddresses } = await auditGameDirectory(scratch);
    expect(
      rootAddresses
        .map(
          ({ file, line, reference }) => `${file}:${String(line)} ${reference}`,
        )
        .sort(),
    ).toEqual(
      [
        "app.js:1 /api/run",
        "app.js:2 /x",
        "app.js:3 /m.js",
        "app.js:4 /post",
        "app.js:5 /home",
        "app.js:6 /next",
        "index.html:1 /a.css",
        "index.html:2 /b.js",
        "index.html:4 /",
        "index.html:5 /submit",
        "style.css:1 /img.png",
        "style.css:2 /y.png",
      ].sort(),
    );
  });

  it("lists the other hosts a game loads from, once each, and reads nested folders", async () => {
    await mkdir(join(scratch, "deep"));
    await writeFile(
      join(scratch, "index.html"),
      '<script src="https://unpkg.com/a.js"></script><link href="https://fonts.googleapis.com/css2?x">',
    );
    await writeFile(
      join(scratch, "deep", "b.jsx"),
      'const u = "https://unpkg.com/b.js"; const v = "http://localhost:3000/x";',
    );
    await writeFile(
      join(scratch, "deep", "image.png"),
      "https://ignored.example.com",
    );
    const { externalHosts } = await auditGameDirectory(scratch);
    expect(externalHosts).toEqual([
      "http://localhost:3000",
      "https://fonts.googleapis.com",
      "https://unpkg.com",
    ]);
  });

  it("ignores text that only looks like an address", async () => {
    await writeFile(
      join(scratch, "a.js"),
      'const hint = "https://…";\nconst x = "https://real.example.com/a";',
    );
    expect((await auditGameDirectory(scratch)).externalHosts).toEqual([
      "https://real.example.com",
    ]);
  });

  it("flags the fixture that is known to break under a base path", async () => {
    const { rootAddresses } = await auditGameDirectory(
      `${fixtures}broken-game`,
    );
    expect(rootAddresses.map(({ reference }) => reference).sort()).toEqual([
      "/main.js",
      "/styles.css",
    ]);
  });
});
