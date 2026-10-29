import { describe, expect, it } from "vitest";

import { fieldsOf, refuse, tickNamed, withFields } from "../src/run-inputs.ts";

describe("checking an input", () => {
  it("refuses with a reason, and never throws", () => {
    expect(refuse("no")).toEqual({ ok: false, reason: "no" });
  });

  it("takes an object with exactly the named fields, and says what is wrong otherwise", () => {
    expect(fieldsOf({ a: 1, b: 2 }, ["a", "b"])).toEqual({ a: 1, b: 2 });
    expect(fieldsOf({ a: 1 }, ["a", "b"])).toBe(
      "the input takes exactly: a, b",
    );
    expect(fieldsOf({ a: 1, c: 2 }, ["a", "b"])).toBe(
      "the input takes exactly: a, b",
    );
    expect(fieldsOf({ a: 1, b: 2, c: 3 }, ["a", "b"])).toBe(
      "the input takes exactly: a, b",
    );
    expect(fieldsOf(undefined, ["a"])).toBe("the input takes an object");
    expect(fieldsOf(null, ["a"])).toBe("the input takes an object");
    expect(fieldsOf([1], ["a"])).toBe("the input takes an object");
    expect(fieldsOf(5, ["a"])).toBe("the input takes an object");
  });

  it("takes no fields for an input that carries none", () => {
    expect(fieldsOf({}, [])).toEqual({});
    expect(fieldsOf({ a: 1 }, [])).toBe("the input takes no fields");
  });

  it("takes a tick that is a whole number, within the run, and not already past", () => {
    expect(tickNamed(5, 3, 10)).toBe(5);
    expect(tickNamed(3, 3, 10)).toBe(3);
    expect(tickNamed(10, 3, 10)).toBe(10);
    expect(tickNamed(2, 3, 10)).toBe("tick 2 is already past");
    expect(tickNamed(11, 3, 10)).toBe("tick must be from 0 to 10");
    expect(tickNamed(-1, 0, 10)).toBe("tick must be from 0 to 10");
    expect(tickNamed(1.5, 0, 10)).toBe("tick must be a whole number");
    expect(tickNamed("5", 0, 10)).toBe("tick must be a whole number");
    expect(tickNamed(undefined, 0, 10)).toBe("tick must be a whole number");
  });

  it("acts on the fields only once they are right", () => {
    const act = (fields: Readonly<Record<string, unknown>>) => ({
      ok: true as const,
      state: fields,
    });
    expect(withFields({ a: 1 }, ["a"], act)).toEqual({
      ok: true,
      state: { a: 1 },
    });
    expect(withFields({ b: 1 }, ["a"], act)).toEqual({
      ok: false,
      reason: "the input takes exactly: a",
    });
  });
});
