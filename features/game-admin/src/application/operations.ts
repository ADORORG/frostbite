import type { StartStepResult } from "@ador/game-admin";
import type { HttpOperation } from "@ador/http";
import { unauthenticated } from "@ador/http/outcome";
import { signedTransactionSchema } from "@ador/shared/chain";
import {
  gameAdminCapability,
  gameAdminRoutes,
  gameAdminStartRefusals,
  listGameAdminStepsInputSchema,
  listGameAdminStepsResponseSchema,
  listGameAdminTemplatesInputSchema,
  listGameAdminTemplatesResponseSchema,
  recordGameAdminContractInputSchema,
  recordGameAdminContractResponseSchema,
  refreshGameAdminStepInputSchema,
  refreshGameAdminStepResponseSchema,
  startGameAdminStepInputSchema,
  startGameAdminStepResponseSchema,
  submitGameAdminStepInputSchema,
  submitGameAdminStepResponseSchema,
  type ListGameAdminStepsInput,
  type ListGameAdminStepsResponse,
  type ListGameAdminTemplatesInput,
  type ListGameAdminTemplatesResponse,
  type RecordGameAdminContractInput,
  type RecordGameAdminContractResponse,
  type RefreshGameAdminStepInput,
  type RefreshGameAdminStepResponse,
  type StartGameAdminStepInput,
  type StartGameAdminStepResponse,
  type SubmitGameAdminStepInput,
  type SubmitGameAdminStepResponse,
} from "@ador/shared/games";

import type { GameAdminRuntime } from "../runtime.ts";
import { peopleOf, toWireStep } from "./present.ts";

type Resolve = () => Promise<GameAdminRuntime>;

const access = { capability: gameAdminCapability, kind: "platform" } as const;
const base = {
  access,
  applicationErrors: ["unauthorized"],
  idempotency: "none",
  input: "json",
} as const;

const startRefusal = {
  "address-taken": "address-taken",
  "already-created": "already-created",
  "already-defined": "already-defined",
  "already-published": "already-published",
  "bad-drawing": "bad-drawing",
  "chain-unavailable": "unavailable",
  "could-not-build": "could-not-build",
  "not-administered": "not-administered",
  "template-not-published": "template-not-published",
  "unknown-template": "unknown-template",
  unavailable: "unavailable",
  "wrong-chain": "wrong-network",
} as const satisfies Record<
  Extract<StartStepResult, { ok: false }>["code"],
  (typeof gameAdminStartRefusals)[number]
>;

// Builds a step for staff to review and sign. Who is asking is the session, never a field of the request. A step that cannot be
// taken right now is an answer (with why), not an error.
export function createStartStepOperation(resolve: Resolve) {
  return {
    ...base,
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { names, service } = await resolve();
      const outcome = await service.start({
        action: input.action,
        authTokenOutput: input.authTokenOutput,
        gameId: input.gameId,
        staffId: context.actorUserId,
        wallet: input.wallet,
      });
      if (!outcome.ok)
        return {
          ok: true,
          value: {
            ...("reason" in outcome ? { detail: outcome.reason } : {}),
            reason: startRefusal[outcome.code],
            status: "refused",
          },
        } as const;
      return {
        ok: true,
        value: {
          resumed: outcome.resumed,
          status: "started",
          step: toWireStep(outcome.step, await names(peopleOf([outcome.step]))),
        },
      } as const;
    },
    inputSchema: startGameAdminStepInputSchema,
    outputSchema: startGameAdminStepResponseSchema,
    ...gameAdminRoutes.start,
  } satisfies HttpOperation<
    StartGameAdminStepInput,
    StartGameAdminStepResponse
  >;
}

// Takes what the wallet signed for a step. A step that does not exist is "not-found".
export function createSubmitStepOperation(resolve: Resolve) {
  return {
    ...base,
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { names, service } = await resolve();
      const outcome = await service.submitSigned({
        signed: signedTransactionSchema.parse(input.signed),
        staffId: context.actorUserId,
        stepId: input.stepId,
      });
      return {
        ok: true,
        value: outcome.ok
          ? {
              status: "submitted",
              step: toWireStep(
                outcome.step,
                await names(peopleOf([outcome.step])),
              ),
            }
          : { reason: outcome.code, status: "refused" },
      } as const;
    },
    inputSchema: submitGameAdminStepInputSchema,
    outputSchema: submitGameAdminStepResponseSchema,
    ...gameAdminRoutes.submit,
  } satisfies HttpOperation<
    SubmitGameAdminStepInput,
    SubmitGameAdminStepResponse
  >;
}

