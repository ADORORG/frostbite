import {
  nameShapeProblem,
  type CheckProfileNameResponse,
} from "@frostbite/shared/profiles";

import { profileCopy } from "./copy.ts";

export type NameCheckState =
  | { readonly kind: "checking" }
  | { readonly kind: "failed" }
  | { readonly kind: "idle" }
  | { readonly kind: "result"; readonly result: CheckProfileNameResponse };

// What the name field says about the name as it stands: the problem with its shape (found here, instantly), or what the server answered about
// it. `error` marks the field invalid; `note` is a status line with a tone for its colour.
export interface NameStatusView {
  readonly error: string | null;
  readonly note: {
    readonly text: string;
    readonly tone: "bad" | "good" | "wait";
  } | null;
}

const none: NameStatusView = { error: null, note: null };

export function nameStatusOf(
  name: string,
  bounds: { readonly maxLength: number; readonly minLength: number },
  check: NameCheckState,
): NameStatusView {
  if (name === "") return none;
  const shape = nameShapeProblem(name, bounds);
  if (shape !== null)
    return { error: profileCopy.nameReason(shape, bounds), note: null };
  switch (check.kind) {
    case "idle":
      return none;
    case "checking":
      return {
        error: null,
        note: { text: profileCopy.nameStatus.checking, tone: "wait" },
      };
    case "failed":
      return {
        error: null,
        note: { text: profileCopy.nameStatus.failed, tone: "wait" },
      };
    case "result":
      return resultView(check.result, bounds);
  }
}

function resultView(
  result: CheckProfileNameResponse,
  bounds: { readonly maxLength: number; readonly minLength: number },
): NameStatusView {
  switch (result.status) {
    case "available":
      return {
        error: null,
        note: { text: profileCopy.nameStatus.available, tone: "good" },
      };
    case "yours":
      return {
        error: null,
        note: { text: profileCopy.nameStatus.yours, tone: "good" },
      };
    case "taken":
      return { error: profileCopy.nameStatus.taken, note: null };
    case "locked":
      return {
        error: profileCopy.nameStatus.locked(result.until),
        note: null,
      };
    case "invalid":
      return {
        error: profileCopy.nameReason(result.reason, bounds),
        note: null,
      };
  }
}
