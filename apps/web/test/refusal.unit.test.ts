import { httpErrorEnvelopeSchema } from "@frostbite/shared/http";
import { describe, expect, it } from "vitest";

import { refusal } from "../src/server/http/refusal";

describe("a refusal before an operation runs", () => {
  it("is the platform's error envelope, with its status, and is never kept", async () => {
    const response = refusal(
      "unauthorized",
      "Authentication is required.",
      401,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { error } = httpErrorEnvelopeSchema.parse(await response.json());
    expect(error).toMatchObject({
      code: "unauthorized",
      message: "Authentication is required.",
    });
    expect(response.headers.get("x-correlation-id")).toBe(error.correlationId);
  });

  it("carries the correlation id it is given, and the headers it is told to add", async () => {
    const id = "018f47f0-7b5c-7c5b-8d56-43d493d8f001";
    const response = refusal("rate_limited", "Slow down.", 429, {
      correlationId: id,
      headers: { "retry-after": "7" },
    });
    expect(response.headers.get("retry-after")).toBe("7");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe(id);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.correlationId,
    ).toBe(id);
  });

  it("does not let an added header replace the rule that it is never kept", () => {
    const response = refusal("not_found", "No.", 404, {
      headers: { "cache-control": "public, max-age=600" },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
