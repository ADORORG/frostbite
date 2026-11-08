import type { CSSProperties } from "react";

// A style object that may set CSS custom properties (`--name`) as well as ordinary properties, without a type assertion.
export type StyleWithVars = CSSProperties & {
  readonly [name: `--${string}`]: string;
};
