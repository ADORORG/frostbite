import { snowballRules } from "./rules/index.ts";
import { sampleRun } from "./sample-run.ts";

// What SNOWBALL DASH publishes for the platform to replay a run: its rules, and one legal run that shows what they accept. The SDK's
// build turns this module into `verifier.js` next to the game, and the manifest pins that file's digest (`configs/games/snowball-dash.ts`).
// Nothing else in the game is part of the verifier.
export default snowballRules;
export const sample = sampleRun;
