import {
  afterBroadcast,
  afterObservation,
  isObservable,
  moveTo,
  signedOf,
  type SignedTransaction,
} from "@ador/shared/chain";

import { completing } from "./completion.ts";
import { refOf } from "./plan.ts";
import { recordCreated } from "./record.ts";
import { startStep } from "./start.ts";
import { toView } from "./steps.ts";
import type {
  AdminChainPorts,
  GameAdminDependencies,
  GameStatus,
  RefreshStepResult,
  StepChange,
  StoredStep,
  SubmitStepResult,
} from "./types.ts";

export function createGameAdminService(dependencies: GameAdminDependencies) {
  const { clock, ports, repository } = dependencies;

  // Sends a signed step to the network, once; asking again sends the same bytes and the network gives the same id.
  async function broadcast(
    step: StoredStep,
    chain: AdminChainPorts,
  ): Promise<StoredStep | null> {
    const signed = signedOf(step);
    if (signed === null) return step;
    const change: StepChange | null = afterBroadcast(
      await chain.broadcaster.broadcast(signed),
    );
    return change === null
      ? step
      : repository.update(step.id, moveTo("signed", change));
  }

  return {
    // Staff ask to take a step on a game, with the wallet they will sign with. The answer is the step in progress if there is
    // one, or a new one with the transaction built and the summary to show.
    start: (input: Parameters<typeof startStep>[1]) =>
      startStep(dependencies, input),

    // Staff signed what they were shown. It is checked against what was built, kept with who sent it, and sent to the network.
    // Sending the same signed step again returns the step as it is; a different one is refused.
    async submitSigned(input: {
      readonly signed: SignedTransaction;
      readonly staffId: string;
      readonly stepId: string;
    }): Promise<SubmitStepResult> {
      const { signed, staffId, stepId } = input;
      const outcome: { refusal: SubmitStepResult | null } = { refusal: null };
      const accepted = await repository.update(stepId, (step) => {
        if (step.state !== "awaiting_signature") {
          outcome.refusal =
            step.signedPayload === signed.payload
              ? null
              : { code: "not-awaiting-signature", ok: false };
          return null;
        }
        if (clock() >= step.expiresAt) {
          outcome.refusal = { code: "expired", ok: false };
          return { state: "expired" };
        }
        const chain = ports(step.chain);
        if (chain === null) {
          outcome.refusal = { code: "chain-unavailable", ok: false };
          return null;
        }
        const verified = chain.builder.verifySigned(step.unsigned, signed);
        if (!verified.ok) {
          outcome.refusal = {
            code: "invalid-signature",
            ok: false,
            reason: verified.reason,
          };
          return null;
        }
        return {
          signedPayload: signed.payload,
          state: "signed",
          submittedBy: staffId,
        };
      });
      if (accepted === null) return { code: "not-found", ok: false };
      if (outcome.refusal !== null) return outcome.refusal;
      const chain = ports(accepted.chain);
      if (chain === null || accepted.state !== "signed")
        return { ok: true, step: toView(accepted) };
      try {
        return {
          ok: true,
          step: toView((await broadcast(accepted, chain)) ?? accepted),
        };
      } catch {
        return { code: "chain-unavailable", ok: false };
      }
    },

    // Staff enter where a game's contract was made, when the platform could not read it. See `record.ts`.
    recordCreated: (input: Parameters<typeof recordCreated>[1]) =>
      recordCreated(dependencies, input),

    // Looks at the chain once and moves the step as far as the evidence allows. It is safe to call as often as wanted. A step is
    // complete when the network confirms it: the observer reports confirmed only once the indexer has run the call.
    async refresh(stepId: string): Promise<RefreshStepResult> {
      const step = await repository.get(stepId);
      if (step === null) return { code: "not-found", ok: false };
      const chain = ports(step.chain);
      if (chain === null) return { code: "chain-unavailable", ok: false };
      const view = (held: StoredStep | null): RefreshStepResult => ({
        ok: true,
        step: toView(held ?? step),
      });
      try {
        if (step.state === "signed") return view(await broadcast(step, chain));
        if (step.state === "awaiting_signature")
          return view(
            await repository.update(stepId, (held) =>
              held.state === "awaiting_signature" && clock() >= held.expiresAt
                ? { state: "expired" }
                : null,
            ),
          );
        if (step.state === "confirmed")
          return view(await repository.update(stepId, completing));
        if (step.transactionId === null || !isObservable(step.state))
          return view(step);
        const from = step.state;
        const observation = await chain.observer.observe({
          chain: step.chain,
          id: step.transactionId,
        });
        const next = afterObservation(from, observation);
        if (next === null) return view(step);
        const move = moveTo(from, next);
        // What the chain says the step created is kept with it, to be recorded when the step completes.
        return view(
          await repository.update(stepId, (held) => {
            const change = move(held);
            return change !== null && observation.created !== undefined
              ? { ...change, createdContracts: observation.created }
              : change;
          }),
        );
      } catch {
        return { code: "chain-unavailable", ok: false };
      }
    },

    // A game's steps, or (with null) the steps that published templates, oldest first.
    async list(gameId: string | null) {
      return (await repository.list(gameId)).map(toView);
    },

    // Whether a game has its contract yet (and how large a drawing it accepts), and whether the two templates it is made from are
    // published, which is all that is needed to create it. Null for a game the service does not administer.
    async status(gameId: string): Promise<GameStatus | null> {
      const game = await dependencies.game(gameId);
      if (game === null) return null;
      const { gameTemplate, collectibleTemplate } = dependencies.rewards;
      const published = await Promise.all(
        [gameTemplate, collectibleTemplate].map((template) =>
          dependencies.contracts.publishedTemplate(game.chain, refOf(template)),
        ),
      );
      return {
        contract:
          game.contract === null
            ? null
            : {
                address: game.contract.id,
                maxDrawingBytes: Number(game.maxDrawingBytes),
              },
        drawingCeiling: Number(dependencies.rewards.maxDrawingBytes),
        templatesReady: published.every((template) => template !== null),
      };
    },

    // The templates published on the rewards chain.
    templates: () =>
      dependencies.contracts.publishedTemplates(dependencies.rewards.chain),
  };
}

export type GameAdminService = ReturnType<typeof createGameAdminService>;
