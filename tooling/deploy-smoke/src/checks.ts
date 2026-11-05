import { readinessSchema } from "@frostbite/shared/readiness";

export interface Context {
  readonly base: URL;
  readonly get: (path: string) => Promise<Response>;
}

// One thing a healthy deployment does. It throws a sentence saying what was wrong; returning means it passed.
export interface Check {
  readonly name: string;
  readonly run: (context: Context) => Promise<void>;
}

function expect(condition: boolean, problem: string): void {
  if (!condition) throw new Error(problem);
}

const securityHeaders = ["x-content-type-options", "referrer-policy"] as const;

// What a deployment must do before it is given traffic: serve its pages, say it is ready, keep private pages closed, carry its
// security headers, and ship the files its build is meant to. The list is data, in the order a person would ask the questions.
export const checks: readonly Check[] = [
  {
    name: "says it is ready (database and object storage answer)",
    run: async ({ get }) => {
      const response = await get("/api/ready");
      const body = readinessSchema.safeParse(await response.json());
      expect(
        response.status === 200,
        `/api/ready answered ${String(response.status)}.`,
      );
      expect(
        body.success && body.data.status === "ready",
        "/api/ready did not say ready.",
      );
    },
  },
  {
    name: "serves the landing page",
    run: async ({ get }) => {
      const response = await get("/");
      expect(response.status === 200, `/ answered ${String(response.status)}.`);
      expect((await response.text()).includes("<h1"), "/ has no heading.");
    },
  },
  {
    name: "carries its security headers",
    run: async ({ get }) => {
      const response = await get("/");
      for (const header of securityHeaders)
        expect(response.headers.has(header), `/ has no ${header} header.`);
      expect(
        response.headers.has("content-security-policy") ||
          response.headers.has("content-security-policy-report-only"),
        "/ has no content security policy.",
      );
    },
  },
  {
    name: "serves the versioned platform contract",
    run: async ({ get }) => {
      const response = await get("/api/v1/platform");
      expect(
        response.status === 200,
        `/api/v1/platform answered ${String(response.status)}.`,
      );
      expect(
        (await response.text()).includes('"apiVersion":"v1"'),
        "/api/v1/platform does not name apiVersion v1.",
      );
    },
  },
  {
    name: "keeps a private page closed and sends a visitor to sign in",
    run: async ({ get }) => {
      const response = await get("/studio");
      const location = response.headers.get("location") ?? "";
      expect(
        [302, 303, 307, 308].includes(response.status),
        `/studio answered ${String(response.status)}, not a redirect.`,
      );
      expect(
        location.includes("/sign-in"),
        "/studio did not send the visitor to sign in.",
      );
    },
  },
  {
    name: "ships the rendered scene files for the video fallback",
    run: async ({ get }) => {
      const response = await get("/scenes/pong.png");
      expect(
        response.status === 200,
        `/scenes/pong.png answered ${String(response.status)}; was pnpm scenes:render run in the build?`,
      );
      expect(
        response.headers.get("content-type")?.startsWith("image/png") === true,
        "/scenes/pong.png is not a png.",
      );
    },
  },
  {
    name: "serves the games it plays itself",
    run: async ({ get }) => {
      const response = await get("/games");
      expect(
        response.status === 200,
        `/games answered ${String(response.status)}.`,
      );
    },
  },
];
