import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { findBoundaryViolations } from "../src/boundary-policy.ts";
import { listSourceFiles, physicalLineCount } from "../src/files.ts";
import { findOversizedFiles } from "../src/line-policy.ts";
import { findScriptPolicyViolations } from "../src/script-policy.ts";
import type { Workspace } from "../src/workspaces.ts";

const temporaryDirectories: string[] = [];

async function temporaryFile(
  relativePath: string,
  contents: string,
): Promise<[string, string]> {
  const root = await mkdtemp(resolve(tmpdir(), "repository-policy-"));
  temporaryDirectories.push(root);
  const path = resolve(root, relativePath);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, contents, "utf8");
  return [root, path];
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe("workspace script policy", () => {
  const completeScripts = {
    lint: "eslint .",
    typecheck: "tsc --noEmit",
    "test:unit": "vitest run unit",
    "test:integration": "vitest run integration",
    "test:coverage": "vitest run --coverage",
  };

  it("accepts real required scripts", () => {
    const workspace: Workspace = {
      directory: "/repo/app",
      name: "app",
      scripts: completeScripts,
    };
    expect(findScriptPolicyViolations([workspace])).toEqual([]);
  });

  it("rejects missing and no-op scripts", () => {
    const workspace: Workspace = {
      directory: "/repo/app",
      name: "app",
      scripts: {
        ...completeScripts,
        "test:unit": "vitest --passWithNoTests",
        typecheck: "",
      },
    };
    expect(findScriptPolicyViolations([workspace])).toEqual([
      "app is missing typecheck.",
      "app has a non-verifying test:unit script.",
    ]);
  });
});

