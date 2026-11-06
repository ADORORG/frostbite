import { ApiError } from "@frostbite/client-http";
import { creatorApplicationRoutes } from "@frostbite/shared/creator-admission";
import { describe, expect, it, vi } from "vitest";

import { describeFailure } from "../src/client/error-copy.ts";
import { createCreatorReviewApi } from "../src/client/review-api.ts";
import { detail, queuePage } from "./support/review-fixtures.ts";

function json(body: object) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

describe("creator review api", () => {
  it("asks for the queue at the contract's route and returns the validated page", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(queuePage([])));
    const page = await createCreatorReviewApi(fetchImpl).queue({
      cursor: "c",
      group: "all",
      sort: "name",
    });
    expect(page.items).toEqual([]);
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(init.method).toBe(creatorApplicationRoutes.reviewQueue.method);
    expect(path).toBe(
      `${creatorApplicationRoutes.reviewQueue.path}?group=all&sort=name&cursor=c`,
    );
    expect(init.body).toBeUndefined();
  });

  it("names no cursor for the first page", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(queuePage([])));
    await createCreatorReviewApi(fetchImpl).queue({
      cursor: null,
      group: "all",
      sort: "name",
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `${creatorApplicationRoutes.reviewQueue.path}?group=all&sort=name`,
    );
  });

  it("asks for an application by its id at the read route", async () => {
    const application = detail();
    const fetchImpl = vi.fn().mockResolvedValue(json({ application }));
    const result = await createCreatorReviewApi(fetchImpl).read(
      application.applicationId,
    );
    expect(result.application.applicationId).toBe(application.applicationId);
    const [path, init] = fetchImpl.mock.calls[0] ?? [];
    expect(path).toBe(
      `${creatorApplicationRoutes.reviewRead.path}?applicationId=${application.applicationId}`,
    );
    expect(init.method).toBe("GET");
  });

  it("rejects a response the shared contract does not describe", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ items: "nope" }));
    await expect(
      createCreatorReviewApi(fetchImpl).queue({
        cursor: null,
        group: "all",
        sort: "oldest",
      }),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });
});

describe("describeFailure", () => {
  it.each([
    ["unauthorized", "sign-in", false],
    ["forbidden", "not-permitted", false],
    ["not_found", "not-found", false],
    ["invalid_request", "rejected", false],
    ["internal_error", "temporary", true],
    ["network", "temporary", true],
  ] as const)("describes %s as %s (retryable: %s)", (code, kind, retryable) => {
    expect(describeFailure(new ApiError(code, null, "text"))).toMatchObject({
      kind,
      retryable,
    });
  });

  it("passes the server's words through only for a rejected request", () => {
    expect(
      describeFailure(new ApiError("invalid_request", 400, "Cursor is bad.")),
    ).toMatchObject({ message: "Cursor is bad." });
  });

  it("treats anything that is not an API error as a temporary fault", () => {
    expect(describeFailure(new TypeError("x"))).toEqual({
      kind: "temporary",
      message: "Something went wrong. Try again.",
      retryable: true,
    });
  });

  it("does not offer a retry for an unexpected non-retryable code", () => {
    expect(describeFailure(new ApiError("conflict", 409, "x"))).toMatchObject({
      kind: "temporary",
      retryable: false,
    });
  });
});
