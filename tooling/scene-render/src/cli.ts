import { resolve } from "node:path";

import { scenes } from "@ador/scenes/library";

import { renderScene } from "./render.ts";

// pnpm scenes:render --out <directory> [--scene <id>]
function option(name: string): string | null {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? null : (process.argv[at + 1] ?? null);
}

const out = option("out");
if (out === null) {
  console.error("Say where to put the files: --out <directory>.");
  process.exit(1);
}
const only = option("scene");
const chosen = scenes.filter(({ id }) => only === null || id === only);
if (chosen.length === 0) {
  console.error(`There is no scene "${only ?? ""}".`);
  process.exit(1);
}
for (const scene of chosen) {
  const written = await renderScene(scene, resolve(out));
  console.log(`${scene.id}: ${written.length} files`);
}
