import type { MilestoneRules } from "../../src/rules.ts";

// A game whose milestones are all earned once, with no target: the shape every game had before progress existed.
export const rules = (ids: readonly string[]): MilestoneRules =>
  new Map(ids.map((id) => [id, { claimPolicy: "once" as const }]));
