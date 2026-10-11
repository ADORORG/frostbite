import { importColumns, type ImportFormat } from "./import-parse.ts";

export interface ImportTemplate {
  readonly fileName: string;
  readonly mimeType: string;
  readonly text: string;
}

interface Example {
  readonly description: string;
  readonly image: string;
  readonly name: string;
  readonly traits: Readonly<Record<string, string>>;
}

const examples: readonly Example[] = [
  {
    description: "The first piece",
    image: "piece-1.png",
    name: "Piece one",
    traits: { Background: "Blue", Eyes: "Open" },
  },
  {
    description: "A second piece, with a comma in its description",
    image: "piece-2.png",
    name: "Piece two",
    traits: { Background: "Red", Eyes: "Closed" },
  },
];

// The traits the first example shows; every example gives each of them a value.
const traitNames = Object.keys(examples[0]?.traits ?? {});

// Quotes a cell when it holds the delimiter, a quote or a line break, so the example opens correctly.
const cell = (value: string) =>
  /[",\n\r]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

// A file the creator can fill in, in the format they chose. It is built from the same column names the
// reader accepts, so a template and the importer can never drift apart.
export function importTemplate(format: ImportFormat): ImportTemplate {
  if (format === "json")
    return {
      fileName: "items-template.json",
      mimeType: "application/json",
      text: `${JSON.stringify(
        examples.map(({ description, image, name, traits }) => ({
          attributes: Object.entries(traits).map(([trait_type, value]) => ({
            trait_type,
            value,
          })),
          description,
          image,
          name,
        })),
        null,
        2,
      )}\n`,
    };
  const header = [
    importColumns.name,
    importColumns.description,
    importColumns.image,
    ...traitNames.map((name) => `${importColumns.traitPrefix}${name}`),
  ];
  const lines = examples.map(({ description, image, name, traits }) => [
    name,
    description,
    image,
    ...traitNames.map((trait) => traits[trait] ?? ""),
  ]);
  return {
    fileName: "items-template.csv",
    mimeType: "text/csv",
    text: `${[header, ...lines].map((line) => line.map(cell).join(",")).join("\n")}\n`,
  };
}
