import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import { request as httpsRequest } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { platformSessionCookieName } from "@ador/shared/auth";
import { afterEach, describe, expect, it } from "vitest";

import { stackActors, type StackActor } from "../src/manual-stack.ts";
import { createStackProxy } from "../src/stack-proxy.ts";

const origin = "http://localhost:4174";
const opened: Server[] = [];

function start(server: Server): Promise<number> {
  opened.push(server);
  return new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address !== null)
        resolve(address.port);
      else reject(new Error("The test server has no port"));
    }),
  );
}

// A web server that answers with what it was asked, so a test can see exactly what got through.
function echoUpstream() {
  return createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      response.writeHead(201, { "x-from": "web" });
      response.end(
        JSON.stringify({
          body: Buffer.concat(chunks).toString(),
          cookie: request.headers.cookie,
          host: request.headers.host,
          method: request.method,
          url: request.url,
        }),
      );
    });
  });
}

async function proxy(
  upstreamPort: number,
  startSession?: (actor: StackActor) => Promise<void>,
): Promise<string> {
  const port = await start(
    createStackProxy({
      actors: stackActors,
      origin,
      upstreamPort,
      ...(startSession === undefined ? {} : { startSession }),
    }),
  );
  return `http://127.0.0.1:${String(port)}`;
}

afterEach(async () => {
  for (const server of opened.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

const post = (
  url: string,
  body: string,
  headers: Record<string, string> = {},
) =>
  fetch(url, {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
    method: "POST",
    redirect: "manual",
  });

describe("the stack front door", () => {
  it("serves the sign-in page itself, without asking the web server", async () => {
    const base = await proxy(1);
    const response = await fetch(`${base}/dev/sign-in`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Local test sign-in");
  });

  it("signs a person in: a session cookie and a redirect to their page", async () => {
    const base = await proxy(1);
    const response = await post(`${base}/dev/sign-in`, "actor=creator");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/studio/collections");
    expect(response.headers.get("set-cookie")).toContain(
      `${platformSessionCookieName}=`,
    );
  });

  it("makes the person's session usable before it hands out the cookie, and only for the person asked for", async () => {
    const started: string[] = [];
    const base = await proxy(1, async ({ id }) => {
      started.push(id);
    });
    const response = await post(`${base}/dev/sign-in`, "actor=staff");
    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("e2e-staff");
    expect(started).toEqual(["staff"]);
    expect((await post(`${base}/dev/sign-in`, "actor=nobody")).status).toBe(
      400,
    );
    await post(`${base}/dev/sign-out`, "");
    expect(started).toEqual(["staff"]);
  });

  it("gives no cookie when the session could not be started", async () => {
    const base = await proxy(1, () => Promise.reject(new Error("down")));
    const response = await post(`${base}/dev/sign-in`, "actor=staff");
    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("signs a person out", async () => {
    const base = await proxy(1);
    const response = await post(`${base}/dev/sign-out`, "");
    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("refuses a sign-in that came from another site", async () => {
    const base = await proxy(1);
    const response = await post(`${base}/dev/sign-in`, "actor=creator", {
      origin: "https://evil.example",
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("accepts a sign-in from its own origin", async () => {
    const base = await proxy(1);
    const response = await post(`${base}/dev/sign-in`, "actor=staff", {
      origin,
    });
    expect(response.status).toBe(303);
  });

  it("refuses an oversized form", async () => {
    const base = await proxy(1);
    const response = await post(`${base}/dev/sign-in`, "x".repeat(5_000));
    expect(response.status).toBe(413);
  });

  it("passes every other request to the web server unchanged, keeping method, path, body and cookie", async () => {
    const upstream = await start(echoUpstream());
    const base = await proxy(upstream);
    const response = await fetch(`${base}/api/anything?x=1`, {
      body: '{"a":1}',
      headers: { cookie: "k=v" },
      method: "PUT",
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("x-from")).toBe("web");
    expect(await response.json()).toEqual({
      body: '{"a":1}',
      cookie: "k=v",
      host: expect.stringMatching(/^127\.0\.0\.1:/u),
      method: "PUT",
      url: "/api/anything?x=1",
    });
  });

  // The web app checks the address people used, so the proxy must hand it on untouched.
  it("keeps the Host header people used", async () => {
    const upstream = await start(echoUpstream());
    const base = new URL(await proxy(upstream));
    const answer = await new Promise<string>((resolve, reject) => {
      const outgoing = httpRequest(
        {
          headers: { host: "localhost:4174" },
          host: base.hostname,
          path: "/x",
          port: base.port,
        },
        (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
          incoming.on("end", () => resolve(Buffer.concat(chunks).toString()));
        },
      );
      outgoing.on("error", reject);
      outgoing.end();
    });
    expect(JSON.parse(answer)).toMatchObject({ host: "localhost:4174" });
  });

  it("does not take over other /dev paths or other methods of the sign-in path", async () => {
    const upstream = await start(echoUpstream());
    const base = await proxy(upstream);
    expect((await fetch(`${base}/dev/other`)).status).toBe(201);
    expect((await fetch(`${base}/dev/sign-in`, { method: "PUT" })).status).toBe(
      201,
    );
  });

  it("says so when the web server is down", async () => {
    const closed = await start(createServer());
    opened.pop()?.close();
    const base = await proxy(closed);
    const response = await fetch(`${base}/`);
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("not answering");
  });
});

describe("the front door over HTTPS", () => {
  it("serves the sign-in page with a certificate, and passes other requests on", async () => {
    const directory = mkdtempSync(join(tmpdir(), "stack-tls-"));
    try {
      const cert = join(directory, "cert.pem");
      const key = join(directory, "key.pem");
      execFileSync(
        "openssl",
        ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1"].concat([
          "-subj",
          "/CN=localhost",
          "-keyout",
          key,
          "-out",
          cert,
        ]),
        { stdio: "ignore" },
      );
      const upstream = await start(echoUpstream());
      const port = await start(
        createStackProxy({
          actors: stackActors,
          origin: "https://localhost:4174",
          tls: {
            cert: readFileSync(cert, "utf8"),
            key: readFileSync(key, "utf8"),
          },
          upstreamPort: upstream,
        }),
      );
      const get = (path: string) =>
        new Promise<{ body: string; status: number }>((resolve, reject) =>
          httpsRequest(
            { host: "127.0.0.1", path, port, rejectUnauthorized: false },
            (answer) => {
              let body = "";
              answer.on("data", (chunk: Buffer) => (body += String(chunk)));
              answer.on("end", () =>
                resolve({ body, status: answer.statusCode ?? 0 }),
              );
            },
          )
            .on("error", reject)
            .end(),
        );
      const picker = await get("/dev/sign-in");
      expect(picker.status).toBe(200);
      expect(picker.body).toContain("Creator (approved)");
      const passed = await get("/anything");
      expect(passed.status).toBe(201);
      expect(passed.body).toContain('"url":"/anything"');
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
