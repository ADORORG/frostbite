import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@ador/client-http";
import {
  gameAdminRoutes,
  listGameAdminStepsResponseSchema,
  listGameAdminTemplatesResponseSchema,
  refreshGameAdminStepResponseSchema,
  startGameAdminStepResponseSchema,
  submitGameAdminStepResponseSchema,
  type ListGameAdminStepsResponse,
  type ListGameAdminTemplatesResponse,
  type RefreshGameAdminStepResponse,
  type StartGameAdminStepInput,
  type StartGameAdminStepResponse,
  type SubmitGameAdminStepInput,
  type SubmitGameAdminStepResponse,
} from "@ador/shared/games";

// How long a request about a step may take: starting one builds transactions and asks the chain their cost, so it is given longer
// than a look.
export const startStepTimeoutMs = 10_000;
export const stepRequestTimeoutMs = 5_000;

// The platform's administration routes as the page reaches them: one same-origin request each, with staff's session. A failure
// (including no session) is thrown as the requester throws it, for the caller to say.
export interface GameAdminApi {
  list(gameId: string): Promise<ListGameAdminStepsResponse>;
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
        body: { gameId },
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
        body: {},
        signal: AbortSignal.timeout(stepRequestTimeoutMs),
      }),
  };
}
