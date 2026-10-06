import { describe, expect, it } from "vitest";

import {
  defaultWorkerPort,
  livenessPath,
  parseWorkerPort,
  workflowEndpointPath,
} from "../src/config.ts";

describe("worker configuration", () => {
  it("serves the workflow endpoint and liveness probe at stable paths", () => {
    expect(workflowEndpointPath).toBe("/api/inngest");
    expect(livenessPath).toBe("/health");
  });

  it("uses the default port only when the platform injects none", () => {
    expect(parseWorkerPort({})).toBe(defaultWorkerPort);
    expect(parseWorkerPort({ PORT: "" })).toBe(defaultWorkerPort);
    expect(parseWorkerPort({ PORT: "  " })).toBe(defaultWorkerPort);
  });

  it("accepts any valid TCP port, including the bounds", () => {
    expect(parseWorkerPort({ PORT: "8080" })).toBe(8080);
    expect(parseWorkerPort({ PORT: "1" })).toBe(1);
    expect(parseWorkerPort({ PORT: "65535" })).toBe(65_535);
  });

  it.each(["0", "65536", "-1", "80.5", "abc", "1e3x"])(
    "rejects PORT=%s",
    (value) => {
      expect(() => parseWorkerPort({ PORT: value })).toThrow(RangeError);
    },
  );
});
