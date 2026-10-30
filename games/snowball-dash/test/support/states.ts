import { startSnowball } from "../../src/rules/course.ts";
import type { SnowballState } from "../../src/rules/types.ts";

// A run with the given rocks (none by default), and a way to change anything else about it.
export const withRocks = (
  rocks: readonly number[],
  over: Partial<SnowballState> = {},
): SnowballState => ({ ...startSnowball(1), rocks, ...over });
