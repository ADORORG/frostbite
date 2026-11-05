import Fastify from "fastify";
import { afterAll, describe, expect, it } from "vitest";

import { executeHttpOperation } from "@frostbite/http";
import { correlationHeaderName } from "@frostbite/shared/http";
import { platformStatusSchema } from "@frostbite/shared/platform";

import { createPlatformStatusOperation } from "../src/application/platform-status.js";

const correlationId = "123e4567-e89b-42d3-a456-426614174000";
const application = Fastify({ logger: false });
const operation = createPlatformStatusOperation(1);

application.get(operation.path, async (request, reply) => {
  const rawCorrelationId = request.headers[correlationHeaderName];
  const suppliedCorrelationId =
    typeof rawCorrelationId === "string" ? rawCorrelationId : undefined;
  const response = await executeHttpOperation(
    operation,
    {
      actorSession: null,
      actorUserId: null,
      headers: {
        [correlationHeaderName]: suppliedCorrelationId,
      },
      method: request.method,
      rawInput: {},
    },
    { createCorrelationId: () => correlationId },
  );
  return reply
    .headers(response.headers)
    .status(response.status)
    .send(response.body);
});

afterAll(async () => {
  await application.close();
});

describe("Fastify extraction conformance", () => {
  it("serves the shared operation without Next.js", async () => {
    const response = await application.inject({
      method: "GET",
      url: operation.path,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers[correlationHeaderName]).toBe(correlationId);
    expect(platformStatusSchema.parse(response.json())).toEqual({
      apiVersion: "v1",
      registeredFeatures: 1,
      stage: "foundation",
      transactionalActions: "gated",
    });
  });
});
