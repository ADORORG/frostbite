// @vitest-environment jsdom

import { mintedPictureHref } from "@frostbite/shared/games";
import { mount, settle } from "@frostbite/test-kit/dom";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { MintedPicture } from "../src/ui/minted-picture.tsx";

function Switch() {
  const [claimId, setClaimId] = useState(
    "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60",
  );
  return (
    <>
      <button
        onClick={() => setClaimId("0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a")}
        type="button"
      >
        next
      </button>
      <MintedPicture alt="a milestone" claimId={claimId} />
    </>
  );
}
const image = (container: HTMLElement) => container.querySelector("img");

describe("the minted picture", () => {
  it("never shows one claim's picture for another claim", async () => {
    const container = await mount(<Switch />);
    image(container)?.dispatchEvent(new Event("load"));
    await settle(() => expect(image(container)?.hidden).toBe(false));
    container.querySelector("button")?.click();
    await settle(() =>
      expect(image(container)?.getAttribute("src")).toBe(
        mintedPictureHref("0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a"),
      ),
    );
    expect(image(container)?.hidden).toBe(true);
  });

  it("is not shown for a failure, and a later load of another address is shown", async () => {
    const container = await mount(<Switch />);
    image(container)?.dispatchEvent(new Event("error"));
    await settle(() => expect(image(container)?.hidden).toBe(true));
    container.querySelector("button")?.click();
    await settle(() => expect(image(container)?.hidden).toBe(true));
    image(container)?.dispatchEvent(new Event("load"));
    await settle(() => expect(image(container)?.hidden).toBe(false));
  });
});
