import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { startDevHost, type DevHost } from "../src/dev-host/server.ts";

let scratch = "";
let host: DevHost | null = null;
const html =
  '<!doctype html><html><body><p id="x">hi</p><script src="main.js"></script></body></html>';
const game = { capabilities: [], id: "tiny-game", milestones: [] };

async function folder(over: { html?: string; main?: string } = {}) {
  await mkdir(join(scratch, "game/src"), { recursive: true });
  await writeFile(join(scratch, "game/index.html"), over.html ?? html);
  await writeFile(
    join(scratch, "game/src/main.ts"),
    over.main ?? 'document.title = "tiny";',
  );
  await writeFile(join(scratch, "game/secret.txt"), "not published");
  return join(scratch, "game");
}
const start = async (over?: Parameters<typeof folder>[0]) => {
  host = await startDevHost({ directory: await folder(over), game });
  return host.url;
};

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "dev-host-test-"));
});
afterEach(async () => {
  await host?.close();
  host = null;
  await rm(scratch, { force: true, recursive: true });
});

describe("the local test host's pages", () => {
  it("serves the page with the game's name, one script file, and nothing inline or from another address", async () => {
    const url = await start();
    const response = await fetch(`${url}/`);
    const page = await response.text();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(page).toContain("tiny-game");
    expect(page).toContain('<script src="/host.js"></script>');
    expect(page).not.toMatch(/<script(?![^>]*src)/u);
    expect(page).not.toMatch(/https?:\/\//u);
  });

  it("serves the browser script, the styles and what the page needs to know", async () => {
    const url = await start();
    const script = await fetch(`${url}/host.js`);
    expect(script.headers.get("content-type")).toContain("javascript");
    expect((await script.text()).length).toBeGreaterThan(1_000);
    expect(
      (await fetch(`${url}/host.css`)).headers.get("content-type"),
    ).toContain("text/css");
    expect(await (await fetch(`${url}/dev-config.json`)).json()).toEqual({
      game,
      src: "/play/tiny-game/index.html",
    });
  });

  it("listens on the loopback address only", async () => {
    const url = await start();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
  });
});

describe("the game's files", () => {
  it("are built and served with the headers the platform gives them, so the frame is as isolated here", async () => {
    const url = await start();
    await fetch(`${url}/`);
    const response = await fetch(`${url}/play/tiny-game/index.html`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'none'",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox allow-scripts",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const script = await fetch(`${url}/play/tiny-game/main.js`);
    expect(script.headers.get("content-type")).toContain("javascript");
    expect(await script.text()).toContain("tiny");
  });

  it("do not include what the build does not publish", async () => {
    const url = await start();
    await fetch(`${url}/`);
    expect((await fetch(`${url}/play/tiny-game/secret.txt`)).status).toBe(404);
    expect((await fetch(`${url}/play/tiny-game/src/main.ts`)).status).toBe(404);
  });

  it.each([
    "/play/tiny-game/../../../etc/passwd",
    "/play/tiny-game/%2e%2e/%2e%2e/etc/passwd",
    "/play/tiny-game/..%2f..%2fetc%2fpasswd",
    `/play/tiny-game/${"..%2f".repeat(12)}etc%2fpasswd`,
    "/play/other-game/index.html",
    "/nothing",
    "/play/tiny-game/missing.js",
  ])("does not find %s", async (path) => {
    const url = await start();
    await fetch(`${url}/`);
    const response = await fetch(`${url}${path}`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found.");
  });

  it("answers GET and HEAD only", async () => {
    const url = await start();
    const refused = await fetch(`${url}/`, { method: "POST" });
    expect(refused.status).toBe(405);
    expect(refused.headers.get("allow")).toBe("GET, HEAD");
    const head = await fetch(`${url}/dev-config.json`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
});

describe("building the game again on each load", () => {
  it("shows the change after a reload", async () => {
    const url = await start();
    await fetch(`${url}/`);
    expect(
      await (await fetch(`${url}/play/tiny-game/main.js`)).text(),
    ).toContain("tiny");
    await writeFile(
      join(scratch, "game/src/main.ts"),
      'document.title = "changed";',
    );
    await fetch(`${url}/`);
    expect(
      await (await fetch(`${url}/play/tiny-game/main.js`)).text(),
    ).toContain("changed");
  });

  it("says why a build failed, in the page, and recovers once it is fixed", async () => {
    const url = await start({ html: "<html><body>no script</body></html>" });
    const failed = await (await fetch(`${url}/`)).text();
    expect(failed).toContain("Build failed");
    expect(failed).toContain("must load its code");
    // The message quotes markup; it is shown as text, never as a tag the page would act on.
    expect(failed).toContain('script src="main.js"');
    expect(failed).not.toContain("<script");
    await writeFile(join(scratch, "game/index.html"), html);
    expect(await (await fetch(`${url}/`)).text()).toContain("Local test host");
  });

  it("builds two page loads at once without them writing the same folder together", async () => {
    const url = await start();
    const pages = await Promise.all([1, 2, 3].map(() => fetch(`${url}/`)));
    expect(await Promise.all(pages.map((page) => page.text()))).toSatisfy(
      (texts: string[]) =>
        texts.every((text) => text.includes("Local test host")),
    );
  });
});

describe("stopping", () => {
  it("stops answering", async () => {
    const url = await start();
    await host?.close();
    host = null;
    await expect(fetch(`${url}/`)).rejects.toThrow();
  });

  it("refuses a description that is not a game, before it listens", async () => {
    await expect(
      startDevHost({
        directory: await folder(),
        game: { capabilities: [], id: "Not A Slug", milestones: [] },
      }),
    ).rejects.toThrow();
  });
});
