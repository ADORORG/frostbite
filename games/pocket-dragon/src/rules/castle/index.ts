import type { GameVerifier } from "@ador/game-sdk/run-record";

import { verifierVersion } from "../constants.ts";
import { noSettings, playOn, stepChapter, type Chapter } from "../held.ts";
import { maxTicks } from "./constants.ts";
import { castleEarned } from "./milestones.ts";
import { pressCastle, startCastle, tickCastle } from "./tick.ts";
import {
  castleControls,
  type CastleControl,
  type CastleState,
} from "./types.ts";

// THE GUILD AND THE CASTLE's rules as a pure state machine. Inputs: the four ways, `act` and `fire`, each pressed or let go of, and
// `end`. A way held walks tile by tile; a press bumps, talks, breathes or picks in a challenge at once. Once the banner is up only `end`
// is taken.
export const castleChapter: Chapter<CastleControl, CastleState> = {
  advanceTo: (state, tick) => playOn(state, tick, tickCastle),
  controls: castleControls,
  done: (state) => state.bannerRaised,
  maxTicks,
  pressed: pressCastle,
};

export const castleRules: GameVerifier<CastleState> = {
  earned: castleEarned,
  id: "castle",
  init: (seed, config) => noSettings(config, () => startCastle(seed)),
  step: (state, input) => stepChapter(castleChapter, state, input),
  version: verifierVersion,
};
