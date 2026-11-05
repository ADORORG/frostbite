import type { IdempotencyKey } from "@frostbite/shared/http";
import { useCallback, useRef } from "react";

import type { CollectionsClientServices } from "../../client/services.ts";
import { useAction, type Action } from "./use-action.ts";
import { useResource, type LoadedResource } from "./use-resource.ts";
import type { CollectionSubmissionList } from "@frostbite/shared/collections";

export interface Submissions extends Action {
  readonly list: LoadedResource<CollectionSubmissionList>;
  // Freezes the collection as the revision the creator is looking at; resolves true once it is submitted.
  readonly submit: (expectedRevision: number) => Promise<boolean>;
}

// The collection's submissions and the act of submitting. The idempotency key is held from the first
// attempt until one succeeds, so a retry after a lost response cannot submit twice; it is replaced when
// the revision being submitted changes, because that is a different request.
export function useSubmissions(
  services: CollectionsClientServices,
  collectionId: string,
): Submissions {
  const list = useResource(
    (signal) => services.api.listSubmissions(collectionId, { signal }),
    collectionId,
  );
  const action = useAction();
  const { act } = action;
  const attempt = useRef<{
    readonly key: IdempotencyKey;
    readonly revision: number;
  } | null>(null);
  const { replace } = list;

  const submit = useCallback(
    (expectedRevision: number) =>
      act(async () => {
        if (attempt.current?.revision !== expectedRevision)
          attempt.current = {
            key: services.createIdempotencyKey(),
            revision: expectedRevision,
          };
        await services.api.submit(
          { collectionId, expectedRevision },
          { idempotencyKey: attempt.current.key },
        );
        attempt.current = null;
        replace(await services.api.listSubmissions(collectionId));
      }),
    [act, collectionId, replace, services],
  );

  return { ...action, list, submit };
}
