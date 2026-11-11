import { rules } from "./rules/index.ts";
import { sampleRun } from "./sample-run.ts";

// What this game publishes for the platform to replay a run: its rules, and one legal run that shows what they accept. The build turns this
// module into `verifier.js` next to the game. Nothing else in the game is part of the verifier.
export default rules;
export const sample = sampleRun;
