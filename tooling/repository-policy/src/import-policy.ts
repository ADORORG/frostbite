import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";

// An import that climbs three or more folders (`../../../x`) is hard to follow and breaks when a file moves. Reach other workspaces by their
// package name (`@repo/configs/games`, `@ador/auth/test-fixtures`) and files inside the web app by `@/`.
export const maximumParentSegments = 2;

// The only deep relative imports left, each with the reason it cannot be a package import. An entry is removed when its reason goes.
export const allowedDeepImports: Readonly<Record<string, string>> = {
  "apps/web/test/rewards-policy.unit.test.ts":
    "Reads the released contract hashes (a JSON file in the Rust template tree, which is not a package).",
  "packages/wallet/test/fixtures/next-app/app/page.tsx":
    "A Next.js app fixture that exercises this package's own source before it is built.",
};

const scripted = new Set([".js", ".mjs", ".ts", ".tsx"]);
const deepImport = new RegExp(
  `(?:from|import|mock|require)\\s*\\(?\\s*["'](?:\\.\\./){${String(maximumParentSegments + 1)},}`,
  "u",
);

export function hasDeepRelativeImport(source: string): boolean {
  return source.split("\n").some((line) => deepImport.test(line));
}

export async function findDeepRelativeImports(
  root: string,
  files: readonly string[],
): Promise<readonly string[]> {
  const violations: string[] = [];
  for (const file of files) {
    if (!scripted.has(extname(file))) continue;
    const name = relative(root, file);
    if (name in allowedDeepImports) continue;
    if (hasDeepRelativeImport(await readFile(file, "utf8")))
      violations.push(
        `${name} imports a file through three or more "../"; use a package name or "@/".`,
      );
  }
  return violations;
}
