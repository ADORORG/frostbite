import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { ScaffoldError, scaffoldGame } from "./scaffold.ts";

// `pnpm game:new <id> [--title "My Game"]`: makes a new game from the template and registers it. A new game
// conforms to the platform's interface from the first minute; the author then replaces the rules.
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { title: { type: "string" } },
});
const [id] = positionals;
if (id === undefined || positionals.length > 1) {
  console.error('Usage: pnpm game:new <id> [--title "My Game"]');
  process.exit(2);
}
const root = resolve(import.meta.dirname, "../../..");
try {
  const { created } = await scaffoldGame({
    id,
    paths: {
      gamesDirectory: join(root, "games"),
      manifestDirectory: join(root, "configs/games"),
      registryFile: join(root, "configs/games.ts"),
      templateDirectory: join(root, "games/sample-game"),
      templateManifestFile: join(root, "configs/games/sample.ts"),
    },
    ...(values.title === undefined ? {} : { title: values.title }),
  });
  console.log(`Created:\n${created.map((path) => `  ${path}`).join("\n")}`);
  console.log(
    `\nNext:\n  1. pnpm install\n  2. pnpm --filter @game/${id} test:unit   (and test:integration)\n  3. Edit src/game.ts, index.html, src/main.ts and configs/games/${id}.ts\n  4. pnpm --filter web dev, then open /games/${id}\n  5. Open a pull request (see docs/product/game-onboarding.md)`,
  );
} catch (error) {
  if (!(error instanceof ScaffoldError)) throw error;
  console.error(error.message);
  process.exit(1);
}
