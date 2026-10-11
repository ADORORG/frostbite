import { chainOptionSchema } from "@ador/shared/chain";
import { defineGame } from "@ador/shared/games";

export const signet = "bip122:00000008819873e925422c1ff0f99f7c";

export const chains = [
  chainOptionSchema.parse({
    chainId: signet,
    displayName: "Bitcoin signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  }),
];

// The template: what a game's file looks like when it declares everything the manifest can. Onboarding a game
// is writing a file like this and adding it to the platform's list; nothing else changes.
export const templateGame = defineGame({
  capabilities: ["wallet", "run:submit"],
  description: "A game written from the template.",
  id: "template-game",
  launch: {
    basePath: "/template",
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
    {
      claimPolicy: "repeatable",
      criteria: "Score 100 points in a run.",
      description: "A century.",
      id: "century",
      title: "Century",
    },
  ],
  network: signet,
  schemaVersion: 1,
  summary: "Shows what a registered game looks like.",
  title: "Template game",
  version: "0.3.0",
});

// A game that is registered but has nothing to play yet, and declares nothing.
export const bareGame = defineGame({
  capabilities: [],
  description: "",
  id: "bare-game",
  launch: { basePath: "", mode: "external", returnUrl: null, url: null },
  milestones: [],
  network: "eip155:1",
  schemaVersion: 1,
  summary: "Registered, not playable.",
  title: "Bare game",
  version: "0.0.1",
});
