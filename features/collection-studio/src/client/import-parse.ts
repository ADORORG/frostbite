import {
  collectionImportJsonItemSchema,
  collectionImportRowSchema,
  collectionLimits,
  type CollectionImportRow,
} from "@frostbite/shared/collections";

import { detectDelimiter, parseCsv } from "./csv.ts";
import { itemFieldMessages } from "./item-form.ts";

export const importFormats = ["csv", "json"] as const;
export type ImportFormat = (typeof importFormats)[number];

// Larger than any real list of a few hundred items, and below the size a request may have.
export const importFileMaxBytes = 1_000_000;

export const importColumns = {
  description: "description",
  image: "image",
  name: "name",
  traitPrefix: "trait:",
} as const;

// One item of the file: the row to send if it is acceptable, or what is wrong with it.
export type ParsedRow =
  | {
      readonly number: number;
      readonly ok: true;
      readonly row: CollectionImportRow;
    }
  | {
      readonly number: number;
      readonly ok: false;
      readonly problems: readonly string[];
    };

export type ParsedImport =
  | { readonly kind: "file-problem"; readonly message: string }
  | { readonly kind: "rows"; readonly rows: readonly ParsedRow[] };

const imageMessage =
  "Give the file name of the image, such as piece-1.png, as it was uploaded.";

const problem = (message: string): ParsedImport => ({
  kind: "file-problem",
  message,
});

// The part after the last folder separator, so "images/1.png" and "ipfs://cid/1.png" name "1.png".
const baseName = (path: string): string => path.trim().replace(/^.*[/\\]/u, "");

// What a candidate row's own values say is wrong, in the words used for a single item.
function check(number: number, candidate: object): ParsedRow {
  const parsed = collectionImportRowSchema.safeParse(candidate);
  if (parsed.success) return { number, ok: true, row: parsed.data };
  const fields = new Set(parsed.error.issues.map(({ path }) => path[0]));
  return {
    number,
    ok: false,
    problems: [
      ...(fields.has("name") ? [itemFieldMessages.name] : []),
      ...(fields.has("description") ? [itemFieldMessages.description] : []),
      ...(fields.has("imageFileName") ? [imageMessage] : []),
      ...(fields.has("attributes") ? [itemFieldMessages.attributes] : []),
    ],
  };
}

function tooLong(count: number): ParsedImport | null {
  return count > collectionLimits.importRows
    ? problem(
        `A file can hold up to ${collectionLimits.importRows} items and this one has ${count}. Split it into several files.`,
      )
    : null;
}

const unknownColumn = (name: string) =>
  `The column "${name}" is not one of name, description, image, or a trait column written as ${importColumns.traitPrefix} and the trait name, such as ${importColumns.traitPrefix}Background.`;

// What each column of the header holds. Trait columns carry the trait's name, taken from the header.
type Column =
  | { readonly kind: "description" }
  | { readonly kind: "image" }
  | { readonly kind: "name" }
  | { readonly kind: "trait"; readonly trait: string };

function readHeader(
  header: readonly string[],
): { readonly columns: readonly Column[] } | { readonly message: string } {
  const columns: Column[] = [];
  const seen = new Set<string>();
  for (const cell of header) {
    const written = cell.trim();
    const name = written.toLowerCase();
    if (seen.has(name))
      return { message: `The column "${name}" appears twice.` };
    seen.add(name);
    if (name === importColumns.name) columns.push({ kind: "name" });
    else if (name === importColumns.description)
      columns.push({ kind: "description" });
    else if (name === importColumns.image) columns.push({ kind: "image" });
    else if (name.startsWith(importColumns.traitPrefix)) {
      const trait = written.slice(importColumns.traitPrefix.length).trim();
      if (trait === "")
        return { message: "A trait column needs a name after the colon." };
      columns.push({ kind: "trait", trait });
    } else return { message: unknownColumn(written) };
  }
  for (const required of [importColumns.name, importColumns.image])
    if (!seen.has(required))
      return { message: `The file needs a "${required}" column.` };
  return { columns };
}

export function parseCsvImport(text: string): ParsedImport {
  const parsed = parseCsv(text, detectDelimiter(text));
  if (parsed.kind === "unterminated-quote")
    return problem(
      "A quoted value is never closed. Check the quotation marks.",
    );
  const [header, ...lines] = parsed.rows;
  if (header === undefined) return problem("The file is empty.");
  const read = readHeader(header);
  if ("message" in read) return problem(read.message);
  const { columns } = read;
  if (lines.length === 0) return problem("The file has a header but no items.");
  const long = tooLong(lines.length);
  if (long !== null) return long;
  return {
    kind: "rows",
    rows: lines.map((cells, at) => {
      const attributes: { trait: string; value: string }[] = [];
      const candidate = {
        attributes,
        description: "",
        imageFileName: "",
        name: "",
      };
      for (const [index, column] of columns.entries()) {
        const value = (cells[index] ?? "").trim();
        if (column.kind === "name") candidate.name = value;
        else if (column.kind === "description") candidate.description = value;
        else if (column.kind === "image")
          candidate.imageFileName = baseName(value);
        else if (value !== "") attributes.push({ trait: column.trait, value });
      }
      const extra = cells.length > columns.length;
      return extra
        ? {
            number: at + 1,
            ok: false,
            problems: ["This line has more values than the file has columns."],
          }
        : check(at + 1, candidate);
    }),
  };
}

export function parseJsonImport(text: string): ParsedImport {
  let document: unknown;
  try {
    // `unknown` is what parsing untrusted text yields; it is accepted only through the schema below.
    document = JSON.parse(text);
  } catch {
    return problem("The file is not valid JSON.");
  }
  if (!Array.isArray(document))
    return problem(
      "The file should be a list of items, written between [ and ].",
    );
  if (document.length === 0) return problem("The list has no items.");
  const long = tooLong(document.length);
  if (long !== null) return long;
  return {
    kind: "rows",
    rows: document.map((entry: unknown, at): ParsedRow => {
      const item = collectionImportJsonItemSchema.safeParse(entry);
      if (!item.success)
        return {
          number: at + 1,
          ok: false,
          problems: [
            "Each item needs a name and an image, as text, and its traits as a list of trait_type and value.",
          ],
        };
      const { attributes = [], traits = {} } = item.data;
      return check(at + 1, {
        attributes: [
          ...attributes.map(({ trait, trait_type, value }) => ({
            trait: (trait ?? trait_type ?? "").trim(),
            value: value.trim(),
          })),
          ...Object.entries(traits).map(([trait, value]) => ({
            trait: trait.trim(),
            value: value.trim(),
          })),
        ].filter(({ trait, value }) => trait !== "" || value !== ""),
        description: (item.data.description ?? "").trim(),
        imageFileName: baseName(item.data.image),
        name: item.data.name.trim(),
      });
    }),
  };
}

// The format a file is in, from its name: `.json` is JSON, anything else is read as CSV.
export function formatOf(fileName: string): ImportFormat {
  return fileName.toLowerCase().endsWith(".json") ? "json" : "csv";
}

export const parseImport = (
  text: string,
  format: ImportFormat,
): ParsedImport =>
  format === "json" ? parseJsonImport(text) : parseCsvImport(text);
