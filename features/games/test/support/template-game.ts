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
      maxCount: 100,
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

// A game the platform plays itself, in its isolated frame.
export const embeddedGame = defineGame({
  capabilities: [],
  description: "",
  id: "embedded-game",
  launch: { mode: "embedded" },
  milestones: templateGame.milestones,
  network: signet,
  schemaVersion: 1,
  summary: "Played on this page.",
  title: "Embedded game",
  version: "1.0.0",
});

// A game the platform plays itself that has a cover: a picture and a short clip, both files of the game.
export const coveredGame = defineGame({
  ...embeddedGame,
  cover: {
    alt: "A tower of blocks, one tap from falling.",
    image: "cover.webp",
    video: "cover.mp4",
  },
  id: "covered-game",
  title: "Covered game",
});

// A game the platform plays itself that asks to see the player's wallet, and for something it does not grant.
export const walletGame = defineGame({
  ...embeddedGame,
  capabilities: ["wallet", "balance:read"],
  id: "wallet-game",
  title: "Wallet game",
});

export const walletConfig = {
  network: "signet",
} as const;

// Never read by a page; the runs routes read it only when a run is started.
export const runsConfig = { playRoot: "/nonexistent/play" } as const;
