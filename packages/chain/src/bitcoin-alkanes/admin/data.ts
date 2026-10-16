import { crypto } from "bitcoinjs-lib";
import { gunzipSync, gzipSync } from "node:zlib";

import { toHex } from "../node/hex.ts";
import type { AdminOptions, TemplateEntry } from "./templates.ts";
import { templateKey } from "./templates.ts";
import type { AdminSource } from "./action.ts";
import { StepRefusedError } from "./types.ts";

export function sha256Hex(bytes: Uint8Array): string {
  return toHex(crypto.sha256(bytes));
}

// A drawing is stored as its UTF-8 bytes, uncompressed (the Alkanes runtime reads a witness envelope without unpacking it).
export function drawingData(drawing: string): Uint8Array {
  return new TextEncoder().encode(drawing);
}

// A template's code is stored compressed, which the runtime does unpack.
export function packCode(code: Uint8Array): Uint8Array {
  return Uint8Array.from(gzipSync(code, { level: 9 }));
}

function unpackCode(data: Uint8Array, maxBytes: number): Uint8Array | null {
  try {
    return Uint8Array.from(gunzipSync(data, { maxOutputLength: maxBytes }));
  } catch {
    return null;
  }
}

export function configuredTemplate(
  source: Pick<AdminSource, "templateId" | "templateVersion">,
  options: Pick<AdminOptions, "templates">,
): TemplateEntry | undefined {
  return options.templates.get(
    templateKey(source.templateId ?? "", source.templateVersion ?? ""),
  );
}

// The witness data a step carries: a drawing for a milestone that has one, the packed code for a template, nothing otherwise. The
// code is checked against its configured hash first, so the file on disk cannot be published as something it is not.
export async function stepData(
  source: AdminSource,
  drawing: string | undefined,
  options: Pick<AdminOptions, "maxCodeBytes" | "templates">,
): Promise<Uint8Array | null> {
  if (source.operation === "define-milestone") {
    return drawing === undefined ? null : drawingData(drawing);
  }
  if (source.operation !== "publish-template") return null;
  const entry = configuredTemplate(source, options);
  if (entry === undefined) return null;
  const code = await entry.load();
  if (
    code.length > options.maxCodeBytes ||
    sha256Hex(code) !== entry.codeHash
  ) {
    throw new StepRefusedError(
      "The template's code is not the code its configuration names.",
    );
  }
  return packCode(code);
}

// Whether the data in the reveal is what the summary shown to the person says it is.
export function dataMatchesSummary(
  source: AdminSource,
  summary: {
    readonly drawing?:
      { readonly bytes: number; readonly sha256: string } | undefined;
    readonly template?: { readonly codeHash: string } | undefined;
  },
  data: Uint8Array | null,
  options: Pick<AdminOptions, "maxCodeBytes" | "templates">,
): boolean {
  switch (source.operation) {
    case "define-milestone":
      return data === null
        ? summary.drawing === undefined
        : summary.drawing?.bytes === data.length &&
            summary.drawing.sha256 === sha256Hex(data);
    case "publish-template": {
      const entry = configuredTemplate(source, options);
      const code =
        data === null ? null : unpackCode(data, options.maxCodeBytes);
      return (
        entry !== undefined &&
        code !== null &&
        summary.template?.codeHash === entry.codeHash &&
        sha256Hex(code) === entry.codeHash
      );
    }
    case "set-claims-paused":
      return data === null && summary.drawing === undefined;
    case "deploy":
      return (
        data === null &&
        summary.template?.codeHash ===
          configuredTemplate(source, options)?.codeHash
      );
  }
}
