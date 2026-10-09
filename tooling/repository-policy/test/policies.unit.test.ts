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
      'import Next from "next";\nexport { value } from "@ador/example/src/value";\n',
    );
    await expect(findBoundaryViolations(root, [file])).resolves.toEqual([
      "packages/shared/src/auth.ts imports runtime-specific dependency next.",
      "packages/shared/src/auth.ts imports private module @ador/example/src/value.",
      "packages/shared/src/auth.ts imports runtime-specific dependency @ador/example/src/value.",
    ]);
  });

  it("allows shared domains to import another public shared domain", async () => {
    const [root, file] = await temporaryFile(
      "packages/shared/src/features.ts",
      'import { httpMethodSchema } from "@ador/shared/http";\nvoid httpMethodSchema;\n',
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

  it("keeps chain-family code and vendor SDKs behind the adapter", async () => {
    const imports = [
      'import { validateBitcoinAddress } from "@ador/chain/bitcoin";',
      'import { createBitcoinAlkanesAdapter } from "@ador/chain/bitcoin-alkanes";',
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
      "features/uploads/src/chain.ts imports chain-family code @ador/chain/bitcoin; use the neutral chain ports.",
    );
  });

  it.each([
    "packages/chain/src/bitcoin-alkanes/adapter.ts",
    "packages/wallet/src/client/provider.tsx",
    "packages/auth/src/domain/contracts.ts",
    "packages/test-kit/test/chain-conformance.unit.test.ts",
    "providers/chain/bitcoin-alkanes/src/index.ts",
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
      'import { createChainRegistry } from "@ador/chain/registry";\nimport type { AddressCodec } from "@ador/chain/ports";\nimport { chainRefSchema } from "@ador/shared/chain";\nvoid createChainRegistry;\nvoid chainRefSchema;\n',
    );
    await expect(findBoundaryViolations(root, [file])).resolves.toEqual([]);
  });
});
