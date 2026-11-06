import { walk } from "@frostbite/shared/chain";

import { isUnreadableCreation } from "./completion.ts";
import { stepViewerFor } from "./steps.ts";
import type { GameAdminDependencies, RecordCreatedResult } from "./types.ts";

// Recording by hand is a reconciliation: a failed step is made right by a person, then complete. The lifecycle allows no jump.
walk(["indexed_failure", "reconciled", "complete"]);

// Staff enter where a game's contract was made, when the platform could not read it from the confirmed transaction. The address is
// accepted only if a contract is there and it is made from the game template the step was built for; it is then recorded and the
// step completed together, so the record and the log cannot disagree, and the log says who entered it.
export async function recordCreated(
  dependencies: GameAdminDependencies,
  input: {
    readonly address: string;
    readonly staffId: string;
    readonly stepId: string;
  },
): Promise<RecordCreatedResult> {
  const { contracts, repository } = dependencies;
  const step = await repository.get(input.stepId);
  if (step === null) return { code: "not-found", ok: false };
  if (!isUnreadableCreation(step) || step.gameId === null)
    return { code: "not-recordable", ok: false };
  const game = await dependencies.game(step.gameId);
  if (game === null) return { code: "not-recordable", ok: false };
  if (game.contract !== null) return { code: "already-created", ok: false };
  const address = input.address.trim();
  if (await contracts.addressTaken(step.chain, address))
    return { code: "address-taken", ok: false };
  const chain = dependencies.ports(step.chain);
  if (chain === null) return { code: "chain-unavailable", ok: false };
  const inspection = await chain.contracts
    .inspect({ chain: step.chain, family: step.unsigned.family, id: address })
    .catch(() => null);
  if (inspection === null) return { code: "chain-unavailable", ok: false };
  if (!inspection.exists) return { code: "not-on-chain", ok: false };
  const { maxDrawingBytes, template } = step.unsigned.summary;
  if (
    template === undefined ||
    maxDrawingBytes === undefined ||
    inspection.codeHash !== template.codeHash
  )
    return { code: "different-code", ok: false };
  const gameId = step.gameId;
  const done = await repository.update(step.id, (held) =>
    isUnreadableCreation(held)
      ? {
          createdContracts: [address],
          failureReason: null,
          recordedBy: input.staffId,
          record: {
            address,
            family: held.unsigned.family,
            gameId,
            kind: "game",
            maxDrawingBytes,
          },
          state: "complete",
        }
      : null,
  );
  return done?.state === "complete" && done.recordedBy === input.staffId
    ? { ok: true, step: await stepViewerFor(dependencies).one(done) }
    : { code: "not-recordable", ok: false };
}
