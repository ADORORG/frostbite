import { describe, expect, it } from "vitest";

import { detectDelimiter, parseCsv } from "../../src/client/csv.ts";

const rowsOf = (text: string, delimiter: "," | ";" | "\t" = ",") => {
  const parsed = parseCsv(text, delimiter);
  if (parsed.kind !== "rows") throw new Error(parsed.kind);
  return parsed.rows;
};

const byteOrderMark = String.fromCharCode(0xfeff);

describe("reading CSV", () => {
  it("reads cells and rows with any line ending, and ignores a final empty line", () => {
    expect(rowsOf("a,b\n1,2\r\n3,4\r5,6\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("reads quoted cells with the delimiter, a line break and doubled quotes inside", () => {
    expect(
      rowsOf('name,note\n"Smith, J","two\nlines"\n"say ""hi""",x'),
    ).toEqual([
      ["name", "note"],
      ["Smith, J", "two\nlines"],
      ['say "hi"', "x"],
    ]);
  });

  it("drops a byte-order mark and keeps spaces exactly as written", () => {
    expect(rowsOf(`${byteOrderMark}a, b\n 1 ,2`)).toEqual([
      ["a", " b"],
      [" 1 ", "2"],
    ]);
  });

  it("keeps an empty cell, and a row that is only empty cells", () => {
    expect(rowsOf("a,b,c\n,,\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["", "", ""],
      ["1", "", "3"],
    ]);
  });

  it("treats a quote in the middle of a cell as a character, not a quote", () => {
    expect(rowsOf('5" nails,x')).toEqual([['5" nails', "x"]]);
  });

  it("reports a quote that is never closed, and reads an empty text as no rows", () => {
    expect(parseCsv('a,"b\nc', ",")).toEqual({ kind: "unterminated-quote" });
    expect(rowsOf("")).toEqual([]);
    expect(rowsOf('a,""')).toEqual([["a", ""]]);
  });

  it("reads the delimiter the file uses", () => {
    expect(rowsOf("a;b\n1;2", ";")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(detectDelimiter("name;image;trait:A\nx;y;z")).toBe(";");
    expect(detectDelimiter("name\timage\nx\ty")).toBe("\t");
    expect(detectDelimiter("name,image,trait:A")).toBe(",");
    expect(detectDelimiter("name")).toBe(",");
    // Delimiters inside quotes, or in later lines, do not decide it.
    expect(detectDelimiter('"a;b;c",d\n1;2;3')).toBe(",");
  });
});
