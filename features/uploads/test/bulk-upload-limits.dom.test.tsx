import { describe, expect, it, vi } from "vitest";

import { resolveUploadClientPolicy } from "../src/client/client-policy.ts";
import { BulkUpload } from "../src/ui/bulk-upload.tsx";
import {
  button,
  chooseFiles,
  click,
  imageFile,
  mount,
  settle,
  textOf,
} from "./support/dom.tsx";
import { batchServices, names } from "./support/bulk-fixtures.ts";

describe("bulk upload limits and control", () => {
  it("never has more unfinished uploads than the server allows, and keeps going as slots free", async () => {
    const { counts, services } = batchServices();
    const container = await mount(
      <BulkUpload purpose="collection-item-artwork" services={services} />,
    );
    await chooseFiles(
      container,
      names(7).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() => expect(textOf(container)).toContain("7 of 7 ready."));
    expect(counts.peak).toBe(2);
  });

  it("waits to start more while the server is still checking as many images as it should at once", async () => {
    const { counts, services } = batchServices();
    const container = await mount(
      <BulkUpload
        purpose="collection-item-artwork"
        services={{
          ...services,
          // Checking never ends, so the images stay in processing.
          sleep: () => new Promise<void>(() => undefined),
          policy: resolveUploadClientPolicy({
            bulkInFlightLimit: 3,
            pollIntervalMs: 60_000,
            pollMaxAttempts: 3,
          }),
        }}
      />,
    );
    await chooseFiles(
      container,
      names(8).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() =>
      expect(services.api.completeIntent).toHaveBeenCalledTimes(3),
    );
    // Give a further start every chance to happen; none does while three are still being checked.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(services.api.createIntent).toHaveBeenCalledTimes(3);
    expect(counts.peak).toBeLessThanOrEqual(2);
    expect(textOf(container)).toContain("0 of 8 ready, 8 still to go.");
  });

  it("asks the server about the whole batch together, not once per image", async () => {
    const { services } = batchServices();
    const container = await mount(
      <BulkUpload purpose="collection-item-artwork" services={services} />,
    );
    await chooseFiles(
      container,
      names(8).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() => expect(textOf(container)).toContain("8 of 8 ready."));
    expect(services.api.listAssets.mock.calls.length).toBeLessThan(8);
  });

  it("retries everything that failed without exceeding the server's limit", async () => {
    let failing = true;
    const { counts, services } = batchServices({ fail: () => failing });
    const container = await mount(
      <BulkUpload purpose="collection-item-artwork" services={services} />,
    );
    await chooseFiles(
      container,
      names(5).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() =>
      expect(textOf(container)).toContain("0 of 5 ready, 5 can be retried."),
    );
    failing = false;
    await click(button(container, "Retry all that can be retried"));
    await settle(() => expect(textOf(container)).toContain("5 of 5 ready."));
    expect(counts.peak).toBeLessThanOrEqual(2);
  });

  it("cancels what is waiting and what is moving, and clears the list", async () => {
    const base = batchServices();
    const stuck = vi.fn(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<void>((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason)),
        ),
    );
    const services = { ...base.services, transfer: { upload: stuck } };
    const container = await mount(
      <BulkUpload purpose="collection-item-artwork" services={services} />,
    );
    await chooseFiles(
      container,
      names(5).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() => expect(stuck).toHaveBeenCalledTimes(2));
    await click(button(container, "Cancel the rest"));
    await settle(() =>
      expect(textOf(container)).toContain("0 of 2 ready, 2 can be retried."),
    );
    // Three files were still waiting; they were taken out rather than started.
    expect(base.created).toHaveLength(2);
    await click(button(container, "Clear the list"));
    expect(textOf(container)).not.toContain("piece-1.png");
  });

  it("takes only as many files as one batch allows and says how many were left out", async () => {
    const { created, services } = batchServices();
    const container = await mount(
      <BulkUpload
        purpose="collection-item-artwork"
        services={{
          ...services,
          policy: resolveUploadClientPolicy({
            bulkFileLimit: 3,
            pollIntervalMs: 1,
            pollMaxAttempts: 3,
          }),
        }}
      />,
    );
    await chooseFiles(
      container,
      names(5).map((name) => imageFile(3, "image/png", name)),
    );
    await settle(() => expect(textOf(container)).toContain("3 of 3 ready."));
    expect(textOf(container)).toContain("2 files were not added");
    expect(created).toHaveLength(3);
  });

  it("says so in the singular when exactly one file did not fit", async () => {
    const { services } = batchServices();
    const container = await mount(
      <BulkUpload
        purpose="collection-item-artwork"
        services={{
          ...services,
          policy: resolveUploadClientPolicy({
            bulkFileLimit: 2,
            pollIntervalMs: 1,
            pollMaxAttempts: 3,
          }),
        }}
      />,
    );
    await chooseFiles(
      container,
      names(3).map((name) => imageFile(3, "image/png", name)),
    );
    expect(textOf(container)).toContain("1 file was not added");
    await settle(() => expect(textOf(container)).toContain("2 of 2 ready."));
  });
});
