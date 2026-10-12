// @ts-expect-error The module is missing on purpose: the conformance check must report a script that does not bundle.
import { missing } from "./missing-file.ts";

console.log(missing);
