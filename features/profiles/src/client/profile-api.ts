import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@frostbite/client-http";
import {
  checkProfileNameResponseSchema,
  checkProfileNameRoute,
  deleteProfileResponseSchema,
  deleteProfileRoute,
  getMyProfileResponseSchema,
  getMyProfileRoute,
  saveProfileResponseSchema,
  saveProfileRoute,
  type CheckProfileNameResponse,
  type DeleteProfileResponse,
  type GetMyProfileResponse,
  type SaveProfileInput,
  type SaveProfileResponse,
} from "@frostbite/shared/profiles";

// How long a request about the player's own profile may take before the page gives up and says so.
export const profileRequestTimeoutMs = 15_000;

// The player's own profile, as the setup page reaches it: same-origin requests with the player's session. A failure (including no
// session) is thrown as the requester throws it, for the caller to say.
export interface ProfileApi {
  checkName(
    name: string,
    signal?: AbortSignal,
  ): Promise<CheckProfileNameResponse>;
  getMine(): Promise<GetMyProfileResponse>;
  remove(): Promise<DeleteProfileResponse>;
  save(input: SaveProfileInput): Promise<SaveProfileResponse>;
}

export function createProfileApi(
  fetchImpl: FetchLike = sameOriginFetch,
): ProfileApi {
  const request = createRequester(fetchImpl);
  const signal = () => AbortSignal.timeout(profileRequestTimeoutMs);
  return {
    checkName: (name, outer) =>
      request(checkProfileNameRoute, checkProfileNameResponseSchema, {
        query: { name },
        signal: outer ?? signal(),
      }),
    getMine: () =>
      request(getMyProfileRoute, getMyProfileResponseSchema, {
        signal: signal(),
      }),
    remove: () =>
      request(deleteProfileRoute, deleteProfileResponseSchema, {
        body: {},
        signal: signal(),
      }),
    save: (input) =>
      request(saveProfileRoute, saveProfileResponseSchema, {
        body: input,
        signal: signal(),
      }),
  };
}
