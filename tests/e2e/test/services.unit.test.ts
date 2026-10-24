import { describe, expect, it, vi, type Mock } from "vitest";

import {
  inngestEnvironment,
  storageEnvironment,
  withUploadServices,
  type ServiceLaunchers,
} from "../src/services.ts";

type Fakes = { [K in keyof ServiceLaunchers]: Mock<ServiceLaunchers[K]> };

function launchers(order: string[], overrides: Partial<Fakes> = {}): Fakes {
  let ports = 4000;
  const stop = (name: string) => async () => void order.push(`stop ${name}`);
  const fakes = {
    freePort: vi.fn(async () => (ports += 1)),
    startInngestRuntime: vi.fn(async () => {
      order.push("start inngest");
      return {
        baseUrl: "",
        eventKey: "",
        logs: async () => "",
        signingKey: "",
        stop: stop("inngest"),
      };
    }),
    startS3Runtime: vi.fn(async () => {
      order.push("start s3");
      return {
        accessKeyId: "access",
        endpoint: "http://127.0.0.1:9000",
        logs: async () => "",
        secretAccessKey: "secret",
        stop: stop("s3"),
      };
    }),
    startServiceProcess: vi.fn(async () => {
      order.push("start worker");
      return {
        lines: () => [],
        stop: async () => (order.push("stop worker"), 0),
      };
    }),
    ...overrides,
  };
  return fakes;
}

const base = { APP_ENV: "test", DATABASE_URL: "postgresql://db" };

describe("e2e service environment", () => {
  it("points the app at the stand-in storage with distinct buckets", () => {
    const env = storageEnvironment({
      accessKeyId: "a",
      endpoint: "http://127.0.0.1:1",
      secretAccessKey: "s",
    });
    expect(env).toEqual({
      R2_ACCESS_KEY_ID: "a",
      R2_ENDPOINT: "http://127.0.0.1:1",
      R2_PRIVATE_BUCKET: "e2e-private-drafts",
      R2_PUBLIC_BUCKET: "e2e-public-assets",
      R2_REGION: "us-east-1",
      R2_SECRET_ACCESS_KEY: "s",
    });
    expect(env.R2_PRIVATE_BUCKET).not.toBe(env.R2_PUBLIC_BUCKET);
  });

  it("keeps signature verification on and addresses the runtime on loopback", () => {
    expect(inngestEnvironment(8288)).toMatchObject({
      INNGEST_BASE_URL: "http://127.0.0.1:8288",
      INNGEST_DEV: "false",
    });
    expect(inngestEnvironment(1).INNGEST_EVENT_KEY).toMatch(/^[0-9a-f]+$/);
    expect(inngestEnvironment(1).INNGEST_SIGNING_KEY).toMatch(
      /^(?:[0-9a-f]{2})+$/,
    );
  });
});

