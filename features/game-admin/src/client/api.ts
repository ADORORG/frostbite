import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@frostbite/client-http";
import {
  gameAdminMintRoutes,
  gameAdminRoutes,
  getPlatformFeeResponseSchema,
  listGameAdminStepsResponseSchema,
  listGameAdminTemplatesResponseSchema,
  listGameMintsResponseSchema,
  listGameMintTotalsResponseSchema,
  recordGameAdminContractResponseSchema,
  refreshGameAdminStepResponseSchema,
  setPlatformFeeResponseSchema,
  startGameAdminStepResponseSchema,
  submitGameAdminStepResponseSchema,
  type GetPlatformFeeResponse,
  type ListGameAdminStepsResponse,
  type ListGameAdminTemplatesResponse,
  type ListGameMintsResponse,
  type ListGameMintTotalsResponse,
  type RecordGameAdminContractInput,
  type RecordGameAdminContractResponse,
  type RefreshGameAdminStepResponse,
  type SetPlatformFeeInput,
  type SetPlatformFeeResponse,
  type StartGameAdminStepInput,
  type StartGameAdminStepResponse,
  type SubmitGameAdminStepInput,
  type SubmitGameAdminStepResponse,
} from "@frostbite/shared/games";

// How long a request about a step may take: starting one builds transactions and asks the chain their cost, so it is given longer
// than a look.
export const startStepTimeoutMs = 10_000;
export const stepRequestTimeoutMs = 5_000;

// The platform's administration routes as the page reaches them: one same-origin request each, with staff's session. A failure
// (including no session) is thrown as the requester throws it, for the caller to say.
export interface GameAdminApi {
  list(gameId: string): Promise<ListGameAdminStepsResponse>;
  // A game's totals and a page of its completed mints, newest first; `after` is the previous page's `next`.
  mints(gameId: string, after?: string): Promise<ListGameMintsResponse>;
  // The totals of every game that declares rewards.
  mintTotals(): Promise<ListGameMintTotalsResponse>;
  // The platform's fee on claims, for each chain, and a way to set it (the fee and its treasury address together).
  platformFee(): Promise<GetPlatformFeeResponse>;
  setPlatformFee(input: SetPlatformFeeInput): Promise<SetPlatformFeeResponse>;
  // Enters where a game's contract is, when the platform could not read it from the confirmed transaction.
  record(
    input: RecordGameAdminContractInput,
  ): Promise<RecordGameAdminContractResponse>;
  refresh(stepId: string): Promise<RefreshGameAdminStepResponse>;
  start(input: StartGameAdminStepInput): Promise<StartGameAdminStepResponse>;
  submit(input: SubmitGameAdminStepInput): Promise<SubmitGameAdminStepResponse>;
  // The templates the platform may publish, which are published and where, and the log of the steps that publish them.
  templates(): Promise<ListGameAdminTemplatesResponse>;
}

export function createGameAdminApi(
  fetchImpl: FetchLike = sameOriginFetch,
): GameAdminApi {
  const request = createRequester(fetchImpl);
  return {
    list: (gameId) =>
      request(gameAdminRoutes.list, listGameAdminStepsResponseSchema, {
        query: { gameId },
        signal: AbortSignal.timeout(stepRequestTimeoutMs),
      }),
    mints: (gameId, after) =>
      request(gameAdminMintRoutes.mints, listGameMintsResponseSchema, {
        query: after === undefined ? { gameId } : { after, gameId },
        signal: AbortSignal.timeout(stepRequestTimeoutMs),
      }),
    mintTotals: () =>
      request(
        gameAdminMintRoutes.mintTotals,
        listGameMintTotalsResponseSchema,
        {
          signal: AbortSignal.timeout(stepRequestTimeoutMs),
        },
      ),
    platformFee: () =>
      request(gameAdminMintRoutes.platformFee, getPlatformFeeResponseSchema, {
        signal: AbortSignal.timeout(stepRequestTimeoutMs),
      }),
    setPlatformFee: (input) =>
      request(
        gameAdminMintRoutes.setPlatformFee,
        setPlatformFeeResponseSchema,
        {
          body: input,
          signal: AbortSignal.timeout(stepRequestTimeoutMs),
        },
      ),
    record: (input) =>
      request(gameAdminRoutes.record, recordGameAdminContractResponseSchema, {
        body: input,
        signal: AbortSignal.timeout(stepRequestTimeoutMs),
      }),
    refresh: (stepId) =>
      request(gameAdminRoutes.refresh, refreshGameAdminStepResponseSchema, {
        body: { stepId },
        signal: AbortSignal.timeout(stepRequestTimeoutMs),
      }),
    start: (input) =>
      request(gameAdminRoutes.start, startGameAdminStepResponseSchema, {
        body: input,
        signal: AbortSignal.timeout(startStepTimeoutMs),
      }),
    submit: (input) =>
      request(gameAdminRoutes.submit, submitGameAdminStepResponseSchema, {
        body: input,
        signal: AbortSignal.timeout(stepRequestTimeoutMs),
      }),
    templates: () =>
      request(gameAdminRoutes.templates, listGameAdminTemplatesResponseSchema, {
        signal: AbortSignal.timeout(stepRequestTimeoutMs),
      }),
  };
}
