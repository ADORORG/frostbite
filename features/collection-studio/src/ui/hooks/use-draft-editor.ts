import { useCallback } from "react";
import type {
  CollectionDetail,
  CollectionDraft,
  CollectionItem,
} from "@ador/shared/collections";
import type { IdempotencyKey } from "@ador/shared/http";

import type { CollectionsClientServices } from "../../client/services.ts";
import type { Failure } from "../../client/error-copy.ts";
import { useAction } from "./use-action.ts";
import { useResource, type Resource } from "./use-resource.ts";

export interface DraftEditor {
  readonly addItem: (
    item: CollectionItem,
    key: IdempotencyKey,
  ) => Promise<boolean>;
  readonly busy: boolean;
  readonly dismissNotice: () => void;
  // The last failed action, until it is dismissed or the next action starts.
  readonly notice: Failure | null;
  // Reads the draft again without clearing the page, for a change made outside the editor's own actions.
  readonly refresh: () => Promise<void>;
  readonly reload: () => void;
  readonly removeItem: (itemId: string) => Promise<boolean>;
  readonly save: (
    draft: CollectionDraft,
    expectedRevision: number,
  ) => Promise<boolean>;
  readonly state: Resource<CollectionDetail>;
  readonly updateItem: (
    itemId: string,
    item: CollectionItem,
  ) => Promise<boolean>;
}

// The draft being edited and every change the wizard can make to it. A save names the revision the
// page last saw; an item change returns the new revision, and the draft is read again so the page
// always shows what the server holds (items, order, and signed previews).
export function useDraftEditor(
  services: CollectionsClientServices,
  collectionId: string,
): DraftEditor {
  const { reload, replace, state } = useResource(
    (signal) => services.api.read(collectionId, { signal }),
    collectionId,
  );
  const { act, busy, dismissNotice, notice } = useAction();

  const refresh = useCallback(
    async () => replace(await services.api.read(collectionId)),
    [collectionId, replace, services],
  );

  return {
    addItem: (item, key) =>
      act(async () => {
        await services.api.addItem(
          { collectionId, item },
          { idempotencyKey: key },
        );
        await refresh();
      }),
    busy,
    dismissNotice,
    notice,
    refresh,
    reload,
    removeItem: (itemId) =>
      act(async () => {
        await services.api.removeItem({ collectionId, itemId });
        await refresh();
      }),
    save: (draft, expectedRevision) =>
      act(async () => {
        replace(
          await services.api.save({ collectionId, draft, expectedRevision }),
        );
      }),
    state,
    updateItem: (itemId, item) =>
      act(async () => {
        await services.api.updateItem({ collectionId, item, itemId });
        await refresh();
      }),
  };
}
