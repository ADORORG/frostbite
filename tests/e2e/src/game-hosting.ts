import { createServer, type Server } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export interface GameRequest {
  readonly path: string;
  readonly status: number;
}

export interface HostedGame {
  close(): Promise<void>;
  // Every request the host has answered, in order.
  readonly requests: readonly GameRequest[];
  // Where the game is, as a player would open it.
  readonly url: string;
}

// Hosts a game's files the way a host does, for checking that one build works in both styles. With no base
// path the game has the whole host (the subdomain style). With one (`/frostbite`) it answers only under that
// path and refuses everything else, as a host that shares its domain among games does, so a file the game
// asks for by its root address (`/main.js`) is a 404 here exactly as it would be there. Loopback only.
export async function serveGame(
  directory: string,
  options: { readonly basePath?: string } = {},
): Promise<HostedGame> {
  const root = resolve(directory);
  const basePath = options.basePath ?? "";
  const requests: GameRequest[] = [];

  async function respond(
    target: string,
  ): Promise<{ body: Buffer; status: number; type: string }> {
    const path = decodePath(target);
    if (path === null || (basePath !== "" && !underBase(path, basePath)))
      return {
        body: Buffer.from("Not found"),
        status: 404,
        type: "text/plain",
      };
    // `/frostbite` with no closing slash is the game's own front page, as a host that redirects would show it.
    const local = path.slice(basePath.length) || "/";
    const file = resolve(
      root,
      `.${local.endsWith("/") ? `${local}index.html` : local}`,
    );
    // Whatever the request says, only a file inside the game's directory is ever read.
    if (file !== root && !file.startsWith(root + sep))
      return {
        body: Buffer.from("Not found"),
        status: 404,
        type: "text/plain",
      };
    try {
      return {
        body: await readFile(file),
        status: 200,
        type: contentTypes[extname(file)] ?? "application/octet-stream",
      };
    } catch {
      return {
        body: Buffer.from("Not found"),
        status: 404,
        type: "text/plain",
      };
    }
  }

  const server: Server = createServer((request, response) => {
    const target = request.url ?? "/";
    void respond(target.split("?")[0] ?? "/").then((answer) => {
      requests.push({ path: target, status: answer.status });
      response.writeHead(answer.status, { "content-type": answer.type });
      response.end(answer.body);
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  /* v8 ignore next 2 -- a server listening on a TCP port always reports an address with a port. */
  if (address === null || typeof address === "string")
    throw new Error("The game host has no port.");
  return {
    close: () =>
      new Promise<void>((done, fail) =>
        server.close((error) => (error === undefined ? done() : fail(error))),
      ),
    requests,
    url: `http://127.0.0.1:${String(address.port)}${basePath}/`,
  };
}

function decodePath(target: string): string | null {
  try {
    return decodeURIComponent(target);
  } catch {
    return null;
  }
}

// `/frostbite` and `/frostbite/x` are under `/frostbite`; `/frostbite-other` is not.
function underBase(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`);
}

export interface PathFinding {
  readonly file: string;
  readonly line: number;
  readonly reference: string;
}

export interface GameAudit {
  // Addresses that start at the root of the host. They break when the game is served under a base path.
  readonly rootAddresses: readonly PathFinding[];
  // Other hosts the game loads from, which the platform's host policy must allow.
  readonly externalHosts: readonly string[];
}

const rootAddressPatterns: readonly RegExp[] = [
  // HTML: src="/x", href="/x", action="/x", poster="/x"
  /\b(?:src|href|action|poster)\s*=\s*["'](\/(?!\/)[^"']*)["']/gu,
  // CSS: url(/x)
  /url\(\s*["']?(\/(?!\/)[^)"']*)["']?\s*\)/gu,
  // Script: fetch("/x"), import("/x"), new URL("/x"), XMLHttpRequest open("GET", "/x")
  /\b(?:fetch|import|URL|open)\(\s*(?:["'][A-Z]+["']\s*,\s*)?["'](\/(?!\/)[^"']*)["']/gu,
  // Script: location.href = "/x", location = "/x", location.assign("/x")
  /\blocation(?:\.href)?\s*=\s*["'](\/(?!\/)[^"']*)["']/gu,
  /\blocation\.(?:assign|replace)\(\s*["'](\/(?!\/)[^"']*)["']/gu,
];

const externalPattern = /["'(](https?:\/\/[^/"')\s]+)/gu;
const scannable = new Set([".css", ".html", ".js", ".jsx"]);

// A look through a game's files for what stops one build serving both hosting styles. It reads text and
// matches the common forms; it is a check, not a proof, and an address assembled at run time will not be
// seen. The browser run on a fixture is the proof of the method; this is how a real game is screened.
export async function auditGameDirectory(
  directory: string,
): Promise<GameAudit> {
  const root = resolve(directory);
  const rootAddresses: PathFinding[] = [];
  const external = new Set<string>();
  async function walk(folder: string): Promise<void> {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (scannable.has(extname(entry.name))) {
        const lines = (await readFile(path, "utf8")).split("\n");
        lines.forEach((text, at) => {
          // One address can fit two patterns (`location.href = "/x"` is also an `href =`); it is reported once.
          const seen = new Set<string>();
          for (const pattern of rootAddressPatterns)
            for (const match of text.matchAll(pattern)) {
              const reference = match[1] ?? "";
              if (seen.has(reference)) continue;
              seen.add(reference);
              rootAddresses.push({
                file: relative(root, path),
                line: at + 1,
                reference,
              });
            }
          for (const match of text.matchAll(externalPattern))
            // Text such as "https://…" in a comment is not an address, and must not stop the audit.
            if (match[1] !== undefined && URL.canParse(match[1]))
              external.add(new URL(match[1]).origin);
        });
      }
    }
  }
  await walk(root);
  return { externalHosts: [...external].sort(), rootAddresses };
}
