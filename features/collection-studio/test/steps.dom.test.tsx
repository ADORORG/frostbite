import { ApiError } from "@frostbite/client-http";
import { button, click, mount, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { describeFailure } from "../src/client/error-copy.ts";
import { newDraftForm } from "../src/client/draft-form.ts";
import { CollectionList } from "../src/ui/components/collection-list.tsx";
import { ImagesStep } from "../src/ui/components/images-step.tsx";
import { imageAsset } from "./support/detail.ts";
import { signet } from "./support/stubs.ts";

describe("images step", () => {
  const form = newDraftForm(signet);
  const noop = () => undefined;
  const library = {
    assets: [imageAsset("collection-artwork"), imageAsset("collection-banner")],
    nextCursor: null,
  };

  it("shows loading, and a failure with retry, without hiding the rest", async () => {
    const loading = await mount(
      <ImagesStep
        disabled={false}
        form={form}
        library={{ status: "loading" }}
        onChange={noop}
        onRefresh={noop}
        onUploaded={async () => undefined}
      />,
    );
    expect(textOf(loading)).toContain("Loading your images…");
    const onRefresh = vi.fn();
    const failed = await mount(
      <ImagesStep
        disabled={false}
        form={form}
        library={{
          data: null,
          failure: describeFailure(new ApiError("network", null, "x")),
          status: "error",
        }}
        onChange={noop}
        onRefresh={onRefresh}
        onUploaded={async () => undefined}
      />,
    );
    expect(textOf(failed)).toContain("Your images could not be loaded.");
    await click(button(failed, "Retry"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("offers the cover and banner choices once loaded, and says when only some are shown", async () => {
    const container = await mount(
      <ImagesStep
        disabled={false}
        form={form}
        library={{
          data: {
            ...library,
            nextCursor: "1760000000000.0198a000-0000-7000-8000-000000000001",
          },
          status: "ready",
        }}
        onChange={noop}
        onRefresh={noop}
        onUploaded={async () => undefined}
      />,
    );
    expect(textOf(container)).toContain("Cover image");
    expect(textOf(container)).toContain("Banner image");
    expect(textOf(container)).toContain("Showing your newest images.");
    expect(button(container, "Refresh images")).not.toBeNull();
  });

  it("keeps showing what was loaded when a refresh fails", async () => {
    const container = await mount(
      <ImagesStep
        disabled={false}
        form={form}
        library={{
          data: library,
          failure: describeFailure(new ApiError("network", null, "x")),
          status: "error",
        }}
        onChange={noop}
        onRefresh={noop}
        onUploaded={async () => undefined}
      />,
    );
    expect(textOf(container)).toContain(
      "Could not refresh your images. Showing what was loaded earlier.",
    );
    expect(textOf(container)).toContain("Cover image");
  });
});

describe("collection list", () => {
  const summary = {
    coverAssetId: null,
    createdAt: "2026-10-09T12:00:00.000Z",
    id: "018f22f2-9c1a-7b21-8c45-000000000001",
    itemCount: 1,
    name: "First light",
    plannedSupply: 5,
    revision: 2,
    submissionState: null,
    targetChain: signet,
    updatedAt: "2026-10-09T13:00:00.000Z",
  };

  it("keeps showing what was loaded when a refresh fails, and offers a retry", async () => {
    const reload = vi.fn();
    const container = await mount(
      <CollectionList
        chains={[]}
        covers={new Map()}
        list={{
          reload,
          replace: () => undefined,
          state: {
            data: { collections: [summary] },
            failure: describeFailure(new ApiError("network", null, "x")),
            status: "error",
          },
        }}
      />,
    );
    expect(textOf(container)).toContain(
      "Could not refresh. Showing what was loaded earlier.",
    );
    expect(textOf(container)).toContain("First light");
    expect(textOf(container)).toContain(signet);
    await click(button(container, "Retry"));
    expect(reload).toHaveBeenCalledOnce();
  });
});
