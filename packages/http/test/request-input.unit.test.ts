import { describe, expect, it } from "vitest";

import {
  maxQueryLength,
  readQueryInput,
  readRequestInput,
} from "../src/request-input.ts";

const at = (search: string) => `https://launch.example/api/v1/x${search}`;

describe("reading a GET's query string", () => {
  it("is one text value per name, decoded", () => {
    expect(readQueryInput(at("?claimId=a%20b&n=2&flag="))).toEqual({
      claimId: "a b",
      flag: "",
      n: "2",
    });
  });

  it("is empty where there is no query", () => {
    expect(readQueryInput(at(""))).toEqual({});
    expect(readQueryInput(at("?"))).toEqual({});
  });

  it("refuses a name given twice, which would leave it unclear which is meant", () => {
    expect(readQueryInput(at("?a=1&a=2"))).toBeUndefined();
    expect(readQueryInput(at("?a=1&b=2&a=1"))).toBeUndefined();
  });

  it("accepts a query of exactly the limit and refuses one a character over", () => {
    const fill = (length: number) => `?q=${"x".repeat(length - 3)}`;
    expect(readQueryInput(at(fill(maxQueryLength)))?.q).toHaveLength(
      maxQueryLength - 3,
    );
    expect(readQueryInput(at(fill(maxQueryLength + 1)))).toBeUndefined();
  });

  it("keeps a name that looks like an object's own as plain data", () => {
    const input = readQueryInput(at("?__proto__=x"));
    expect(Object.keys(input ?? {})).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(input)).toBe(Object.prototype);
  });
});

describe("the input of a request", () => {
  const get = (search = "") => new Request(at(search));

  it("is the query string for a GET that reads one", async () => {
    expect(await readRequestInput(get("?id=7"), "query")).toEqual({ id: "7" });
    expect(await readRequestInput(get("?id=7&id=8"), "query")).toBeUndefined();
  });

  it("is nothing for a GET that takes no input, whatever its query holds", async () => {
    expect(await readRequestInput(get("?id=7"), "none")).toEqual({});
    expect(await readRequestInput(get("?id=7"), "json")).toEqual({});
  });

  it("is the JSON body for anything else, and a query string is not read", async () => {
    const post = new Request(at("?id=7"), {
      body: '{"a":1}',
      method: "POST",
    });
    expect(await readRequestInput(post, "query")).toEqual({ a: 1 });
  });
});
