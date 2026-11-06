import { act } from "react";
import { describe, expect, it } from "vitest";

import { ApiError } from "@frostbite/client-http";
import { LibraryWorkspace } from "../src/ui/library-workspace.tsx";
import {
  button,
  click,
  fakeServices,
  mount,
  settle,
  textOf,
  unmountAll,
} from "./support/dom.tsx";
import {
  assetId,
  libraryAsset,
  processedAsset,
} from "./support/library-fixtures.ts";

describe("library workspace", () => {
  it("keeps polling the library while an asset is processing, then stops", async () => {
    let calls = 0;
    const services = fakeServices({
      api: {
        listAssets: async () => ({
          assets: [++calls < 3 ? libraryAsset() : processedAsset()],
          nextCursor: null,
        }),
      },
    });
    const container = await mount(<LibraryWorkspace services={services} />);
    await settle(() => expect(textOf(container)).toContain("Ready"));
    const settled = calls;
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(calls).toBe(settled);
  });

  it("keeps showing the images already loaded when a later refresh fails", async () => {
    let calls = 0;
    const services = fakeServices({
      api: {
        listAssets: async () => {
          if (++calls > 1) throw new ApiError("network", null, "offline");
          return { assets: [libraryAsset()], nextCursor: null };
        },
      },
    });
    const container = await mount(<LibraryWorkspace services={services} />);
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
          if (failing) throw new ApiError("network", null, "offline");
          return { assets: [], nextCursor: null };
        },
      },
    });
    const container = await mount(<LibraryWorkspace services={services} />);
    await settle(() =>
      expect(textOf(container)).toContain("could not be loaded"),
    );
    failing = false;
    await click(button(container, "Retry"));
    await settle(() =>
      expect(textOf(container)).toContain("Nothing uploaded yet"),
    );
    // An empty library points at the page that adds an image, instead of holding a form of its own.
    const start = [...container.querySelectorAll("a")].find(
      (link) => link.textContent === "Upload your first image",
    );
    expect(start?.getAttribute("href")).toBe("/studio/uploads/new");
    expect(container.querySelector("input")).toBeNull();
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
    await mount(<LibraryWorkspace services={services} />);
    expect(signal?.aborted).toBe(false);
    await unmountAll();
    expect(signal?.aborted).toBe(true);
  });
});

describe("library workspace: filters and use", () => {
  const purposes = [
    processedAsset({ id: `${assetId.slice(0, -1)}1` }),
    processedAsset({
      id: `${assetId.slice(0, -1)}2`,
      purpose: "collection-banner",
    }),
    libraryAsset({
      id: `${assetId.slice(0, -1)}3`,
      processingState: "validated",
    }),
  ];
  const withAssets = () =>
    fakeServices({
      api: {
        listAssets: async () => ({ assets: purposes, nextCursor: null }),
      },
    });
  const links = (container: HTMLElement, text: string) =>
    [...container.querySelectorAll("a")].filter(
      (link) => link.textContent === text,
    );

  it("offers a way to add an image, and only the filters that lead somewhere", async () => {
    const container = await mount(<LibraryWorkspace services={withAssets()} />);
    await settle(() =>
      expect(container.querySelectorAll("li")).toHaveLength(3),
    );
    expect(links(container, "Upload an image")[0]?.getAttribute("href")).toBe(
      "/studio/uploads/new",
    );
    expect(
      [...container.querySelectorAll("[aria-pressed]")].map(
        (option) => option.textContent,
      ),
    ).toEqual(["All3", "Collection artwork2", "Collection banner1"]);
  });

  it("narrows the images to one purpose, and back", async () => {
    const container = await mount(<LibraryWorkspace services={withAssets()} />);
    await settle(() =>
      expect(container.querySelectorAll("li")).toHaveLength(3),
    );
    await click(button(container, "Collection banner1"));
    expect(container.querySelectorAll("li")).toHaveLength(1);
    await click(button(container, "All3"));
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("offers 'Use in a collection' only for an image that is ready", async () => {
    const container = await mount(<LibraryWorkspace services={withAssets()} />);
    await settle(() =>
      expect(container.querySelectorAll("li")).toHaveLength(3),
    );
    const use = links(container, "Use in a collection");
    expect(use).toHaveLength(2);
    expect(use.map((link) => link.getAttribute("href"))).toEqual([
      "/studio/collections",
      "/studio/collections",
    ]);
    expect(use[1]?.getAttribute("aria-label")).toBe(
      "Use in a collection: Collection banner uploaded 2026-10-06",
    );
  });

  it("links every image, ready or not, to its own page", async () => {
    const container = await mount(<LibraryWorkspace services={withAssets()} />);
    await settle(() =>
      expect(container.querySelectorAll("li")).toHaveLength(3),
    );
    expect(
      links(container, "Details").map((link) => link.getAttribute("href")),
    ).toEqual(purposes.map(({ id }) => `/studio/uploads/${id}`));
  });
});