// Takes the address staff enter for a contract the platform could not read. The platform checks it before it records it; a refusal
// says why.
export function createRecordContractOperation(resolve: Resolve) {
  return {
    ...base,
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { names, service } = await resolve();
      const outcome = await service.recordCreated({
        address: input.address,
        staffId: context.actorUserId,
        stepId: input.stepId,
      });
      return {
        ok: true,
        value: outcome.ok
          ? {
              status: "recorded",
              step: toWireStep(
                outcome.step,
                await names(peopleOf([outcome.step])),
              ),
            }
          : { reason: outcome.code, status: "refused" },
      } as const;
    },
    inputSchema: recordGameAdminContractInputSchema,
    outputSchema: recordGameAdminContractResponseSchema,
    ...gameAdminRoutes.record,
  } satisfies HttpOperation<
    RecordGameAdminContractInput,
    RecordGameAdminContractResponse
  >;
}

// Looks at the chain once for a step and answers how it stands. The page asks again until it is over.
export function createRefreshStepOperation(resolve: Resolve) {
  return {
    ...base,
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { names, service } = await resolve();
      const outcome = await service.refresh(input.stepId);
      return {
        ok: true,
        value: outcome.ok
          ? {
              status: "ok",
              step: toWireStep(
                outcome.step,
                await names(peopleOf([outcome.step])),
              ),
            }
          : { reason: outcome.code, status: "refused" },
      } as const;
    },
    inputSchema: refreshGameAdminStepInputSchema,
    outputSchema: refreshGameAdminStepResponseSchema,
    ...gameAdminRoutes.refresh,
  } satisfies HttpOperation<
    RefreshGameAdminStepInput,
    RefreshGameAdminStepResponse
  >;
}

// The log of a game's steps, oldest first: who took each and when; and where the game stands (its contract, and whether the
// templates it is made from are published).
export function createListStepsOperation(resolve: Resolve) {
  return {
    ...base,
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { names, service } = await resolve();
      // A game the platform does not administer has no contract, no templates ready and no steps.
      const status = (await service.status(input.gameId)) ?? {
        contract: null,
        drawingCeiling: 1,
        templatesReady: false,
      };
      const steps = await service.list(input.gameId);
      const known = await names(peopleOf(steps));
      return {
        ok: true,
        value: {
          contract: status.contract,
          drawingCeiling: status.drawingCeiling,
          steps: steps.map((step) => toWireStep(step, known)),
          templatesReady: status.templatesReady,
        },
      } as const;
    },
    inputSchema: listGameAdminStepsInputSchema,
    outputSchema: listGameAdminStepsResponseSchema,
    ...gameAdminRoutes.list,
  } satisfies HttpOperation<
    ListGameAdminStepsInput,
    ListGameAdminStepsResponse
  >;
}

// The templates the platform may publish, which are published and where, and the log of the steps that publish them.
export function createListTemplatesOperation(resolve: Resolve) {
  return {
    ...base,
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { names, rewards, service } = await resolve();
      const [published, steps] = await Promise.all([
        service.templates(),
        service.list(null),
      ]);
      const known = await names(peopleOf(steps));
      return {
        ok: true,
        value: {
          publishable: rewards.publishable.map(({ id, version }) => ({
            id,
            version,
          })),
          published: published.map(({ address, publishedAt, templateRef }) => ({
            address,
            publishedAt: publishedAt.toISOString(),
            templateRef,
          })),
          steps: steps.map((step) => toWireStep(step, known)),
        },
      } as const;
    },
    inputSchema: listGameAdminTemplatesInputSchema,
    outputSchema: listGameAdminTemplatesResponseSchema,
    ...gameAdminRoutes.templates,
  } satisfies HttpOperation<
    ListGameAdminTemplatesInput,
    ListGameAdminTemplatesResponse
  >;
}
