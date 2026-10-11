import { click, mount, settle, textOf } from "@ador/test-kit/dom";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

// The real uploader is covered in the uploads feature. Here it is a button that "finishes an upload", so
// what this component does with the result is tested on its own.
vi.mock("@ador/feature-uploads/inline", () => ({
  InlineUpload: ({
    onUploaded,
    purpose,
  }: {
    onUploaded: (assetId: string) => void;
    purpose: string;
  }) => (
    <button
      data-purpose={purpose}
      onClick={() => onUploaded("new-asset-id")}
      type="button"
    >
      Finish upload
    </button>
  ),
}));

import { ImageChoice } from "../src/ui/components/image-choice.tsx";
import { imageAsset } from "./support/detail.ts";

const cover = imageAsset("collection-artwork");
const otherCover = imageAsset("collection-artwork");
const banner = imageAsset("collection-banner");
const pending = imageAsset("collection-artwork", undefined, {
  derivativeAccess: "none",
  derivatives: [],
  processingState: "validated",
});

function view(overrides: Partial<Parameters<typeof ImageChoice>[0]> = {}) {
  const onChange = vi.fn();
  const props = {
    allowNone: true,
    assets: [cover, otherCover, banner, pending],
    disabled: false,
    legend: "Cover image",
    onChange,
    purpose: "collection-artwork",
    onUploaded: vi.fn(async () => undefined),
    selectedId: null,
    ...overrides,
  } as const;
  return { onChange, props };
}

const radios = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
];

describe("image choice", () => {
  it("offers only the creator's processed images made for this purpose, plus none", async () => {
    const { props } = view();
    const container = await mount(<ImageChoice {...props} />);
    expect(container.querySelector("legend")?.textContent).toBe("Cover image");
    expect(radios(container)).toHaveLength(3);
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(textOf(container)).toContain("None");
  });

  it("does not offer none when a choice is required", async () => {
    const { props } = view({ allowNone: false });
    const container = await mount(<ImageChoice {...props} />);
    expect(radios(container)).toHaveLength(2);
    expect(textOf(container)).not.toContain("None");
  });

  it("reports the chosen image, and none", async () => {
    const { onChange, props } = view({ selectedId: cover.id });
    const container = await mount(<ImageChoice {...props} />);
    const [none, first, second] = radios(container);
    expect([none?.checked, first?.checked, second?.checked]).toEqual([
      false,
      true,
      false,
    ]);
    await act(() => second?.click());
    expect(onChange).toHaveBeenLastCalledWith(otherCover.id);
    await act(() => none?.click());
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("when there are none ready, says so and offers the uploader for this purpose right there", async () => {
    const { props } = view({ assets: [banner, pending] });
    const container = await mount(<ImageChoice {...props} />);
    expect(textOf(container)).toContain(
      "You have no ready images for this yet.",
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    expect(
      container
        .querySelector("button[data-purpose]")
        ?.getAttribute("data-purpose"),
    ).toBe("collection-artwork");
  });

  it("keeps the uploader a click away, not in the way, when images already exist", async () => {
    const { props } = view();
    const container = await mount(<ImageChoice {...props} />);
    const disclosure = container.querySelector("details");
    expect(disclosure?.open).toBe(false);
    expect(disclosure?.querySelector("summary")?.textContent).toBe(
      "Upload a new image",
    );
    expect(disclosure?.querySelector("button[data-purpose]")).not.toBeNull();
  });

  it("chooses the uploaded image only after the library holds it", async () => {
    let finishRefresh: () => void = () => undefined;
    const onUploaded = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    const { onChange, props } = view({ onUploaded });
    const container = await mount(<ImageChoice {...props} />);
    await click(container.querySelector("button[data-purpose]"));
    expect(onUploaded).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => finishRefresh());
    await settle(() => expect(onChange).toHaveBeenCalledWith("new-asset-id"));
  });

  it("keeps showing a chosen image that is not in the list, and says so", async () => {
    const { props } = view({ selectedId: banner.id });
    const container = await mount(<ImageChoice {...props} />);
    expect(textOf(container)).toContain(
      "An image you chose earlier is not in the list above.",
    );
    expect(radios(container).some((radio) => radio.checked)).toBe(false);
  });

  it("disables every choice while busy, and shows a placeholder when a rendition is missing", async () => {
    const noThumbnail = imageAsset("collection-artwork", undefined, {
      derivatives: [],
    });
    const { props } = view({ assets: [noThumbnail], disabled: true });
    const container = await mount(<ImageChoice {...props} />);
    expect(radios(container).every((radio) => radio.disabled)).toBe(true);
    expect(textOf(container)).toContain("Preview unavailable");
  });
});
