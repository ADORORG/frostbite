import type {
  CheckProfileNameResponse,
  GetMyProfileResponse,
  ProfileView,
  SaveProfileInput,
  SaveProfileResponse,
} from "@frostbite/shared/profiles";
import { vi } from "vitest";

import type { ProfileApi } from "../../src/client/profile-api.ts";

export const policy = { changeCooldownDays: 30, maxLength: 20, minLength: 3 };
export const saved: ProfileView = {
  avatar: "fox",
  canChangeNameAt: null,
  memberSince: "2026-11-01T00:00:00.000Z",
  name: "IceAda",
  visible: true,
};

// The page's server, faked at its edge: each call is a spy with a plausible answer, and a test replaces the one it is about.
export function fakeApi(
  over: {
    readonly check?: (name: string) => CheckProfileNameResponse;
    readonly mine?: GetMyProfileResponse | Error;
    readonly save?: (input: SaveProfileInput) => SaveProfileResponse | Error;
  } = {},
) {
  const mine = over.mine ?? { policy, profile: null };
  return {
    checkName: vi.fn(async (name: string) =>
      (over.check ?? (() => ({ status: "available" as const })))(name),
    ),
    getMine: vi.fn(async () => {
      if (mine instanceof Error) throw mine;
      return mine;
    }),
    remove: vi.fn(async () => ({ deleted: true })),
    save: vi.fn(async (input: SaveProfileInput) => {
      const answer = (
        over.save ??
        ((made): SaveProfileResponse => ({
          profile: { ...saved, ...made },
          status: "saved",
        }))
      )(input);
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  } satisfies ProfileApi;
}
