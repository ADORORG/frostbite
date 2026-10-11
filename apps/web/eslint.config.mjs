import { nextJsConfig } from "@repo/eslint-config/next-js";

// `public/play` holds the games built from /games (generated, bundled output); the source is linted there.
export default [{ ignores: ["public/play/**"] }, ...nextJsConfig];
