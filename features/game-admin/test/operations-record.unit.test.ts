import { describe, expect, it, vi } from "vitest";

import { context, stub } from "./support/operations-stub.ts";
import { staffId, view } from "./support/fixtures.ts";

describe("entering the address of a contract the platform could not read", () => {
  it("records an address as the session's staff member and answers the step, or why it was refused", async () => {
    const s = stub();
    const asked = { address: "2:7", stepId: view().id };
    expect(await s.record.execute(asked, context)).toMatchObject({
      ok: true,
      value: { status: "recorded", step: { id: view().id } },
    });
    expect(s.service.recordCreated).toHaveBeenCalledWith({
      address: "2:7",
      staffId,
      stepId: view().id,
    });
    const refusing = stub({
      recordCreated: vi.fn(async () => ({
        code: "different-code" as const,
        ok: false as const,
      })),
    });
    expect(await refusing.record.execute(asked, context)).toEqual({
      ok: true,
      value: { reason: "different-code", status: "refused" },
    });
  });
});
