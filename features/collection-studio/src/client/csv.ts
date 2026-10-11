export type CsvResult =
  | { readonly kind: "rows"; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: "unterminated-quote" };

// Spreadsheets often start a file with this character; it is not part of the first cell.
const byteOrderMark = String.fromCharCode(0xfeff);

const delimiters = [",", ";", "\t"] as const;
export type CsvDelimiter = (typeof delimiters)[number];

// The delimiter a spreadsheet used: comma, or semicolon where a comma is the decimal mark, or tab. It is
// read from the first line (outside quotes) as the one that occurs most, and is a comma when none does.
export function detectDelimiter(text: string): CsvDelimiter {
  const counts = new Map<CsvDelimiter, number>();
  let quoted = false;
  for (const character of text) {
    if (character === '"') quoted = !quoted;
    else if (!quoted && (character === "\n" || character === "\r")) break;
    else if (!quoted)
      for (const delimiter of delimiters)
        if (character === delimiter)
          counts.set(delimiter, (counts.get(delimiter) ?? 0) + 1);
  }
  let best: CsvDelimiter = ",";
  let bestCount = 0;
  for (const delimiter of delimiters) {
    const count = counts.get(delimiter) ?? 0;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

// Rows of cells as RFC 4180 describes them: a cell may be quoted to hold the delimiter, a line break or
// a quote (written twice), and lines end with LF, CRLF or CR. A leading byte-order mark is dropped and
// lines with nothing on them are skipped. Cells are returned exactly as written, not trimmed.
export function parseCsv(text: string, delimiter: CsvDelimiter): CsvResult {
  const source = text.startsWith(byteOrderMark) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let wasQuoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
    wasQuoted = false;
  };
  const endRow = () => {
    endCell();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  for (let at = 0; at < source.length; at += 1) {
    const character = source.charAt(at);
    if (quoted) {
      if (character !== '"') cell += character;
      else if (source.charAt(at + 1) === '"') {
        cell += '"';
        at += 1;
      } else quoted = false;
    } else if (character === '"' && cell === "" && !wasQuoted) {
      quoted = true;
      wasQuoted = true;
    } else if (character === delimiter) endCell();
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && source.charAt(at + 1) === "\n") at += 1;
      endRow();
    } else cell += character;
  }
  if (quoted) return { kind: "unterminated-quote" };
  if (cell !== "" || row.length > 0 || wasQuoted) endRow();
  return { kind: "rows", rows };
}
