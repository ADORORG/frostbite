import {
  describeCreatorStanding,
  type StandingCopy,
} from "../../client/creator-standing.ts";
import type { CreatorStanding } from "../../client/collections-api.ts";
import type { CollectionsClientServices } from "../../client/services.ts";
import { useResource, type LoadedResource } from "./use-resource.ts";

export interface CreatorStandingView {
  readonly resource: LoadedResource<CreatorStanding>;
  // What the person's standing is, once it is known (also from an earlier load after a failed refresh);
  // null while loading or when it could not be loaded at all.
  readonly standing: StandingCopy | null;
}

// Where the person stands as a creator, loaded once for a page and shared by everything on it that
// depends on it (offering or withholding what only an approved creator can do).
export function useCreatorStanding(
  services: CollectionsClientServices,
): CreatorStandingView {
  const resource = useResource(
    (signal) => services.api.creatorStanding({ signal }),
    "standing",
  );
  const { state } = resource;
  const known =
    state.status === "ready"
      ? state.data
      : state.status === "error"
        ? state.data
        : null;
  return {
    resource,
    standing: known === null ? null : describeCreatorStanding(known.state),
  };
}
