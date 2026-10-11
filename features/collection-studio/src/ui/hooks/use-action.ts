import {
  useAction as useSharedAction,
  type Action as Shared,
} from "@ador/client-react";

import { describeFailure, type Failure } from "../../client/error-copy.ts";

export type Action = Shared<Failure>;

// The shared action hook with this feature's failure words.
export function useAction(): Action {
  return useSharedAction(describeFailure);
}
