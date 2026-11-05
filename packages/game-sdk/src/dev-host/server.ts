import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { buildGame } from "../build.ts";
import { gameResponseHeaders } from "../frame-headers.ts";
import { devGameSchema, type DevConfig, type DevGame } from "./config.ts";
import { devPageCss, devPageHtml } from "./page.ts";

export { devGameSchema, type DevGame } from "./config.ts";

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// The browser half of the page, bundled once: it is this package's own file, compiled (`.js`) when installed and read as source
// (`.ts`) inside this repository.
async function bundleClient(): Promise<string> {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  const entry = fileURLToPath(
    new URL(`./client.${extension}`, import.meta.url),
  );
  const result = await build({
    bundle: true,
    entryPoints: [entry],
    format: "iife",
    logLevel: "silent",
    platform: "browser",
    write: false,
  });
  return result.outputFiles.map(({ text }) => text).join("");
}

export interface DevHost {
  close(): Promise<void>;
  readonly url: string;
}

// Serves a local test page for one game: the page, the game's built files (with the same headers the platform serves them with,
// so what the isolated frame forbids is forbidden here), and nothing else. It listens on the loopback address only, and the game
// is built again each time the page is loaded, so a change is seen on reload.
export async function startDevHost(options: {
  readonly directory: string;
  readonly game: DevGame;
  readonly host?: string;
  readonly port?: number;
}): Promise<DevHost> {
  const game = devGameSchema.parse(options.game);
  const directory = resolve(options.directory);
  const scratch = await mkdtemp(join(tmpdir(), "frostbite-dev-host-"));
  const built = join(scratch, "play", game.id);
  const client = await bundleClient();
  const config: DevConfig = { game, src: `/play/${game.id}/index.html` };
  // Builds are one at a time, so two page loads cannot write the same folder together.
  let building: Promise<void> = Promise.resolve();
  const rebuild = (): Promise<string | null> => {
    const run = building.then(() =>
      buildGame({ directory, outDirectory: built }),
    );
    building = run.catch(() => undefined);
    return run.then(
      () => null,
      (error: unknown) =>
        error instanceof Error ? error.message : "The game did not build.",
    );
  };

  const server: Server = createServer((request, response) => {
    void (async () => {
      const send = (
        status: number,
        type: string,
        body: string | Uint8Array,
        headers: Readonly<Record<string, string>> = {},
      ) => {
        response.writeHead(status, {
          "Cache-Control": "no-cache",
          "Content-Type": type,
          "X-Content-Type-Options": "nosniff",
          ...headers,
        });
        // A reply to HEAD is sent without its body by the server itself.
        response.end(body);
      };
      if (request.method !== "GET" && request.method !== "HEAD")
        return send(405, "text/plain; charset=utf-8", "Method not allowed.", {
          Allow: "GET, HEAD",
        });
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      if (path === "/") {
        const failure = await rebuild();
        return send(
          200,
          "text/html; charset=utf-8",
          failure === null
            ? devPageHtml(game.id)
            : `<!doctype html><meta charset="utf-8"><title>Build failed</title><pre>${failure.replace(/[<&>]/gu, "")}</pre>`,
        );
      }
      if (path === "/host.js")
        return send(200, contentTypes[".js"] ?? "", client);
      if (path === "/host.css")
        return send(200, contentTypes[".css"] ?? "", devPageCss);
      if (path === "/dev-config.json")
        return send(200, contentTypes[".json"] ?? "", JSON.stringify(config));
      const prefix = `/play/${game.id}/`;
      if (!path.startsWith(prefix))
        return send(404, "text/plain; charset=utf-8", "Not found.");
      // Only a file inside the game's built folder: a path that climbs out of it is not found.
      const file = resolve(
        built,
        normalize(decodeURIComponent(path.slice(prefix.length))),
      );
      if (file !== built && !file.startsWith(`${built}${sep}`))
        return send(404, "text/plain; charset=utf-8", "Not found.");
      const found = await stat(file).then(
        (entry) => entry.isFile(),
        () => false,
      );
      if (!found) return send(404, "text/plain; charset=utf-8", "Not found.");
      return send(
        200,
        contentTypes[extname(file)] ?? "application/octet-stream",
        await readFile(file),
        Object.fromEntries(
          gameResponseHeaders().map(({ key, value }) => [key, value]),
        ),
      );
    })().catch(() => {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("The test host failed.");
    });
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", done);
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("The test host has no address.");
  return {
    close: async () => {
      await new Promise<void>((done) => server.close(() => done()));
      await rm(scratch, { force: true, recursive: true });
    },
    url: `http://${address.address === "::" ? "localhost" : address.address}:${String(address.port)}`,
  };
}
