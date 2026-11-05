import { readinessSchema } from "@frostbite/shared/readiness";
import { describe, expect, it, vi } from "vitest";

import { GET } from "../src/app/api/ready/route.js";

describe("readiness at the web service", () => {
  it("names each check and its outcome, answers 503 when one fails, and says nothing else", async () => {
    // Object storage is not configured in this run, so it cannot answer; the database can.
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await GET();
    const body = readinessSchema.parse(await response.json());
    expect(response.headers.get("cache-control")).toBe("no-store");
    const outcome = Object.fromEntries(
      body.checks.map(({ name, status }) => [name, status]),
    );
    expect(outcome.database).toBe("ok");
    expect(body.status).toBe(
      outcome["object-storage"] === "ok" ? "ready" : "not-ready",
    );
    expect(response.status).toBe(body.status === "ready" ? 200 : 503);
    // The reason went to the log, not the answer.
    if (body.status === "not-ready") expect(error).toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toMatch(/password|secret|ECONN|stack/iu);
    error.mockRestore();
  });
});
