import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@frostbite/client-http";
import { TransferError, type ObjectTransfer } from "../src/client/transfer.ts";
import { NewUploadWorkspace } from "../src/ui/new-upload-workspace.tsx";
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

describe("new upload workspace", () => {
  it("shows the upload form and leaves the library to its own page", async () => {
    const services = fakeServices();
    const container = await mount(<NewUploadWorkspace services={services} />);
    expect(textOf(container)).toContain("Choose a file");
    expect(textOf(container)).not.toContain("Your library");
    expect(services.api.listAssets).not.toHaveBeenCalled();
  });

  it("uploads, waits for processing, and says where to go next", async () => {
    const services = fakeServices({
      api: {
        completeIntent: async () => ({
          asset: { id: assetId, processingState: "pending-validation" },
        }),
        listAssets: async () => ({
          assets: [processedAsset()],
          nextCursor: null,
        }),
      },
    });
    const container = await mount(<NewUploadWorkspace services={services} />);
    await chooseFile(container, imageFile());
    await settle(() => expect(textOf(container)).toContain("Upload processed"));
    expect(services.api.createIntent).toHaveBeenCalledWith(
      {
        byteLength: 3,
        contentType: "image/png",
        fileName: "art.png",
        purpose: "collection-artwork",
      },
      expect.objectContaining({ idempotencyKey: "upload-attempt-0001" }),
    );
    expect(button(container, "Upload another")).not.toBeNull();
    // An uploaded image has somewhere to go: the collections it is used in, or the library it joined.
    const hrefOf = (text: string) =>
      [...container.querySelectorAll("a")]
        .find((link) => link.textContent === text)
        ?.getAttribute("href");
    expect(hrefOf("Use it in a collection")).toBe("/studio/collections");
    expect(hrefOf("See your library")).toBe("/studio/uploads");
  });

  it("refuses an unsupported file locally without contacting the server", async () => {
    const services = fakeServices();
    const container = await mount(<NewUploadWorkspace services={services} />);
    await chooseFile(container, imageFile(3, "image/gif"));
    expect(textOf(container)).toContain("Only PNG, JPEG, and WebP");
    expect(services.api.createIntent).not.toHaveBeenCalled();
  });

  it("recovers from a network failure by retrying the same attempt without a new key", async () => {
    let failures = 1;
    const services = fakeServices({
      api: {
        createIntent: async (...args) => {
          if (failures-- > 0) throw new ApiError("network", null, "offline");
          return fakeServices().api.createIntent(...args);
        },
        listAssets: async () => ({
          assets: [processedAsset()],
          nextCursor: null,
        }),
      },
    });
    const container = await mount(<NewUploadWorkspace services={services} />);
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
            throw new ApiError("internal_error", 500, "boom");
          }
          return {
            asset: { id: assetId, processingState: "pending-validation" },
          };
        },
        listAssets: async () => ({
          assets: [processedAsset()],
          nextCursor: null,
        }),
      },
      transfer: { upload },
    });
    const container = await mount(<NewUploadWorkspace services={services} />);
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
    const container = await mount(<NewUploadWorkspace services={services} />);
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
        listAssets: async () => ({ assets: [rejected], nextCursor: null }),
      },
    });
    const container = await mount(<NewUploadWorkspace services={services} />);
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(textOf(container)).toContain("Animated images are not supported"),
    );
    expect(button(container, "Retry")).toBeNull();
  });

  it("cancels an in-flight transfer without completing it", async () => {
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
    const container = await mount(<NewUploadWorkspace services={services} />);
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
