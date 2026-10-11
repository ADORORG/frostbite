import { describe, expect, it } from "vitest";

import config from "../vitest.config.js";

describe("web coverage inventory", () => {
  it("instruments generic page and API adapters", () => {
    expect(config).toMatchObject({
      test: {
        coverage: {
          include: [
            "src/app/**/page.tsx",
            "src/app/api/v1/**/route.ts",
            "src/server/http/next-operation.ts",
            "src/server/auth/page-access.ts",
            "src/server/auth/runtime.ts",
            "src/app/api/csp-report/route.ts",
            "src/app/api/ready/route.ts",
            "src/proxy.ts",
            "src/server/database.ts",
            "src/server/rate-limit.ts",
            "src/server/readiness.ts",
            "src/server/security/*.ts",
          ],
        },
      },
    });
  });
});
