// A template the platform has decided to publish, as configuration states it: the hash of its code, the read-only opcode it is
// published with, and how to load the code. The hash is checked against the loaded code before anything is built, so a wrong file
// cannot be published under a trusted name. Where it is published is not configuration: staff choose it when they publish, and it
// travels in the step.
export interface TemplateEntry {
  // Lower-case SHA-256 of the uncompressed wasm.
  readonly codeHash: string;
  readonly load: () => Promise<Uint8Array>;
  readonly readOnlyOpcode: bigint;
}

// What administering games needs beyond the transaction options.
export interface AdminOptions {
  // The most a template's code may weigh uncompressed: what a published template is checked against before it is unpacked.
  readonly maxCodeBytes: number;
  // The most a game's contract may be created to store (`initialize` sets the bound on chain); a step asks for its own, within this.
  readonly maxDrawingBytes: bigint;
  readonly random: (length: number) => Uint8Array;
  // Keyed by `templateKey(id, version)`.
  readonly templates: ReadonlyMap<string, TemplateEntry>;
}

export function templateKey(id: string, version: string): string {
  return `${id}@${version}`;
}
