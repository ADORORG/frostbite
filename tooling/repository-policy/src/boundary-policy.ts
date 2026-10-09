import { readFile } from "node:fs/promises";
import { relative, sep } from "node:path";
import ts from "typescript";

const runtimeNeutralSharedImports = new Set(["@noble/hashes/sha2.js", "zod"]);

// Chain-family code and vendor SDKs (ADR-017 section 2). Everything outside the places below reaches
// a chain only through the neutral ports (`@ador/chain/ports`, `/registry`, `/adapter`) and
// `@ador/shared/chain`.
const familySpecificImports = [
  "@ador/chain/alkanes",
  "@ador/chain/bitcoin",
  "@ador/chain/bitcoin-alkanes",
  "bitcoinjs-lib",
];
const familySpecificPrefixes = ["@alkanes/", "@omnisat/"];

// Where family-specific imports are allowed: the chain package and its future provider home, the
// per-family wallet bridge (ADR-017 section 4), and the conformance tests that run real adapters.
// `packages/auth/` is a recorded exception: wallet-first sign-in still validates Bitcoin addresses
// directly and moves to the neutral address codec with the network-to-chain migration, which waits
// for the W2-10B wallet evidence (ADR-017 section 7). Remove it then.
const familyImportOwners = [
  "packages/auth/",
  "packages/chain/",
  "packages/test-kit/test/",
  "packages/wallet/",
  "providers/chain/",
];

function isFamilySpecific(imported: string): boolean {
  return (
    familySpecificImports.includes(imported) ||
    familySpecificPrefixes.some((prefix) => imported.startsWith(prefix))
  );
}

function moduleSpecifiers(
  contents: string,
  filename: string,
): readonly string[] {
  const source = ts.createSourceFile(
    filename,
    contents,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return specifiers;
}

function isSharedSource(relativePath: string): boolean {
  return relativePath.startsWith(["packages", "shared", "src", ""].join(sep));
}

export async function findBoundaryViolations(
  root: string,
  files: readonly string[],
): Promise<readonly string[]> {
  const violations: string[] = [];
  for (const file of files.filter((path) => /\.[cm]?[jt]sx?$/.test(path))) {
    const path = relative(root, file);
    const imports = moduleSpecifiers(await readFile(file, "utf8"), file);
    for (const imported of imports) {
      if (
        !imported.startsWith(".") &&
        (imported.includes("/src/") || imported.includes("/test/"))
      ) {
        violations.push(`${path} imports private module ${imported}.`);
      }
      if (
        isFamilySpecific(imported) &&
        !familyImportOwners.some((owner) =>
          path.startsWith(owner.replaceAll("/", sep)),
        )
      ) {
        violations.push(
          `${path} imports chain-family code ${imported}; use the neutral chain ports.`,
        );
      }
      if (
        isSharedSource(path) &&
        !imported.startsWith(".") &&
        !runtimeNeutralSharedImports.has(imported) &&
        !imported.startsWith("@ador/shared/")
      ) {
        violations.push(
          `${path} imports runtime-specific dependency ${imported}.`,
        );
      }
    }
  }
  return violations;
}
