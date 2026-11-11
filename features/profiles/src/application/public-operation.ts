import type { HttpOperation } from "@frostbite/http";
import type { HttpCachePolicy } from "@frostbite/http/cache";
import { failure } from "@frostbite/http/outcome";
import {
  getPublicProfileInputSchema,
  getPublicProfileRoute,
  publicProfileSchema,
  type GetPublicProfileInput,
  type PublicProfileView,
} from "@frostbite/shared/profiles";

import { loadPublicProfile } from "../public-profile.ts";
import type { ProfilesRuntime } from "../runtime.ts";

// How long a browser or the edge keeps a profile: a new best or a mint may take a minute to show, and a page anyone can open should not
// be read from the database by everyone. Switching a profile off may take as long to take effect.
export const publicProfileCache = {
  kind: "max-age",
  seconds: 60,
} as const satisfies HttpCachePolicy;

// The public view of one player's profile, by name. A name nobody holds, a hidden profile and a name that cannot be one answer alike
// ("not found"), so the address says nothing about which it was. It names nothing but the player's chosen name and what they earned.
export function createGetPublicProfileOperation(
  getRuntime: () => Promise<ProfilesRuntime>,
) {
  return {
    access: { kind: "public" },
    applicationErrors: ["not_found"],
    cache: publicProfileCache,
    execute: async (input) => {
      const view = await loadPublicProfile(await getRuntime(), input.name);
      return view === null
        ? failure("not_found", "No such player.")
        : ({ ok: true, value: view } as const);
    },
    idempotency: "none",
    input: "query",
    inputSchema: getPublicProfileInputSchema,
    outputSchema: publicProfileSchema,
    ...getPublicProfileRoute,
  } satisfies HttpOperation<GetPublicProfileInput, PublicProfileView>;
}
