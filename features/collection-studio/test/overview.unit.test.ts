import type {
  CollectionSummary,
  SubmissionState,
} from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import {
  effectiveFilter,
  filterOptions,
  nextActionLabels,
  stateLabel,
  visibleCollections,
} from "../src/client/overview.ts";
import { id, signet } from "./support/stubs.ts";

const summary = (
  name: string,
  submissionState: SubmissionState | null,
): CollectionSummary => ({
  createdAt: "2026-10-09T12:00:00.000Z",
  id: id(),
  itemCount: 1,
  name,
  plannedSupply: 2,
  revision: 1,
  submissionState,
  targetChain: signet,
  updatedAt: "2026-10-09T13:00:00.000Z",
});

const collections = [
  summary("a", null),
  summary("b", "submitted"),
  summary("c", "under-review"),
  summary("d", "changes-requested"),
  summary("e", "approved"),
  summary("f", "rejected"),
  summary("g", "suspended"),
  summary("h", "revoked"),
];

describe("overview filters", () => {
  it("counts each standing, with every submission state in the standing it belongs to", () => {
    expect(
      filterOptions(collections).map(({ count, value }) => [value, count]),
    ).toEqual([
      ["all", 8],
      ["draft", 1],
      ["in-review", 2],
      ["needs-changes", 1],
      ["approved", 1],
      ["paused", 1],
      ["ended", 2],
    ]);
  });

  it("offers only All when there is nothing, and omits standings nobody is in", () => {
    expect(filterOptions([])).toEqual([
      { count: 0, label: "All", value: "all" },
    ]);
    expect(
      filterOptions([summary("a", null)]).map(({ value }) => value),
    ).toEqual(["all", "draft"]);
  });

  it("uses the words creators see elsewhere", () => {
    expect(filterOptions(collections).map(({ label }) => label)).toEqual([
      "All",
      "Drafts",
      "In review",
      "Needs changes",
      "Approved",
      "Paused",
      "Ended",
    ]);
  });

  it("shows everything for All and only the matching standing otherwise", () => {
    expect(visibleCollections(collections, "all")).toHaveLength(8);
    expect(
      visibleCollections(collections, "in-review").map(({ name }) => name),
    ).toEqual(["b", "c"]);
    expect(
      visibleCollections(collections, "paused").map(({ name }) => name),
    ).toEqual(["g"]);
    expect(
      visibleCollections(collections, "ended").map(({ name }) => name),
    ).toEqual(["f", "h"]);
    expect(visibleCollections([], "draft")).toEqual([]);
  });

  it("keeps the chosen filter while it matches something, and falls back to All when it no longer does", () => {
    const options = filterOptions([summary("a", null)]);
    expect(effectiveFilter(options, "draft")).toBe("draft");
    expect(effectiveFilter(options, "approved")).toBe("all");
    expect(effectiveFilter(options, "all")).toBe("all");
  });
});

describe("overview wording", () => {
  it("calls a never-submitted collection a draft and names every other state", () => {
    expect(stateLabel(summary("a", null))).toBe("Draft");
    expect(stateLabel(summary("a", "changes-requested"))).toBe(
      "Changes requested",
    );
    expect(stateLabel(summary("a", "rejected"))).toBe("Not approved");
  });

  it("gives each standing its own next step", () => {
    expect(nextActionLabels).toEqual({
      approved: "View",
      draft: "Continue editing",
      ended: "See details",
      "in-review": "See status",
      "needs-changes": "Make changes",
      paused: "See details",
    });
  });
});
