import { describe, expect, it, vi } from "vitest";

import { UploadApiError } from "../src/client/api-error.ts";
import { TransferError, type ObjectTransfer } from "../src/client/transfer.ts";
import { UploadsWorkspace } from "../src/ui/uploads-workspace.tsx";
import {
  assetId,
  button,
  chooseFile,
  click,
  fakeServices,
  imageFile,
  mount,
  settle,
  textOf,
} from "./support/dom.tsx";
import { libraryAsset, processedAsset } from "./support/library-fixtures.ts";

describe("uploads workspace", () => {
  it("shows the upload form and the loaded library together", async () => {
    const services = fakeServices({
      api: {
        listAssets: async () => ({
          assets: [processedAsset()],
          truncated: false,
        }),
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await settle(() =>
      expect(container.querySelectorAll("li")).toHaveLength(1),
    );
    expect(textOf(container)).toContain("Upload an image");
    expect(textOf(container)).toContain("Your library");
  });

  it("uploads, waits for processing, and refreshes the library with the result", async () => {
    let processed = false;
    const services = fakeServices({
      api: {
        completeIntent: async () => {
          processed = true;
          return {
            asset: { id: assetId, processingState: "pending-validation" },
          };
        },
        listAssets: async () => ({
          assets: processed ? [processedAsset()] : [],
          truncated: false,
        }),
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await settle(() =>
      expect(textOf(container)).toContain("Nothing uploaded yet"),
    );
    await chooseFile(container, imageFile());
    await settle(() => expect(textOf(container)).toContain("Upload processed"));
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
    expect(services.api.createIntent).toHaveBeenCalledWith(
      {
        byteLength: 3,
        contentType: "image/png",
        purpose: "collection-artwork",
      },
      expect.objectContaining({ idempotencyKey: "upload-attempt-0001" }),
    );
    expect(button(container, "Upload another")).not.toBeNull();
  });

  it("refuses an unsupported file locally without contacting the server", async () => {
    const services = fakeServices();
    const container = await mount(<UploadsWorkspace services={services} />);
    await chooseFile(container, imageFile(3, "image/gif"));
    expect(textOf(container)).toContain("Only PNG, JPEG, and WebP");
    expect(services.api.createIntent).not.toHaveBeenCalled();
  });

  it("recovers from a network failure by retrying the same attempt without a new key", async () => {
    let failures = 1;
    const services = fakeServices({
      api: {
        createIntent: async (...args) => {
          if (failures-- > 0)
            throw new UploadApiError("network", null, "offline");
          return fakeServices().api.createIntent(...args);
        },
        listAssets: async () => ({
          assets: [processedAsset()],
          truncated: false,
        }),
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(textOf(container)).toContain("Could not reach the server"),
    );
    await click(button(container, "Retry"));
    await settle(() => expect(textOf(container)).toContain("Upload processed"));
    const keys = services.api.createIntent.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys).toEqual(["upload-attempt-0001", "upload-attempt-0001"]);
  });

  it("does not repeat a finished transfer when a later step is retried", async () => {
    let failCompletion = true;
    const upload = vi.fn<ObjectTransfer["upload"]>(async () => undefined);
    const services = fakeServices({
      api: {
        completeIntent: async () => {
          if (failCompletion) {
            failCompletion = false;
            throw new UploadApiError("internal_error", 500, "boom");
          }
          return {
            asset: { id: assetId, processingState: "pending-validation" },
          };
        },
        listAssets: async () => ({
          assets: [processedAsset()],
          truncated: false,
        }),
      },
      transfer: { upload },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(textOf(container)).toContain("The server had a problem"),
    );
    await click(button(container, "Retry"));
    await settle(() => expect(textOf(container)).toContain("Upload processed"));
    expect(upload).toHaveBeenCalledOnce();
  });

  it("reports a storage refusal as retryable", async () => {
    const services = fakeServices({
      transfer: {
        upload: async () => Promise.reject(new TransferError("rejected", 403)),
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(textOf(container)).toContain("upload link may have expired"),
    );
    expect(button(container, "Retry")).not.toBeNull();
  });

  it("explains a server-side rejection and offers a new file, not a retry", async () => {
    const rejected = libraryAsset({
      processingState: "rejected",
      rejectionReason: "animation-unsupported",
    });
    const services = fakeServices({
      api: {
        listAssets: async () => ({ assets: [rejected], truncated: false }),
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(textOf(container)).toContain("Animated images are not supported"),
    );
    expect(button(container, "Retry")).toBeNull();
  });

  it("cancels an in-flight transfer and leaves the library untouched", async () => {
    const services = fakeServices({
      transfer: {
        upload: ({ signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () =>
              reject(new TransferError("aborted", null)),
            );
          }),
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(button(container, "Cancel upload")).not.toBeNull(),
    );
    expect(container.querySelector("input")?.disabled).toBe(true);
    expect(container.querySelector("select")?.disabled).toBe(true);
    await click(button(container, "Cancel upload"));
    await settle(() => expect(textOf(container)).toContain("Upload cancelled"));
    expect(container.querySelector("input")?.disabled).toBe(false);
    expect(services.api.completeIntent).not.toHaveBeenCalled();
  });
});
