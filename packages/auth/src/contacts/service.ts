import { createUuidV7 } from "@ador/shared/identifiers";

import {
  createSessionMaterial,
  type SessionLifetimes,
} from "../application/session-material.ts";
import { createOpaqueValue } from "../domain/crypto.ts";
import type { MethodKind } from "../methods/contracts.ts";
import type { ContactChannel } from "./channel.ts";
import { codeMatches, generateCode, hashCode } from "./code.ts";
import type { ContactCodeRepository } from "./repository.ts";

const SALT_BYTES = 16;
const SESSION_TOKEN_BYTES = 32;

export type RequestCodeResult =
  | { readonly ok: true }
  // What the caller may say to the person. None of these depends on whether the destination has an account.
  | {
      readonly ok: false;
      readonly reason:
        "delivery-failed" | "invalid-destination" | "unsupported-channel";
    }
  | {
      readonly ok: false;
      readonly reason: "cooldown" | "limit";
      readonly retryAfterMs: number;
    };

export type VerifyCodeResult =
  | { readonly ok: true; readonly sessionToken: string }
  // One answer for a wrong code, an expired one, a used one, one never sent and one whose tries are spent.
  | { readonly ok: false; readonly reason: "invalid" };

// Signing in with a code sent to a destination. It is the same for every channel: the channel says how a destination is written and a
// code delivered; this decides when a code may be sent, whether one entered is right, and then signs the person in. It never asks
// whether the destination has an account until the code is right, so nothing it says depends on that.
export function createContactCodeService(dependencies: {
  readonly channels: readonly ContactChannel[];
  readonly clock: () => Date;
  // Replaceable so a test can know the code; the default draws one at random.
  readonly randomCode?: (length: number) => string;
  readonly repository: ContactCodeRepository;
  readonly sessions: SessionLifetimes;
}) {
  const { channels, clock, repository, sessions } = dependencies;
  const randomCode = dependencies.randomCode ?? generateCode;
  const channelOf = (kind: MethodKind) =>
    channels.find((channel) => channel.kind === kind);
  return {
    async request(input: {
      readonly destination: string;
      readonly kind: MethodKind;
    }): Promise<RequestCodeResult> {
      const channel = channelOf(input.kind);
      if (channel === undefined)
        return { ok: false, reason: "unsupported-channel" };
      const destination = channel.normalize(input.destination);
      if (destination === null)
        return { ok: false, reason: "invalid-destination" };
      const { policy } = channel;
      const now = clock();
      const code = randomCode(policy.codeLength);
      const salt = createOpaqueValue(SALT_BYTES);
      const id = createUuidV7();
      const issued = await repository.issue({
        codeHash: hashCode(code, salt),
        destination,
        expiresAt: new Date(now.getTime() + policy.lifetimeMs),
        id,
        issuedAt: now,
        kind: channel.kind,
        limits: {
          cooldownMs: policy.resendCooldownMs,
          maximumPerWindow: policy.maximumSendsPerWindow,
          windowMs: policy.sendWindowMs,
        },
        salt,
      });
      if (issued.kind !== "issued")
        return {
          ok: false,
          reason: issued.kind,
          retryAfterMs: issued.retryAfterMs,
        };
      try {
        await channel.deliver(destination, code);
      } catch {
        await repository.discard(id);
        return { ok: false, reason: "delivery-failed" };
      }
      return { ok: true };
    },

    async verify(input: {
      readonly code: string;
      readonly destination: string;
      readonly kind: MethodKind;
    }): Promise<VerifyCodeResult> {
      const invalid = { ok: false, reason: "invalid" } as const;
      const channel = channelOf(input.kind);
      const destination = channel?.normalize(input.destination) ?? null;
      if (channel === undefined || destination === null) return invalid;
      const { policy } = channel;
      // The shape of a code is public, so a malformed one is refused without spending a try.
      if (!new RegExp(`^\\d{${policy.codeLength}}$`, "u").test(input.code))
        return invalid;
      const now = clock();
      const held = await repository.takeAttempt({
        destination,
        kind: channel.kind,
        maximumAttempts: policy.maximumAttempts,
        now,
      });
      if (held === null || !codeMatches(input.code, held.salt, held.codeHash))
        return invalid;
      const sessionToken = createOpaqueValue(SESSION_TOKEN_BYTES);
      const result = await repository.completeSignIn({
        accountName: channel.accountName,
        codeId: held.id,
        destination,
        kind: channel.kind,
        now,
        session: createSessionMaterial(now, sessionToken, sessions),
      });
      return result.kind === "signed-in" ? { ok: true, sessionToken } : invalid;
    },
  };
}

export type ContactCodeService = ReturnType<typeof createContactCodeService>;
