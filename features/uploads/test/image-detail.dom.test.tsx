import { ApiError } from "@ador/client-http";
import { describe, expect, it } from "vitest";

import { ImageDetailWorkspace } from "../src/ui/image-detail-workspace.tsx";
import {
  button,
  click,
  fakeServices,
  mount,
  settle,
  textOf,
} from "./support/dom.tsx";
import {
  assetId,
  libraryAsset,
  processedAsset,
} from "./support/library-fixtures.ts";

const withLibrary = (
  assets: ReturnType<typeof libraryAsset>[],
  truncated = false,
) =>
  fakeServices({
    api: { listAssets: async () => ({ assets, truncated }) },
  });

const hrefOf = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("a")]
    .find((link) => link.textContent === text)
    ?.getAttribute("href");

describe("image detail", () => {
  it("shows a ready image in full, and where to go with it", async () => {
    const container = await mount(
      <ImageDetailWorkspace
        assetId={assetId}
        services={withLibrary([
          processedAsset({ purpose: "collection-banner" }),
        ])}
      />,
    );
    await settle(() => expect(textOf(container)).toContain("Ready"));
    expect(textOf(container)).toContain("Collection banner");
    expect(textOf(container)).toContain("40 × 30 px");
    expect(textOf(container)).toContain("2026-10-06");
    // The large picture is used when there is one.
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://storage.example.test/p.webp?sig=1",
    );
    expect(hrefOf(container, "Use in a collection")).toBe(
      "/studio/collections",
    );
    expect(hrefOf(container, "Back to your library")).toBe("/studio/uploads");
  });

  it("says why there is no picture: ready but unavailable, or not ready yet", async () => {
    const unavailable = await mount(
      <ImageDetailWorkspace
        assetId={assetId}
        services={withLibrary([processedAsset({ derivatives: [] })])}
      />,
    );
    await settle(() => expect(textOf(unavailable)).toContain("Ready"));
    expect(textOf(unavailable)).toContain("Preview unavailable");
    const pending = await mount(
      <ImageDetailWorkspace
        assetId={assetId}
        services={withLibrary([libraryAsset({ processingState: "validated" })])}
      />,
    );
    await settle(() => expect(textOf(pending)).toContain("Processing"));
    expect(textOf(pending)).toContain("No preview yet");
  });

  it("offers no way to use an image that is not ready, and says why", async () => {
    const container = await mount(
      <ImageDetailWorkspace
        assetId={assetId}
        services={withLibrary([libraryAsset({ processingState: "validated" })])}
      />,
    );
    await settle(() => expect(textOf(container)).toContain("Processing"));
    expect(textOf(container)).toContain("Still being checked and processed.");
    expect(hrefOf(container, "Use in a collection")).toBeUndefined();
    expect(container.querySelector("img")).toBeNull();
  });

  it("says when the image is not in the library, and does not show another one", async () => {
    const other = processedAsset({ id: `${assetId.slice(0, -1)}9` });
    const container = await mount(
      <ImageDetailWorkspace
        assetId={assetId}
        services={withLibrary([other])}
      />,
    );
    await settle(() => expect(textOf(container)).toContain("Image not found"));
    expect(container.querySelector("img")).toBeNull();
    expect(textOf(container)).toContain("It is not in your library");
    expect(hrefOf(container, "Back to your library")).toBe("/studio/uploads");
  });

  it("says an old image may simply be beyond the listed ones", async () => {
    const container = await mount(
      <ImageDetailWorkspace
        assetId={assetId}
        services={withLibrary([], true)}
      />,
    );
    await settle(() => expect(textOf(container)).toContain("Image not found"));
    expect(textOf(container)).toContain("older than the images listed");
  });

  it("tells a failed load apart from a missing image, and recovers on retry", async () => {
    let failing = true;
    const services = fakeServices({
      api: {
        listAssets: async () => {
          if (failing) throw new ApiError("network", null, "offline");
          return { assets: [processedAsset()], truncated: false };
        },
      },
    });
    const container = await mount(
      <ImageDetailWorkspace assetId={assetId} services={services} />,
    );
    await settle(() =>
      expect(textOf(container)).toContain("could not be loaded"),
    );
    expect(textOf(container)).not.toContain("Image not found");
    failing = false;
    await click(button(container, "Retry"));
    await settle(() => expect(textOf(container)).toContain("Ready"));
  });
});
