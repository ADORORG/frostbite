import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { createIsolatedImageProcessor } from "../src/isolated-processor.ts";
import { workerExitCodes } from "../src/exit-codes.ts";
import { createNodeWorkerLauncher } from "../src/process-launcher.ts";
import { encodeFrame } from "../src/protocol.ts";
import { buildPng, makeImage, pngChunks } from "./support/images.ts";

const policy = {
  maxDerivativeBytes: 5_000_000,
  wallTimeMs: 20_000,
  workerMaxHeapMegabytes: 512,
};
const derivatives = [
  { kind: "thumbnail", maxSide: 256 },
  { kind: "preview", maxSide: 1_024 },
] as const;
const limits = { maxDimension: 8_192, maxPixels: 40_000_000 };
const directory = mkdtempSync(join(tmpdir(), "ador-worker-"));
afterAll(() => rmSync(directory, { force: true, recursive: true }));

function input(bytes: Uint8Array, width: number, height: number) {
  return {
    bytes,
    derivatives,
    expected: { height, width },
    limits,
    quality: 80,
  };
}

let counter = 0;
function script(source: string): string {
  counter += 1;
  const path = join(directory, `worker-${counter}.mjs`);
  writeFileSync(path, source);
  return path;
}

function processorFor(workerPath?: string, overrides = {}) {
  return createIsolatedImageProcessor({
    launcher: createNodeWorkerLauncher(workerPath),
    policy: { ...policy, ...overrides },
  });
}

describe("the real isolated worker", () => {
  const processor = processorFor();

  it("decodes in a child process and returns validated derivatives", async () => {
    const bytes = await makeImage({ format: "jpeg", height: 600, width: 900 });
    const result = await processor.process(input(bytes, 900, 600));
    expect(result).toMatchObject({
      derivatives: [
        { height: 171, kind: "thumbnail", width: 256 },
        { height: 600, kind: "preview", width: 900 },
      ],
      ok: true,
    });
    if (result.ok)
      expect(
        Buffer.from(result.derivatives[0]?.bytes ?? [])
          .subarray(8, 12)
          .toString(),
      ).toBe("WEBP");
  });

  it("passes deterministic rejections through from the child", async () => {
    const png = pngChunks(
      await makeImage({ format: "png", height: 80, width: 80 }),
    );
    const truncated = buildPng(
      png.map((chunk) =>
        chunk.type === "IDAT"
          ? { ...chunk, data: chunk.data.subarray(0, 12) }
          : chunk,
      ),
    );
    expect(await processor.process(input(truncated, 80, 80))).toEqual({
      ok: false,
      reason: "decode-failed",
    });
    const good = await makeImage({ format: "png", height: 80, width: 80 });
    expect(await processor.process(input(good, 81, 80))).toEqual({
      ok: false,
      reason: "decoded-size-mismatch",
    });
  });
});

describe("the real worker's exit codes", () => {
  function exitCodeFor(request: Uint8Array): Promise<number | null> {
    return new Promise((resolve) => {
      const worker = createNodeWorkerLauncher()({ heapMegabytes: 256 });
      worker.onExit(resolve);
      worker.send(request);
    });
  }

  it("exits with the protocol-violation code for a request it cannot parse", async () => {
    expect(await exitCodeFor(Buffer.from("garbage"))).toBe(
      workerExitCodes.protocolViolation,
    );
  });

  it("exits cleanly after answering a valid request", async () => {
    const frame = encodeFrame(
      {
        byteLength: 3,
        derivatives: [{ kind: "thumbnail", maxSide: 256 }],
        expected: { height: 5, width: 7 },
        limits: { maxDimension: 8_192, maxPixels: 40_000_000 },
        quality: 80,
      },
      Buffer.from([1, 2, 3]),
    );
    expect(await exitCodeFor(frame)).toBe(0);
  });
});

describe("worker process misbehavior", () => {
  const run = (workerPath: string, overrides = {}) =>
    processorFor(workerPath, { wallTimeMs: 600, ...overrides }).process(
      input(Buffer.from([1, 2, 3]), 1, 1),
    );

  it("kills a worker that exceeds the wall time and reports a limit violation", async () => {
    const path = script(
      `import { writeFileSync } from "node:fs";
       setTimeout(() => writeFileSync(new URL("./survived", import.meta.url), "x"), 2500);
       setInterval(() => {}, 1000);`,
    );
    const started = Date.now();
    expect(await run(path)).toEqual({
      ok: false,
      reason: "processing-limit-exceeded",
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(existsSync(join(directory, "survived"))).toBe(false);
  });

  it("force-kills a worker that ignores polite termination", async () => {
    const path = script(
      `process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);`,
    );
    expect(await run(path)).toEqual({
      ok: false,
      reason: "processing-limit-exceeded",
    });
  });

  it("reports death by signal as a limit violation", async () => {
    expect(await run(script('process.kill(process.pid, "SIGABRT");'))).toEqual({
      ok: false,
      reason: "processing-limit-exceeded",
    });
  });

  it("treats a worker that cannot start as a retryable platform fault", async () => {
    await expect(run(script("process.exit(1);"))).rejects.toThrow(
      "Worker exited with code 1.",
    );
    await expect(run(join(directory, "missing.mjs"))).rejects.toThrow(
      "Worker exited with code 1.",
    );
    await expect(
      run(script("throw new Error('cannot load native decoder');")),
    ).rejects.toThrow("Worker exited with code 1.");
  });

  it("kills a worker that floods stdout past the output cap", async () => {
    const path = script(
      "process.stdout.write(Buffer.alloc(8_000_000)); setInterval(() => {}, 1000);",
    );
    expect(
      await run(path, { maxDerivativeBytes: 1_000, wallTimeMs: 15_000 }),
    ).toEqual({ ok: false, reason: "processing-limit-exceeded" });
  });

  it("runs the worker with only NODE_ENV in its environment", async () => {
    const path = script(
      `import { Buffer } from "node:buffer";
       const header = Object.keys(process.env).join() === "NODE_ENV" ? { ok: false, reason: "decode-failed" } : { ok: false, reason: "malformed" };
       const json = Buffer.from(JSON.stringify(header)); const prefix = Buffer.alloc(4); prefix.writeUInt32BE(json.length);
       process.stdout.write(Buffer.concat([prefix, json]));`,
    );
    expect(await run(path)).toEqual({ ok: false, reason: "decode-failed" });
  });

  it("starts the worker with the configured heap cap", async () => {
    const path = script(
      `import { Buffer } from "node:buffer";
       const capped = process.execArgv.includes("--max-old-space-size=321");
       const json = Buffer.from(JSON.stringify(capped ? { ok: false, reason: "decode-failed" } : { ok: false, reason: "malformed" }));
       const prefix = Buffer.alloc(4); prefix.writeUInt32BE(json.length);
       process.stdout.write(Buffer.concat([prefix, json]));`,
    );
    expect(await run(path, { workerMaxHeapMegabytes: 321 })).toEqual({
      ok: false,
      reason: "decode-failed",
    });
  });

  it.each([
    ["no output", "process.exit(0);"],
    ["garbage output", 'process.stdout.write("garbage");'],
  ])("rejects on a worker that sends %s", async (_name, source) => {
    await expect(run(script(source))).rejects.toThrow("invalid frame");
  });

  it("survives a worker that exits without reading a large request", async () => {
    await expect(
      processorFor(script("process.exit(0);"), { wallTimeMs: 5_000 }).process(
        input(Buffer.alloc(8_000_000), 1, 1),
      ),
    ).rejects.toThrow("invalid frame");
  });
});
