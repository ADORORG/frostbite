import { collectionLimits } from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import {
  formatOf,
  importFormats,
  parseCsvImport,
  parseImport,
  type ParsedImport,
} from "../../src/client/import-parse.ts";
import { importTemplate } from "../../src/client/import-template.ts";

const rowsOf = (parsed: ParsedImport) => {
  if (parsed.kind !== "rows") throw new Error(parsed.message);
  return parsed.rows;
};
const problemOf = (parsed: ParsedImport) => {
  if (parsed.kind !== "file-problem") throw new Error("expected a problem");
  return parsed.message;
};

describe("reading a CSV list of items", () => {
  it("reads name, description, image and trait columns, in any case and order", () => {
    const rows = rowsOf(
      parseCsvImport(
        "IMAGE, Name ,trait:Background,Description,trait: Eyes \nimages/one.png, One ,Blue,First,Open\n" +
          "two.png,Two,,,\n",
      ),
    );
    expect(rows).toEqual([
      {
        number: 1,
        ok: true,
        row: {
          attributes: [
            { trait: "Background", value: "Blue" },
            { trait: "Eyes", value: "Open" },
          ],
          description: "First",
          imageFileName: "one.png",
          name: "One",
        },
      },
      {
        number: 2,
        ok: true,
        row: {
          attributes: [],
          description: "",
          imageFileName: "two.png",
          name: "Two",
        },
      },
    ]);
  });

  it("explains a column it does not know, so a mistyped trait column is never dropped silently", () => {
    expect(
      problemOf(parseCsvImport("name,image,Background\nA,a.png,Blue")),
    ).toContain('The column "Background"');
  });

  it.each([
    ["", "The file is empty."],
    ["name,image", "The file has a header but no items."],
    ["name,description\nA,B", 'needs a "image" column'],
    ["image,description\na.png,B", 'needs a "name" column'],
    ["name,image,name\nA,a.png,B", 'column "name" appears twice'],
    ["name,image,trait:\nA,a.png,B", "needs a name after the colon"],
    ['name,image\n"A,a.png', "never closed"],
  ])("refuses the file %j", (text, message) => {
    expect(problemOf(parseCsvImport(text))).toContain(message);
  });

  it("refuses a file with more items than one import takes", () => {
    const lines = Array.from(
      { length: collectionLimits.importRows + 1 },
      (_, at) => `Item ${at},p${at}.png`,
    );
    expect(
      problemOf(parseCsvImport(`name,image\n${lines.join("\n")}`)),
    ).toContain("Split it into several files");
    const exactly = lines.slice(0, collectionLimits.importRows);
    expect(
      rowsOf(parseCsvImport(`name,image\n${exactly.join("\n")}`)),
    ).toHaveLength(collectionLimits.importRows);
  });

  it("says what is wrong with each bad row and still reads the good ones", () => {
    const rows = rowsOf(
      parseCsvImport(
        [
          "name,image,trait:A,trait:B",
          ",a.png,,",
          "Nameless image,,,",
          "Slash,folder/,,",
          `Long,${"x".repeat(300)}.png,,`,
          "Fine,fine.png,1,2",
          "Extra,extra.png,1,2,3",
        ].join("\n"),
      ),
    );
    expect(rows.map((row) => row.ok)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(rows[0]).toMatchObject({
      problems: [expect.stringContaining("Enter a name")],
    });
    expect(rows[1]).toMatchObject({
      problems: [expect.stringContaining("file name of the image")],
    });
    expect(rows[5]).toMatchObject({
      problems: [
        expect.stringContaining("more values than the file has columns"),
      ],
    });
  });

  it("reads a line with fewer values than columns as having nothing in the missing ones", () => {
    const [row] = rowsOf(parseCsvImport("name,image,trait:A\nOne,one.png"));
    expect(row).toMatchObject({ ok: true, row: { attributes: [] } });
  });

  it("says when a description is too long", () => {
    const [row] = rowsOf(
      parseCsvImport(
        `name,image,description\nOne,one.png,${"x".repeat(collectionLimits.itemDescription + 1)}`,
      ),
    );
    expect(row).toMatchObject({
      ok: false,
      problems: [expect.stringContaining("Keep the description")],
    });
  });

  it("refuses a trait named twice and an item with too many traits", () => {
    const wide = Array.from(
      { length: collectionLimits.attributesPerItem + 1 },
      (_, at) => `trait:T${at}`,
    );
    const [row] = rowsOf(
      parseCsvImport(
        `name,image,${wide.join(",")}\nA,a.png,${wide.map(() => "v").join(",")}`,
      ),
    );
    expect(row).toMatchObject({ ok: false });
    // The same trait cannot be named twice: columns differing only in case are the same trait.
    expect(
      problemOf(parseCsvImport("name,image,trait:A,TRAIT:a\nx,x.png,1,2")),
    ).toContain("appears twice");
  });

  it("reads a semicolon-separated file from a spreadsheet", () => {
    const [row] = rowsOf(parseCsvImport("name;image;trait:A\nOne;one.png;x"));
    expect(row).toMatchObject({ ok: true, row: { name: "One" } });
  });
});

describe("formats and templates", () => {
  it("takes the format from the file name", () => {
    expect(formatOf("Items.JSON")).toBe("json");
    expect(formatOf("items.csv")).toBe("csv");
    expect(formatOf("items.txt")).toBe("csv");
    expect(parseImport('[{"name":"A","image":"a.png"}]', "json").kind).toBe(
      "rows",
    );
    expect(parseImport("name,image\nA,a.png", "csv").kind).toBe("rows");
  });

  it.each(importFormats)("a %s template reads back as ready rows", (format) => {
    const template = importTemplate(format);
    const rows = rowsOf(parseImport(template.text, format));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.ok)).toBe(true);
    expect(rows[1]).toMatchObject({
      row: {
        attributes: [
          { trait: "Background", value: "Red" },
          { trait: "Eyes", value: "Closed" },
        ],
        description: "A second piece, with a comma in its description",
      },
    });
    expect(template.fileName.endsWith(format)).toBe(true);
  });
});
