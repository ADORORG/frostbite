import { ObjectStorageError } from "@frostbite/object-storage/errors";
import { describe, expect, it } from "vitest";

import { conflict } from "./support/processing-fakes.ts";
import { setup } from "./support/processing-setup.ts";

describe("failures leave the asset retryable", () => {
  it("treats an existing identical object as already written", async () => {
    const { repository, service, storage, subject } = setup({
      head: { contentLength: 3 },
      onWrite: (key) => {
        if (key.includes("thumbnail")) throw conflict();
      },
    });
    const result = await service.process({ assetId: subject.assetId });
    expect(result).toMatchObject({
      kind: "recorded",
      outcome: { state: "processed" },
    });
    expect(storage.writes).toHaveLength(1);
    expect(repository.recorded).toHaveLength(1);
  });

  it("fails on a conflicting object of a different size or when it has vanished", async () => {
    for (const head of [{ contentLength: 99 }, null]) {
      const { repository, service, subject } = setup({
        head,
        onWrite: () => {
          throw conflict();
        },
      });
      await expect(
        service.process({ assetId: subject.assetId }),
      ).rejects.toThrow("exists");
      expect(repository.recorded).toHaveLength(0);
    }
  });

  it.each<[string, Parameters<typeof setup>[0], string]>([
    [
      "a storage failure while writing",
      {
        onWrite: () => {
          throw new ObjectStorageError("provider-failure", "down");
        },
      },
      "down",
    ],
    [
      "a decoder platform failure",
      { processor: new Error("worker unavailable") },
      "worker unavailable",
    ],
  ])("records nothing after %s", async (_name, options, message) => {
    const { repository, service, subject } = setup(options);
    await expect(service.process({ assetId: subject.assetId })).rejects.toThrow(
      message,
    );
    expect(repository.recorded).toHaveLength(0);
  });
});
