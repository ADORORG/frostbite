import { cabinet, combineCabinets } from "@frostbite/game-sdk/cabinets";

import { castleRules } from "./castle/index.ts";
import { verifierId, verifierVersion } from "./constants.ts";
import { hillsRules } from "./hills/index.ts";
import { questRules } from "./quest/index.ts";
import { woodsRules } from "./woods/index.ts";

// The one verifier POCKET DRAGON publishes. The platform holds one set of rules per game, so the three levels and the whole quest are
// combined behind it as cabinets: a run names what was played in its settings (`cabinet`), and those rules replay it. Any change to any
// level's rules raises `verifierVersion` (and changes the digest the manifest pins).
export const pocketDragonRules = combineCabinets({
  cabinets: {
    castle: cabinet(castleRules),
    hills: cabinet(hillsRules),
    quest: cabinet(questRules),
    woods: cabinet(woodsRules),
  },
  id: verifierId,
  version: verifierVersion,
});
