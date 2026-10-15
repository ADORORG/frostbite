import { createVerifierRegistry } from "@ador/game-verification/registry";
import { defineVerifier } from "@ador/game-verification/verifier";
import { iceFieldRules } from "@game/frostbite/verifier";
import { iceFieldSampleRun } from "@game/frostbite/verifier-sample";

// The deterministic rules the platform replays game runs with, one explicit line per game, reviewed by pull request like
// a game manifest. A game is added here only with a sample run that passes the conformance checks
// (`apps/web/test/verifiers.unit.test.ts`). The record a game sends must name one of these and its version.
//
// FROST·BITE: the ice-field board and icicle economy. Its real-time cabinets are not replayable yet, so only the
// milestones those rules can decide (`first-win`, `first-glacier`) can ever be replay-verified; `first-cashout` stays
// self-reported. See docs/product/run-record.md.
export const verifierRegistry = createVerifierRegistry([
  {
    gameId: "frostbite",
    sample: iceFieldSampleRun(),
    verifier: defineVerifier(iceFieldRules),
  },
]);
