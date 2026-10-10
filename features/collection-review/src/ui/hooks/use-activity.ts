import type {
  ReviewActivityItem,
  ReviewActivityResponse,
} from "@ador/shared/collections";
import { useCallback, useState } from "react";

import type { ReviewClientServices } from "../../client/services.ts";
import { useAction, type Action } from "./use-action.ts";
import { useResource, type LoadedResource } from "./use-resource.ts";

export interface Activity {
  readonly action: Action;
  // True while an older page exists and has not been loaded.
  readonly hasOlder: boolean;
  readonly items: readonly ReviewActivityItem[];
  // The newest page of the log. Reloading it is offered only when it failed to load, so no older page
  // can be on screen yet.
  readonly latest: LoadedResource<ReviewActivityResponse>;
  readonly loadOlder: () => Promise<boolean>;
}

// The activity log as one growing list: the newest page, then older pages as they are asked for. Each
// older page is cut at the last event already shown, so nothing is missed or repeated.
export function useActivity(services: ReviewClientServices): Activity {
  const latest = useResource(
    (signal) => services.api.activity(null, { signal }),
    "activity",
  );
  const action = useAction();
  const [older, setOlder] = useState<{
    readonly cursor: string | null;
    readonly items: readonly ReviewActivityItem[];
  } | null>(null);
  const first = latest.state.status === "loading" ? null : latest.state.data;
  const cursor = older === null ? (first?.nextCursor ?? null) : older.cursor;

  const loadOlder = useCallback(async () => {
    if (cursor === null) return false;
    return action.act(async () => {
      const page = await services.api.activity(cursor);
      setOlder((current) => ({
        cursor: page.nextCursor,
        items: [...(current?.items ?? []), ...page.items],
      }));
    });
  }, [action, cursor, services]);

  return {
    action,
    hasOlder: cursor !== null,
    items: [...(first?.items ?? []), ...(older?.items ?? [])],
    latest,
    loadOlder,
  };
}
