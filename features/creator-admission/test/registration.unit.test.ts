import { describe, expect, it } from "vitest";

import { creatorAdmissionFeature } from "../src/registration.ts";

describe("creator admission registration", () => {
  it("declares its detachable access and accounts dependency", () => {
    expect(creatorAdmissionFeature.manifest).toMatchObject({
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "studio-page",
      ],
      dependencies: ["accounts"],
      id: "creator-admission",
      pages: [
        {
          access: { kind: "authenticated" },
          path: "/studio/creator-application",
        },
        {
          access: { capability: "creator:review", kind: "platform" },
          path: "/admin/creator-applications",
        },
        {
          access: { capability: "creator:review", kind: "platform" },
          path: "/admin/creator-applications/[applicationId]",
        },
      ],
    });
    expect(creatorAdmissionFeature.manifest.routes).toHaveLength(6);
  });

  it("loads the matching runtime entrypoint", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
    process.env.DATABASE_SSL_MODE = "disable";
    process.env.DATABASE_POOL_MAX = "1";
    process.env.DATABASE_ACQUIRE_TIMEOUT_MS = "1000";
    process.env.DATABASE_IDLE_TIMEOUT_MS = "1000";
    process.env.DATABASE_STATEMENT_TIMEOUT_MS = "1000";
    const entrypoint = await creatorAdmissionFeature.load({
      registeredFeatureCount: 3,
      registeredFeatureIds: ["accounts", "creator-admission", "platform-shell"],
    });
    expect(entrypoint.id).toBe("creator-admission");
    expect(entrypoint.operations).toHaveLength(6);
  });
});
