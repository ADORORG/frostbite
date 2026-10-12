import {
  cp,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { gameIdSchema, gameManifestLimits } from "@ador/shared/games";

// Where the pieces of a game live, so the same code works on the repository and on a copy of it in a test.
export interface ScaffoldPaths {
  // `configs/games`, where each game's manifest is written.
  readonly manifestDirectory: string;
  // `configs/games.ts`, the one place games are registered.
  readonly registryFile: string;
  // The game to copy: `games/sample-game`, and its manifest, `configs/games/sample.ts`.
  readonly templateDirectory: string;
  readonly templateManifestFile: string;
  // `games`, where the new folder is made.
  readonly gamesDirectory: string;
}

// The sample game's identifiers, replaced in everything copied from it.
const templateId = "sample-game";
const templateTitle = "Tap Tower";
const templateExport = "sampleGame";
const importAnchor = "// game:new adds imports above this line.";
const gameAnchor = "// game:new adds games above this line.";
// Never copied: what a build, a test run or an install leaves in a game's folder.
const notCopied = new Set(["node_modules", "coverage", ".turbo", "dist"]);

export class ScaffoldError extends Error {}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

// `my-game` -> `myGame`, the name the manifest is exported under.
export function exportNameOf(id: string): string {
  return `${id.replace(/-([a-z0-9])/gu, (_, letter: string) => letter.toUpperCase())}Game`;
}

// `my-game` -> `My Game`, the default title until the author writes a real one.
export function titleOf(id: string): string {
  return id
    .split("-")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

async function textFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await textFiles(path)));
    else if (/\.(?:ts|html|css|json|md|mjs)$/u.test(entry.name))
      found.push(path);
  }
  return found;
}

// Makes a new game from the template and registers it, so the author starts from a game that already
// conforms. It changes only what a new game needs: a folder, a manifest and the two registry lines. It refuses
// rather than overwrite, and checks every input before it writes anything.
export async function scaffoldGame(options: {
  readonly id: string;
  readonly paths: ScaffoldPaths;
  readonly title?: string;
}): Promise<{ readonly created: readonly string[] }> {
  const { paths } = options;
  const id = gameIdSchema.safeParse(options.id);
  if (!id.success)
    throw new ScaffoldError(
      `"${options.id}" is not a game id: use lower-case words joined by hyphens, 2 to 64 characters.`,
    );
  const title = (options.title ?? titleOf(id.data)).trim();
  if (title.length === 0 || title.length > gameManifestLimits.title)
    throw new ScaffoldError(
      `The title must be 1 to ${String(gameManifestLimits.title)} characters.`,
    );
  if (id.data === templateId)
    throw new ScaffoldError(`"${templateId}" is the template itself.`);
  const folder = join(paths.gamesDirectory, id.data);
  const manifestFile = join(paths.manifestDirectory, `${id.data}.ts`);
  for (const path of [folder, manifestFile])
    if (await exists(path))
      throw new ScaffoldError(`${path} already exists; nothing was changed.`);
  const registry = await readFile(paths.registryFile, "utf8");
  for (const anchor of [importAnchor, gameAnchor])
    if (!registry.includes(anchor))
      throw new ScaffoldError(
        `The registry has no line "${anchor}"; nothing was changed.`,
      );
  const exportName = exportNameOf(id.data);
  if (
    registry.includes(`${exportName},`) ||
    registry.includes(`{ ${exportName} }`)
  )
    throw new ScaffoldError(
      `A game named ${exportName} is already registered.`,
    );
  const templateManifest = await readFile(paths.templateManifestFile, "utf8");

  const rename = (text: string) =>
    text
      .replaceAll(templateId, id.data)
      .replaceAll(templateTitle, title)
      .replaceAll(templateExport, exportName);

  await cp(paths.templateDirectory, folder, {
    filter: (source) => !notCopied.has(source.split("/").pop() ?? ""),
    recursive: true,
  });
  for (const file of await textFiles(folder))
    await writeFile(file, rename(await readFile(file, "utf8")));
  await writeFile(
    join(folder, "README.md"),
    `# ${title}\n\nStarted from the template (\`games/${templateId}\`). Replace the rules in \`src/game.ts\`, the page\nin \`index.html\` and \`src/main.ts\`, and the milestones in \`configs/games/${id.data}.ts\`, then see\n\`docs/product/game-onboarding.md\`.\n\nTest commands: \`pnpm --filter @game/${id.data} test:unit\`, \`test:integration\`, \`test:coverage\`.\n`,
  );
  await mkdir(paths.manifestDirectory, { recursive: true });
  // The template's own comment is about the sample game, so it is replaced, not renamed.
  const manifestBody = templateManifest.slice(
    templateManifest.indexOf("export const"),
  );
  await writeFile(
    manifestFile,
    rename(
      templateManifest.slice(0, templateManifest.indexOf("// ")) +
        `// ${title}, started from the template. Replace the description, summary and milestones; a milestone's id\n// must be one the game's code asks the platform to unlock.\n${manifestBody}`,
    ),
  );
  await writeFile(
    paths.registryFile,
    registry
      .replace(
        importAnchor,
        `import { ${exportName} } from "./games/${id.data}.ts";\n${importAnchor}`,
      )
      .replace(gameAnchor, `${exportName},\n  ${gameAnchor}`),
  );
  return { created: [folder, manifestFile] };
}
