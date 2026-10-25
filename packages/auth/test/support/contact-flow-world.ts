// The whole path with nothing stood in for: real codes, a real database, and a mailbox that keeps what it is sent. Importing this file in a
// test file also cleans up the mailboxes that file made.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCapturingMailbox,
  readCapturedMail,
  type MailSender,
} from "@ador/mail";
import { afterEach } from "vitest";

import { createEmailChannel } from "../../src/contacts/email-channel.ts";
import { createDrizzleContactLinkRepository } from "../../src/contacts/drizzle-link-repository.ts";
import { createContactLinkService } from "../../src/contacts/link-service.ts";
import { emailMethod } from "../../src/contacts/method.ts";
import { createContactCodeService } from "../../src/contacts/service.ts";
import { createMethodRegistry } from "../../src/methods/registry.ts";
import { passkeyMethod } from "../../src/passkeys/method.ts";
import { walletMethod } from "../../src/wallets/method.ts";
import { clock, database, repository } from "./contact-world.ts";

export const policy = {
  codeLength: 6,
  lifetimeMs: 600_000,
  maximumAttempts: 5,
  maximumSendsPerWindow: 4,
  resendCooldownMs: 60_000,
  sendWindowMs: 3_600_000,
};
export const sessions = {
  sessionAbsoluteLifetimeMs: 3_600_000,
  sessionIdleLifetimeMs: 600_000,
};

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

export async function world(sender?: MailSender) {
  const directory = await mkdtemp(join(tmpdir(), "ador-contact-"));
  directories.push(directory);
  const mailbox = createCapturingMailbox({
    clock: () => clock.now,
    directory,
    from: "login@example.org",
  });
  const channels = [
    createEmailChannel({ appName: "Ador", policy, sender: sender ?? mailbox }),
  ];
  const service = createContactCodeService({
    channels,
    clock: () => clock.now,
    repository,
    sessions,
  });
  const links = createContactLinkService({
    channels,
    clock: () => clock.now,
    codes: service,
    policy: { ...sessions, recentAuthenticationWindowMs: 600_000 },
    repository: createDrizzleContactLinkRepository(
      database,
      createMethodRegistry([walletMethod, passkeyMethod, emailMethod]).list,
    ),
  });
  const codeSentTo = async (address: string) => {
    const mail = (await readCapturedMail(directory)).find(
      ({ to }) => to === address,
    );
    const code = /sign-in code is (\d{6})/u.exec(mail?.text ?? "")?.[1];
    if (code === undefined) throw new Error(`No code was sent to ${address}.`);
    return code;
  };
  return { codeSentTo, directory, links, service };
}
