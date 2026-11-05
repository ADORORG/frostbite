import { ApiError } from "@frostbite/client-http";
import { describe, expect, it, vi } from "vitest";

import { InlineUpload } from "../src/ui/inline-upload.tsx";
import { libraryAsset, processedAsset } from "./support/library-fixtures.ts";
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

describe("inline upload", () => {
  it("uploads for the purpose it was given and reports the image only once it is processed", async () => {
    const onUploaded = vi.fn();
    const services = fakeServices({
      api: {
        listAssets: async () => ({
          assets: [processedAsset({ purpose: "collection-banner" })],
          nextCursor: null,
        }),
      },
    });
    const container = await mount(
      <InlineUpload
        onUploaded={onUploaded}
        purpose="collection-banner"
        services={services}
      />,
    );
    expect(textOf(container)).toContain("Upload collection banner");
    expect(onUploaded).not.toHaveBeenCalled();
    await chooseFile(container, imageFile());
    await settle(() => expect(textOf(container)).toContain("Upload processed"));
    expect(services.api.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "collection-banner" }),
      expect.anything(),
    );
    expect(onUploaded).toHaveBeenCalledExactlyOnceWith(assetId);
  });

  it("does not report an image that was refused, and says why", async () => {
    const onUploaded = vi.fn();
    const services = fakeServices({
      api: {
        listAssets: async () => ({
          assets: [
            libraryAsset({
              processingState: "rejected",
              rejectionReason: "dimensions-exceeded",
            }),
          ],
          nextCursor: null,
        }),
      },
    });
    const container = await mount(
      <InlineUpload
        onUploaded={onUploaded}
        purpose="collection-artwork"
        services={services}
      />,
    );
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(textOf(container)).toContain(
        "The image is too large in width or height.",
      ),
    );
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("refuses an unsupported file locally and reports nothing", async () => {
    const onUploaded = vi.fn();
    const services = fakeServices();
    const container = await mount(
      <InlineUpload
        onUploaded={onUploaded}
        purpose="collection-artwork"
        services={services}
      />,
    );
    await chooseFile(container, imageFile(3, "image/gif"));
    expect(textOf(container)).toContain("Only PNG, JPEG, and WebP");
    expect(services.api.createIntent).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("retries a failed upload without reporting anything until it succeeds", async () => {
    const onUploaded = vi.fn();
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
    const container = await mount(
      <InlineUpload
        onUploaded={onUploaded}
        purpose="collection-artwork"
        services={services}
      />,
    );
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(textOf(container)).toContain("Could not reach the server"),
    );
    expect(onUploaded).not.toHaveBeenCalled();
    await click(button(container, "Retry"));
    await settle(() => expect(onUploaded).toHaveBeenCalledTimes(1));
  });
});
