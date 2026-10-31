import { pocketDragonRules } from "./rules/index.ts";
import { sampleRun } from "./sample-run.ts";

// What POCKET DRAGON publishes for the platform to replay a run: the rules of all three chapters behind one verifier, and one legal
// run that shows what they accept. The SDK's build turns this module into `verifier.js` next to the game, and the manifest pins that
// file's digest (`configs/games/pocket-dragon.ts`). Nothing else in the game is part of the verifier.
export default pocketDragonRules;
export const sample = sampleRun;
