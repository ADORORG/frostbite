import { describe, expect, it, vi } from "vitest";

import { storageReadinessProbe } from "../src/readiness.ts";

describe("the storage readiness probe", () => {
  it("asks about a key nobody writes, in the private bucket, and treats a missing object as healthy", async () => {
    const head = vi.fn(async () => null);
    const probe = storageReadinessProbe({ head });
    expect(probe.name).toBe("object-storage");
    await expect(
      probe.check(new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(head).toHaveBeenCalledExactlyOnceWith({
      key: "health/readiness-probe",
      scope: "private",
    });
  });

  it("fails when storage cannot be reached", async () => {
    const probe = storageReadinessProbe({
      head: async () => {
        throw new Error("endpoint unreachable");
      },
    });
    await expect(probe.check(new AbortController().signal)).rejects.toThrow(
      "endpoint unreachable",
    );
  });
});