describe("source policies", () => {
  it("rejects files above 300 physical lines", async () => {
    const [root, file] = await temporaryFile(
      "oversized.ts",
      "line\n".repeat(301),
    );
    await expect(findOversizedFiles(root, [file])).resolves.toEqual([
      "oversized.ts has 301 lines.",
    ]);
  });

  it("counts empty files and ignores generated directories", async () => {
    const [root, file] = await temporaryFile("empty.ts", "");
    await mkdir(resolve(root, "node_modules"));
    await writeFile(
      resolve(root, "node_modules/ignored.ts"),
      "line\n".repeat(400),
    );
    await writeFile(resolve(root, "notes.txt"), "not source");
    await expect(physicalLineCount(file)).resolves.toBe(0);
    await expect(listSourceFiles(root)).resolves.toEqual([file]);
  });

  it("rejects private and runtime-specific imports", async () => {
    const [root, file] = await temporaryFile(
      "packages/shared/src/auth.ts",
      'import Next from "next";\nexport { value } from "@frostbite/example/src/value";\n',
    );
    await expect(findBoundaryViolations(root, [file])).resolves.toEqual([
      "packages/shared/src/auth.ts imports runtime-specific dependency next.",
      "packages/shared/src/auth.ts imports private module @frostbite/example/src/value.",
      "packages/shared/src/auth.ts imports runtime-specific dependency @frostbite/example/src/value.",
    ]);
  });

  it("allows shared domains to import another public shared domain", async () => {
    const [root, file] = await temporaryFile(
      "packages/shared/src/features.ts",
      'import { httpMethodSchema } from "@frostbite/shared/http";\nvoid httpMethodSchema;\n',
    );
    await expect(findBoundaryViolations(root, [file])).resolves.toEqual([]);
  });

  it("allows only qualified runtime-neutral dependencies in shared source", async () => {
    const [root, file] = await temporaryFile(
      "packages/shared/src/hashing.ts",
      'import { sha256 } from "@noble/hashes/sha2.js";\nvoid sha256;\n',
    );
    await expect(findBoundaryViolations(root, [file])).resolves.toEqual([]);
  });

  it("keeps library and feature code off the database package root at runtime", async () => {
    const [root, source] = await temporaryFile(
      "packages/example/src/adapter.ts",
      'import { runMigrations } from "@frostbite/database";\nvoid runMigrations;\n',
    );
    await expect(findBoundaryViolations(root, [source])).resolves.toEqual([
      "packages/example/src/adapter.ts imports the database package root; import a subpath such as @frostbite/database/connection.",
    ]);
    const [featureRoot, feature] = await temporaryFile(
      "features/example/src/adapter.ts",
      'export { runMigrations } from "./local.ts";\nimport { runMigrations as run } from "@frostbite/database";\nvoid run;\n',
    );
    await expect(
      findBoundaryViolations(featureRoot, [feature]),
    ).resolves.toHaveLength(1);
  });

  it("allows the database root for types, subpaths, tests, apps, and test support", async () => {
    const allowed: readonly [string, string][] = [
      [
        "packages/example/src/types.ts",
        'import type { DatabaseClient } from "@frostbite/database";\nexport type Client = DatabaseClient;\n',
      ],
      [
        "packages/example/src/subpath.ts",
        'import { collections } from "@frostbite/database/schema/collections";\nvoid collections;\n',
      ],
      [
        "packages/example/test/support.ts",
        'import { runMigrations } from "@frostbite/database";\nvoid runMigrations;\n',
      ],
      [
        "apps/worker/src/runtime.ts",
        'import { createOutboxDeliveryStore } from "@frostbite/database";\nvoid createOutboxDeliveryStore;\n',
      ],
      [
        "packages/test-kit/src/seed.ts",
        'import { authUsers } from "@frostbite/database";\nvoid authUsers;\n',
      ],
    ];
    for (const [path, contents] of allowed) {
      const [root, file] = await temporaryFile(path, contents);
      await expect(findBoundaryViolations(root, [file])).resolves.toEqual([]);
    }
  });

  it("keeps chain-family code and vendor SDKs behind the adapter", async () => {
    const imports = [
      'import { validateBitcoinAddress } from "@frostbite/chain/bitcoin";',
      'import { createBitcoinAlkanesAdapter } from "@frostbite/chain/bitcoin-alkanes";',
      'import { address } from "bitcoinjs-lib";',
      'import { Provider } from "@alkanes/ts-sdk";',
      'import { useLaserEyes } from "@omnisat/lasereyes-react";',
    ];
    const [root, file] = await temporaryFile(
      "features/uploads/src/chain.ts",
      `${imports.join("\n")}\n`,
    );
    const violations = await findBoundaryViolations(root, [file]);
    expect(violations).toHaveLength(imports.length);
    expect(violations[0]).toBe(
      "features/uploads/src/chain.ts imports chain-family code @frostbite/chain/bitcoin; use the neutral chain ports.",
    );
  });

  it.each([
    "packages/chain/src/bitcoin-alkanes/adapter.ts",
    "packages/wallet/src/client/provider.tsx",
    "packages/auth/src/domain/contracts.ts",
    "packages/test-kit/test/chain-conformance.unit.test.ts",
    "providers/chain/bitcoin-alkanes/src/index.ts",
    "tooling/testnet-preflight/src/run.ts",
  ])("allows chain-family imports in %s", async (path) => {
    const [root, file] = await temporaryFile(
      path,
      'import { address } from "bitcoinjs-lib";\nvoid address;\n',
    );
    await expect(findBoundaryViolations(root, [file])).resolves.toEqual([]);
  });

  it("allows the neutral chain ports everywhere", async () => {
    const [root, file] = await temporaryFile(
      "features/collections/src/chain.ts",
      'import { createChainRegistry } from "@frostbite/chain/registry";\nimport type { AddressCodec } from "@frostbite/chain/ports";\nimport { chainRefSchema } from "@frostbite/shared/chain";\nvoid createChainRegistry;\nvoid chainRefSchema;\n',
    );
    await expect(findBoundaryViolations(root, [file])).resolves.toEqual([]);
  });
});
