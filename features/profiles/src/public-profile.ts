import type { PublicProfileView } from "@frostbite/shared/profiles";

import type { ProfilesRuntime } from "./runtime.ts";

// The public view of one player's profile, by name, or null for a name nobody shows (no such name, a hidden profile, a name that cannot be
// one). The one place a public profile is assembled, so the page and the API cannot differ.
export async function loadPublicProfile(
  { data, service }: ProfilesRuntime,
  name: string,
): Promise<PublicProfileView | null> {
  const profile = await service.getPublic(name);
  if (profile === null) return null;
  const { bests, mints } = await data.load(profile.userId);
  return {
    avatar: profile.avatar,
    bests: [...bests],
    memberSince: profile.createdAt.toISOString(),
    mints: [...mints],
    name: profile.name,
  };
}
