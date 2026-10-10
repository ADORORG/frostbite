import { mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { SnapshotView } from "../src/ui/components/snapshot-view.tsx";
import { previews, reviewSubmission } from "./support/fixtures.ts";

describe("snapshot view", () => {
  it("shows the frozen version in full: details, hash, revision, items with attributes", async () => {
    const submission = reviewSubmission();
    const container = await mount(
      <SnapshotView previews={previews} submission={submission} />,
    );
    const text = textOf(container);
    expect(container.querySelector("h3")?.textContent).toBe(
      "What was submitted",
    );
    expect(container.querySelector("dl.arcade-facts")).not.toBeNull();
    expect(text).toContain("A small collection of hand-drawn lights.");
    expect(text).toContain("Drawn by hand");
    expect(text).toContain("a".repeat(64));
    expect(text).toContain("4");
    expect(text).toContain("Items (1)");
    expect(text).toContain("Colour: Blue");
    expect(text).toContain("The first light");
  });

  it("shows the cover and item images the reviewer needs to judge the art", async () => {
    const container = await mount(
      <SnapshotView previews={previews} submission={reviewSubmission()} />,
    );
    expect(
      container.querySelector('img[alt="Cover image for First light"]'),
    ).not.toBeNull();
    expect(container.querySelector('img[alt="1. Dawn"]')).not.toBeNull();
  });

  it("says a preview is unavailable rather than hiding the image", async () => {
    const container = await mount(
      <SnapshotView previews={[]} submission={reviewSubmission()} />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(textOf(container)).toContain("Preview unavailable");
  });

  it("says when no provenance was given, and shows a banner only when there is one", async () => {
    const base = reviewSubmission();
    const bare = reviewSubmission("submitted", {
      snapshot: {
        ...base.snapshot,
        collection: { ...base.snapshot.collection, provenance: "" },
      },
    });
    const container = await mount(
      <SnapshotView previews={previews} submission={bare} />,
    );
    expect(textOf(container)).toContain("None given.");
    expect(textOf(container)).not.toContain("Banner image");
    const withBanner = reviewSubmission("submitted", {
      snapshot: {
        ...base.snapshot,
        collection: {
          ...base.snapshot.collection,
          bannerAssetId: base.snapshot.collection.coverAssetId,
        },
      },
    });
    const second = await mount(
      <SnapshotView previews={previews} submission={withBanner} />,
    );
    expect(textOf(second)).toContain("Banner image for First light");
  });
});
