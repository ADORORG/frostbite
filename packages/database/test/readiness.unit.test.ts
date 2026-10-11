import { describe, expect, it, vi } from "vitest";

import { databaseReadinessProbe } from "../src/connection/readiness.ts";

describe("the database readiness probe", () => {
  it("runs a trivial query", async () => {
    const execute = vi.fn(async () => undefined);
    const probe = databaseReadinessProbe({ execute });
    expect(probe.name).toBe("database");
    await probe.check(new AbortController().signal);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("fails when the database does not answer", async () => {
    const probe = databaseReadinessProbe({
      execute: async () => {
        throw new Error("connection refused");
      },
    });
    await expect(probe.check(new AbortController().signal)).rejects.toThrow(
      "connection refused",
    );
  });
});
