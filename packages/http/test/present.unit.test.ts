import { describe, expect, it } from "vitest";

import {
  entityTag,
  matchesEntityTag,
  presentResponse,
  type PresentContext,
} from "../src/present.ts";
import type { HttpAdapterResponse } from "../src/operation.ts";

const correlationId = "018f47f0-7b5c-7c5b-8d56-43d493d8f001";
const answer = (body: object, status = 200): HttpAdapterResponse<object> => ({
  body,
  effects: [],
  headers: { "x-correlation-id": correlationId },
  status,
});
const context = (over: Partial<PresentContext> = {}): PresentContext => ({
  cache: { kind: "revalidate" },
  file: false,
  ifNoneMatch: undefined,
  scope: "private",
  ...over,
});
const text = (body: Uint8Array | null) =>
  body === null ? null : new TextDecoder().decode(body);

describe("naming a body", () => {
  it("is the same for the same bytes and different for any other", () => {
    const a = new TextEncoder().encode("a");
    expect(entityTag(a)).toBe(entityTag(new TextEncoder().encode("a")));
    expect(entityTag(a)).not.toBe(entityTag(new TextEncoder().encode("b")));
    expect(entityTag(a)).toMatch(/^"[A-Za-z0-9_-]{43}"$/u);
  });

  it("is matched by an If-None-Match that lists it, weakly, or by *", () => {
    expect(matchesEntityTag('"a"', '"a"')).toBe(true);
    expect(matchesEntityTag('"x", "a"', '"a"')).toBe(true);
    expect(matchesEntityTag('W/"a"', '"a"')).toBe(true);
    expect(matchesEntityTag("*", '"a"')).toBe(true);
    expect(matchesEntityTag('"b"', '"a"')).toBe(false);
    expect(matchesEntityTag("", '"a"')).toBe(false);
  });
});

describe("presenting a successful read", () => {
  it("sends the JSON with a tag, the policy, and says it depends on who asks when it does", () => {
    const sent = presentResponse(answer({ n: 1 }), context());
    expect(sent.status).toBe(200);
    expect(text(sent.body)).toBe('{"n":1}');
    expect(sent.headers).toMatchObject({
      "cache-control": "private, no-cache",
      "content-type": "application/json",
      etag: entityTag(new TextEncoder().encode('{"n":1}')),
      vary: "Cookie",
      "x-content-type-options": "nosniff",
      "x-correlation-id": correlationId,
    });
  });

  it("says nothing of who asks, and may be shared, for an answer that is for everyone", () => {
    const sent = presentResponse(
      answer({ n: 1 }),
      context({ scope: "public" }),
    );
    expect(sent.headers["cache-control"]).toBe("public, no-cache");
    expect(sent.headers).not.toHaveProperty("vary");
  });

  it("answers unchanged, with no body, when the browser already holds exactly this", () => {
    const tag = entityTag(new TextEncoder().encode('{"n":1}'));
    const sent = presentResponse(
      answer({ n: 1 }),
      context({ ifNoneMatch: tag }),
    );
    expect(sent.status).toBe(304);
    expect(sent.body).toBeNull();
    expect(sent.headers).toEqual({
      "cache-control": "private, no-cache",
      etag: tag,
      vary: "Cookie",
      "x-correlation-id": correlationId,
    });
  });

  it("sends the whole answer when what the browser holds is out of date", () => {
    const stale = entityTag(new TextEncoder().encode('{"n":0}'));
    const sent = presentResponse(
      answer({ n: 1 }),
      context({ ifNoneMatch: stale }),
    );
    expect(sent.status).toBe(200);
    expect(text(sent.body)).toBe('{"n":1}');
  });

  it("gives the lifetime when the policy has one", () => {
    const sent = presentResponse(
      answer({ n: 1 }),
      context({ cache: { kind: "max-age", seconds: 60 } }),
    );
    expect(sent.headers["cache-control"]).toBe("private, max-age=60");
  });
});

describe("presenting what must not be kept", () => {
  it.each([
    [
      "an operation that says no-store",
      context({ cache: { kind: "no-store" } }),
    ],
    ["an operation with no policy (a write)", context({ cache: undefined })],
  ])(
    "keeps nothing for %s, even if the browser asks if it changed",
    (_, kept) => {
      const sent = presentResponse(answer({ n: 1 }), {
        ...kept,
        ifNoneMatch: "*",
      });
      expect(sent.status).toBe(200);
      expect(sent.headers["cache-control"]).toBe("no-store");
      expect(sent.headers).not.toHaveProperty("etag");
      expect(text(sent.body)).toBe('{"n":1}');
    },
  );

  it("keeps no error, whatever the policy", () => {
    const sent = presentResponse(
      answer({ error: { code: "not_found" } }, 404),
      context({ cache: { kind: "max-age", seconds: 60 }, ifNoneMatch: "*" }),
    );
    expect(sent.status).toBe(404);
    expect(sent.headers["cache-control"]).toBe("no-store");
    expect(sent.headers).not.toHaveProperty("etag");
  });
});

describe("presenting a file", () => {
  const picture = (contentType = "image/svg+xml") =>
    answer({ bytes: new TextEncoder().encode("<svg/>"), contentType });
  const file = context({ cache: { kind: "max-age", seconds: 60 }, file: true });

  it("sends the bytes as what they are, shut in so a drawing opened on its own runs nothing", () => {
    const sent = presentResponse(picture(), file);
    expect(text(sent.body)).toBe("<svg/>");
    expect(sent.headers).toMatchObject({
      "cache-control": "private, max-age=60",
      "content-security-policy": "sandbox; default-src 'none'",
      "content-type": "image/svg+xml",
      "x-content-type-options": "nosniff",
    });
  });

  it("answers unchanged for the tag of the bytes", () => {
    const tag = entityTag(new TextEncoder().encode("<svg/>"));
    expect(
      presentResponse(picture(), { ...file, ifNoneMatch: tag }).status,
    ).toBe(304);
  });

  it("does not treat an error of a file operation as a file", () => {
    const sent = presentResponse(
      answer({ error: { code: "not_found" } }, 404),
      file,
    );
    expect(sent.headers["content-type"]).toBe("application/json");
    expect(sent.headers).not.toHaveProperty("content-security-policy");
  });

  it("does not take a JSON answer of a file operation for a file", () => {
    const sent = presentResponse(answer({ bytes: "no", contentType: 1 }), file);
    expect(sent.headers["content-type"]).toBe("application/json");
  });
});
