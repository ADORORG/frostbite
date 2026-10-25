import { vi } from "vitest";

import type { ContactChannel } from "../../src/contacts/channel.ts";
import { hashCode } from "../../src/contacts/code.ts";
import type {
  ContactCodeRepository,
  HeldCode,
  IssueCodeInput,
  IssueCodeResult,
} from "../../src/contacts/repository.ts";
import { createContactCodeService } from "../../src/contacts/service.ts";

// A code service over a recording stand-in repository and channel, for the rules that do not need a database.
export const now = new Date("2026-10-25T12:00:00.000Z");
export const policy = {
  codeLength: 6,
  lifetimeMs: 600_000,
  maximumAttempts: 5,
  maximumSendsPerWindow: 4,
  resendCooldownMs: 60_000,
  sendWindowMs: 3_600_000,
};
const sessions = {
  sessionAbsoluteLifetimeMs: 3_600_000,
  sessionIdleLifetimeMs: 600_000,
};

export function harness(
  options: {
    readonly deliver?: () => Promise<void>;
    readonly held?: (issued: IssueCodeInput | undefined) => HeldCode | null;
    readonly issue?: IssueCodeResult;
    readonly completes?: "signed-in" | "conflict";
  } = {},
) {
  let issued: IssueCodeInput | undefined;
  const calls: string[] = [];
  const repository: ContactCodeRepository = {
    completeSignIn: vi.fn(() => {
      calls.push("complete");
      return Promise.resolve(
        options.completes === "conflict"
          ? ({ kind: "conflict" } as const)
          : ({ kind: "signed-in", userId: "user-one" } as const),
      );
    }),
    discard: vi.fn(() => {
      calls.push("discard");
      return Promise.resolve();
    }),
    issue: vi.fn((input) => {
      calls.push("issue");
      issued = input;
      return Promise.resolve(options.issue ?? ({ kind: "issued" } as const));
    }),
    takeAttempt: vi.fn(() => {
      calls.push("take");
      return Promise.resolve(options.held?.(issued) ?? null);
    }),
  };
  const deliver = vi.fn(options.deliver ?? (() => Promise.resolve()));
  const channel: ContactChannel = {
    accountName: "Email user",
    deliver,
    kind: "email",
    normalize: (raw) => (raw.includes("@") ? raw.trim().toLowerCase() : null),
    policy,
  };
  const service = createContactCodeService({
    channels: [channel],
    clock: () => now,
    randomCode: () => "424242",
    repository,
    sessions,
  });
  return { calls, deliver, repository, service };
}
export const heldFor = (code: string) => (): HeldCode => ({
  codeHash: hashCode(code, "salt-1"),
  id: "code-1",
  salt: "salt-1",
});
