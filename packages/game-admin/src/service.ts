import {
  afterBroadcast,
  afterObservation,
  indexed,
  isObservable,
  moveTo,
  signedOf,
  type SignedTransaction,
} from "@ador/shared/chain";

import { startStep } from "./start.ts";
import { toView } from "./steps.ts";
import type {
  AdminChainPorts,
  GameAdminDependencies,
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
          return view(
            await repository.update(
              stepId,
              moveTo("confirmed", { state: indexed }),
            ),
          );
        if (step.transactionId === null || !isObservable(step.state))
          return view(step);
        const from = step.state;
        const next = afterObservation(
          from,
          await chain.observer.observe({
            chain: step.chain,
            id: step.transactionId,
          }),
        );
        return next === null
          ? view(step)
          : view(await repository.update(stepId, moveTo(from, next)));
      } catch {
        return { code: "chain-unavailable", ok: false };
      }
    },

    async list(gameId: string) {
      return (await repository.list(gameId)).map(toView);
    },
  };
}

export type GameAdminService = ReturnType<typeof createGameAdminService>;
