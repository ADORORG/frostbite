import { refuse, type DrawingPolicy, type Failure } from "./policy.ts";

// A drawing is read as a strict subset of XML: elements with quoted attributes, and nothing else. There is no text, comment,
// CDATA, processing instruction, doctype or entity, and the characters are printable ASCII. Anything outside that subset is
// refused, not repaired, so what remains has only one reading.
export interface XmlElement {
  readonly attributes: readonly (readonly [string, string])[];
  readonly children: readonly XmlElement[];
  readonly name: string;
}

export type ParseResult =
  { readonly ok: true; readonly root: XmlElement } | Failure;

const allowedCharacters = /^[\t\n\r\x20-\x7e]*$/u;
const nameStart = /[A-Za-z]/u;
const nameRest = /[A-Za-z0-9-]/u;
const space = /[\t\n\r ]/u;

class Reader {
  position = 0;
  elements = 0;

  constructor(
    readonly text: string,
    readonly policy: DrawingPolicy,
  ) {}

  more(): boolean {
    return this.position < this.text.length;
  }

  peek(length = 1): string {
    return this.text.slice(this.position, this.position + length);
  }

  skipSpace(): void {
    while (this.more() && space.test(this.text[this.position] ?? ""))
      this.position += 1;
  }

  name(): string | null {
    const start = this.position;
    if (!nameStart.test(this.text[this.position] ?? "")) return null;
    this.position += 1;
    while (this.more() && nameRest.test(this.text[this.position] ?? ""))
      this.position += 1;
    return this.text.slice(start, this.position);
  }
}

type Step<T> = { readonly ok: true; readonly value: T } | Failure;

function malformed(detail: string): Failure {
  return refuse("malformed", detail);
}

function attribute(reader: Reader): Step<readonly [string, string]> {
  const name = reader.name();
  if (name === null) return malformed("An attribute name is not a plain word.");
  if (reader.peek() !== "=")
    return malformed(`Attribute ${name} has no value.`);
  reader.position += 1;
  const quote = reader.peek();
  if (quote !== '"' && quote !== "'")
    return malformed(`Attribute ${name} is not quoted.`);
  reader.position += 1;
  const end = reader.text.indexOf(quote, reader.position);
  if (end === -1) return malformed(`Attribute ${name} is never closed.`);
  const value = reader.text.slice(reader.position, end);
  reader.position = end + 1;
  if (value.length > reader.policy.maxAttributeLength) {
    return refuse("too-complex", `Attribute ${name} is longer than the limit.`);
  }
  if (value.includes("<")) return malformed(`Attribute ${name} contains "<".`);
  if (value.includes("&")) {
    return refuse("forbidden-markup", "Entities are not allowed.");
  }
  return { ok: true, value: [name, value] };
}

function element(reader: Reader, depth: number): Step<XmlElement> {
  if (depth > reader.policy.maxDepth) {
    return refuse("too-complex", "The drawing is nested too deeply.");
  }
  reader.elements += 1;
  if (reader.elements > reader.policy.maxElements) {
    return refuse("too-complex", "The drawing has too many elements.");
  }
  if (reader.peek() !== "<")
    return malformed("Text is not allowed between elements.");
  if (reader.peek(2) === "<!" || reader.peek(2) === "<?") {
    return refuse(
      "forbidden-markup",
      "Comments, CDATA, doctypes and instructions are not allowed.",
    );
  }
  reader.position += 1;
  const name = reader.name();
  if (name === null) return malformed("An element name is not a plain word.");
  const attributes: (readonly [string, string])[] = [];
  for (;;) {
    reader.skipSpace();
    if (reader.peek(2) === "/>") {
      reader.position += 2;
      return { ok: true, value: { attributes, children: [], name } };
    }
    if (reader.peek() === ">") {
      reader.position += 1;
      break;
    }
    const read = attribute(reader);
    if (!read.ok) return read;
    if (attributes.some(([existing]) => existing === read.value[0])) {
      return malformed(`Attribute ${read.value[0]} is repeated.`);
    }
    attributes.push(read.value);
  }
  const children: XmlElement[] = [];
  for (;;) {
    reader.skipSpace();
    if (!reader.more()) return malformed(`Element ${name} is never closed.`);
    if (reader.peek(2) === "</") {
      reader.position += 2;
      const closing = reader.name();
      reader.skipSpace();
      if (closing !== name || reader.peek() !== ">") {
        return malformed(`Element ${name} is closed by something else.`);
      }
      reader.position += 1;
      return { ok: true, value: { attributes, children, name } };
    }
    const child = element(reader, depth + 1);
    if (!child.ok) return child;
    children.push(child.value);
  }
}

export function parseSubset(text: string, policy: DrawingPolicy): ParseResult {
  if (!allowedCharacters.test(text)) {
    return refuse("forbidden-character", "Only printable ASCII is allowed.");
  }
  const reader = new Reader(text, policy);
  reader.skipSpace();
  if (!reader.more()) return refuse("missing-root", "The drawing is empty.");
  const root = element(reader, 1);
  if (!root.ok) return root;
  reader.skipSpace();
  if (reader.more()) return malformed("There is content after the drawing.");
  return { ok: true, root: root.value };
}
