import type { TransactionIntent } from "@ador/shared/chain";

import type { Call } from "../tx/call-script.ts";
import { milestoneKey } from "../milestone-key.ts";
import { parseAlkaneId, type AlkaneId } from "../node/alkane-id.ts";
import {
  createGameCall,
  defineMilestoneCall,
  pauseCall,
  publishTemplateCall,
  resumeCall,
} from "./calls.ts";
import { templateKey, type AdminOptions } from "./templates.ts";

// Published code lives in block 4 (`{3, n}` publishes it at `{4, n}`).
const codeBlock = 4n;

function publishedCode(
  at: { readonly id: string } | undefined,
): AlkaneId | null {
  const id = parseAlkaneId(at?.id ?? "");
  return id !== null && id.block === codeBlock ? id : null;
}

export const adminOperations = [
  "define-milestone",
  "deploy",
  "publish-template",
  "set-claims-paused",
] as const;
export type AdminOperation = (typeof adminOperations)[number];

export function isAdminOperation(
  operation: string,
): operation is AdminOperation {
  return (adminOperations as readonly string[]).includes(operation);
}

export type AdminIntent = Extract<
  TransactionIntent,
  { operation: AdminOperation }
>;

export function isAdminIntent(
  intent: TransactionIntent,
): intent is AdminIntent {
  return isAdminOperation(intent.operation);
}

// What an administration transaction does, in the words both an intent and a summary use. The builder reads an intent; the verifier
// reads the summary a person was shown; both turn it into the same call (`adminCall`), so what was shown cannot drift from what is
// sent.
export interface AdminSource {
  readonly claimLimit?: number | undefined;
  readonly collectibleAt?: { readonly id: string } | undefined;
  readonly contract?: { readonly id: string } | undefined;
  readonly maxDrawingBytes?: number | undefined;
  readonly milestoneId?: string | undefined;
  readonly operation: AdminOperation;
  readonly paused?: boolean | undefined;
  readonly templateAt?: { readonly id: string } | undefined;
  readonly templateId?: string | undefined;
  readonly templateVersion?: string | undefined;
}

// Whether the call must be handed the game's auth token (the staff's proof that they administer it).
export function needsAuthToken(operation: AdminOperation): boolean {
  return operation === "define-milestone" || operation === "set-claims-paused";
}

// The call an action makes, or null when its parts are missing, malformed or name a template that is not configured.
export function adminCall(
  source: AdminSource,
  options: Pick<AdminOptions, "maxDrawingBytes" | "templates">,
): Call | null {
  switch (source.operation) {
    case "define-milestone": {
      const game = parseAlkaneId(source.contract?.id ?? "");
      if (
        game === null ||
        source.milestoneId === undefined ||
        source.claimLimit === undefined
      )
        return null;
      return defineMilestoneCall(
        game,
        milestoneKey(source.milestoneId),
        BigInt(source.claimLimit),
      );
    }
    case "set-claims-paused": {
      const game = parseAlkaneId(source.contract?.id ?? "");
      if (game === null || source.paused === undefined) return null;
      return source.paused ? pauseCall(game) : resumeCall(game);
    }
    case "publish-template": {
      const entry = options.templates.get(
        templateKey(source.templateId ?? "", source.templateVersion ?? ""),
      );
      const at = publishedCode(source.templateAt);
      return entry === undefined || at === null
        ? null
        : publishTemplateCall(at.tx, entry.readOnlyOpcode);
    }
    case "deploy": {
      const game = options.templates.has(
        templateKey(source.templateId ?? "", source.templateVersion ?? ""),
      )
        ? publishedCode(source.templateAt)
        : null;
      const collectible = publishedCode(source.collectibleAt);
      const size = source.maxDrawingBytes;
      return game === null ||
        collectible === null ||
        size === undefined ||
        BigInt(size) > options.maxDrawingBytes
        ? null
        : createGameCall(game.tx, collectible.tx, BigInt(size));
    }
  }
}
