import { describe, expect, it } from "vitest";

import { isWorkerFault, workerExitCodes } from "../src/exit-codes.ts";

describe("worker exit classification", () => {
  it("treats only the worker's own failure codes as platform faults", () => {
    expect(workerExitCodes).toEqual({
      protocolViolation: 2,
      unexpectedError: 1,
    });
    expect(isWorkerFault(1)).toBe(true);
    expect(isWorkerFault(2)).toBe(true);
    for (const code of [0, 3, 134, 137, null])
      expect(isWorkerFault(code)).toBe(false);
  });
});
