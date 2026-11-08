import { createGameCatalog } from "@frostbite/feature-games/catalog";
import { registerHttpOperation } from "@frostbite/http/registered-operation";
import type { FeatureEntrypoint } from "@frostbite/plugin-kit";
import { privatePage } from "@frostbite/plugin-kit/page-metadata";
import type { ProfilePolicy } from "@frostbite/profiles";
import type { ShareConfig } from "@frostbite/share";
import type { ChainOption } from "@frostbite/shared/chain";
import type { GameManifest } from "@frostbite/shared/games";
import {
  getPublicProfileInputSchema,
  profilePagePath,
  profileSetupPath,
} from "@frostbite/shared/profiles";

import {
  createCheckProfileNameOperation,
  createDeleteProfileOperation,
  createGetMyProfileOperation,
  createSaveProfileOperation,
} from "./application/profile-operations.ts";
import { createGetPublicProfileOperation } from "./application/public-operation.ts";
import { publicProfileModel } from "./domain/public-model.ts";
import { profileMetadata } from "./metadata.ts";
import { loadPublicProfile } from "./public-profile.ts";
import { createProfilesResolver } from "./runtime.ts";
import { ProfileNotFound, PublicProfile } from "./ui/public-profile.tsx";
import { ProfileSetup } from "./ui/profile-setup.tsx";

export function createProfilesEntrypoint(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
  policy: ProfilePolicy,
  share?: ShareConfig,
): FeatureEntrypoint {
  const catalog = createGameCatalog(games, chains);
  const runtime = createProfilesResolver(
    policy,
    new Set(games.map(({ id }) => id)),
  );
  const service = async () => (await runtime()).service;
  // The profile a page asks for by name, or null for a name that is not one or that nobody shows.
  const viewOf = async (name: string | undefined) => {
    const parsed = getPublicProfileInputSchema.safeParse({ name });
    return parsed.success
      ? await loadPublicProfile(await runtime(), parsed.data.name)
      : null;
  };
  return {
    capabilities: ["api-routes", "authenticated-page", "public-page"],
    id: "profiles",
    operations: [
      registerHttpOperation(createGetMyProfileOperation(service)),
      registerHttpOperation(createCheckProfileNameOperation(service)),
      registerHttpOperation(createSaveProfileOperation(service)),
      registerHttpOperation(createDeleteProfileOperation(service)),
      registerHttpOperation(createGetPublicProfileOperation(runtime)),
    ],
    pages: [
      {
        access: { kind: "authenticated" },
        metadata: () => privatePage,
        path: profileSetupPath,
        render: ({ navigation }) => (
          <ProfileSetup
            navigation={navigation}
            {...(share === undefined ? {} : { share })}
          />
        ),
      },
      {
        access: { kind: "public" },
        metadata: async ({ params }) =>
          profileMetadata(await viewOf(params.name)),
        path: profilePagePath,
        render: async ({ navigation, params }) => {
          const view = await viewOf(params.name);
          return view === null ? (
            <ProfileNotFound navigation={navigation} />
          ) : (
            <PublicProfile
              model={publicProfileModel(view, catalog.list())}
              navigation={navigation}
              {...(share === undefined ? {} : { share })}
            />
          );
        },
      },
    ],
    version: "1.0.0",
  };
}
