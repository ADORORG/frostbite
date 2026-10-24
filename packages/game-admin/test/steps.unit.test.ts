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

import { unreadableCreation } from "../src/completion.ts";
import { createStepViewer } from "../src/steps.ts";
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

const now = new Date("2026-01-01T02:00:00.000Z");
const delay = { maxLagBlocks: 2, maxUnsettledMs: 60 * 60_000 };
// The indexer, as the chain reports it: the blocks it is behind, or null when it cannot be asked.
const viewerFor = (behind: number | null) =>
  createStepViewer({
    clock: () => now,
    delay,
    transactionIds: () => [],
    ports: () => ({
      observer: {
        indexing: async (asked) => {
          if (behind === null) throw new Error("the node is down");
          return {
            chain: asked,
            indexedHeight: 100,
            observedAt: now.toISOString(),
            tipHeight: 100 + behind,
          };
        },
      },
    }),
  });
const toView = (stored: StoredStep, behind: number | null = 0) =>
  viewerFor(behind).one(stored);

const step = (state: TrackedState): StoredStep => ({
  broadcastAt: new Date("2026-01-01T01:50:00.000Z"),
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
  recordedBy: null,
  signedPayload: "never shown",
  state,
  submittedBy: "staff-2",
  templateRef: null,
  transactionId: "tx-1",
  unsigned,
  updatedAt: new Date("2026-01-01T00:30:00.000Z"),
});

describe("the view of a stored step", () => {
  it("offers the transaction to sign only while the step awaits a signature", async () => {
    expect((await toView(step("awaiting_signature"))).toSign).toBe(unsigned);
    expect((await toView(step("broadcast_accepted"))).toSign).toBeNull();
    expect((await toView(step("confirmed"))).toSign).toBeNull();
  });

  it("shows times as ISO text and the summary staff were asked to check", async () => {
    const view = await toView(step("awaiting_signature"));
    expect(view.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(view.expiresAt).toBe("2026-01-01T01:00:00.000Z");
    expect(view.summary).toBe(unsigned.summary);
  });

  it("says a step can have its contract's address entered only when the platform could not read it", async () => {
    const unreadable = {
      ...step("indexed_failure"),
      failureReason: unreadableCreation,
      operation: "deploy" as const,
    };
    expect((await toView(unreadable)).recordable).toBe(true);
    expect((await toView(step("indexed_failure"))).recordable).toBe(false);
    expect(
      (await toView({ ...unreadable, recordedBy: "staff-3" })).recordedBy,
    ).toBe("staff-3");
  });

  it("carries who made and who sent the step, and never the signed payload", async () => {
    const view = await toView(step("broadcast_accepted"));
    expect(view.createdBy).toBe("staff-1");
    expect(view.submittedBy).toBe("staff-2");
    expect(view.transactionId).toBe("tx-1");
    expect(view).not.toHaveProperty("signedPayload");
    expect(Object.values(view)).not.toContain("never shown");
  });

  it("lists the contracts the step created, none when it created none, and names the template it published", async () => {
    expect((await toView(step("complete"))).createdContracts).toEqual([]);
    expect(
      await toView({
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

  it("says when the step was sent, and nothing before it was", async () => {
    expect((await toView(step("broadcast_accepted"))).sentAt).toBe(
      "2026-01-01T01:50:00.000Z",
    );
    expect(
      (await toView({ ...step("awaiting_signature"), broadcastAt: null }))
        .sentAt,
    ).toBeNull();
  });

  it("calls a step delayed when the indexer is more than two blocks behind or it was sent more than an hour ago, and only while it waits", async () => {
    expect((await toView(step("pending"), 2)).delayed).toBe(false);
    expect((await toView(step("pending"), 3)).delayed).toBe(true);
    expect((await toView(step("confirmed"), 3)).delayed).toBe(true);
    expect((await toView(step("complete"), 3)).delayed).toBe(false);
    expect((await toView(step("indexed_failure"), 3)).delayed).toBe(false);
    expect((await toView(step("awaiting_signature"), 3)).delayed).toBe(false);
    const old = { broadcastAt: new Date("2026-01-01T00:59:59.000Z") };
    expect((await toView({ ...step("pending"), ...old }, 0)).delayed).toBe(
      true,
    );
    // Where the indexer cannot be asked the time alone decides.
    expect((await toView(step("pending"), null)).delayed).toBe(false);
    expect((await toView({ ...step("pending"), ...old }, null)).delayed).toBe(
      true,
    );
  });

  it("judges a whole list against one reading, in order", async () => {
    const views = await viewerFor(3).many([
      step("pending"),
      step("complete"),
      step("confirmed"),
    ]);
    expect(views.map(({ delayed }) => delayed)).toEqual([true, false, true]);
  });
});
