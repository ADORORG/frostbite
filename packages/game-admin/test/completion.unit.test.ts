import {
  chainRefSchema,
  unsignedTransactionSchema,
  type TrackedState,
} from "@ador/shared/chain";
import {
  nativeAsset,
  simulatedFamily,
} from "@ador/test-kit/simulated-chain-transaction";
import { describe, expect, it } from "vitest";

import {
  completing,
  isUnreadableCreation,
  unreadableCreation,
} from "../src/completion.ts";
import type { StoredStep } from "../src/types.ts";

const chain = chainRefSchema.parse("simnet:one");
const at = { chain, family: simulatedFamily, id: "at-1" };
const codeHash = "a".repeat(64);
const unsigned = (summary: object) =>
  unsignedTransactionSchema.parse({
    chain,
    family: simulatedFamily,
    format: "simulated",
    payload: "payload",
    summary: {
      chain,
      expiresAt: "2026-01-01T01:00:00.000Z",
      fee: { asset: nativeAsset(chain), baseUnits: 10n },
      ...summary,
    },
  });

const step = (
  over: Partial<StoredStep> & Pick<StoredStep, "operation" | "unsigned">,
  state: TrackedState = "confirmed",
): StoredStep => ({
  chain,
  contract: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: "staff-1",
  createdContracts: null,
  expiresAt: new Date("2026-01-01T01:00:00.000Z"),
  failureReason: null,
  gameId: "arcade",
  id: "step-1",
  milestoneId: null,
  recordedBy: null,
  signedPayload: "signed",
  state,
  submittedBy: "staff-1",
  templateRef: null,
  transactionId: "tx-1",
  updatedAt: new Date("2026-01-01T00:30:00.000Z"),
  ...over,
});

const publication = (over: Partial<StoredStep> = {}) =>
  step({
    gameId: null,
    operation: "publish-template",
    templateRef: "game-rewards@1.0.0",
    unsigned: unsigned({
      operation: "publish-template",
      template: { at, codeHash, id: "game-rewards", version: "1.0.0" },
    }),
    ...over,
  });
const creation = (over: Partial<StoredStep> = {}) =>
  step({
    createdContracts: ["sim-game-1"],
    operation: "deploy",
    unsigned: unsigned({
      maxDrawingBytes: 4096,
      operation: "deploy",
      template: { at, codeHash, id: "game-rewards", version: "1.0.0" },
    }),
    ...over,
  });

describe("completing a confirmed step", () => {
  it("records where a published template is, with the hash of its code", () => {
    expect(completing(publication())).toEqual({
      record: {
        address: "at-1",
        codeHash,
        kind: "template",
        templateRef: "game-rewards@1.0.0",
      },
      state: "complete",
    });
  });

  it("records where a game's contract was made, from what the chain reported", () => {
    expect(completing(creation())).toEqual({
      record: {
        address: "sim-game-1",
        family: simulatedFamily,
        gameId: "arcade",
        kind: "game",
        maxDrawingBytes: 4096,
      },
      state: "complete",
    });
  });

  it("takes the first contract the chain says the step created", () => {
    expect(
      completing(creation({ createdContracts: ["sim-game-1", "sim-token-2"] })),
    ).toMatchObject({ record: { address: "sim-game-1" } });
  });

  it("completes a step with nothing to record, and records nothing", () => {
    const pause = step({
      contract: at,
      operation: "set-claims-paused",
      unsigned: unsigned({
        contract: at,
        operation: "set-claims-paused",
        paused: true,
      }),
    });
    expect(completing(pause)).toEqual({ state: "complete" });
  });

  it("fails to index a creation the chain did not say anything about", () => {
    for (const missing of [null, []]) {
      const outcome = completing(creation({ createdContracts: missing }));
      expect(outcome).toMatchObject({ state: "indexed_failure" });
      expect(outcome).not.toHaveProperty("record");
      expect(outcome?.failureReason).toMatch(/did not report what it made/u);
    }
  });

  it("fails to index a step whose summary lacks what is to be recorded", () => {
    expect(completing(publication({ templateRef: null }))).toMatchObject({
      state: "indexed_failure",
    });
    expect(
      completing(
        publication({
          unsigned: unsigned({
            operation: "publish-template",
            template: { codeHash, id: "game-rewards", version: "1.0.0" },
          }),
        }),
      ),
    ).toMatchObject({ state: "indexed_failure" });
    expect(completing(creation({ gameId: null }))).toMatchObject({
      state: "indexed_failure",
    });
    expect(
      completing(
        creation({
          unsigned: unsigned({ operation: "deploy" }),
        }),
      ),
    ).toMatchObject({ state: "indexed_failure" });
  });

  it("changes nothing for a step that is not confirmed", () => {
    for (const state of ["pending", "complete", "indexed_failure"] as const) {
      expect(completing(creation({ state }))).toBeNull();
    }
  });
});

describe("telling a creation the platform could not read from one that failed", () => {
  const failed = (over: Partial<StoredStep> = {}) =>
    creation({
      createdContracts: null,
      failureReason: unreadableCreation,
      state: "indexed_failure",
      ...over,
    });

  it("is only a creation that confirmed and failed to say what it made", () => {
    expect(isUnreadableCreation(failed())).toBe(true);
    // Whatever completing does with a creation that said nothing is what makes it recordable by hand.
    const outcome = completing(creation({ createdContracts: [] }));
    expect(
      isUnreadableCreation(
        failed({ failureReason: outcome?.failureReason ?? null }),
      ),
    ).toBe(true);
  });

  it("is not a creation that reverted, one still in progress, one complete, or another operation", () => {
    expect(
      isUnreadableCreation(
        failed({ failureReason: "reverted by the network" }),
      ),
    ).toBe(false);
    expect(isUnreadableCreation(failed({ failureReason: null }))).toBe(false);
    expect(isUnreadableCreation(failed({ state: "confirmed" }))).toBe(false);
    expect(isUnreadableCreation(failed({ state: "complete" }))).toBe(false);
    expect(
      isUnreadableCreation(failed({ operation: "publish-template" })),
    ).toBe(false);
  });
});
