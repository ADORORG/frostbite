import { describe, expect, it } from "vitest";

import { coverPictures } from "../../src/client/covers.ts";
import { imageAsset } from "../support/detail.ts";
import { id } from "../support/stubs.ts";

describe("cover pictures", () => {
  it("maps each processed image to its thumbnail, by image id", () => {
    const ready = id();
    const pictures = coverPictures([imageAsset("collection-artwork", ready)]);
    expect(pictures.get(ready)).toEqual({
      height: 8,
      src: `https://storage.example.test/${ready}.webp`,
      width: 12,
    });
  });

  it("leaves out an image that is not processed, or has no picture to show", () => {
    const unprocessed = id();
    const unsigned = id();
    const pictures = coverPictures([
      imageAsset("collection-artwork", unprocessed, {
        processingState: "validated",
      }),
      imageAsset("collection-artwork", unsigned, { derivatives: [] }),
    ]);
    expect(pictures.size).toBe(0);
  });
});
