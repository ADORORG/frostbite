import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  MailDeliveryError,
  createCapturingMailbox,
  createMailSender,
  readCapturedMail,
} from "../src/index.ts";

let directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.map((path) => rm(path, { force: true, recursive: true })),
  );
  directories = [];
});
async function scratch() {
  const path = await mkdtemp(join(tmpdir(), "frostbite-mail-"));
  directories.push(path);
  return path;
}

describe("the capturing mailbox", () => {
  it("keeps each message as a file and reads them newest first, even within one millisecond", async () => {
    const directory = join(await scratch(), "inbox");
    const sender = createCapturingMailbox({
      clock: () => new Date(1_700_000_000_000),
      directory,
      from: "login@example.org",
    });
    await sender.send({ subject: "one", text: "111111", to: "a@example.com" });
    await sender.send({ subject: "two", text: "222222", to: "b@example.com" });
    const mail = await readCapturedMail(directory);
    expect(mail.map(({ subject }) => subject)).toEqual(["two", "one"]);
    expect(mail[0]).toEqual({
      from: "login@example.org",
      sentAt: "2023-11-14T22:13:20.000Z",
      subject: "two",
      text: "222222",
      to: "b@example.com",
    });
  });

  it("keeps a message's styled version in its record and as a page beside it, and writes no page for a plain message", async () => {
    const directory = await scratch();
    const sender = createCapturingMailbox({
      clock: () => new Date(0),
      directory,
      from: "login@example.org",
    });
    await sender.send({
      html: "<p>hi</p>",
      subject: "styled",
      text: "t",
      to: "a@example.com",
    });
    await sender.send({ subject: "plain", text: "t", to: "a@example.com" });
    const mail = await readCapturedMail(directory);
    // Found by subject: two messages in one millisecond have no order to rely on.
    const styled = mail.find(({ subject }) => subject === "styled");
    const plain = mail.find(({ subject }) => subject === "plain");
    expect(styled?.html).toBe("<p>hi</p>");
    expect(plain).not.toHaveProperty("html");
    const files = (await readdir(directory)).filter((n) => n.endsWith(".html"));
    expect(files).toHaveLength(1);
    expect(await readFile(join(directory, files[0] ?? ""), "utf8")).toBe(
      "<p>hi</p>",
    );
  });

  it("is what the capture setting builds", async () => {
    const directory = await scratch();
    await createMailSender(
      { directory, from: "login@example.org", transport: "capture" },
      { clock: () => new Date(0) },
    ).send({ subject: "s", text: "t", to: "a@example.com" });
    expect(await readCapturedMail(directory)).toHaveLength(1);
  });

  it("reads nothing from a directory that does not exist yet, and ignores files that are not messages", async () => {
    const root = await scratch();
    expect(await readCapturedMail(join(root, "missing"))).toEqual([]);
    await writeFile(join(root, "notes.txt"), "not mail");
    expect(await readCapturedMail(root)).toEqual([]);
  });

  it("reports a path it cannot read as a directory, rather than saying there is no mail", async () => {
    const root = await scratch();
    await writeFile(join(root, "file"), "x");
    await expect(readCapturedMail(join(root, "file"))).rejects.toThrow();
  });

  it("refuses a file that is not a message, rather than showing it", async () => {
    const root = await scratch();
    await writeFile(join(root, "bad.json"), JSON.stringify({ to: "" }));
    await expect(readCapturedMail(root)).rejects.toThrow();
  });

  it("fails delivery, without the address, when the directory cannot be written", async () => {
    const root = await scratch();
    const blocker = join(root, "file");
    await writeFile(blocker, "x");
    const error = await createCapturingMailbox({
      clock: () => new Date(),
      directory: join(blocker, "inbox"),
      from: "f@example.org",
    })
      .send({ subject: "s", text: "t", to: "ada@example.com" })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MailDeliveryError);
    expect(String(error)).not.toContain("ada@example.com");
  });
});
