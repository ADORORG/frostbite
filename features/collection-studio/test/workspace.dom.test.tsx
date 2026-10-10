import { ApiError } from "@ador/client-http";
import { chainOptionSchema } from "@ador/shared/chain";
import type {
  CollectionSummary,
  SubmissionState,
} from "@ador/shared/collections";
import { button, click, mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { CollectionsWorkspace } from "../src/ui/collections-workspace.tsx";
import { fakeCollections } from "./support/fake-api.ts";
import { imageAsset } from "./support/detail.ts";
import { id, signet } from "./support/stubs.ts";

const chain = chainOptionSchema.parse({
  chainId: signet,
  displayName: "Bitcoin signet",
  enabled: true,
  family: "bitcoin-alkanes",
  role: "public-beta",
});

const summary = (
  name: string,
  itemCount: number,
  submissionState: SubmissionState | null = null,
) => ({
  coverAssetId: null,
  createdAt: "2026-10-09T12:00:00.000Z",
  id: id(),
  itemCount,
  name,
  plannedSupply: 5,
  revision: 2,
  submissionState,
  targetChain: signet,
  updatedAt: "2026-10-09T13:00:00.000Z",
});

function view(fake: ReturnType<typeof fakeCollections>) {
  return (
    <CollectionsWorkspace services={fake.services} targetChains={[chain]} />
  );
}

describe("collections overview", () => {
  it("shows loading, then an empty state that points to the page that starts a collection", async () => {
    const fake = fakeCollections();
    fake.api.list.mockReturnValueOnce(new Promise(() => undefined));
    const loading = await mount(view(fake));
    expect(textOf(loading)).toContain("Loading your collections…");
    const empty = await mount(view(fakeCollections()));
    await settle(() => expect(textOf(empty)).toContain("No collections yet"));
    const start = [...empty.querySelectorAll("a")].find(
      (link) => link.textContent === "Start your first collection",
    );
    expect(start?.getAttribute("href")).toBe("/studio/collections/new");
    expect(empty.querySelector("input")).toBeNull();
  });

  it("shows each collection as a card with its chain, state, progress, date, and next step", async () => {
    const fake = fakeCollections();
    fake.state.summaries = [
      summary("First light", 2),
      summary("Second", 5, "changes-requested"),
    ];
    const container = await mount(view(fake));
    await settle(() => expect(textOf(container)).toContain("First light"));
    expect(textOf(container)).toContain("Bitcoin signet");
    expect(textOf(container)).toContain("2 of 5 items");
    // The bar says the same thing in words and in its value: 2 of 5 is 40%, 5 of 5 is 100%.
    expect(
      [...container.querySelectorAll("progress")].map((bar) => bar.value),
    ).toEqual([40, 100]);
    expect(textOf(container)).toContain("Updated 2026-10-09");
    expect(textOf(container)).toContain("Draft");
    expect(textOf(container)).toContain("Changes requested");
    const links = [
      ...container.querySelectorAll('a[href^="/studio/collections/"]'),
    ].filter((link) => !link.getAttribute("href")?.endsWith("/new"));
    expect(links.map((link) => link.textContent)).toEqual([
      "Continue editing",
      "Make changes",
    ]);
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual([
      "Continue editing: First light",
      "Make changes: Second",
    ]);
  });

  it("filters by where each collection stands, and only offers filters that lead somewhere", async () => {
    const fake = fakeCollections();
    fake.state.summaries = [
      summary("Alpha", 1),
      summary("Beta", 5, "under-review"),
      summary("Gamma", 5, "submitted"),
    ];
    const container = await mount(view(fake));
    await settle(() => expect(textOf(container)).toContain("Alpha"));
    const filters = [...container.querySelectorAll("[aria-pressed]")].map(
      (option) => option.textContent,
    );
    expect(filters).toEqual(["All3", "Drafts1", "In review2"]);
    await click(button(container, "In review2"));
    expect(textOf(container)).not.toContain("Alpha");
    expect(textOf(container)).toContain("Beta");
    expect(textOf(container)).toContain("Gamma");
    await click(button(container, "Drafts1"));
    expect(textOf(container)).toContain("Alpha");
    expect(textOf(container)).not.toContain("Beta");
  });

  it("says when the list could not load, and retries", async () => {
    const fake = fakeCollections();
    fake.api.list.mockRejectedValueOnce(new ApiError("network", null, "x"));
    const container = await mount(view(fake));
    await settle(() =>
      expect(textOf(container)).toContain(
        "Your collections could not be loaded.",
      ),
    );
    fake.state.summaries = [summary("First light", 1)];
    await click(button(container, "Retry"));
    await settle(() => expect(textOf(container)).toContain("First light"));
  });
});

describe("collections overview: who may start a collection", () => {
  const link = (container: HTMLElement, text: string) =>
    [...container.querySelectorAll("a")].find((a) => a.textContent === text);

  it("offers the button to an approved creator", async () => {
    const fake = fakeCollections();
    const container = await mount(view(fake));
    await settle(() => expect(link(container, "New collection")).toBeDefined());
    expect(textOf(container)).not.toContain("approved creator");
  });

  it.each([
    [null, "Not a creator yet", "Apply to create"],
    ["draft", "Application started", "Finish your application"],
    ["under-review", "Application in review", "View your application"],
    ["suspended", "Creator access paused", "View your application"],
  ] as const)(
    "tells a person whose standing is %s why, and where to go, instead of offering the button",
    async (standing, headline, label) => {
      const fake = fakeCollections();
      fake.state.standing = standing;
      const container = await mount(view(fake));
      await settle(() => expect(textOf(container)).toContain(headline));
      expect(link(container, label)?.getAttribute("href")).toBe(
        "/studio/creator-application",
      );
      expect(link(container, "New collection")).toBeUndefined();
    },
  );

  it("keeps the button when the standing cannot be read, and leaves the decision to the server", async () => {
    const fake = fakeCollections();
    fake.api.creatorStanding.mockRejectedValue(
      new ApiError("network", null, "x"),
    );
    const container = await mount(view(fake));
    await settle(() => expect(fake.api.creatorStanding).toHaveBeenCalled());
    await settle(() => expect(link(container, "New collection")).toBeDefined());
    expect(textOf(container)).not.toContain("Collections open once");
  });
});

describe("collections overview: covers", () => {
  const withCover = (
    name: string,
    coverAssetId: string | null,
  ): CollectionSummary => ({ ...summary(name, 1), coverAssetId });

  it("shows the cover picture on a card whose cover is ready, and the monogram on the rest", async () => {
    const fake = fakeCollections();
    const ready = id();
    const pending = id();
    fake.state.summaries = [
      withCover("With cover", ready),
      withCover("Cover still processing", pending),
      withCover("No cover", null),
    ];
    fake.state.library = [
      imageAsset("collection-artwork", ready),
      imageAsset("collection-artwork", pending, {
        derivatives: [],
        processingState: "validated",
      }),
    ];
    const container = await mount(view(fake));
    await settle(() => expect(textOf(container)).toContain("With cover"));
    await settle(() =>
      expect(container.querySelectorAll("img")).toHaveLength(1),
    );
    const image = container.querySelector("img");
    expect(image?.getAttribute("alt")).toBe("With cover cover");
    expect(image?.getAttribute("src")).toBe(
      `https://storage.example.test/${ready}.webp`,
    );
    expect(container.querySelectorAll(".arcade-card__avatar")).toHaveLength(2);
  });

  it("keeps the monogram when the images cannot be loaded", async () => {
    const fake = fakeCollections();
    fake.state.summaries = [withCover("Only name", id())];
    fake.api.listImages.mockRejectedValue(new ApiError("network", null, "x"));
    const container = await mount(view(fake));
    await settle(() => expect(textOf(container)).toContain("Only name"));
    await settle(() => expect(fake.api.listImages).toHaveBeenCalled());
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll(".arcade-card__avatar")).toHaveLength(1);
  });
});
