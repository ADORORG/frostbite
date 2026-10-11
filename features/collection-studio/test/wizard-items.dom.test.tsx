import { ApiError } from "@ador/client-http";
import {
  button,
  buttonMatching,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { detail, itemRecord } from "./support/detail.ts";
import { fakeCollections } from "./support/fake-api.ts";
import { heading, wizard } from "./support/wizard-view.tsx";
import { id } from "./support/stubs.ts";

describe("collection wizard: images and items", () => {
  it("chooses a cover from the library and saves it", async () => {
    const fake = fakeCollections(detail({ description: "About" }));
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    await settle(() =>
      expect(
        container.querySelectorAll('input[type="radio"]').length,
      ).toBeGreaterThan(1),
    );
    const cover = container.querySelector(
      'fieldset input[type="radio"]:not(:checked)',
    );
    await act(() =>
      cover instanceof HTMLInputElement ? cover.click() : undefined,
    );
    await click(button(container, "Save"));
    await settle(() => expect(fake.api.save).toHaveBeenCalled());
    expect(fake.state.detail.collection.coverAssetId).not.toBeNull();
  });

  it("adds an item, shows it with its position, and counts it against the supply", async () => {
    const fake = fakeCollections(
      detail({ description: "About", plannedSupply: 2 }),
    );
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    await click(buttonMatching(container, /4\. Items/u));
    await settle(() => expect(textOf(container)).toContain("0 of 2 items"));
    await typeInto(fieldByLabel(container, "Item name"), "First item");
    await act(() =>
      container
        .querySelector<HTMLInputElement>('fieldset input[type="radio"]')
        ?.click(),
    );
    await click(button(container, "Add item"));
    await settle(() => expect(textOf(container)).toContain("1 of 2 items"));
    expect(textOf(container)).toContain("1. First item");
    expect(fake.api.addItem).toHaveBeenCalledTimes(1);
  });

  it("changes and removes an item, asking before removing", async () => {
    const record = itemRecord(1, imageAssetId(), "Original");
    const fake = fakeCollections(detail({ description: "About" }, [record]));
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    await click(buttonMatching(container, /4\. Items/u));
    await click(button(container, "Edit Original"));
    await typeInto(fieldByLabel(container, "Item name"), "Renamed");
    await click(button(container, "Save item"));
    await settle(() => expect(textOf(container)).toContain("1. Renamed"));
    // Saving the change closes the change form and offers adding again.
    expect(buttonMatching(container, /^Add item$/u)).not.toBeNull();
    expect(textOf(container)).not.toContain("Save item");
    await click(button(container, "Remove Renamed"));
    expect(fake.api.removeItem).not.toHaveBeenCalled();
    await click(button(container, "Confirm removing Renamed"));
    await settle(() => expect(textOf(container)).toContain("No items yet."));
  });

  it("lets a change to an item be cancelled, and moves on to review with Continue", async () => {
    const fake = fakeCollections(
      detail({ description: "About" }, [
        itemRecord(1, imageAssetId(), "Original"),
      ]),
    );
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    await click(buttonMatching(container, /4\. Items/u));
    await click(button(container, "Edit Original"));
    expect(button(container, "Save item")).not.toBeNull();
    await click(button(container, "Cancel"));
    expect(button(container, "Add item")).not.toBeNull();
    expect(fake.api.updateItem).not.toHaveBeenCalled();
    await click(button(container, "Continue"));
    expect(heading(container)).toBe("Review");
  });

  it("stops offering the form when the collection already has as many items as its supply", async () => {
    const fake = fakeCollections(
      detail({ description: "About", plannedSupply: 1 }, [itemRecord(1)]),
    );
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    await click(buttonMatching(container, /4\. Items/u));
    expect(textOf(container)).toContain("as many items as its planned supply");
    expect(button(container, "Add item")).toBeNull();
  });

  it("still lets items be added when the image library cannot be loaded, saying there are no images to pick", async () => {
    const fake = fakeCollections(detail({ description: "About" }));
    fake.api.listImages.mockRejectedValue(new ApiError("network", null, "x"));
    const container = await mount(wizard(fake));
    await settle(() => expect(heading(container)).toBe("Images"));
    await click(buttonMatching(container, /4\. Items/u));
    expect(textOf(container)).toContain(
      "You have no ready images for this yet.",
    );
    expect(button(container, "Add item")).not.toBeNull();
  });
});

function imageAssetId() {
  return id();
}
