import type { CorrelationId } from "@ador/shared/http";

import type { ActiveSession } from "../application/session-repository.ts";
import {
  createSessionMaterial,
  type SessionLifetimes,
} from "../application/session-material.ts";
import { createOpaqueValue } from "../domain/crypto.ts";
import type { MethodKind } from "../methods/contracts.ts";
import type { ContactChannel } from "./channel.ts";
import type {
  ContactLinkRepository,
  LinkedContact,
} from "./link-repository.ts";
import type { ContactCodeService, RequestCodeResult } from "./service.ts";

const SESSION_TOKEN_BYTES = 32;

export interface ContactLinkPolicy extends SessionLifetimes {
  // The most addresses of one kind an account may hold.
  readonly maximumAddresses: number;
  // How recently the session must have signed in to add or remove an address.
  readonly recentAuthenticationWindowMs: number;
}

export type RequestLinkResult =
  | RequestCodeResult
  | { readonly ok: false; readonly reason: "limit-reached" }
  | { readonly ok: false; readonly reason: "recent-authentication-required" };

export type ConfirmLinkResult =
  // `sessionToken` is null when the account already held the address: nothing changed, so no session was replaced.
  | { readonly ok: true; readonly sessionToken: string | null }
  | {
      readonly ok: false;
      // `taken`: another account holds the address. `invalid`: a wrong, used or expired code, or an address that cannot be one.
      // `limit-reached`: the account already holds as many addresses as it may.
      readonly reason:
        | "invalid"
        | "limit-reached"
        | "recent-authentication-required"
        | "taken";
    };

export type UnlinkContactOutcome =
  | { readonly ok: true; readonly sessionToken: string }
  | {
      readonly ok: false;
      readonly reason:
        "final-method" | "missing" | "recent-authentication-required";
    };

// Adding an address to the account that is signed in, and removing one. Adding needs a recent sign-in and the code sent to the address
// (so it proves the mailbox is theirs); an address another account holds is refused and never moves (no merging). Removing needs a
// recent sign-in and never takes the account's last way in. An account holds at most `maximumAddresses` of one kind: a request for a code to
// one more is refused before anything is mailed, and the repository counts again when it adds, since two sessions can ask at once. Both
// changes sign every other session out, as linking a wallet or passkey does. The rules are enforced here and in the repository's
// transaction, not by the page that asks.
export function createContactLinkService(dependencies: {
  readonly channels: readonly ContactChannel[];
  readonly clock: () => Date;
  readonly codes: Pick<ContactCodeService, "confirm" | "request">;
  readonly policy: ContactLinkPolicy;
  readonly repository: ContactLinkRepository;
}) {
  const { channels, clock, codes, policy, repository } = dependencies;
  if (
    !Number.isInteger(policy.maximumAddresses) ||
    policy.maximumAddresses < 1 ||
    policy.recentAuthenticationWindowMs <= 0 ||
    policy.sessionIdleLifetimeMs <= 0 ||
    policy.sessionAbsoluteLifetimeMs < policy.sessionIdleLifetimeMs
  )
    throw new Error("Contact link policy is invalid");

  // The address as the channel for this kind writes it, or null when there is no such channel or it is not an address.
  function normalized(kind: MethodKind, raw: string): string | null {
    return (
      channels.find((channel) => channel.kind === kind)?.normalize(raw) ?? null
    );
  }
  function isRecent(session: ActiveSession, now: Date): boolean {
    const age = now.getTime() - session.authenticatedAt.getTime();
    return age >= 0 && age <= policy.recentAuthenticationWindowMs;
  }
  function change(
    session: ActiveSession,
    correlationId: CorrelationId,
    destination: string,
    kind: MethodKind,
    now: Date,
  ) {
    const sessionToken = createOpaqueValue(SESSION_TOKEN_BYTES);
    return {
      input: {
        correlationId,
        destination,
        kind,
        minimumAuthenticatedAt: new Date(
          now.getTime() - policy.recentAuthenticationWindowMs,
        ),
        now,
        replacementSession: createSessionMaterial(now, sessionToken, policy),
        sessionId: session.sessionId,
        userId: session.userId,
      },
      sessionToken,
    };
  }

  return {
    // What the account page shows: the addresses the account holds, oldest first, and how many it may hold.
    async addresses(
      userId: string,
      kind: MethodKind,
    ): Promise<{
      readonly addresses: readonly LinkedContact[];
      readonly maximum: number;
    }> {
      return {
        addresses: await repository.list(userId, kind),
        maximum: policy.maximumAddresses,
      };
    },

    async request(input: {
      readonly destination: string;
      readonly kind: MethodKind;
      readonly session: ActiveSession;
    }): Promise<RequestLinkResult> {
      if (!isRecent(input.session, clock()))
        return { ok: false, reason: "recent-authentication-required" };
      // Only the account's own addresses are counted, so this tells nobody anything about other accounts. An address it already holds
      // is let through: asking for a code for it changes nothing, and the answer to "is it full" must not depend on which address.
      const destination = normalized(input.kind, input.destination);
      if (destination !== null) {
        const held = await repository.list(input.session.userId, input.kind);
        if (
          held.length >= policy.maximumAddresses &&
          !held.some(({ value }) => value === destination)
        )
          return { ok: false, reason: "limit-reached" };
      }
      return codes.request({
        destination: input.destination,
        forAccount: input.session.userId,
        kind: input.kind,
      });
    },

    async confirm(input: {
      readonly code: string;
      readonly correlationId: CorrelationId;
      readonly destination: string;
      readonly kind: MethodKind;
      readonly session: ActiveSession;
    }): Promise<ConfirmLinkResult> {
      const now = clock();
      if (!isRecent(input.session, now))
        return { ok: false, reason: "recent-authentication-required" };
      const confirmed = await codes.confirm({
        code: input.code,
        destination: input.destination,
        forAccount: input.session.userId,
        kind: input.kind,
      });
      if (!confirmed.ok) return { ok: false, reason: "invalid" };
      const { input: repositoryInput, sessionToken } = change(
        input.session,
        input.correlationId,
        confirmed.destination,
        input.kind,
        now,
      );
      const result = await repository.completeLink({
        ...repositoryInput,
        codeId: confirmed.codeId,
        maximumAddresses: policy.maximumAddresses,
      });
      switch (result.kind) {
        case "linked":
          return { ok: true, sessionToken };
        case "already-linked":
          return { ok: true, sessionToken: null };
        case "taken":
          return { ok: false, reason: "taken" };
        case "limit-reached":
          return { ok: false, reason: "limit-reached" };
        case "code-spent":
          return { ok: false, reason: "invalid" };
        case "session-not-recent":
          return { ok: false, reason: "recent-authentication-required" };
      }
    },

    async unlink(input: {
      readonly correlationId: CorrelationId;
      readonly destination: string;
      readonly kind: MethodKind;
      readonly session: ActiveSession;
    }): Promise<UnlinkContactOutcome> {
      const now = clock();
      if (!isRecent(input.session, now))
        return { ok: false, reason: "recent-authentication-required" };
      const destination = normalized(input.kind, input.destination);
      if (destination === null) return { ok: false, reason: "missing" };
      const { input: repositoryInput, sessionToken } = change(
        input.session,
        input.correlationId,
        destination,
        input.kind,
        now,
      );
      const result = await repository.unlink(repositoryInput);
      if (result.kind === "unlinked") return { ok: true, sessionToken };
      return {
        ok: false,
        reason:
          result.kind === "session-not-recent"
            ? "recent-authentication-required"
            : result.kind,
      };
    },
  };
}

export type ContactLinkService = ReturnType<typeof createContactLinkService>;
