import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

import { build } from "esbuild";

// What a game folder contains and what is published from it. `index.html`, `styles.css` and `assets/` are
// copied; `src/main.ts` (and what it imports, including the SDK) is bundled into the one `main.js` the page
// loads. Nothing else in the folder (tests, config, notes) leaves it.
const published = ["assets", "index.html", "styles.css"] as const;

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
    platform: "browser",
    target: "es2022",
    write: false,
  });
  const [output] = result.outputFiles;
  if (output === undefined) throw new Error("The game produced no script.");
  return output.text;
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
