import { createProviderRegistry } from "@frostbite/plugin-kit/providers";
import {
  uploadDetailPath,
  uploadsNewPath,
  uploadsStudioPath,
} from "@frostbite/shared/uploads";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createUploadsEntrypoint } from "../src/entrypoint.tsx";

describe("uploads entrypoint", () => {
  const entrypoint = createUploadsEntrypoint(createProviderRegistry([]));

  it("contributes the library, intent, and completion operations and a library page, an upload page and an image page", () => {
    expect(
      entrypoint.operations?.map(({ route }) => route.operationId).sort(),
    ).toEqual([
      "completeUploadIntent",
      "createUploadIntent",
      "listOlderUploadedAssets",
      "listUploadedAssets",
    ]);
    expect(
      entrypoint.pages?.map(({ path, access }) => [path, access.kind]),
    ).toEqual([
      [uploadsStudioPath, "authenticated"],
      [uploadsNewPath, "authenticated"],
      [uploadDetailPath, "authenticated"],
    ]);
    expect(entrypoint.capabilities).toEqual([
      "api-routes",
      "authenticated-page",
      "navigation",
      "studio-page",
    ]);
  });

  it("renders the library page inside the shell with the supplied navigation", async () => {
    const page = entrypoint.pages?.[0];
    if (page === undefined) throw new Error("page missing");
    const markup = renderToStaticMarkup(
      await page.render({
        actorUserId: null,
        navigation: [{ area: "studio", href: "/studio", label: "Overview" }],
        params: {},
      }),
    );
    expect(markup).toContain("<h1>Uploads</h1>");
    // The frame's own words: the area, and the platform's name in the footer.
    expect(markup).toContain('<p class="arcade-eyebrow">Studio</p>');
    expect(markup).toContain("<span>Frostbite</span>");
    expect(markup).not.toContain("PRIVATE DRAFTS");
    expect(markup).toContain('href="/studio"');
    expect(markup).toContain("Upload an image");
    expect(markup).toContain("Your library");
  });

  it("renders the page that adds an image, apart from the library", async () => {
    const page = entrypoint.pages?.[1];
    if (page === undefined) throw new Error("page missing");
    const markup = renderToStaticMarkup(
      await page.render({ actorUserId: null, navigation: [], params: {} }),
    );
    expect(markup).toContain("<h1>Upload an image</h1>");
    expect(markup).not.toContain("Your library");
  });

  it("renders the image page for the image in the address", async () => {
    const page = entrypoint.pages?.[2];
    if (page === undefined) throw new Error("page missing");
    const markup = renderToStaticMarkup(
      await page.render({
        actorUserId: null,
        navigation: [],
        params: { assetId: "abc" },
      }),
    );
    expect(markup).toContain("<h1>Image</h1>");
    expect(markup).toContain("Loading the image");
  });
});
