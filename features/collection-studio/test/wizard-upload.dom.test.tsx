import { ApiError } from "@ador/client-http";
import {
  buttonMatching,
  click,
  mount,
  settle,
  textOf,
} from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

// The real uploader is covered in the uploads feature. Here each uploader is a button that "finishes an
// upload" of a known image, so the wizard's handling of the result is tested on its own.
let uploadedId = "";
vi.mock("@ador/feature-uploads/inline", () => ({
  InlineUpload: ({
    onUploaded,
    purpose,
  }: {
    onUploaded: (assetId: string) => void;
    purpose: string;
  }) => (
    <button onClick={() => onUploaded(uploadedId)} type="button">
      {`Finish ${purpose} upload`}
    </button>
  ),
}));

import { detail, imageAsset } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { heading, wizard } from "./support/wizard-view.tsx";

const radios = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
];

describe("collection wizard: uploading an image without leaving", () => {
  it("fetches the library again and chooses the new image as the cover", async () => {
    const fake = fakeCollections(detail({ description: "About" }));
    fake.state.library = [];
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    expect(fake.api.listImages).toHaveBeenCalledTimes(1);
    expect(textOf(container)).toContain(
      "You have no ready images for this yet",
    );

    const uploaded = imageAsset("collection-artwork");
    uploadedId = uploaded.id;
    fake.state.library = [uploaded];
    await click(buttonMatching(container, /Finish collection-artwork upload/u));
    expect(fake.api.listImages).toHaveBeenCalledTimes(2);
    // Cover choices: None, then the new image, which is now the chosen one.
    await settle(() => expect(radios(container)[1]?.checked).toBe(true));
    expect(textOf(container)).not.toContain("not in the list above");
    expect(fake.api.save).not.toHaveBeenCalled();
  });

  it("uses the usual reload when the library cannot be fetched again, and still chooses the image", async () => {
    const fake = fakeCollections(detail({ description: "About" }));
    fake.state.library = [];
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    const uploaded = imageAsset("collection-artwork");
    uploadedId = uploaded.id;
    fake.state.library = [uploaded];
    fake.api.listImages.mockRejectedValueOnce(
      new ApiError("network", null, "x"),
    );
    await click(buttonMatching(container, /Finish collection-artwork upload/u));
    // The reload that follows a failed refresh brings the new image in.
    await settle(() => expect(fake.api.listImages).toHaveBeenCalledTimes(3));
    await settle(() => expect(radios(container)[1]?.checked).toBe(true));
  });

  it("chooses a new banner for the banner, not the cover", async () => {
    const fake = fakeCollections(detail({ description: "About" }));
    fake.state.library = [];
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    const banner = imageAsset("collection-banner");
    uploadedId = banner.id;
    fake.state.library = [banner];
    await click(buttonMatching(container, /Finish collection-banner upload/u));
    // Cover: None only, still chosen. Banner: None, then the new image, chosen.
    await settle(() => expect(radios(container)).toHaveLength(3));
    expect(radios(container).map((radio) => radio.checked)).toEqual([
      true,
      false,
      true,
    ]);
  });
});
