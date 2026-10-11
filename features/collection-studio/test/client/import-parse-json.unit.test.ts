import { collectionLimits } from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import {
  parseJsonImport,
  type ParsedImport,
} from "../../src/client/import-parse.ts";

const rowsOf = (parsed: ParsedImport) => {
  if (parsed.kind !== "rows") throw new Error(parsed.message);
  return parsed.rows;
};
const problemOf = (parsed: ParsedImport) => {
  if (parsed.kind !== "file-problem") throw new Error("expected a problem");
  return parsed.message;
};

describe("reading a JSON list of items", () => {
  it("reads NFT-style metadata: attributes with trait_type, other fields ignored", () => {
    const rows = rowsOf(
      parseJsonImport(
        JSON.stringify([
          {
            attributes: [
              { trait_type: "Background", value: "Blue" },
              { trait: "Level", value: 5 },
              { trait_type: "Shiny", value: true },
            ],
            description: " Desc ",
            external_url: "https://example.test",
            image: "ipfs://cid/folder/one.png",
            name: " One ",
          },
        ]),
      ),
    );
    expect(rows).toEqual([
      {
        number: 1,
        ok: true,
        row: {
          attributes: [
            { trait: "Background", value: "Blue" },
            { trait: "Level", value: "5" },
            { trait: "Shiny", value: "true" },
          ],
          description: "Desc",
          imageFileName: "one.png",
          name: "One",
        },
      },
    ]);
  });

  it("reads traits written as a plain object, and treats missing fields as empty", () => {
    const [row] = rowsOf(
      parseJsonImport(
        JSON.stringify([
          { image: "a.png", name: "A", traits: { Eyes: "Open", Hat: 1 } },
        ]),
      ),
    );
    expect(row).toMatchObject({
      ok: true,
      row: {
        attributes: [
          { trait: "Eyes", value: "Open" },
          { trait: "Hat", value: "1" },
        ],
        description: "",
      },
    });
  });

  it.each([
    ["not json", "{", "not valid JSON"],
    ["an object", "{}", "list of items"],
    ["an empty list", "[]", "no items"],
  ])("refuses %s", (_why, text, message) => {
    expect(problemOf(parseJsonImport(text))).toContain(message);
  });

  it("says what is wrong with an item that is not shaped like one, and with a bad value", () => {
    const rows = rowsOf(
      parseJsonImport(
        JSON.stringify([
          { image: "a.png" },
          "text",
          { image: "a.png", name: "A", attributes: [{ trait_type: "X" }] },
          {
            image: "a.png",
            name: "",
            attributes: [{ trait_type: "X", value: "" }],
          },
          {
            image: "a.png",
            name: "Twice",
            attributes: [
              { trait_type: "X", value: "1" },
              { trait_type: "X", value: "2" },
            ],
          },
        ]),
      ),
    );
    expect(rows.map((row) => row.ok)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(rows[0]).toMatchObject({
      problems: [expect.stringContaining("needs a name and an image")],
    });
    expect(rows[3]).toMatchObject({
      problems: [
        expect.stringContaining("Enter a name"),
        expect.stringContaining("Each trait needs a name and a value"),
      ],
    });
  });

  it("treats an attribute without a trait name as one that needs fixing", () => {
    const [row] = rowsOf(
      parseJsonImport(
        JSON.stringify([
          { attributes: [{ value: "Blue" }], image: "a.png", name: "A" },
        ]),
      ),
    );
    expect(row).toMatchObject({
      ok: false,
      problems: [expect.stringContaining("Each trait needs a name")],
    });
  });

  it("refuses a list longer than one import takes", () => {
    const items = Array.from(
      { length: collectionLimits.importRows + 1 },
      () => ({
        image: "a.png",
        name: "A",
      }),
    );
    expect(problemOf(parseJsonImport(JSON.stringify(items)))).toContain(
      "Split it into several files",
    );
  });
});
