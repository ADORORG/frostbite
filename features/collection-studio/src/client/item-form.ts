import {
  collectionItemSchema,
  collectionLimits,
  type CollectionItem,
} from "@frostbite/shared/collections";

export interface AttributeRow {
  readonly trait: string;
  readonly value: string;
}

export interface ItemFormValues {
  readonly attributes: readonly AttributeRow[];
  readonly description: string;
  readonly imageAssetId: string | null;
  readonly name: string;
}

export interface ItemFormErrors {
  readonly attributes?: string;
  readonly description?: string;
  readonly imageAssetId?: string;
  readonly name?: string;
}

export type ItemFormResult =
  | { readonly item: CollectionItem; readonly ok: true }
  | { readonly errors: ItemFormErrors; readonly ok: false };

export const emptyItemForm: ItemFormValues = {
  attributes: [],
  description: "",
  imageAssetId: null,
  name: "",
};

// Picks the item's own fields, so a stored record that carries more (an id, a position) can be passed
// in: the form must hold exactly what the schema accepts.
export function formFromItem(item: CollectionItem): ItemFormValues {
  return {
    attributes: item.attributes.map(({ trait, value }) => ({ trait, value })),
    description: item.description,
    imageAssetId: item.imageAssetId,
    name: item.name,
  };
}

// What the creator is told when a field of an item is not acceptable.
export const itemFieldMessages = {
  attributes: `Each trait needs a name and a value, a trait can appear only once, and an item can have up to ${collectionLimits.attributesPerItem}.`,
  description: `Keep the description to ${collectionLimits.itemDescription.toLocaleString("en-US")} characters.`,
  imageAssetId: "Choose an image for this item.",
  name: `Enter a name of up to ${collectionLimits.itemName} characters.`,
} as const;

const itemFormFields = [
  "attributes",
  "description",
  "imageAssetId",
  "name",
] as const;

// An attribute row left completely empty is not an attribute, so it is dropped rather than reported.
export function parseItemForm(values: ItemFormValues): ItemFormResult {
  const attributes = values.attributes.filter(
    ({ trait, value }) => trait.trim() !== "" || value.trim() !== "",
  );
  const parsed = collectionItemSchema.safeParse({ ...values, attributes });
  if (parsed.success) return { item: parsed.data, ok: true };
  const errors: { -readonly [Field in keyof ItemFormErrors]: string } = {};
  for (const field of itemFormFields)
    if (parsed.error.issues.some(({ path }) => path[0] === field))
      errors[field] = itemFieldMessages[field];
  return { errors, ok: false };
}
