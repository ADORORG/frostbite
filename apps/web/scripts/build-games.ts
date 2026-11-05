import { resolve } from "node:path";

import { buildGames } from "@frostbite/game-sdk/build";

// Builds every game under /games into public/play/<folder>, the files the platform serves and plays in its
// isolated frame. A game whose page reaches beyond its own files fails the build here, not in a browser.
const applicationRoot = resolve(import.meta.dirname, "..");
const built = await buildGames({
  gamesDirectory: resolve(applicationRoot, "../../games"),
  outRoot: resolve(applicationRoot, "public/play"),
});
console.log(`Built games: ${built.join(", ") || "none"}`);
