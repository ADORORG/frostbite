// @vitest-environment jsdom

import { mintedPictureHref } from "@ador/shared/games";
import { mount, settle } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { ClaimsCard } from "../src/ui/claims-card.tsx";
import { claimAt, claimId, milestoneId } from "./support/claims-ui.tsx";

const show = (state: "complete" | "pending") =>
  mount(
    <ClaimsCard
      claims={[claimAt(state)]}
      onReview={() => undefined}
      titles={{ [milestoneId]: "First win" }}
    />,
  );
const picture = (container: HTMLElement) =>
  container.querySelector<HTMLImageElement>("img.minted-picture");

describe("the claims in the dock", () => {
  it("point an image at the minted picture of a complete claim, and show it once it has come", async () => {
    const container = await show("complete");
    const image = picture(container);
    expect(image?.getAttribute("src")).toBe(mintedPictureHref(claimId));
    expect(image?.getAttribute("alt")).toBe("First win");
    expect(image?.hidden).toBe(true);
    image?.dispatchEvent(new Event("load"));
    await settle(() => expect(picture(container)?.hidden).toBe(false));
  });

  it("draw nothing where the picture cannot be had", async () => {
    const container = await show("complete");
    picture(container)?.dispatchEvent(new Event("error"));
    await settle(() => expect(picture(container)?.hidden).toBe(true));
  });

  it("ask for no picture of a claim that has minted nothing yet", async () => {
    const container = await show("pending");
    await settle(() => expect(container.querySelector("ul")).not.toBeNull());
    expect(container.querySelector("img")).toBeNull();
  });
});
