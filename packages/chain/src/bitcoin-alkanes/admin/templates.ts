import type { AlkaneId } from "../node/alkane-id.ts";

// A template the platform has decided to publish, as configuration states it: where it lives on the chain (its id after it is
// published), the hash of its code, the read-only opcode it is published with, and how to load the code. The hash is checked
// against the loaded code before anything is built, so a wrong file cannot be published under a trusted name.
export interface TemplateEntry {
  readonly alkane: AlkaneId;
  // Lower-case SHA-256 of the uncompressed wasm.
  readonly codeHash: string;
  readonly load: () => Promise<Uint8Array>;
  readonly readOnlyOpcode: bigint;
}

// What administering games needs beyond the transaction options.
export interface AdminOptions {
  // The template `deploy` gives every game for its collectibles.
  readonly collectibleTemplate: string;
  // The most a template's code may weigh uncompressed: what a published template is checked against before it is unpacked.
  readonly maxCodeBytes: number;
  // The largest drawing a game's contract will store (`initialize` sets this bound on chain).
  readonly maxDrawingBytes: bigint;
  readonly random: (length: number) => Uint8Array;
  // Keyed by `templateKey(id, version)`.
  readonly templates: ReadonlyMap<string, TemplateEntry>;
}

export function templateKey(id: string, version: string): string {
  return `${id}@${version}`;
}
