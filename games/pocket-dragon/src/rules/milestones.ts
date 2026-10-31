import { castleMilestones } from "./castle/milestones.ts";
import { hillsMilestones } from "./hills/milestones.ts";
import { woodsMilestones } from "./woods/milestones.ts";

// Every milestone the rules can decide, chapter by chapter, in the order the manifest lists them. The platform's own test reads this list
// (`apps/web/test/games-verifiers.unit.test.ts`) and checks it is exactly the manifest's.
export const milestoneIds: readonly string[] = [
  ...hillsMilestones,
  ...woodsMilestones,
  ...castleMilestones,
];
