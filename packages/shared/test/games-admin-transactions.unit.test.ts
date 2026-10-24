import { describe, expect, it } from "vitest";

import { gameAdminStepSchema } from "../src/games/index.ts";
import { adminStep } from "./support/admin-step.ts";

const step = adminStep;

describe("the staff administration contract: the transactions of a sent step", () => {
  it("carries the ids of a sent step's transactions by role, and whether the send is unconfirmed, and refuses a role it does not know", () => {
    const id = "a".repeat(64);
    const sent = {
      ...step,
      transactions: [
        { id, role: "commit" as const },
        { id: "b".repeat(64), role: "reveal" as const },
      ],
      unconfirmedSend: true,
    };
    expect(gameAdminStepSchema.parse(sent)).toEqual(sent);
    expect(() =>
      gameAdminStepSchema.parse({
        ...sent,
        transactions: [{ id, role: "payout" }],
      }),
    ).toThrow();
    expect(() =>
      gameAdminStepSchema.parse({ ...sent, unconfirmedSend: "yes" }),
    ).toThrow();
    expect(() =>
      gameAdminStepSchema.parse({ ...step, transactions: undefined }),
    ).toThrow();
  });
});
