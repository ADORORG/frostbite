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

import { NewCollectionWorkspace } from "../src/ui/new-collection-workspace.tsx";
import { detail } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { signet } from "./support/stubs.ts";

const chain = chainOptionSchema.parse({
  chainId: signet,
  displayName: "Bitcoin signet",
  enabled: true,
  family: "bitcoin-alkanes",
  role: "public-beta",
});

function view(fake: ReturnType<typeof fakeCollections>) {
  return (
    <NewCollectionWorkspace services={fake.services} targetChains={[chain]} />
  );
}

describe("new collection page", () => {
  const start = async (fake: ReturnType<typeof fakeCollections>) =>
    mount(view(fake));

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

  it("offers a way back to the list without creating anything", async () => {
    const fake = fakeCollections();
    const container = await start(fake);
    const cancel = [...container.querySelectorAll("a")].find(
      (link) => link.textContent === "Cancel",
    );
    expect(cancel?.getAttribute("href")).toBe("/studio/collections");
    expect(fake.api.create).not.toHaveBeenCalled();
  });
});
