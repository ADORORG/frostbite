import { chainOptionSchema } from "@frostbite/shared/chain";
import { defineGame } from "@frostbite/shared/games";

const signet = "bip122:00000008819873e925422c1ff0f99f7c";

export const chains = [
  chainOptionSchema.parse({
    chainId: signet,
    displayName: "Bitcoin signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  }),
];

// One listed game with a milestone, for the pages that read the platform's list.
export const profileGame = defineGame({
  capabilities: [],
  description: "A game the profile tests list.",
  id: "profile-game",
  launch: {
    basePath: "",
    mode: "external",
    returnUrl: null,
    url: "https://play.example.test",
  },
  milestones: [
    {
      claimPolicy: "once",
      criteria: "Finish the first level.",
      description: "You finished the first level.",
      id: "first-level",
      title: "First level",
    },
  ],
  network: signet,
  schemaVersion: 1,
  summary: "Shows what the profile page reads.",
  tags: ["arcade"],
  title: "Profile game",
  version: "0.1.0",
});
export const games = [profileGame];
