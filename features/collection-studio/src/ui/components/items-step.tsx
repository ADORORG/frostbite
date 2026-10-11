import { BulkUpload } from "@ador/feature-uploads/bulk";
import type { CollectionDetail } from "@ador/shared/collections";
import type { IdempotencyKey } from "@ador/shared/http";
import type { LibraryAsset } from "@ador/shared/uploads";
import { ArcadeProgress } from "@repo/ui/arcade";
import { useState } from "react";

import { formFromItem } from "../../client/item-form.ts";
import type { DraftEditor } from "../hooks/use-draft-editor.ts";
import { ItemEditor } from "./item-editor.tsx";
import { ItemList } from "./item-list.tsx";

type Item = CollectionDetail["items"][number];

// The items, how many of the planned supply exist, and the one form for adding or changing an item.
export function ItemsStep({
  assets,
  createKey,
  detail,
  editor,
  onUploaded,
}: {
  readonly assets: readonly LibraryAsset[];
  readonly createKey: () => IdempotencyKey;
  readonly detail: CollectionDetail;
  readonly editor: DraftEditor;
  readonly onUploaded: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Item | null>(null);
  const { collection, items } = detail;
  const full = items.length >= collection.plannedSupply;
  return (
    <div className="arcade-form">
      <ArcadeProgress
        label="Items added so far"
        value={items.length / collection.plannedSupply}
      />
      <p>{`${items.length} of ${collection.plannedSupply} items`}</p>
      <details className="arcade-disclosure">
        <summary>Upload many images at once</summary>
        <BulkUpload
          onSettled={() => void onUploaded()}
          purpose="collection-item-artwork"
        />
      </details>
      <ItemList
        busy={editor.busy}
        items={items}
        onEdit={setEditing}
        onRemove={(item) => void editor.removeItem(item.id)}
        previews={detail.previews}
      />
      {editing === null ? (
        full ? (
          <p>
            This collection already has as many items as its planned supply.
            Raise the supply on the supply step to add more.
          </p>
        ) : (
          <ItemEditor
            assets={assets}
            busy={editor.busy}
            createKey={createKey}
            onSubmit={editor.addItem}
            submitLabel="Add item"
            onUploaded={onUploaded}
          />
        )
      ) : (
        <ItemEditor
          assets={assets}
          busy={editor.busy}
          createKey={createKey}
          initial={formFromItem(editing)}
          key={editing.id}
          onCancel={() => setEditing(null)}
          onSubmit={async (item) => {
            const done = await editor.updateItem(editing.id, item);
            if (done) setEditing(null);
            return done;
          }}
          submitLabel="Save item"
          onUploaded={onUploaded}
        />
      )}
    </div>
  );
}
