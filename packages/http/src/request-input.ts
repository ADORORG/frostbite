import { readJsonBody } from "./json-body.ts";
import type { HttpOperation } from "./operation.ts";

// The longest query string a read is given. A read's input is a few identifiers and paging values; anything longer is refused
// before it is parsed, so the address of a request cannot be made to cost more than a body can.
export const maxQueryLength = 2_048;

// A GET's input from its query string: one text value per name. A name given twice is ambiguous (which one is meant, and which
// does a cache key on?), so it is `undefined`, as is a query that is too long; the operation's schema then refuses either as an
// invalid request, like a body that is not JSON. Turning the text into numbers or choices is the schema's work, not this one's.
export function readQueryInput(
  url: string,
): Readonly<Record<string, string>> | undefined {
  const { search } = new URL(url);
  if (search.length > maxQueryLength) return undefined;
  const entries = [...new URLSearchParams(search)];
  const names = new Set(entries.map(([name]) => name));
  return names.size === entries.length
    ? Object.fromEntries(entries)
    : undefined;
}

// The untrusted input of a request, as its operation says it is given: a read takes its query string (or nothing), anything else
// its JSON body.
export function readRequestInput(
  request: Request,
  input: HttpOperation<object, object>["input"],
): Promise<unknown> {
  if (request.method !== "GET") return readJsonBody(request);
  return Promise.resolve(input === "query" ? readQueryInput(request.url) : {});
}
