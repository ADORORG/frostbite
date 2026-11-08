import type { PublicGame } from "@frostbite/feature-games/catalog";

// A game as the public pages show it, for tests: the title and milestones are what the profile page reads.
export const game = (
  id: string,
  title: string,
  milestones: readonly { readonly id: string; readonly title: string }[] = [],
): PublicGame => ({
  capabilities: [],
  claimable: true,
  cover: null,
  description: `${title} description.`,
  embedSrc: null,
  hash: "hash",
  id,
  milestones: milestones.map(({ id: milestoneId, title: milestoneTitle }) => ({
    claimPolicy: "once",
    criteria: "Do the thing.",
    description: "A milestone.",
    id: milestoneId,
    title: milestoneTitle,
  })),
  networkLabel: "Testnet",
  playable: true,
  playUrl: null,
  scene: null,
  summary: `${title} summary.`,
  tags: [],
  title,
  version: "1.0.0",
});

export const runner = game("frost-runner", "Frost Runner", [
  { id: "first-run", title: "First Run" },
]);
export const stacker = game("tower-stack", "Tower Stacker", [
  { id: "ten-high", title: "Ten High" },
]);
