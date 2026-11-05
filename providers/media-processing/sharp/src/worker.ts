// The isolated decoder. This file is deliberately self-contained: it is copied as a single asset into
// deployment output, so it may import only Node built-ins, `sharp`, and erased `import type`s. It
// never imports the platform packages, which keeps the import graph that handles untrusted bytes
// minimal. Constants it shares with the parent are duplicated here and pinned by a drift test.
import { pathToFileURL } from "node:url";

import type {
  ProcessImageInput,
  ProcessImageResult,
  ProducedDerivative,
} from "@frostbite/media/processing";
import sharp from "sharp";

const lengthPrefixBytes = 4;
const maximumHeaderBytes = 65_536;
const derivativeKinds = ["thumbnail", "preview"] as const;

// Exit codes the worker chooses itself: a platform fault, as opposed to a file that exhausted a limit.
export const workerExitCodes = {
  protocolViolation: 2,
  unexpectedError: 1,
} as const;

type RequestOptions = Omit<ProcessImageInput, "bytes">;

interface ParsedRequest {
  readonly options: RequestOptions;
  readonly payload: Buffer;
}

type ReplyHeader =
  | {
      readonly derivatives: readonly {
        readonly byteLength: number;
        readonly height: number;
        readonly kind: ProducedDerivative["kind"];
        readonly width: number;
      }[];
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: Extract<ProcessImageResult, { ok: false }>["reason"];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    [...keys].sort().every((key, index) => key === actual[index])
  );
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function derivativeRequest(
  value: unknown,
): ProcessImageInput["derivatives"][number] | null {
  if (!isRecord(value) || !hasExactKeys(value, ["kind", "maxSide"]))
    return null;
  const { kind, maxSide } = value;
  const known = derivativeKinds.find((candidate) => candidate === kind);
  return known !== undefined && positive(maxSide)
    ? { kind: known, maxSide }
    : null;
}

// The request comes from another process, so its header is validated field by field before use.
function readOptions(
  header: unknown,
): { byteLength: number; options: RequestOptions } | null {
  if (!isRecord(header)) return null;
  if (
    !hasExactKeys(header, [
      "byteLength",
      "derivatives",
      "expected",
      "limits",
      "quality",
    ])
  )
    return null;
  const { byteLength, derivatives, expected, limits, quality } = header;
  if (
    typeof byteLength !== "number" ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0
  )
    return null;
  if (!Array.isArray(derivatives) || derivatives.length === 0) return null;
  const requests = derivatives.map(derivativeRequest);
  if (!isRecord(expected) || !hasExactKeys(expected, ["height", "width"]))
    return null;
  if (!isRecord(limits) || !hasExactKeys(limits, ["maxDimension", "maxPixels"]))
    return null;
  if (!positive(expected.height) || !positive(expected.width)) return null;
  if (!positive(limits.maxDimension) || !positive(limits.maxPixels))
    return null;
  if (
    typeof quality !== "number" ||
    !Number.isInteger(quality) ||
    quality < 1 ||
    quality > 100
  )
    return null;
  const valid = requests.filter((request) => request !== null);
  if (valid.length !== requests.length) return null;
  return {
    byteLength,
    options: {
      derivatives: valid,
      expected: { height: expected.height, width: expected.width },
      limits: {
        maxDimension: limits.maxDimension,
        maxPixels: limits.maxPixels,
      },
      quality,
    },
  };
}

// Frame: 4-byte big-endian header length, a JSON header, then the binary payload.
export function parseRequest(frame: Buffer): ParsedRequest | null {
  if (frame.length < lengthPrefixBytes) return null;
  const headerLength = frame.readUInt32BE(0);
  const end = lengthPrefixBytes + headerLength;
  if (headerLength > maximumHeaderBytes || end > frame.length) return null;
  let header: unknown;
  try {
    header = JSON.parse(
      frame.subarray(lengthPrefixBytes, end).toString("utf8"),
    );
  } catch {
    return null;
  }
  const parsed = readOptions(header);
  const payload = frame.subarray(end);
  return parsed !== null && payload.length === parsed.byteLength
    ? { options: parsed.options, payload }
    : null;
}

function encodeReply(header: ReplyHeader, payload: Buffer): Buffer {
  const json = Buffer.from(JSON.stringify(header));
  const prefix = Buffer.alloc(lengthPrefixBytes);
  prefix.writeUInt32BE(json.length);
  return Buffer.concat([prefix, json, payload]);
}

// libvips decodes lazily and strictly (`failOn: "warning"`), so a truncated or corrupt pixel stream
// fails here. The decoder is told the pixel limit and the header must agree with the dimensions
// recorded by structural validation. Output is WebP, EXIF auto-oriented, never enlarged, and carries
// no source metadata (sharp strips it by default).
export async function processImage(
  input: ProcessImageInput,
): Promise<ProcessImageResult> {
  sharp.cache(false);
  sharp.concurrency(1);
  try {
    const source = sharp(
      Buffer.from(
        input.bytes.buffer,
        input.bytes.byteOffset,
        input.bytes.byteLength,
      ),
      {
        failOn: "warning",
        limitInputPixels: input.limits.maxPixels,
        sequentialRead: true,
      },
    );
    const metadata = await source.metadata();
    if (
      metadata.width !== input.expected.width ||
      metadata.height !== input.expected.height
    )
      return { ok: false, reason: "decoded-size-mismatch" };
    const derivatives: ProducedDerivative[] = [];
    for (const request of input.derivatives) {
      const { data, info } = await source
        .clone()
        .rotate()
        .resize({
          fit: "inside",
          height: request.maxSide,
          width: request.maxSide,
          withoutEnlargement: true,
        })
        .webp({ quality: input.quality })
        .toBuffer({ resolveWithObject: true });
      derivatives.push({
        bytes: data,
        height: info.height,
        kind: request.kind,
        width: info.width,
      });
    }
    return { derivatives, ok: true };
  } catch {
    // Decoder messages describe untrusted input and are never surfaced or persisted.
    return { ok: false, reason: "decode-failed" };
  }
}

// One request frame in, one reply frame out; null means the request violated the protocol.
export async function handleRequest(frame: Buffer): Promise<Buffer | null> {
  const request = parseRequest(frame);
  if (request === null) return null;
  const result = await processImage({
    ...request.options,
    bytes: request.payload,
  });
  if (!result.ok)
    return encodeReply({ ok: false, reason: result.reason }, Buffer.alloc(0));
  return encodeReply(
    {
      derivatives: result.derivatives.map(({ bytes, height, kind, width }) => ({
        byteLength: bytes.length,
        height,
        kind,
        width,
      })),
      ok: true,
    },
    Buffer.concat(result.derivatives.map(({ bytes }) => bytes)),
  );
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/* v8 ignore start -- the process shell runs only inside the isolated child; the integration tests
   exercise it for real. It starts only when this file is the entry point, so tests can import it. */
if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  handleRequest(await readStdin()).then(
    (reply) => {
      if (reply === null) process.exit(workerExitCodes.protocolViolation);
      process.stdout.write(reply, () => process.exit(0));
    },
    () => process.exit(workerExitCodes.unexpectedError),
  );
}
/* v8 ignore stop */
