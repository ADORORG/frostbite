import {
  assetRejectionReasonSchema,
  derivativeKindSchema,
} from "@ador/shared/uploads";
import { z } from "zod";

// Frame: 4-byte big-endian header length, a JSON header, then the binary payload.
const lengthPrefixBytes = 4;
export const maximumHeaderBytes = 65_536;

const positiveInteger = z.number().int().positive();

export const responseHeaderSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    derivatives: z.array(
      z.strictObject({
        byteLength: positiveInteger,
        height: positiveInteger,
        kind: derivativeKindSchema,
        width: positiveInteger,
      }),
    ),
    ok: z.literal(true),
  }),
  z.strictObject({ ok: z.literal(false), reason: assetRejectionReasonSchema }),
]);

export type ResponseHeader = z.infer<typeof responseHeaderSchema>;

export function encodeFrame(header: object, payload: Uint8Array): Buffer {
  const json = Buffer.from(JSON.stringify(header));
  const prefix = Buffer.alloc(lengthPrefixBytes);
  prefix.writeUInt32BE(json.length);
  return Buffer.concat([prefix, json, payload]);
}

// The frame comes from another process, so the header is parsed against its schema before use.
export function decodeFrame<Header>(
  frame: Uint8Array,
  schema: z.ZodType<Header>,
): { readonly header: Header; readonly payload: Uint8Array } | null {
  const buffer = Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength);
  if (buffer.length < lengthPrefixBytes) return null;
  const headerLength = buffer.readUInt32BE(0);
  const end = lengthPrefixBytes + headerLength;
  if (headerLength > maximumHeaderBytes || end > buffer.length) return null;
  let value;
  try {
    value = JSON.parse(
      buffer.subarray(lengthPrefixBytes, end).toString("utf8"),
    );
  } catch {
    return null;
  }
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { header: parsed.data, payload: buffer.subarray(end) }
    : null;
}
