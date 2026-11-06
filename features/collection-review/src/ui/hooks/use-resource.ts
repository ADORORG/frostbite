import {
  useResource as useLoadedResource,
  type LoadedResource as Loaded,
  type Resource as Value,
} from "@frostbite/client-react";

import { describeFailure, type Failure } from "../../client/error-copy.ts";

export type Resource<Data> = Value<Data, Failure>;
export type LoadedResource<Data> = Loaded<Data, Failure>;

// The shared loading hook with this feature's failure words.
export function useResource<Data>(
  load: (signal: AbortSignal) => Promise<Data>,
  key: string,
): LoadedResource<Data> {
  return useLoadedResource(load, key, describeFailure);
}
