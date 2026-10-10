import {
  collectionLimits,
  type CollectionItem,
} from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import {
  emptyItemForm,
  formFromItem,
  parseItemForm,
  type ItemFormValues,
} from "../../src/client/item-form.ts";
import { itemRecord } from "../support/detail.ts";
import { id } from "../support/stubs.ts";

const image = id();
const valid: ItemFormValues = {
  attributes: [{ trait: "Colour", value: "Blue" }],
  description: "An item",
  imageAssetId: image,
  name: "Item",
};

function errorsOf(overrides: Partial<ItemFormValues>) {
  const result = parseItemForm({ ...valid, ...overrides });
  if (result.ok) throw new Error("expected the form to be refused");
  return result.errors;
}

describe("item form", () => {
  it("turns what was typed into an item", () => {
    const result = parseItemForm({ ...valid, name: "  Padded  " });
    if (!result.ok) throw new Error("expected a valid item");
    expect(result.item).toEqual({ ...valid, name: "Padded" });
  });

  it("drops attribute rows left completely empty but keeps half-filled ones to report", () => {
    const dropped = parseItemForm({
      ...valid,
      attributes: [
        { trait: "", value: "" },
        { trait: " ", value: " " },
        ...valid.attributes,
      ],
    });
    expect(dropped.ok && dropped.item.attributes).toEqual(valid.attributes);
    expect(
      errorsOf({ attributes: [{ trait: "Colour", value: "" }] }).attributes,
    ).toMatch(/\w+/u);
    expect(
      errorsOf({ attributes: [{ trait: "", value: "Blue" }] }).attributes,
    ).toMatch(/\w+/u);
  });

  it.each([
    ["a blank name", { name: " " }, "name"],
    [
      "a name over the limit",
      { name: "x".repeat(collectionLimits.itemName + 1) },
      "name",
    ],
    ["no image", { imageAssetId: null }, "imageAssetId"],
    [
      "a long description",
      { description: "x".repeat(collectionLimits.itemDescription + 1) },
      "description",
    ],
    [
      "a repeated trait",
      {
        attributes: [
          { trait: "A", value: "1" },
          { trait: "A", value: "2" },
        ],
      },
      "attributes",
    ],
    [
      "too many attributes",
      {
        attributes: Array.from(
          { length: collectionLimits.attributesPerItem + 1 },
          (_, index) => ({ trait: `t${index}`, value: "v" }),
        ),
      },
      "attributes",
    ],
  ] as const)(
    "refuses %s, in words, on the right field",
    (_name, change, field) => {
      const errors = errorsOf(change);
      expect(Object.keys(errors)).toEqual([field]);
      expect(errors[field]).toMatch(/\w+/u);
    },
  );

  it("ignores the extra fields of a stored item, so it can be edited and saved again", () => {
    const stored = itemRecord(2);
    const form = formFromItem(stored);
    expect(Object.keys(form).sort()).toEqual([
      "attributes",
      "description",
      "imageAssetId",
      "name",
    ]);
    expect(parseItemForm(form).ok).toBe(true);
  });

  it("copies an existing item into the form without sharing its attribute rows", () => {
    const item: CollectionItem = {
      attributes: [{ trait: "Colour", value: "Blue" }],
      description: "An item",
      imageAssetId: image,
      name: "Item",
    };
    const form = formFromItem(item);
    expect(form).toEqual(item);
    expect(form.attributes[0]).not.toBe(item.attributes[0]);
    expect(emptyItemForm).toEqual({
      attributes: [],
      description: "",
      imageAssetId: null,
      name: "",
    });
  });
});
