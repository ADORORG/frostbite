import { cabinet, combineCabinets } from "@ador/game-sdk/cabinets";

import {
  iceFieldGameId,
  iceFieldRules,
  iceFieldVerifierId,
} from "./ice-field.ts";
import { snakeCabinetName, snakeRules } from "./snake.ts";

// The one verifier FROST·BITE publishes: the platform holds one set of rules per game, so the game's replayable cabinets are
// combined behind it. A record names its cabinet in its settings (`cabinet`), and the cabinet's own rules do the rest.
// The version is the version of the whole: any change to any cabinet's rules raises it (and changes the digest the manifest
// pins), so a run begun under older rules is not replayed under newer ones.
// The game these cabinets belong to: the id its manifest is registered under.
export const frostbiteGameId = iceFieldGameId;
export const frostbiteVerifierId = "frostbite";
export const frostbiteVerifierVersion = 2;
export const iceFieldCabinetName = iceFieldVerifierId;
export { snakeCabinetName };

export const frostbiteRules = combineCabinets({
  cabinets: {
    [iceFieldCabinetName]: cabinet(iceFieldRules),
    [snakeCabinetName]: cabinet(snakeRules),
  },
  id: frostbiteVerifierId,
  version: frostbiteVerifierVersion,
});
