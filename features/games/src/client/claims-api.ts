import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@ador/client-http";
import {
  listGameClaimsResponseSchema,
  listGameClaimsRoute,
  refreshGameClaimResponseSchema,
  refreshGameClaimRoute,
  startGameClaimResponseSchema,
  startGameClaimRoute,
  submitGameClaimResponseSchema,
  submitGameClaimRoute,
  type ListGameClaimsResponse,
  type RefreshGameClaimResponse,
  type StartGameClaimInput,
  type StartGameClaimResponse,
  type SubmitGameClaimInput,
  type SubmitGameClaimResponse,
} from "@ador/shared/games";

// How long a request about a claim may take: starting one builds a transaction and asks the chain its cost, so it is given
// longer than a look.
export const startClaimTimeoutMs = 8_000;
export const claimRequestTimeoutMs = 5_000;

// The platform's claim routes as the page reaches them: one same-origin request each, with the player's session. A failure
// (including no session) is thrown as the requester throws it, for the caller to say.
export interface ClaimsApi {
  list(gameId: string): Promise<ListGameClaimsResponse>;
  refresh(claimId: string): Promise<RefreshGameClaimResponse>;
  start(input: StartGameClaimInput): Promise<StartGameClaimResponse>;
  submit(input: SubmitGameClaimInput): Promise<SubmitGameClaimResponse>;
}

export function createClaimsApi(
  fetchImpl: FetchLike = sameOriginFetch,
): ClaimsApi {
  const request = createRequester(fetchImpl);
  return {
    list: (gameId) =>
      request(listGameClaimsRoute, listGameClaimsResponseSchema, {
        body: { gameId },
        signal: AbortSignal.timeout(claimRequestTimeoutMs),
      }),
    refresh: (claimId) =>
      request(refreshGameClaimRoute, refreshGameClaimResponseSchema, {
        body: { claimId },
        signal: AbortSignal.timeout(claimRequestTimeoutMs),
      }),
    start: (input) =>
      request(startGameClaimRoute, startGameClaimResponseSchema, {
        body: input,
        signal: AbortSignal.timeout(startClaimTimeoutMs),
      }),
    submit: (input) =>
      request(submitGameClaimRoute, submitGameClaimResponseSchema, {
        body: input,
        signal: AbortSignal.timeout(claimRequestTimeoutMs),
      }),
  };
}
