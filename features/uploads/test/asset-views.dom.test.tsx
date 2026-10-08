import { describe, expect, it, vi } from "vitest";

import type { AssetLibrary } from "../src/ui/hooks/use-asset-library.ts";
import { AssetCard } from "../src/ui/components/asset-card.tsx";
import { AssetLibraryPanel } from "../src/ui/components/asset-library-panel.tsx";
import { libraryAsset, processedAsset } from "./support/library-fixtures.ts";
import { button, click, mount, textOf } from "./support/dom.tsx";

describe("asset card", () => {
  it("shows the thumbnail with intrinsic size, descriptive alt text, state, and dimensions", async () => {
    const container = await mount(<AssetCard asset={processedAsset()} />);
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(
      "https://storage.example.test/t.webp?sig=1",
    );
    expect(image?.getAttribute("alt")).toBe("Collection artwork thumbnail");
    expect([image?.width, image?.height]).toEqual([4, 3]);
    expect(textOf(container)).toContain("Ready");
    expect(textOf(container)).toContain("40 × 30 px");
  });

  it("explains a rejected file in plain language and shows no image", async () => {
    const container = await mount(
      <AssetCard
        asset={libraryAsset({
          processingState: "rejected",
          rejectionReason: "pixels-exceeded",
        })}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(textOf(container)).toContain("Rejected");
    expect(textOf(container)).toContain("too many pixels");
    expect(textOf(container)).toContain("No preview yet");
  });

  it("separates an unavailable preview from a rejected file", async () => {
    const container = await mount(
      <AssetCard
        asset={processedAsset({
          derivativeAccess: "unavailable",
          derivatives: [],
        })}
      />,
    );
    expect(textOf(container)).toContain("Preview unavailable");
    expect(textOf(container)).toContain("temporarily unavailable");
    expect(textOf(container)).not.toContain("Rejected");
  });

  it("says a pending asset is still being checked", async () => {
    const container = await mount(<AssetCard asset={libraryAsset()} />);
    expect(textOf(container)).toContain("Checking");
    expect(textOf(container)).toContain("Still being checked");
    expect(textOf(container)).not.toContain("px");
  });
});

function view(state: AssetLibrary["state"]) {
  const refresh = vi.fn();
  return { refresh, library: { refresh, state } satisfies AssetLibrary };
}

describe("asset library panel", () => {
  it("says it is loading, not empty", async () => {
    const container = await mount(
      <AssetLibraryPanel library={view({ status: "loading" }).library} />,
    );
    expect(textOf(container)).toContain("Loading your library");
    expect(textOf(container)).not.toContain("Nothing uploaded");
  });

  it("shows the empty state only for a loaded, empty library", async () => {
    const container = await mount(
      <AssetLibraryPanel
        library={
          view({ library: { assets: [], truncated: false }, status: "ready" })
            .library
        }
      />,
    );
    expect(textOf(container)).toContain("Nothing uploaded yet");
    expect(container.querySelector("ul")).toBeNull();
  });

  it("lists the assets and tells the user when older ones are not shown", async () => {
    const assets = [
      processedAsset(),
      libraryAsset({ id: "018f22f2-9c1a-7b21-8c45-0000000000bb" }),
    ];
    const container = await mount(
      <AssetLibraryPanel
        library={
          view({ library: { assets, truncated: true }, status: "ready" })
            .library
        }
      />,
    );
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(textOf(container)).not.toContain("Nothing uploaded");
    expect(textOf(container)).toContain("Showing your newest images");
    const full = await mount(
      <AssetLibraryPanel
        library={
          view({ library: { assets, truncated: false }, status: "ready" })
            .library
        }
      />,
    );
    expect(textOf(full)).not.toContain("newest");
  });

  it("reports a failed first load with a retry and no invented content", async () => {
    const { library, refresh } = view({ library: null, status: "error" });
    const container = await mount(<AssetLibraryPanel library={library} />);
    expect(textOf(container)).toContain("could not be loaded");
    expect(container.querySelector("ul")).toBeNull();
    expect(textOf(container)).not.toContain("Nothing uploaded");
    await click(button(container, "Retry"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps showing earlier data when a refresh fails, and says so", async () => {
    const { library } = view({
      library: { assets: [processedAsset()], truncated: false },
      status: "error",
    });
    const container = await mount(<AssetLibraryPanel library={library} />);
    expect(textOf(container)).toContain("Could not refresh");
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });
});
