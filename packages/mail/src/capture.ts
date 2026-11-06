import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createUuidV7 } from "@frostbite/shared/identifiers";
import { z } from "zod";

import {
  MailDeliveryError,
  type MailMessage,
  type MailSender,
} from "./contracts.ts";

const capturedMailSchema = z.strictObject({
  from: z.string().min(1),
  // The styled version, when the message had one; also written beside the JSON as a page to open in a browser.
  html: z.string().optional(),
  sentAt: z.iso.datetime(),
  subject: z.string(),
  text: z.string(),
  to: z.string().min(1),
});
export type CapturedMail = z.infer<typeof capturedMailSchema>;

// A real mailbox for development: every message is a JSON file in a directory, named so that the newest sorts last. Whoever is testing
// reads the file (`readCapturedMail`, or `pnpm mailbox`). Nothing is delivered anywhere.
export function createCapturingMailbox(input: {
  readonly clock: () => Date;
  readonly directory: string;
  readonly from: string;
}): MailSender {
  return {
    async send(message: MailMessage) {
      const sentAt = input.clock();
      const captured: CapturedMail = {
        from: input.from,
        sentAt: sentAt.toISOString(),
        ...(message.html === undefined ? {} : { html: message.html }),
        subject: message.subject,
        text: message.text,
        to: message.to,
      };
      const name = createUuidV7();
      try {
        await mkdir(input.directory, { recursive: true });
        // The UUID (version 7) makes the name unique and ordered by creation, so two messages in one millisecond neither collide nor swap.
        await writeFile(
          join(input.directory, `${name}.json`),
          JSON.stringify(captured, null, 2),
          { flag: "wx" },
        );
        if (message.html !== undefined)
          await writeFile(join(input.directory, `${name}.html`), message.html, {
            flag: "wx",
          });
      } catch (error) {
        throw new MailDeliveryError(
          "the capture directory could not be written.",
          { cause: error },
        );
      }
    },
  };
}

// Messages captured in a directory, newest first. A directory that does not exist yet holds none.
export async function readCapturedMail(
  directory: string,
): Promise<readonly CapturedMail[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
  const files = names
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();
  return Promise.all(
    files.map(async (name) =>
      capturedMailSchema.parse(
        JSON.parse(await readFile(join(directory, name), "utf8")),
      ),
    ),
  );
}
