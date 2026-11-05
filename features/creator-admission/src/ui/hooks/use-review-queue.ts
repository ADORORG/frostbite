import type {
  CreatorReviewGroup,
  CreatorReviewQueueItem,
  CreatorReviewQueueResponse,
  CreatorReviewSort,
} from "@frostbite/shared/creator-admission";
import { useCallback, useState } from "react";

import type { ReviewClientServices } from "../../client/services.ts";
import { useAction, type Action } from "./use-action.ts";
import { useResource, type LoadedResource } from "./use-resource.ts";

export interface ReviewQueue {
  readonly action: Action;
  readonly group: CreatorReviewGroup;
  // True while another page exists and has not been loaded.
  readonly hasMore: boolean;
  readonly items: readonly CreatorReviewQueueItem[];
  // The first page of what is shown. Reloading it is offered only when it failed, so no later page can be on
  // screen yet.
  readonly first: LoadedResource<CreatorReviewQueueResponse>;
  readonly loadMore: () => Promise<boolean>;
  readonly setGroup: (group: CreatorReviewGroup) => void;
  readonly setSort: (sort: CreatorReviewSort) => void;
  readonly sort: CreatorReviewSort;
}

// The queue as one growing list for the chosen group and order: the first page, then more as they are asked
// for. Each later page continues after the last row already shown, so nothing is missed or repeated, and a
// change of group or order starts the list again.
export function useReviewQueue(services: ReviewClientServices): ReviewQueue {
  const [group, setGroup] = useState<CreatorReviewGroup>("needs-review");
  const [sort, setSort] = useState<CreatorReviewSort>("oldest");
  const key = `${group}|${sort}`;
  const first = useResource(
    (signal) => services.api.queue({ cursor: null, group, sort }, { signal }),
    key,
  );
  const action = useAction();
  const [more, setMore] = useState<{
    readonly cursor: string | null;
    readonly items: readonly CreatorReviewQueueItem[];
    readonly key: string;
  } | null>(null);
  const loaded = first.state.status === "loading" ? null : first.state.data;
  // Pages loaded for another group or order are not this list's.
  const later = more !== null && more.key === key ? more : null;
  const cursor = later === null ? (loaded?.nextCursor ?? null) : later.cursor;

  const loadMore = useCallback(async () => {
    if (cursor === null) return false;
    return action.act(async () => {
      const page = await services.api.queue({ cursor, group, sort });
      setMore((current) => ({
        cursor: page.nextCursor,
        items: [
          ...(current !== null && current.key === key ? current.items : []),
          ...page.items,
        ],
        key,
      }));
    });
  }, [action, cursor, group, key, services, sort]);

  return {
    action,
    first,
    group,
    hasMore: cursor !== null,
    items: [...(loaded?.items ?? []), ...(later?.items ?? [])],
    loadMore,
    setGroup,
    setSort,
    sort,
  };
}
