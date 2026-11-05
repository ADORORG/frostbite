import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { build } from "esbuild";

import { metaGlobal } from "./replay.ts";

// What a game folder contains and what is published from it. `index.html` and `assets/` are copied;
// `src/main.ts` (and what it imports, including the SDK) is bundled into the one `main.js` the page loads, and
// `styles.css` (with the stylesheets and fonts it imports) into the one `styles.css`. Nothing else in the folder
// (tests, config, notes) leaves it.
const published = ["assets", "index.html"] as const;

// The ways a page can reach beyond itself, which the isolated frame forbids: a script or style from another
// address, an inline script (the policy allows only the game's own script file), an embedded frame or form.
// Refusing them when the game is built tells the author at once, instead of a blank page in the browser.
export function checkGameHtml(html: string): string[] {
  const problems: string[] = [];
  if (/\b(?:src|href|action|poster)\s*=\s*["']\s*(?:https?:)?\/\//iu.test(html))
    problems.push(
      "The page loads something from another address; everything must be bundled with the game.",
    );
  if (/<script\b(?![^>]*\bsrc\s*=)/iu.test(html))
    problems.push(
      "The page has an inline script; put the code in src/main.ts.",
    );
  if (/<(?:iframe|form|object|embed)\b/iu.test(html))
    problems.push(
      "The page embeds a frame, form or object, which a game may not.",
    );
  if (/\son[a-z]+\s*=/iu.test(html))
    problems.push(
      "The page has an inline event handler; attach handlers in src/main.ts.",
    );
  if (!/<script\b[^>]*\bsrc\s*=\s*["']main\.js["']/iu.test(html))
    problems.push('The page must load its code with <script src="main.js">.');
  return problems;
}

// The game's code as one script: no modules to fetch, nothing evaluated at run time, nothing from the network.
export async function bundleGameScript(entry: string): Promise<string> {
  const result = await build({
    bundle: true,
    entryPoints: [entry],
    format: "iife",
    legalComments: "none",
    logLevel: "silent",
    minify: true,
    platform: "browser",
    target: "es2022",
    write: false,
  });
  const [output] = result.outputFiles;
  if (output === undefined) throw new Error("The game produced no script.");
  return output.text;
}

// What a game's verifier artifact is, as published next to its bundle: the rules' id and version, and the SHA-256 and size of
// `verifier.js`. The platform pins the digest in the game's manifest and refuses an artifact that does not match it.
export interface VerifierArtifact {
  readonly bytes: number;
  readonly code: string;
  readonly id: string;
  readonly sha256: string;
  readonly version: number;
}

const replaySource = fileURLToPath(new URL("./replay.ts", import.meta.url));
// The name a verifier entry imports the SDK's wrapper by; the build points it at the SDK's own copy, so a game needs no
// dependency or import for it.
const replaySpecifier = "@frostbite/game-sdk/replay";

// A game that has `src/replay.ts` publishes its rules for the platform to replay runs with. That module exports the rules
// (`export default`, a `GameVerifier`) and one legal sample run (`export function sample()`); this bundles them with the SDK's
// small wrapper into one script that, once run, leaves a function from a record as text to an outcome as text. A game without
// the module publishes nothing and its milestones stay self-reported.
export async function bundleVerifier(
  directory: string,
): Promise<VerifierArtifact | null> {
  const entry = join(directory, "src/replay.ts");
  const exists = await stat(entry).then(
    () => true,
    () => false,
  );
  if (!exists) return null;
  const result = await build({
    alias: { [replaySpecifier]: replaySource },
    bundle: true,
    format: "iife",
    legalComments: "none",
    logLevel: "silent",
    minify: true,
    platform: "neutral",
    stdin: {
      contents: `import rules, { sample } from ${JSON.stringify(entry)};
import { exposeReplay } from ${JSON.stringify(replaySpecifier)};
exposeReplay(rules, sample());`,
      loader: "ts",
      resolveDir: directory,
      sourcefile: "verifier-entry.ts",
    },
    target: "es2022",
    write: false,
  }).catch((error: unknown) => {
    throw new Error(
      `${entry}: it must export the rules as the default export and a sample() run (${error instanceof Error ? error.message : "it failed"}).`,
      { cause: error },
    );
  });
  const [output] = result.outputFiles;
  if (output === undefined)
    throw new Error(`${entry}: the verifier produced no script.`);
  // Run once in a scope of its own to read the rules' identity; a module that does not export what is expected fails here,
  // when the game is built, not when a player's run is checked.
  const scope: Record<string, unknown> = {};
  try {
    runInNewContext(output.text, scope);
  } catch (error) {
    throw new Error(
      `${entry}: it must export the rules as the default export and a sample() run (${error instanceof Error ? error.message : "it failed"}).`,
      { cause: error },
    );
  }
  const meta: unknown = JSON.parse(String(scope[metaGlobal] ?? "null"));
  if (
    typeof meta !== "object" ||
    meta === null ||
    !("id" in meta) ||
    !("version" in meta) ||
    typeof meta.id !== "string" ||
    typeof meta.version !== "number"
  )
    throw new Error(`${entry}: the rules must have an id and a version.`);
  const bytes = new TextEncoder().encode(output.text);
  return {
    bytes: bytes.length,
    code: output.text,
    id: meta.id,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    version: meta.version,
  };
}

// A stylesheet an `@import` or `url()` reaches by address would be refused by the isolated frame, which allows
// only the game's own files. Refusing it when the game is built tells the author at once.
const remoteStyleReference =
  /(?:@import\s*(?:url\(\s*)?|url\(\s*)["']?\s*(?:https?:)?\/\//iu;

// The game's styles as files to publish: `styles.css` with every `@import` inlined, and each font or image it
// names copied beside it under a hashed name the stylesheet points to. Imports resolve like a module's, so a
// package's own stylesheet (a bundled font) can be imported by name.
export async function bundleGameStyles(
  entry: string,
): Promise<
  readonly { readonly contents: Uint8Array; readonly path: string }[]
> {
  const outdir = resolve("/", "game-styles");
  const result = await build({
    assetNames: "[name]-[hash]",
    bundle: true,
    entryPoints: [entry],
    legalComments: "none",
    loader: {
      ".gif": "file",
      ".jpg": "file",
      ".png": "file",
      ".svg": "file",
      ".webp": "file",
      ".woff": "file",
      ".woff2": "file",
    },
    logLevel: "silent",
    minify: true,
    outdir,
    write: false,
  });
  const files = result.outputFiles.map(({ contents, path }) => ({
    contents,
    path: relative(outdir, path),
  }));
  for (const file of files)
    if (
      file.path.endsWith(".css") &&
      remoteStyleReference.test(new TextDecoder().decode(file.contents))
    )
      throw new Error(
        `${entry}: the styles load something from another address; everything must be bundled with the game.`,
      );
  return files;
}

// Builds one game folder into `outDirectory`, replacing what was there.
export async function buildGame(options: {
  readonly directory: string;
  readonly outDirectory: string;
}): Promise<void> {
  const directory = resolve(options.directory);
  const html = await readFile(join(directory, "index.html"), "utf8");
  const problems = checkGameHtml(html);
  if (problems.length > 0)
    throw new Error(`${directory}/index.html: ${problems.join(" ")}`);
  const script = await bundleGameScript(join(directory, "src/main.ts"));
  await rm(options.outDirectory, { force: true, recursive: true });
  await mkdir(options.outDirectory, { recursive: true });
  for (const name of published) {
    const source = join(directory, name);
    if (
      await stat(source).then(
        () => true,
        () => false,
      )
    )
      await cp(source, join(options.outDirectory, name), { recursive: true });
  }
  await writeFile(join(options.outDirectory, "main.js"), script);
  const verifier = await bundleVerifier(directory);
  if (verifier !== null) {
    await writeFile(join(options.outDirectory, "verifier.js"), verifier.code);
    await writeFile(
      join(options.outDirectory, "verifier.json"),
      `${JSON.stringify({ bytes: verifier.bytes, id: verifier.id, sha256: verifier.sha256, version: verifier.version }, null, 2)}\n`,
    );
  }
  const styles = join(directory, "styles.css");
  if (
    await stat(styles).then(
      () => true,
      () => false,
    )
  )
    for (const file of await bundleGameStyles(styles))
      await writeFile(join(options.outDirectory, file.path), file.contents);
}

// Builds every game folder under `gamesDirectory` into `outRoot/<folder name>`.
export async function buildGames(options: {
  readonly gamesDirectory: string;
  readonly outRoot: string;
}): Promise<string[]> {
  const entries = await readdir(options.gamesDirectory, {
    withFileTypes: true,
  });
  const built: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await buildGame({
      directory: join(options.gamesDirectory, entry.name),
      outDirectory: join(options.outRoot, entry.name),
    });
    built.push(entry.name);
  }
  return built;
}
