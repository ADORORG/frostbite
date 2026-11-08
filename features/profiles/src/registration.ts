import { defineFeature } from "@frostbite/plugin-kit";
import type { ProfilePolicy } from "@frostbite/profiles";
import type { ShareConfig } from "@frostbite/share";
import type { ChainOption } from "@frostbite/shared/chain";
import type { GameManifest } from "@frostbite/shared/games";
import {
  checkProfileNameRoute,
  deleteProfileRoute,
  getMyProfileRoute,
  getPublicProfileRoute,
  profilePagePath,
  profileSetupPath,
  saveProfileRoute,
} from "@frostbite/shared/profiles";

export type { ProfilePolicy } from "@frostbite/profiles";

// A player's profile: a name and a preset picture they choose, an opt-in public page at `/p/<name>` that shows their best verified scores and
// the milestones they have minted, and the page where they set it up. The games it reads are supplied explicitly (the same list the games
// feature gets), so removing this one registration removes the pages and the routes, and nothing else changes.
export function createProfilesFeature(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
  policy: ProfilePolicy,
  share?: ShareConfig,
) {
  return defineFeature({
    manifest: {
      capabilities: ["api-routes", "authenticated-page", "public-page"],
      dependencies: ["accounts", "games"],
      id: "profiles",
      navigation: [],
      pages: [
        { access: { kind: "authenticated" }, path: profileSetupPath },
        { access: { kind: "public" }, path: profilePagePath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [
        getMyProfileRoute,
        checkProfileNameRoute,
        saveProfileRoute,
        deleteProfileRoute,
        getPublicProfileRoute,
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@frostbite/feature-profiles/entrypoint").then(
        ({ createProfilesEntrypoint }) =>
          createProfilesEntrypoint(games, chains, policy, share),
      ),
  });
}
