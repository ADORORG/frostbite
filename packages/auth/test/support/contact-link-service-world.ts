import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { vi } from "vitest";

import type { ActiveSession } from "../../src/application/session-repository.ts";
import type { ContactChannel } from "../../src/contacts/channel.ts";
import type {
  ContactLinkRepository,
  LinkedContact,
} from "../../src/contacts/link-repository.ts";
import { createContactLinkService } from "../../src/contacts/link-service.ts";

// The link service over a repository and a code service that answer as told, and the sessions and policy its unit tests share.
export const now = new Date("2026-10-25T12:00:00.000Z");
export const window = 600_000;
export const policy = {
  maximumAddresses: 3,
  recentAuthenticationWindowMs: window,
  sessionAbsoluteLifetimeMs: 3_600_000,
  sessionIdleLifetimeMs: 600_000,
};
export const correlationId = createUuidV7();
export const userId: UuidV7 = createUuidV7();
export const sessionAt = (authenticatedAt: Date): ActiveSession => ({
  absoluteExpiresAt: new Date(now.getTime() + 3_600_000),
  authenticatedAt,
  idleExpiresAt: new Date(now.getTime() + 600_000),
  sessionId: createUuidV7(),
  userId,
});
export const recent = sessionAt(new Date(now.getTime() - window));
export const stale = sessionAt(new Date(now.getTime() - window - 1));
export const future = sessionAt(new Date(now.getTime() + 1));

export const channel: ContactChannel = {
  accountName: "Email user",
  deliver: async () => undefined,
  kind: "email",
  normalize: (raw) => (raw.includes("@") ? raw.trim().toLowerCase() : null),
  policy: {
    codeLength: 6,
    lifetimeMs: 1,
    maximumAttempts: 5,
    maximumSendsPerWindow: 5,
    resendCooldownMs: 1,
    sendWindowMs: 2,
  },
};

export const heldOne: LinkedContact = { addedAt: now, value: "a@b.co" };
export const held = (count: number): LinkedContact[] =>
  Array.from({ length: count }, (_, at) => ({
    addedAt: new Date(now.getTime() - at * 1000),
    value: `held${String(at)}@b.co`,
  }));

export function harness(
  options: {
    readonly confirm?: "ok" | "invalid";
    // The addresses the account holds; one by default.
    readonly held?: readonly LinkedContact[];
    readonly link?: Awaited<
      ReturnType<ContactLinkRepository["completeLink"]>
    >["kind"];
    readonly unlink?: Awaited<
      ReturnType<ContactLinkRepository["unlink"]>
    >["kind"];
  } = {},
) {
  const repository: ContactLinkRepository = {
    completeLink: vi.fn(async () => ({ kind: options.link ?? "linked" })),
    list: vi.fn(async () => options.held ?? [heldOne]),
    unlink: vi.fn(async () => ({ kind: options.unlink ?? "unlinked" })),
  };
  const codes = {
    confirm: vi.fn(async () =>
      options.confirm === "invalid"
        ? ({ ok: false, reason: "invalid" } as const)
        : ({ codeId: "code-1", destination: "a@b.co", ok: true } as const),
    ),
    request: vi.fn(async () => ({ ok: true }) as const),
  };
  const service = createContactLinkService({
    channels: [channel],
    clock: () => now,
    codes,
    policy,
    repository,
  });
  return { codes, repository, service };
}
