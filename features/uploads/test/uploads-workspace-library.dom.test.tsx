import { act } from "react";
import { describe, expect, it } from "vitest";

import { UploadApiError } from "../src/client/api-error.ts";
import { resolveUploadClientPolicy } from "../src/client/client-policy.ts";
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
  unmountAll,
} from "./support/dom.tsx";
import { libraryAsset, processedAsset } from "./support/library-fixtures.ts";

describe("uploads workspace library", () => {
  it("shows the processed image as soon as the upload finishes, without waiting for the next poll", async () => {
    let processed = false;
    const release: { current: () => void } = { current: () => undefined };
    const gate = new Promise<void>((resolve) => (release.current = resolve));
    const base = fakeServices({
      api: {
        completeIntent: async () => ({
          asset: { id: assetId, processingState: "pending-validation" },
        }),
        listAssets: async () => ({
          assets: processed
            ? [processedAsset()]
            : [libraryAsset({ processingState: "validated" })],
          truncated: false,
        }),
      },
    });
    // The runner waits on the gate between checks; the library's own poll timer is far away, so only
    // the "finished" event can make the library show the result.
    const services = {
      ...base,
      policy: resolveUploadClientPolicy({
        minimumRefreshDelayMs: 600_000,
        pollIntervalMs: 600_000,
        pollMaxAttempts: 3,
        signedUrlRefreshMarginMs: 1,
      }),
      sleep: () => gate,
    };
    const container = await mount(<UploadsWorkspace services={services} />);
    await chooseFile(container, imageFile());
    await settle(() => expect(textOf(container)).toContain("Processing"));
    expect(container.querySelector("img")).toBeNull();
    processed = true;
    release.current();
    await settle(() => expect(textOf(container)).toContain("Upload processed"));
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
  });

  it("keeps polling the library while an asset is processing, then stops", async () => {
    let calls = 0;
    const services = fakeServices({
      api: {
        listAssets: async () => ({
          assets: [++calls < 3 ? libraryAsset() : processedAsset()],
          truncated: false,
        }),
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await settle(() => expect(textOf(container)).toContain("Ready"));
    const settled = calls;
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(calls).toBe(settled);
  });

  it("keeps showing the images already loaded when a later refresh fails", async () => {
    let failing = false;
    const services = fakeServices({
      api: {
        listAssets: async () => {
          if (failing) throw new UploadApiError("network", null, "offline");
          return { assets: [processedAsset()], truncated: false };
        },
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await settle(() =>
      expect(container.querySelectorAll("li")).toHaveLength(1),
    );
    failing = true;
    await chooseFile(container, imageFile());
    await settle(() =>
      expect(textOf(container)).toContain("Could not refresh"),
    );
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("reports a failed library load and recovers on retry", async () => {
    let failing = true;
    const services = fakeServices({
      api: {
        listAssets: async () => {
          if (failing) throw new UploadApiError("network", null, "offline");
          return { assets: [], truncated: false };
        },
      },
    });
    const container = await mount(<UploadsWorkspace services={services} />);
    await settle(() =>
      expect(textOf(container)).toContain("could not be loaded"),
    );
    failing = false;
    await click(button(container, "Retry"));
    await settle(() =>
      expect(textOf(container)).toContain("Nothing uploaded yet"),
    );
  });

  it("aborts the in-flight library request when unmounted", async () => {
    let signal: AbortSignal | undefined;
    const services = fakeServices({
      api: {
        listAssets: (options) => {
          signal = options?.signal;
          return new Promise(() => undefined);
        },
      },
    });
    await mount(<UploadsWorkspace services={services} />);
    expect(signal?.aborted).toBe(false);
    await unmountAll();
    expect(signal?.aborted).toBe(true);
  });
});
