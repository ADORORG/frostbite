// @vitest-environment jsdom

import { mount, settle } from "@ador/test-kit/dom";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { MintedApi } from "../src/client/minted-api.ts";
import { MintedPicture } from "../src/ui/minted-picture.tsx";

const ok = {
  contentType: "image/svg+xml",
  data: "PHN2Zz48L3N2Zz4=",
  edition: 1,
  status: "ok",
} as const;

// The first claim has a picture; the second never answers.
const api: MintedApi = {
  list: async () => ({ minted: [] }),
  picture: (claimId) =>
    claimId === "first" ? Promise.resolve(ok) : new Promise(() => undefined),
};

function Switch() {
  const [claimId, setClaimId] = useState("first");
  return (
    <>
      <button onClick={() => setClaimId("second")} type="button">
        next
      </button>
      <MintedPicture alt="a milestone" api={api} claimId={claimId} />
    </>
  );
}

describe("the minted picture", () => {
  it("never shows one claim's picture for another claim", async () => {
    const container = await mount(<Switch />);
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
    container.querySelector("button")?.click();
    await settle(() => expect(container.querySelector("img")).toBeNull());
  });
});
