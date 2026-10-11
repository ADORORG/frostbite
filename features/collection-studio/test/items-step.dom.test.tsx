import {
  button,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@ador/test-kit/dom";
import { idempotencyKeySchema } from "@ador/shared/http";
import { describe, expect, it, vi } from "vitest";

import { ItemsStep } from "../src/ui/components/items-step.tsx";
import type { DraftEditor } from "../src/ui/hooks/use-draft-editor.ts";
import { detail, imageAsset, itemRecord } from "./support/detail.ts";
import { id } from "./support/stubs.ts";

const assetId = id();
const asset = imageAsset("collection-item-artwork", assetId);
const key = idempotencyKeySchema.parse("items-step-key-00000001");

function view(updateItem: DraftEditor["updateItem"]) {
  const existing = itemRecord(1, assetId, "Existing");
  const editor = {
    addItem: vi.fn(async () => true),
    busy: false,
    dismissNotice: vi.fn(),
    notice: null,
    reload: vi.fn(),
    removeItem: vi.fn(async () => true),
    save: vi.fn(async () => true),
    state: { data: detail(), status: "ready" },
    updateItem,
  } satisfies DraftEditor;
  const element = (
    <ItemsStep
      assets={[asset]}
      createKey={() => key}
      detail={detail({ plannedSupply: 3 }, [existing])}
      editor={editor}
      onUploaded={async () => undefined}
    />
  );
  return { editor, element, existing };
}

describe("items step: changing an item", () => {
  it("closes the editor once the change was saved", async () => {
    const { element } = view(
      vi.fn<DraftEditor["updateItem"]>(async () => true),
    );
    const container = await mount(element);
    await click(button(container, "Edit Existing"));
    await typeInto(fieldByLabel(container, "Item name"), "Renamed");
    await click(button(container, "Save item"));
    await settle(() => expect(button(container, "Save item")).toBeNull());
    expect(button(container, "Add item")).not.toBeNull();
  });

  it("keeps the editor open, with what was typed, when the change could not be saved", async () => {
    const updateItem = vi.fn<DraftEditor["updateItem"]>(async () => false);
    const { element, existing } = view(updateItem);
    const container = await mount(element);
    await click(button(container, "Edit Existing"));
    await typeInto(fieldByLabel(container, "Item name"), "Renamed");
    await click(button(container, "Save item"));
    await settle(() => expect(updateItem).toHaveBeenCalledTimes(1));
    expect(updateItem.mock.calls[0]?.[0]).toBe(existing.id);
    expect(button(container, "Save item")).not.toBeNull();
    expect(fieldByLabel(container, "Item name")).toHaveProperty(
      "value",
      "Renamed",
    );
    expect(textOf(container)).not.toContain("Add item");
  });
});
