import type { MilestoneRules } from "@ador/game-saves";

// A game whose milestones are all earned once, with no target: the shape every game had before progress existed.
export const rules = (ids: readonly string[]): MilestoneRules =>
  new Map(ids.map((id) => [id, { claimPolicy: "once" as const }]));
