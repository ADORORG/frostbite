import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { embeddedGameAssetPath } from "@ador/shared/games";

// The kinds of picture the card renderer can draw. A cover in another format (AVIF, WebP) is left out of the card, which is then drawn
// without it, rather than failing the preview.
const drawable: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const sizeLimit = 2_000_000;

// A game's cover as a data address, or null when it is missing, too large or not a kind the renderer draws. The platform's static files
// are served from its `public` folder, next to the server; `id` and `file` come from a validated manifest, and the resolved path is
// still required to stay inside the game's own assets folder.
export async function readGameCover(
  id: string,
  file: string,
  publicRoot: string = path.join(process.cwd(), "public"),
): Promise<string | null> {
  const mime = drawable[path.extname(file).toLowerCase()];
  if (mime === undefined) return null;
  // The same address the page uses for the cover, so the file read is the file shown.
  const folder = path.resolve(
    publicRoot,
    embeddedGameAssetPath(id, "").slice(1),
  );
  const target = path.resolve(
    publicRoot,
    embeddedGameAssetPath(id, file).slice(1),
  );
  try {
    // What the name really resolves to (through any link) must be a file directly inside the game's assets folder.
    if (path.dirname(await realpath(target)) !== (await realpath(folder)))
      return null;
    const bytes = await readFile(target);
    if (bytes.byteLength > sizeLimit) return null;
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
