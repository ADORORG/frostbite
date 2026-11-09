import { z } from "zod";

// What makes a game hot, as a record: a change is a new version. Games are ranked by the runs started in the last `windowDays` days (today
// counting as the last day); a game under `minPlays` in that time is not ranked at all, so a handful of plays on a quiet platform does not
// crown anything. The first `hotCount` ranked games are the hot ones, and every ranked game gets a heat from 1 to the shared `heatLevels` against
// the busiest one, which is what the pages draw (never a count of plays).
export const hotPolicySchema = z
  .object({
    hotCount: z.int().min(1).max(10),
    minPlays: z.int().min(1),
    version: z.literal(1),
    windowDays: z.int().min(1).max(60),
  })
  .strict();
export type HotPolicy = z.infer<typeof hotPolicySchema>;

export const defaultHotPolicy: HotPolicy = hotPolicySchema.parse({
  hotCount: 3,
  minPlays: 5,
  version: 1,
  windowDays: 7,
});
