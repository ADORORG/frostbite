import { ApiError } from "@ador/client-http";
import { button, click, mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { StudioHomeWorkspace } from "../src/ui/studio-home-workspace.tsx";
import { imageAsset } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { id, signet } from "./support/stubs.ts";

const summary = (
  name: string,
  state: "approved" | "changes-requested" | null,
) => ({
  coverAssetId: null,
  createdAt: "2026-10-09T12:00:00.000Z",
  id: id(),
  itemCount: 1,
  name,
  plannedSupply: 5,
  revision: 2,
  submissionState: state,
  targetChain: signet,
  updatedAt: "2026-10-09T13:00:00.000Z",
});

const view = (fake: ReturnType<typeof fakeCollections>) => (
  <StudioHomeWorkspace services={fake.services} />
);
const link = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("a")].find((a) => a.textContent === text);

describe("studio home", () => {
  it("shows each part loading on its own", async () => {
    const fake = fakeCollections();
    fake.api.creatorStanding.mockReturnValueOnce(new Promise(() => undefined));
    fake.api.list.mockReturnValueOnce(new Promise(() => undefined));
    fake.api.listImages.mockReturnValueOnce(new Promise(() => undefined));
    const container = await mount(view(fake));
    expect(textOf(container)).toContain("Loading your standing…");
    expect(textOf(container)).toContain("Loading your collections…");
    expect(textOf(container)).toContain("Loading your images…");
    expect(container.querySelector('[aria-label="Next step"]')).toBeNull();
  });

  it("tells an approved creator with no collections to start one, and counts what they have", async () => {
    const fake = fakeCollections();
    fake.state.library = [imageAsset("collection-artwork")];
    const container = await mount(view(fake));
    await settle(() => expect(textOf(container)).toContain("Approved creator"));
    await settle(() =>
      expect(textOf(container)).toContain("You have no collections yet."),
    );
    expect(
      link(container, "Start your first collection")?.getAttribute("href"),
    ).toBe("/studio/collections/new");
    expect(textOf(container)).toContain("Can build collections");
    expect(textOf(container)).toContain("None yet");
    expect(textOf(container)).toContain("1 ready");
    expect(link(container, "Open uploads")?.getAttribute("href")).toBe(
      "/studio/uploads",
    );
  });

  it("puts the collection a reviewer asked changes to first, and counts collections by where they stand", async () => {
    const fake = fakeCollections();
    fake.state.summaries = [
      summary("Draft", null),
      summary("Asked", "changes-requested"),
      summary("Live", "approved"),
    ];
    const container = await mount(view(fake));
    await settle(() =>
      expect(textOf(container)).toContain("asked for changes to Asked"),
    );
    expect(link(container, "Make changes")?.getAttribute("href")).toMatch(
      /^\/studio\/collections\/.+/u,
    );
    expect(textOf(container)).toContain("3 collections");
    expect(textOf(container)).toContain("Drafts: 1");
    expect(textOf(container)).toContain("Needs changes: 1");
    expect(textOf(container)).toContain("Approved: 1");
    expect(link(container, "New collection")).toBeDefined();
  });

  it("sends someone who has not been approved to their application, and offers no way to start", async () => {
    const fake = fakeCollections();
    fake.state.standing = null;
    const container = await mount(view(fake));
    await settle(() =>
      expect(textOf(container)).toContain("Not a creator yet"),
    );
    const [first] = [...container.querySelectorAll("a")].filter(
      (a) => a.textContent === "Apply to create",
    );
    expect(first?.getAttribute("href")).toBe("/studio/creator-application");
    expect(link(container, "New collection")).toBeUndefined();
    expect(textOf(container)).toContain("Cannot build collections yet");
    expect(container.querySelector('[aria-label="Next step"]')).not.toBeNull();
  });

  it("keeps the other parts when one fails, and retries only that one", async () => {
    const fake = fakeCollections();
    fake.api.listImages.mockRejectedValueOnce(
      new ApiError("network", null, "x"),
    );
    const container = await mount(view(fake));
    await settle(() =>
      expect(textOf(container)).toContain("Could not load your images."),
    );
    expect(textOf(container)).toContain("Approved creator");
    await click(button(container, "Retry"));
    await settle(() =>
      expect(textOf(container)).not.toContain("Could not load"),
    );
    expect(fake.api.listImages).toHaveBeenCalledTimes(2);
    expect(fake.api.creatorStanding).toHaveBeenCalledTimes(1);
  });

  it("counts images still processing and refused ones, and marks a truncated library", async () => {
    const fake = fakeCollections();
    fake.state.library = [
      imageAsset("collection-artwork"),
      imageAsset("collection-artwork", undefined, {
        derivativeAccess: "none",
        derivatives: [],
        processingState: "validated",
      }),
      imageAsset("collection-artwork", undefined, {
        derivativeAccess: "none",
        derivatives: [],
        processingState: "rejected",
      }),
    ];
    fake.api.listImages.mockResolvedValue({
      assets: fake.state.library,
      truncated: true,
    });
    const container = await mount(view(fake));
    await settle(() => expect(textOf(container)).toContain("1+ ready"));
    expect(textOf(container)).toContain("1 still processing");
    expect(textOf(container)).toContain("1 not accepted");
  });
});
