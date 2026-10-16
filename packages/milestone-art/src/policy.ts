// How large and how complex a drawing may be. The values come from configuration (the contract's own byte limit is set when a
// game is deployed), so they are arguments, never constants here.
export interface DrawingPolicy {
  // The most characters of one attribute value.
  readonly maxAttributeLength: number;
  // The most bytes of drawing, before and after cleaning.
  readonly maxBytes: number;
  // The deepest nesting of elements, the root being depth 1.
  readonly maxDepth: number;
  // The most elements, the root included.
  readonly maxElements: number;
}

export function assertPolicy(policy: DrawingPolicy): void {
  for (const [name, value] of Object.entries(policy)) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(
        `The drawing policy's ${name} must be a positive whole number.`,
      );
    }
  }
}

// Why a drawing was refused, as a code the caller can act on and a detail a person can read.
export type Refusal =
  | "too-large"
  | "too-complex"
  | "forbidden-character"
  | "forbidden-markup"
  | "malformed"
  | "missing-root"
  | "unknown-element"
  | "unknown-attribute"
  | "bad-value"
  | "bad-reference";

export interface Failure {
  readonly detail: string;
  readonly ok: false;
  readonly reason: Refusal;
}

export type DrawingResult =
  { readonly ok: true; readonly svg: string } | Failure;

export function refuse(reason: Refusal, detail: string): Failure {
  return { detail, ok: false, reason };
}
