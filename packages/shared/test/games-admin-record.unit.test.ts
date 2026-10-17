import { describe, expect, it } from "vitest";

import {
  gameAdminRecordRefusals,
  recordGameAdminContractInputSchema,
  recordGameAdminContractResponseSchema,
} from "../src/games/index.ts";
import { adminStep, adminStepId as id } from "./support/admin-step.ts";

const step = adminStep;

describe("recording a contract's address by hand", () => {
  it("takes an address staff enter for a step, trimmed, and answers the step or a documented refusal", () => {
    expect(
      recordGameAdminContractInputSchema.parse({
        address: " 2:7 ",
        stepId: id,
      }),
    ).toEqual({ address: "2:7", stepId: id });
    for (const bad of [
      { address: "", stepId: id },
      { address: "   ", stepId: id },
      { address: "x".repeat(129), stepId: id },
      { address: "2:7", stepId: "not-a-uuid" },
      { address: "2:7", extra: 1, stepId: id },
    ])
      expect(() => recordGameAdminContractInputSchema.parse(bad)).toThrow();
    expect(
      recordGameAdminContractResponseSchema.parse({
        status: "recorded",
        step,
      }).status,
    ).toBe("recorded");
    for (const reason of gameAdminRecordRefusals)
      expect(
        recordGameAdminContractResponseSchema.parse({
          reason,
          status: "refused",
        }),
      ).toEqual({ reason, status: "refused" });
    expect(() =>
      recordGameAdminContractResponseSchema.parse({
        reason: "other",
        status: "refused",
      }),
    ).toThrow();
  });
});
