import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Workspace } from "./workspaces.ts";

// The licence of this repository, as a record: one place that says which licence, whose and from when, so every file that repeats it
// (LICENSE, each package.json, the README, the image label) is checked against this and cannot drift from it.
// FSL-1.1-ALv2 is the Functional Source License, version 1.1, with the Apache 2.0 future licence: the source is public, any purpose is
// allowed except a competing product or service, and each release becomes Apache-2.0 two years after it is published. The owner chose it
// (LICENSE-1); the text in LICENSE is the template published at https://fsl.software with the holder and year filled in.
export const repositoryLicense = {
  holder: "ADORORG",
  spdx: "FSL-1.1-ALv2",
  title: "Functional Source License, Version 1.1, ALv2 Future License",
  year: 2026,
} as const;

const read = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
};

async function licenseOf(directory: string): Promise<unknown> {
  const contents = await read(resolve(directory, "package.json"));
  if (contents === null) return undefined;
  // A package.json that is not JSON is another policy's problem (the workspace reader throws on it); here it simply has no licence.
  try {
    return (JSON.parse(contents) as { license?: unknown }).license;
  } catch {
    return undefined;
  }
}

// What the repository must say about its licence, and where: the licence text with the holder and year filled in and nothing left to fill,
// a NOTICE that reserves what the licence does not cover, the SPDX identifier in the root and every workspace's package.json, in the
// README, and as the image's licence label.
export async function findLicenseViolations(
  root: string,
  workspaces: readonly Workspace[],
): Promise<readonly string[]> {
  const { holder, spdx, title, year } = repositoryLicense;
  const violations: string[] = [];

  const text = await read(resolve(root, "LICENSE"));
  if (text === null) violations.push("LICENSE is missing.");
  else {
    if (!text.includes(title)) violations.push(`LICENSE is not the ${title}.`);
    if (!text.includes(`Copyright ${String(year)} ${holder}`))
      violations.push(
        `LICENSE does not name "Copyright ${String(year)} ${holder}".`,
      );
    if (text.includes("${"))
      violations.push("LICENSE still has a placeholder to fill in.");
  }

  const notice = await read(resolve(root, "NOTICE"));
  if (notice === null) violations.push("NOTICE is missing.");
  else if (!/all rights reserved/iu.test(notice))
    violations.push(
      "NOTICE does not reserve the rights the licence does not grant.",
    );

  const packages = [
    { directory: root, name: "the root package.json" },
    ...workspaces.map(({ directory, name }) => ({
      directory,
      name: `${name}'s package.json`,
    })),
  ];
  for (const { directory, name } of packages) {
    const declared = await licenseOf(directory);
    if (declared !== spdx)
      violations.push(
        `${name} declares license ${JSON.stringify(declared)}, not "${spdx}".`,
      );
  }

  if (!(await read(resolve(root, "README.md")))?.includes(spdx))
    violations.push(`README.md does not name the licence (${spdx}).`);
  if (
    !(await read(resolve(root, "deploy/Dockerfile")))?.includes(
      `org.opencontainers.image.licenses="${spdx}"`,
    )
  )
    violations.push(
      `deploy/Dockerfile does not label the image with org.opencontainers.image.licenses="${spdx}".`,
    );
  return violations;
}
