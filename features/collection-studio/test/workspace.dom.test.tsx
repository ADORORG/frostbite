import { ApiError } from "@ador/client-http";
import { chainOptionSchema } from "@ador/shared/chain";
import {
  button,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { CollectionsWorkspace } from "../src/ui/collections-workspace.tsx";
import { detail } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { id, signet } from "./support/stubs.ts";

const chain = chainOptionSchema.parse({
  chainId: signet,
  displayName: "Bitcoin signet",
  enabled: true,
  family: "bitcoin-alkanes",
  role: "public-beta",
});

const summary = (name: string, itemCount: number) => ({
  createdAt: "2026-10-09T12:00:00.000Z",
  id: id(),
  itemCount,
  name,
  plannedSupply: 5,
  revision: 2,
  targetChain: signet,
  updatedAt: "2026-10-09T13:00:00.000Z",
});

function view(fake: ReturnType<typeof fakeCollections>) {
  return (
    <CollectionsWorkspace services={fake.services} targetChains={[chain]} />
  );
}

describe("collections page: the list", () => {
  it("shows loading, then an empty state that points to the form", async () => {
    const fake = fakeCollections();
    fake.api.list.mockReturnValueOnce(new Promise(() => undefined));
    const loading = await mount(view(fake));
    expect(textOf(loading)).toContain("Loading your collections…");
    const empty = await mount(view(fakeCollections()));
    await settle(() =>
      expect(textOf(empty)).toContain("No collections yet. Start one below."),
    );
  });

  it("lists each draft with its chain, progress, update date, and a link to resume it", async () => {
    const fake = fakeCollections();
    fake.state.summaries = [summary("First light", 2), summary("Second", 0)];
    const container = await mount(view(fake));
    await settle(() => expect(textOf(container)).toContain("First light"));
    expect(textOf(container)).toContain("Bitcoin signet");
    expect(textOf(container)).toContain("2 of 5 items");
    expect(textOf(container)).toContain("Updated 2026-10-09");
    const link = container.querySelector(`a[href^="/studio/collections/"]`);
    expect(link?.textContent).toBe("Continue First light");
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

describe("collections page: starting a collection", () => {
  async function start(fake: ReturnType<typeof fakeCollections>) {
    const container = await mount(view(fake));
    await settle(() =>
      expect(textOf(container)).toContain("No collections yet"),
    );
    return container;
  }

  it("refuses an incomplete form in words, without calling the server", async () => {
    const fake = fakeCollections();
    const container = await start(fake);
    await click(button(container, "Create collection"));
    expect(fake.api.create).not.toHaveBeenCalled();
    expect(textOf(container)).toContain(
      "Problem: Enter a name of up to 120 characters.",
    );
    expect(textOf(container)).toContain(
      "Problem: Enter a whole number from 1 to 1,000,000.",
    );
  });

  it("creates the draft with the three required fields and opens its wizard", async () => {
    const created = detail({ name: "Brand new" });
    const fake = fakeCollections(created);
    const container = await start(fake);
    await typeInto(fieldByLabel(container, "Collection name"), "Brand new");
    await typeInto(fieldByLabel(container, "Planned supply"), "12");
    await click(button(container, "Create collection"));
    await settle(() => expect(fake.services.navigate).toHaveBeenCalled());
    expect(fake.api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Brand new",
        plannedSupply: 12,
        targetChain: signet,
      }),
      { idempotencyKey: "request-key-00000001" },
    );
    expect(fake.services.navigate).toHaveBeenCalledWith(
      `/studio/collections/${created.collection.id}`,
    );
  });

  it("keeps the same idempotency key when creating fails, so a retry cannot make a second draft", async () => {
    const fake = fakeCollections();
    fake.api.create.mockRejectedValueOnce(new ApiError("network", null, "x"));
    const container = await start(fake);
    await typeInto(fieldByLabel(container, "Collection name"), "Brand new");
    await typeInto(fieldByLabel(container, "Planned supply"), "3");
    await click(button(container, "Create collection"));
    await settle(() =>
      expect(textOf(container)).toContain("could not reach the server"),
    );
    await click(button(container, "Dismiss and try again"));
    await click(button(container, "Create collection"));
    await settle(() => expect(fake.api.create).toHaveBeenCalledTimes(2));
    const keys = fake.api.create.mock.calls.map(
      ([, options]) => options.idempotencyKey,
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it("tells a creator who is not approved how to apply", async () => {
    const fake = fakeCollections();
    fake.api.create.mockRejectedValue(new ApiError("forbidden", 403, "x"));
    const container = await start(fake);
    await typeInto(fieldByLabel(container, "Collection name"), "Brand new");
    await typeInto(fieldByLabel(container, "Planned supply"), "3");
    await click(button(container, "Create collection"));
    await settle(() =>
      expect(textOf(container)).toContain("Only approved creators"),
    );
    expect(
      container.querySelector('a[href="/studio/creator-application"]'),
    ).not.toBeNull();
    expect(fake.services.navigate).not.toHaveBeenCalled();
  });
});