describe("with upload services", () => {
  it("starts storage, the worker, then Inngest, runs the callback, and stops in reverse", async () => {
    const order: string[] = [];
    const fakes = launchers(order);
    let seen: NodeJS.ProcessEnv = {};
    await withUploadServices(
      {
        baseEnvironment: base,
        launchers: fakes,
        webOrigin: "http://localhost:4173",
      },
      async (environment) => {
        order.push("callback");
        seen = environment;
      },
    );
    expect(order).toEqual([
      "start s3",
      "start worker",
      "start inngest",
      "callback",
      "stop inngest",
      "stop worker",
      "stop s3",
    ]);
    expect(fakes.startS3Runtime).toHaveBeenCalledWith({
      buckets: ["e2e-private-drafts", "e2e-public-assets"],
      corsOrigins: ["http://localhost:4173"],
    });
    expect(seen).toMatchObject({
      INNGEST_DEV: "false",
      R2_ENDPOINT: "http://127.0.0.1:9000",
    });
  });

  it("uses the storage it is given in place of the disposable one, with the same buckets, and stops that one with the rest", async () => {
    const order: string[] = [];
    const fakes = launchers(order);
    const given = vi.fn(async () => ({
      accessKeyId: "kept-access",
      endpoint: "http://127.0.0.1:9100",
      logs: async () => "",
      secretAccessKey: "kept-secret",
      stop: async () => void order.push("stop kept"),
    }));
    let seen: NodeJS.ProcessEnv = {};
    await withUploadServices(
      {
        baseEnvironment: base,
        launchers: fakes,
        startStorage: given,
        webOrigin: "http://localhost:4173",
      },
      async (environment) => {
        seen = environment;
      },
    );
    expect(fakes.startS3Runtime).not.toHaveBeenCalled();
    expect(given).toHaveBeenCalledWith({
      buckets: ["e2e-private-drafts", "e2e-public-assets"],
      corsOrigins: ["http://localhost:4173"],
    });
    expect(seen).toMatchObject({
      R2_ACCESS_KEY_ID: "kept-access",
      R2_ENDPOINT: "http://127.0.0.1:9100",
    });
    expect(order.at(-1)).toBe("stop kept");
  });

  it("gives the worker the app environment, the shared service environment, and its own port", async () => {
    const fakes = launchers([]);
    await withUploadServices(
      { baseEnvironment: base, launchers: fakes, webOrigin: "http://x" },
      async () => undefined,
    );
    const call = fakes.startServiceProcess.mock.calls[0]?.[0];
    if (call === undefined) throw new Error("worker was not started");
    const { env, entry, readyLine } = call;
    expect(entry).toBe("src/main.ts");
    expect(readyLine).toBe("worker listening");
    expect(env).toMatchObject({
      APP_ENV: "test",
      DATABASE_URL: "postgresql://db",
      INNGEST_DEV: "false",
      PORT: "4001",
      R2_ACCESS_KEY_ID: "access",
    });
    expect(fakes.startInngestRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        appPort: 4001,
        hostPort: 4002,
        retryIntervalSeconds: 1,
      }),
    );
    expect(env.INNGEST_BASE_URL).toBe("http://127.0.0.1:4002");
  });

  it("stops whatever already started, in reverse, when a later service fails to start", async () => {
    const order: string[] = [];
    const fakes = launchers(order, {
      startInngestRuntime: vi.fn(async () => {
        throw new Error("inngest failed");
      }),
    });
    await expect(
      withUploadServices(
        { baseEnvironment: base, launchers: fakes, webOrigin: "http://x" },
        async () => void order.push("callback"),
      ),
    ).rejects.toThrow("inngest failed");
    expect(order).toEqual([
      "start s3",
      "start worker",
      "stop worker",
      "stop s3",
    ]);
  });

  it("stops everything when the callback fails, and surfaces its error", async () => {
    const order: string[] = [];
    await expect(
      withUploadServices(
        {
          baseEnvironment: base,
          launchers: launchers(order),
          webOrigin: "http://x",
        },
        async () => {
          throw new Error("tests failed");
        },
      ),
    ).rejects.toThrow("tests failed");
    expect(order.slice(-3)).toEqual(["stop inngest", "stop worker", "stop s3"]);
  });

  it("still stops every other service when one of them fails to stop", async () => {
    const order: string[] = [];
    const fakes = launchers(order, {
      startServiceProcess: vi.fn(async () => ({
        lines: () => [],
        stop: async () => {
          order.push("stop worker");
          throw new Error("worker would not stop");
        },
      })),
    });
    await expect(
      withUploadServices(
        { baseEnvironment: base, launchers: fakes, webOrigin: "http://x" },
        async () => undefined,
      ),
    ).rejects.toThrow("worker would not stop");
    expect(order.slice(-3)).toEqual(["stop inngest", "stop worker", "stop s3"]);
  });

  it("reports the callback's error, not a stop error, when both fail", async () => {
    const fakes = launchers([], {
      startServiceProcess: vi.fn(async () => ({
        lines: () => [],
        stop: async () => {
          throw new Error("stop failed");
        },
      })),
    });
    await expect(
      withUploadServices(
        { baseEnvironment: base, launchers: fakes, webOrigin: "http://x" },
        async () => {
          throw new Error("tests failed");
        },
      ),
    ).rejects.toThrow("tests failed");
  });

  it("reports a launcher that rejects with a non-Error as an Error carrying its text", async () => {
    const fakes = launchers([], {
      startS3Runtime: vi.fn(() => Promise.reject("daemon unreachable")),
    });
    await expect(
      withUploadServices(
        { baseEnvironment: base, launchers: fakes, webOrigin: "http://x" },
        async () => undefined,
      ),
    ).rejects.toThrow(new Error("daemon unreachable"));
  });

  it("starts nothing else when storage cannot start", async () => {
    const fakes = launchers([], {
      startS3Runtime: vi.fn(async () => {
        throw new Error("docker missing");
      }),
    });
    await expect(
      withUploadServices(
        { baseEnvironment: base, launchers: fakes, webOrigin: "http://x" },
        async () => undefined,
      ),
    ).rejects.toThrow("docker missing");
    expect(fakes.startServiceProcess).not.toHaveBeenCalled();
  });
});
