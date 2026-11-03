import { readdirSync } from "node:fs";
import { join } from "node:path";

// The configuration modules this package exposes, by the name a consumer imports them under (`@repo/configs/<name>`): every `.ts` file in
// the package directory, and in `games/`, without its extension. Used to prove that each one is reachable through the package's exports.
export function listConfigModules(directory: string): readonly string[] {
  const names = (folder: string, prefix: string) =>
    readdirSync(join(directory, folder), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => `${prefix}${entry.name.slice(0, -".ts".length)}`);
  return [...names(".", ""), ...names("games", "games/")].sort();
}
