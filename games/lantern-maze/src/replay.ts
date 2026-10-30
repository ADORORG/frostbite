import { mazeRules } from "./rules/index.ts";
import { sampleRun } from "./sample-run.ts";

// What LANTERN MAZE publishes for the platform to replay a run: its rules, and one legal run that shows what they accept. The SDK's build
// turns this module into `verifier.js` next to the game, and the manifest pins that file's digest (`configs/games/lantern-maze.ts`).
// Nothing else in the game is part of the verifier.
export default mazeRules;
export const sample = sampleRun;
