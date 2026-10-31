import { cabinet, combineCabinets } from "@ador/game-sdk/cabinets";

import { castleRules } from "./castle/index.ts";
import { verifierId, verifierVersion } from "./constants.ts";
import { hillsRules } from "./hills/index.ts";
import { woodsRules } from "./woods/index.ts";

// The one verifier POCKET DRAGON publishes. The platform holds one set of rules per game, so the three chapters are combined behind it
// as cabinets: a run names its chapter in its settings (`cabinet`), and that chapter's rules replay it. Any change to any chapter's rules
// raises `verifierVersion` (and changes the digest the manifest pins).
export const pocketDragonRules = combineCabinets({
  cabinets: {
    castle: cabinet(castleRules),
    hills: cabinet(hillsRules),
    woods: cabinet(woodsRules),
  },
  id: verifierId,
  version: verifierVersion,
});
