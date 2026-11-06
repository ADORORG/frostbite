import { resolve } from "node:path";

import type { GameRunsConfig } from "@frostbite/feature-games";

// Where the games are built and served from, and so where each game's verifier file is read. The web app runs from its own
// folder (`next dev`, `build` and `start` all do), so the games built into its `public/play` are found there; a deployment
// that serves them from elsewhere changes this one record. A game whose file is not found is logged at startup and simply
// stays self-reported, so a wrong path costs verification, never correctness.
export const gameRunsConfig = {
  playRoot: resolve(process.cwd(), "public/play"),
} satisfies GameRunsConfig;
