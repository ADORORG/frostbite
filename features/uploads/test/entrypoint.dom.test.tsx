import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { uploadsStudioPath } from "@ador/shared/uploads";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createUploadsEntrypoint } from "../src/entrypoint.tsx";

describe("uploads entrypoint", () => {
  const entrypoint = createUploadsEntrypoint(createProviderRegistry([]));

  it("contributes the library, intent, and completion operations and one studio page", () => {
    expect(
      entrypoint.operations?.map(({ route }) => route.operationId).sort(),
    ).toEqual([
      "completeUploadIntent",
      "createUploadIntent",
      "listUploadedAssets",
    ]);
    expect(
      entrypoint.pages?.map(({ path, access }) => [path, access.kind]),
    ).toEqual([[uploadsStudioPath, "authenticated"]]);
    expect(entrypoint.capabilities).toEqual([
      "api-routes",
      "authenticated-page",
      "navigation",
      "studio-page",
    ]);
  });

  it("renders the studio page inside the shell with the supplied navigation", async () => {
    const page = entrypoint.pages?.[0];
    if (page === undefined) throw new Error("page missing");
    const markup = renderToStaticMarkup(
      await page.render({
        actorUserId: null,
        navigation: [{ href: "/studio", label: "Studio" }],
        params: {},
      }),
    );
    expect(markup).toContain("<h1>Uploads</h1>");
    expect(markup).toContain('href="/studio"');
    expect(markup).toContain("Upload an image");
    expect(markup).toContain("Your library");
  });
});
