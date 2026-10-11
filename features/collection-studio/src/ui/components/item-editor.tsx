import {
  collectionLimits,
  type CollectionItem,
} from "@ador/shared/collections";
import type { IdempotencyKey } from "@ador/shared/http";
import type { LibraryAsset } from "@ador/shared/uploads";
import { ArcadeActionButton, ArcadeTextField } from "@repo/ui/arcade";
import { useRef, useState } from "react";

import {
  emptyItemForm,
  parseItemForm,
  type ItemFormErrors,
  type ItemFormValues,
} from "../../client/item-form.ts";
import { ImageChoice } from "./image-choice.tsx";

// One item's form, for adding or for changing. It keeps one idempotency key from the moment the form
// opens until the item is saved, so a retry after a lost response cannot add the item twice.
export function ItemEditor({
  assets,
  busy,
  createKey,
  initial = emptyItemForm,
  onCancel,
  onSubmit,
  onUploaded,
  submitLabel,
}: {
  readonly assets: readonly LibraryAsset[];
  readonly busy: boolean;
  readonly createKey: () => IdempotencyKey;
  readonly initial?: ItemFormValues;
  readonly onCancel?: () => void;
  readonly onSubmit: (
    item: CollectionItem,
    key: IdempotencyKey,
  ) => Promise<boolean>;
  // Resolves once the library holds an image that was just uploaded here.
  readonly onUploaded: () => Promise<void>;
  readonly submitLabel: string;
}) {
  const [values, setValues] = useState<ItemFormValues>(initial);
  const [errors, setErrors] = useState<ItemFormErrors>({});
  const key = useRef<IdempotencyKey>(createKey());

  async function submit() {
    const parsed = parseItemForm(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    if (await onSubmit(parsed.item, key.current)) {
      key.current = createKey();
      setValues(initial);
    }
  }

  const change = (changes: Partial<ItemFormValues>) =>
    setValues((current) => ({ ...current, ...changes }));
  const setRow = (
    index: number,
    row: Partial<ItemFormValues["attributes"][number]>,
  ) =>
    change({
      attributes: values.attributes.map((existing, at) =>
        at === index ? { ...existing, ...row } : existing,
      ),
    });

  return (
    <div className="arcade-form">
      <ArcadeTextField
        disabled={busy}
        error={errors.name ?? null}
        label="Item name"
        maxLength={collectionLimits.itemName}
        onChange={(name) => change({ name })}
        required
        value={values.name}
      />
      <ArcadeTextField
        disabled={busy}
        error={errors.description ?? null}
        label="Item description"
        maxLength={collectionLimits.itemDescription}
        multiline
        onChange={(description) => change({ description })}
        value={values.description}
      />
      <ImageChoice
        allowNone={false}
        assets={assets}
        disabled={busy}
        legend="Item image"
        onChange={(imageAssetId) => change({ imageAssetId })}
        onUploaded={onUploaded}
        purpose="collection-item-artwork"
        selectedId={values.imageAssetId}
      />
      {errors.imageAssetId === undefined ? null : (
        <p role="alert">{errors.imageAssetId}</p>
      )}
      <fieldset className="arcade-choice">
        <legend>Traits</legend>
        {values.attributes.map((row, index) => (
          // Rows have no identity of their own, so the index is their key.
          <div className="arcade-actions" key={index}>
            <ArcadeTextField
              disabled={busy}
              label={`Trait ${index + 1} name`}
              maxLength={collectionLimits.attributeTraitLength}
              onChange={(trait) => setRow(index, { trait })}
              value={row.trait}
            />
            <ArcadeTextField
              disabled={busy}
              label={`Trait ${index + 1} value`}
              maxLength={collectionLimits.attributeValueLength}
              onChange={(value) => setRow(index, { value })}
              value={row.value}
            />
            <ArcadeActionButton
              disabled={busy}
              onClick={() =>
                change({
                  attributes: values.attributes.filter((_, at) => at !== index),
                })
              }
              tone="red"
            >
              {`Remove trait ${index + 1}`}
            </ArcadeActionButton>
          </div>
        ))}
        {errors.attributes === undefined ? null : (
          <p role="alert">{errors.attributes}</p>
        )}
        <ArcadeActionButton
          disabled={
            busy ||
            values.attributes.length >= collectionLimits.attributesPerItem
          }
          onClick={() =>
            change({
              attributes: [...values.attributes, { trait: "", value: "" }],
            })
          }
          tone="yellow"
        >
          Add a trait
        </ArcadeActionButton>
      </fieldset>
      <div className="arcade-actions">
        <ArcadeActionButton
          disabled={busy}
          onClick={() => void submit()}
          tone="mint"
        >
          {submitLabel}
        </ArcadeActionButton>
        {onCancel === undefined ? null : (
          <ArcadeActionButton disabled={busy} onClick={onCancel} tone="pink">
            Cancel
          </ArcadeActionButton>
        )}
      </div>
    </div>
  );
}
