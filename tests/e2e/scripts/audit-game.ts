import { auditGameDirectory } from "../src/game-hosting.ts";

// Screens a game's files for what stops one build serving both hosting styles:
//   pnpm --filter @repo/e2e audit:game -- <path to the game's folder>
// Prints each address that starts at the root of the host, and the other hosts the game loads from. Exits 1
// when there is a root address.
const [directory] = process.argv
  .slice(2)
  .filter((argument) => argument !== "--");
if (directory === undefined) {
  console.error("Usage: audit:game -- <path to the game's folder>");
  process.exit(2);
}
const { externalHosts, rootAddresses } = await auditGameDirectory(directory);
for (const { file, line, reference } of rootAddresses)
  console.log(`root address  ${file}:${String(line)}  ${reference}`);
for (const host of externalHosts) console.log(`loads from    ${host}`);
console.log(
  rootAddresses.length === 0
    ? "No root addresses found."
    : `${String(rootAddresses.length)} root address(es) will break under a base path.`,
);
process.exit(rootAddresses.length === 0 ? 0 : 1);
