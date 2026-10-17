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

import { toView } from "../src/steps.ts";
import type { StoredStep } from "../src/types.ts";

const chain = chainRefSchema.parse("simnet:one");
const unsigned = unsignedTransactionSchema.parse({
  chain,
  family: simulatedFamily,
  format: "simulated",
  payload: "payload",
  summary: {
    chain,
    expiresAt: "2026-01-01T01:00:00.000Z",
    fee: { asset: nativeAsset(chain), baseUnits: 10n },
    operation: "set-claims-paused",
    paused: true,
  },
});

const step = (state: TrackedState): StoredStep => ({
  chain,
  contract: { chain, family: simulatedFamily, id: "rewards-1" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: "staff-1",
  createdContracts: null,
  expiresAt: new Date("2026-01-01T01:00:00.000Z"),
  failureReason: null,
  gameId: "arcade",
  id: "step-1",
  milestoneId: null,
  operation: "set-claims-paused",
  signedPayload: "never shown",
  state,
  submittedBy: "staff-2",
  templateRef: null,
  transactionId: "tx-1",
  unsigned,
  updatedAt: new Date("2026-01-01T00:30:00.000Z"),
});

describe("the view of a stored step", () => {
  it("offers the transaction to sign only while the step awaits a signature", () => {
    expect(toView(step("awaiting_signature")).toSign).toBe(unsigned);
    expect(toView(step("broadcast_accepted")).toSign).toBeNull();
    expect(toView(step("confirmed")).toSign).toBeNull();
  });

  it("shows times as ISO text and the summary staff were asked to check", () => {
    const view = toView(step("awaiting_signature"));
    expect(view.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(view.expiresAt).toBe("2026-01-01T01:00:00.000Z");
    expect(view.summary).toBe(unsigned.summary);
  });

  it("carries who made and who sent the step, and never the signed payload", () => {
    const view = toView(step("broadcast_accepted"));
    expect(view.createdBy).toBe("staff-1");
    expect(view.submittedBy).toBe("staff-2");
    expect(view.transactionId).toBe("tx-1");
    expect(view).not.toHaveProperty("signedPayload");
    expect(Object.values(view)).not.toContain("never shown");
  });

  it("lists the contracts the step created, none when it created none, and names the template it published", () => {
    expect(toView(step("complete")).createdContracts).toEqual([]);
    expect(
      toView({
        ...step("complete"),
        createdContracts: ["4:7"],
        gameId: null,
        templateRef: "game-rewards@1.0.0",
      }),
    ).toMatchObject({
      createdContracts: ["4:7"],
      gameId: null,
      templateRef: "game-rewards@1.0.0",
    });
  });
});
