import { ApiError } from "@ador/client-http";
import { chainOptionSchema } from "@ador/shared/chain";
import type { SubmissionState } from "@ador/shared/collections";
import { button, click, mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { CollectionsWorkspace } from "../src/ui/collections-workspace.tsx";
import { fakeCollections } from "./support/fake-api.ts";
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
    expect(textOf(container)).toContain("Updated 2026-10-09");
    expect(textOf(container)).toContain("Draft");
    expect(textOf(container)).toContain("Changes requested");
    const links = [
      ...container.querySelectorAll('a[href^="/studio/collections/"]'),
    ];
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
