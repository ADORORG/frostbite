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
import { stepViewerFor } from "./steps.ts";
import type {
  AdminChainPorts,
  GameAdminDependencies,
  GameStatus,
  RefreshStepResult,
  StepChange,
  StoredStep,
  SubmitStepResult,
} from "./types.ts";

// What a step that never reached the network says when it is given up.
export const neverReceivedReason =
  "The network never received it, although the platform looked and sent it again for over an hour. Nothing was spent. Start the step again.";

export function createGameAdminService(dependencies: GameAdminDependencies) {
  const { clock, ports, repository } = dependencies;
  const viewer = stepViewerFor(dependencies);

  // Sends a signed step to the network; asking again sends the same bytes and the network gives the same id. `from` is where the step
  // stands: signed, or sent without the network being seen to hold it.
  async function broadcast(
    step: StoredStep,
    chain: AdminChainPorts,
    from: "broadcast_unknown" | "signed" = "signed",
  ): Promise<StoredStep | null> {
    const signed = signedOf(step);
    if (signed === null) return step;
    const change: StepChange | null = afterBroadcast(
      await chain.broadcaster.broadcast(signed),
    );
    return change === null
      ? step
      : repository.update(step.id, moveTo(from, change));
  }

  // A step the network has not been seen to hold, after the time any wait is called delayed, is over: the platform looked and sent it
  // again and the network never had it. It ends as failed, so it does not wait for what will not come; a new step can be started.
  async function givenUp(step: StoredStep): Promise<StoredStep | null> {
    const since = step.broadcastAt;
    if (
      since === null ||
      clock().getTime() - since.getTime() <= dependencies.delay.maxUnsettledMs
    )
      return step;
    return repository.update(
      step.id,
      moveTo("broadcast_unknown", {
        failureReason: neverReceivedReason,
        state: "broadcast_rejected",
      }),
    );
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
        return { ok: true, step: await viewer.one(accepted) };
      try {
        return {
          ok: true,
          step: await viewer.one(
            (await broadcast(accepted, chain)) ?? accepted,
          ),
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
      const view = async (
        held: StoredStep | null,
      ): Promise<RefreshStepResult> => ({
        ok: true,
        step: await viewer.one(held ?? step),
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
        // Sent, but the network does not have it: the same signed bytes are sent again (the network gives the same id and says so if
        // it already holds them), so a step is not left waiting for a transaction that never arrived. The outcome is told as it is:
        // taken, or refused with the network's reason.
        if (
          from === "broadcast_unknown" &&
          observation.status === "not-found"
        ) {
          const sent = (await broadcast(step, chain, from)) ?? step;
          return view(sent.state === from ? await givenUp(sent) : sent);
        }
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
      return viewer.many(await repository.list(gameId));
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
