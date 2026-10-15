import "./zod-config.ts";
import { z } from "zod";

import { jsonValueSchema, type JsonValue } from "./protocol.ts";

// A run record: what a game says happened in one deterministic run, in a form the platform can replay on its own
// server and check. It is a claim about inputs, not proof of a person: replay shows the inputs are legal and lead to
// the claimed result, nothing more. See docs/product/run-record.md.

export const runRecordSchemaVersion = 1;

// Absolute ceilings, whatever a platform policy allows: a record is untrusted input, and these keep it small enough to
// parse and replay cheaply. A platform may allow less, never more.
export const maxRunInputs = 5_000;
// The same size the platform allows for a game's saved progress (64 KB), measured on the canonical text.
export const maxRunRecordBytes = 65_536;
export const maxRunClaims = 64;

const slug = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u);

// One step of the run, in order. There is no time in it: a step is a step. `type` says what the player did; `data` is
// whatever that kind of step needs (the verifier for the game defines it and refuses what it does not accept).
export const runInputSchema = z
  .object({
    data: jsonValueSchema.optional(),
    type: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/u),
  })
  .strict();
export type RunInput = z.infer<typeof runInputSchema>;

export const runRecordSchema = z
  .object({
    claims: z.array(slug).max(maxRunClaims),
    // The game's own settings for the run (for example how many mines), which the verifier checks and bounds.
    config: z.record(z.string().min(1).max(64), jsonValueSchema),
    gameId: slug,
    inputs: z.array(runInputSchema).max(maxRunInputs),
    schemaVersion: z.literal(runRecordSchemaVersion),
    // The seed the whole run's randomness comes from: 32 bits, so every engine reproduces it exactly.
    seed: z.int().min(0).max(0xffff_ffff),
    // Which platform-held verifier replays this record, and which version of its rules.
    verifier: slug,
    verifierVersion: z.int().min(1).max(0xffff),
  })
  .strict();
export type RunRecord = z.infer<typeof runRecordSchema>;

// The one text a record has: keys sorted, no whitespace. The same record is always the same text, so it can be
// stored once, measured and hashed.
export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value).sort(([left], [right]) =>
    left < right ? -1 : 1,
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}

export interface RunStart {
  readonly config?: Readonly<Record<string, JsonValue>>;
  readonly gameId: string;
  readonly seed: number;
  readonly verifier: string;
  readonly verifierVersion: number;
}

// What a game uses to build a record as it plays: note each input as it happens, then finish with the milestones it
// says the run earned. Finishing checks the record against the schema, so a game cannot hand over one the platform would
// refuse for its shape.
export function createRunRecorder(start: RunStart) {
  const inputs: RunInput[] = [];
  return {
    finish(claims: readonly string[]): RunRecord {
      return runRecordSchema.parse({
        claims: [...claims],
        config: { ...start.config },
        gameId: start.gameId,
        inputs,
        schemaVersion: runRecordSchemaVersion,
        seed: start.seed,
        verifier: start.verifier,
        verifierVersion: start.verifierVersion,
      });
    },
    input(type: string, data?: JsonValue): void {
      if (inputs.length >= maxRunInputs)
        throw new RangeError("A run record holds too many inputs.");
      inputs.push(data === undefined ? { type } : { data, type });
    },
  };
}
