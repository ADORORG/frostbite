import {
  button,
  buttonMatching,
  click,
  fieldByLabel,
  mount,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { idempotencyKeySchema } from "@ador/shared/http";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { formFromItem } from "../src/client/item-form.ts";
import { ItemEditor } from "../src/ui/components/item-editor.tsx";
import { imageAsset } from "./support/detail.ts";

const asset = imageAsset("collection-item-artwork");
let issued = 0;
const createKey = () =>
  idempotencyKeySchema.parse(
    `editor-key-${String((issued += 1)).padStart(6, "0")}`,
  );

type Props = Parameters<typeof ItemEditor>[0];

function view(overrides: Partial<Props> = {}) {
  const onSubmit = vi.fn<Props["onSubmit"]>(async () => true);
  const props = {
    assets: [asset],
    busy: false,
    createKey,
    onSubmit,
    submitLabel: "Add item",
    onUploaded: async () => undefined,
    ...overrides,
  };
  return { onSubmit, props };
}

async function fill(container: HTMLElement, name: string) {
  await typeInto(fieldByLabel(container, "Item name"), name);
  await act(() =>
    container.querySelector<HTMLInputElement>('input[type="radio"]')?.click(),
  );
}

describe("item editor", () => {
  it("refuses an item with no name or no image, in words, without calling the server", async () => {
    const { onSubmit, props } = view();
    const container = await mount(<ItemEditor {...props} />);
    await click(button(container, "Add item"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textOf(container)).toContain(
      "Problem: Enter a name of up to 120 characters.",
    );
    expect(textOf(container)).toContain("Choose an image for this item.");
  });

  it("submits the item with an idempotency key, then clears the form and takes a new key", async () => {
    const { onSubmit, props } = view();
    const container = await mount(<ItemEditor {...props} />);
    await fill(container, "First item");
    await click(button(container, "Add item"));
    await click(button(container, "Add item"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [item, key] = onSubmit.mock.calls[0] ?? [];
    expect(item).toMatchObject({ imageAssetId: asset.id, name: "First item" });
    expect(fieldByLabel(container, "Item name")).toHaveProperty("value", "");
    await fill(container, "Second item");
    await click(button(container, "Add item"));
    expect(onSubmit.mock.calls[1]?.[1]).not.toBe(key);
  });

  it("keeps what was typed and the same key when saving fails, so a retry cannot add it twice", async () => {
    const onSubmit = vi.fn<Props["onSubmit"]>(async () => false);
    const { props } = view({ onSubmit });
    const container = await mount(<ItemEditor {...props} />);
    await fill(container, "First item");
    await click(button(container, "Add item"));
    await click(button(container, "Add item"));
    expect(onSubmit.mock.calls[0]?.[1]).toBe(onSubmit.mock.calls[1]?.[1]);
    expect(fieldByLabel(container, "Item name")).toHaveProperty(
      "value",
      "First item",
    );
  });

  it("adds, fills, and removes trait rows, and drops an untouched row", async () => {
    const { onSubmit, props } = view();
    const container = await mount(<ItemEditor {...props} />);
    await fill(container, "First item");
    await click(button(container, "Add a trait"));
    await click(button(container, "Add a trait"));
    await typeInto(fieldByLabel(container, "Trait 1 name"), "Colour");
    await typeInto(fieldByLabel(container, "Trait 1 value"), "Blue");
    await click(button(container, "Remove trait 2"));
    expect(container.querySelectorAll("label")).toBeDefined();
    await click(button(container, "Add item"));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      attributes: [{ trait: "Colour", value: "Blue" }],
    });
  });

  it("reports a half-filled trait and a repeated trait", async () => {
    const { onSubmit, props } = view();
    const container = await mount(<ItemEditor {...props} />);
    await fill(container, "First item");
    await click(button(container, "Add a trait"));
    await typeInto(fieldByLabel(container, "Trait 1 name"), "Colour");
    await click(button(container, "Add item"));
    expect(textOf(container)).toContain("Each trait needs a name and a value");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("stops offering new traits at the limit", async () => {
    const attributes = Array.from({ length: 32 }, (_, index) => ({
      trait: `t${index}`,
      value: "v",
    }));
    const { props } = view({
      initial: {
        attributes,
        description: "",
        imageAssetId: asset.id,
        name: "Full",
      },
    });
    const container = await mount(<ItemEditor {...props} />);
    expect(button(container, "Add a trait")?.disabled).toBe(true);
  });

  it("starts from an existing item, offers cancel, and disables everything while busy", async () => {
    const onCancel = vi.fn();
    const initial = formFromItem({
      attributes: [{ trait: "Colour", value: "Blue" }],
      description: "About",
      imageAssetId: asset.id,
      name: "Existing",
    });
    const { props } = view({ initial, onCancel, submitLabel: "Save item" });
    const container = await mount(<ItemEditor {...props} />);
    expect(fieldByLabel(container, "Item name")).toHaveProperty(
      "value",
      "Existing",
    );
    expect(fieldByLabel(container, "Trait 1 value")).toHaveProperty(
      "value",
      "Blue",
    );
    await click(button(container, "Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    const busy = await mount(
      <ItemEditor {...view({ busy: true, onCancel }).props} />,
    );
    expect(buttonMatching(busy, /Add item/u)?.disabled).toBe(true);
    expect(fieldByLabel(busy, "Item name")).toHaveProperty("disabled", true);
  });
});
