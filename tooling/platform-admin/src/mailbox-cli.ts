import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { readCapturedMail } from "@ador/mail";

import { formatMailbox, parseLimit } from "./mailbox.ts";

// `pnpm mailbox [--dir <directory>] [--limit <n>]`: prints the messages the local stack's capture transport kept, newest first. The
// default directory is the one `pnpm stack` writes to.
const root = resolve(import.meta.dirname, "../../..");
const { values } = parseArgs({
  options: { dir: { type: "string" }, limit: { type: "string" } },
});
const directory = resolve(root, values.dir ?? ".stack-data/mailbox");
const limit = parseLimit(values.limit);
if (limit === null) {
  console.error("--limit must be a whole number of at least 1.");
  process.exit(1);
}
console.log(formatMailbox(await readCapturedMail(directory), limit));
