import { iceFieldRules } from "./verifier/ice-field.ts";
import { iceFieldSampleRun } from "./verifier/sample-run.ts";

// What FROST·BITE publishes for the platform to replay a run: its rules, and one legal run that shows what they accept. The
// SDK's build turns this module into `verifier.js` next to the game, and the manifest pins that file's digest
// (`configs/games/frostbite.ts`). Nothing else in the game is part of the verifier.
export default iceFieldRules;
export const sample = iceFieldSampleRun;
