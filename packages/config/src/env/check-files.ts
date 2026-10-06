import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { environmentKeys } from "./definitions.ts";

export const environmentFiles = [
  ".env.example",
  ".env.local.example",
  ".env.test.example",
  ".env.preview.example",
  ".env.production.example",
] as const;

export const applicationEnvironmentFiles = [
  "apps/web/.env.example",
  "apps/worker/.env.example",
] as const;

export const localEnvironmentFiles = [
  ".env",
  ".env.local",
  ".env.test",
  ".env.preview",
  ".env.production",
  "apps/web/.env",
  "apps/web/.env.local",
  "apps/web/.env.test",
  "apps/web/.env.preview",
  "apps/web/.env.production",
  "apps/worker/.env",
  "apps/worker/.env.local",
  "apps/worker/.env.test",
  "apps/worker/.env.preview",
  "apps/worker/.env.production",
] as const;

function extractKeys(contents: string): string[] {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.slice(0, line.indexOf("=")));
}

function assertCanonicalKeys(filename: string, contents: string): void {
  const actualKeys = extractKeys(contents);
  if (actualKeys.join("\n") !== environmentKeys.join("\n")) {
    throw new Error(
      `${filename} must contain the canonical environment keys in order.`,
    );
  }
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function checkEnvironmentTemplates(root: string): Promise<void> {
  for (const filename of [
    ...environmentFiles,
    ...applicationEnvironmentFiles,
  ]) {
    const contents = await readFile(resolve(root, filename), "utf8");
    assertCanonicalKeys(filename, contents);
  }
}

export async function checkEnvironmentFiles(root: string): Promise<void> {
  await checkEnvironmentTemplates(root);
  for (const filename of localEnvironmentFiles) {
    const contents = await readOptional(resolve(root, filename));
    if (contents !== undefined) assertCanonicalKeys(filename, contents);
  }
}

const modulePath = fileURLToPath(import.meta.url);

export async function runEnvironmentFileCheck(
  executablePath: string | undefined,
  currentModulePath: string,
  root = resolve(dirname(currentModulePath), "../../../.."),
): Promise<boolean> {
  if (executablePath !== currentModulePath) {
    return false;
  }

  await checkEnvironmentFiles(root);
  return true;
}

await runEnvironmentFileCheck(process.argv[1], modulePath);
