import { randomUUID } from "node:crypto";

import { parseObjectKey, type ObjectStoragePort } from "@ador/object-storage";

export interface SmokeResult {
  readonly detail: string;
  readonly name: string;
  readonly ok: boolean;
}

const bytes = Buffer.from("ador-r2-smoke");
const contentType = "text/plain";
const lifetimeSeconds = 60;

async function check(
  name: string,
  run: () => Promise<string>,
): Promise<SmokeResult> {
  try {
    return { detail: await run(), name, ok: true };
  } catch (error) {
    // Messages only: provider errors can embed request details, never credentials we hold.
    return {
      detail: error instanceof Error ? error.message : "failed",
      name,
      ok: false,
    };
  }
}

function expectStatus(
  response: Response,
  expected: number,
  action: string,
): void {
  if (response.status !== expected)
    throw new Error(
      `${action} returned ${response.status}, expected ${expected}.`,
    );
}

// Exercises the real storage round trip the upload feature depends on, against whatever endpoint the
// environment points at, using a throwaway key that is removed afterwards. `webOrigin` is the
// browser origin whose CORS rule on the private bucket is verified.
export async function runStorageSmoke(
  storage: ObjectStoragePort,
  webOrigin: string,
): Promise<readonly SmokeResult[]> {
  const key = parseObjectKey(`smoke/${randomUUID()}`);
  const results: SmokeResult[] = [];
  const run = async (name: string, step: () => Promise<string>) => {
    const result = await check(name, step);
    results.push(result);
    return result.ok;
  };
  let uploadUrl = "";
  let uploadHeaders: Readonly<Record<string, string>> = {};
  try {
    // Every later step needs the signed URL, so without it they could only fail misleadingly.
    const presigned = await run("presign upload", async () => {
      const upload = await storage.presignPrivateUpload({
        contentLength: bytes.length,
        contentType,
        expiresInSeconds: lifetimeSeconds,
        key,
      });
      uploadUrl = upload.url.toString();
      uploadHeaders = upload.headers;
      return `expires ${upload.expiresAt.toISOString()}`;
    });
    if (!presigned) return results;
    await run("browser CORS preflight for the upload", async () => {
      const response = await fetch(uploadUrl, {
        headers: {
          "access-control-request-headers": "content-type",
          "access-control-request-method": "PUT",
          origin: webOrigin,
        },
        method: "OPTIONS",
      });
      const allowed = response.headers.get("access-control-allow-origin");
      if (allowed !== webOrigin && allowed !== "*")
        throw new Error(
          `Allowed origin was ${allowed ?? "missing"}; add a CORS rule for ${webOrigin}.`,
        );
      return `allows ${allowed}`;
    });
    await run("upload through the signed URL", async () => {
      const response = await fetch(uploadUrl, {
        body: bytes,
        headers: {
          "content-type": uploadHeaders["content-type"] ?? contentType,
        },
        method: "PUT",
      });
      expectStatus(response, 200, "PUT");
      return "stored";
    });
    await run("head", async () => {
      const head = await storage.head({ key, scope: "private" });
      if (head?.contentLength !== bytes.length)
        throw new Error("Stored length differs from the upload.");
      return `${head.contentLength} bytes`;
    });
    await run("read through a signed URL", async () => {
      const read = await storage.presignPrivateRead({
        expiresInSeconds: lifetimeSeconds,
        key,
      });
      const response = await fetch(read.url);
      expectStatus(response, 200, "GET");
      if (Buffer.from(await response.arrayBuffer()).compare(bytes) !== 0)
        throw new Error("Read bytes differ from the upload.");
      return "bytes match";
    });
    await run("streamed server read", async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of (await storage.read({ key, scope: "private" }))
        .body)
        chunks.push(Buffer.from(chunk));
      if (Buffer.concat(chunks).compare(bytes) !== 0)
        throw new Error("Streamed bytes differ.");
      return "bytes match";
    });
    await run("conditional private-to-public copy (R2 extension)", async () => {
      const head = await storage.head({ key, scope: "private" });
      if (head === null) throw new Error("Source object is missing.");
      await storage.copyPrivateToPublicIfAbsent({
        key,
        sourceEntityTag: head.entityTag,
      });
      // A second copy must be a no-op success, not an overwrite.
      await storage.copyPrivateToPublicIfAbsent({
        key,
        sourceEntityTag: head.entityTag,
      });
      return "copied; repeat is idempotent";
    });
  } finally {
    for (const scope of ["private", "public"] as const)
      await storage.delete({ key, scope }).catch(() => undefined);
  }
  return results;
}
