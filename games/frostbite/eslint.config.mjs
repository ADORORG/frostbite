import { config } from "@repo/eslint-config/base";

// The legacy folder is the pre-platform game's code, copied as it was (src/legacy/README.md); it is not linted.
export default [{ ignores: ["src/legacy/**"] }, ...config];
