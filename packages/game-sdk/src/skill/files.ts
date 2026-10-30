import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Names in code-unit order: the same on every machine, unlike a locale's.
export const byName = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

// Every file under a folder, as paths relative to it, in `byName` order. Anything that is not a plain file or folder is not part of a skill.
export async function listFiles(root: string, at = ""): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(join(root, at), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => byName(a.name, b.name))) {
    const path = at === "" ? entry.name : `${at}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await listFiles(root, path)));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

export const digestOf = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

// A map from each file's path to the SHA-256 of its bytes.
export async function digestsOf(
  root: string,
): Promise<Readonly<Record<string, string>>> {
  const digests: Record<string, string> = {};
  for (const path of await listFiles(root))
    digests[path] = digestOf(await readFile(join(root, path)));
  return digests;
}

export async function writeInto(
  root: string,
  path: string,
  bytes: Uint8Array | string,
): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
