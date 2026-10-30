# `@repo/vitest-config`

The vitest configuration every workspace shares. Before it existed, 43 workspaces each carried a copy of the same 25 to 40 lines
(coverage reporters, the 90.01 floor, the `unit` and `integration` projects), and a change to any of them had to be made 43 times.

## Public API

`packageVitestConfig(options)` returns a vitest configuration with:

- a `unit` project (`test/**/*.unit.test.*`) and an `integration` project (`test/**/*.integration.test.*`), so the scripts
  `vitest run --project unit` and `--project integration` select by file name;
- v8 coverage with the `text`, `json-summary` and `lcov` reporters and one floor, `defaultCoverageThreshold` (90.01, because the
  rule is "above 90"), on every metric.

A workspace states only what is its own:

| Option                   | Meaning                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `coverage.include`       | the source globs measured (required)                                                              |
| `coverage.exclude`       | globs left out of the report, with the reason in a comment beside the call                        |
| `coverage.threshold`     | a stricter floor for a package that guards a critical invariant (for example `100`)               |
| `tests`                  | `{ unit, integration }` suffix: `"ts"` (default), `"tsx"` or `"{ts,tsx}"`                         |
| `environment`            | `"node"` (default) or `"jsdom"` for the unit and integration projects                             |
| `dom`                    | `{ setupFile }` adds a `unit-dom` project for `*.dom.test.{ts,tsx}` in jsdom                      |
| `react`, `tsconfigPaths` | add the React plugin, or resolve `paths` from the tsconfig                                        |
| `fileParallelism`        | `false` when the integration files share one database                                             |
| `integrationTimeoutMs`   | a longer per-test timeout for the integration project (`databaseTestTimeoutMs` is the usual 15 s) |

```ts
import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: { include: ["src/**/*.ts"] },
});
```

Inline vitest projects do not inherit the root's `environment`, so the option is applied to each project.

## Workspaces that keep their own file

`test/adoption.integration.test.ts` fails if a workspace's vitest configuration neither uses this package nor appears in its
list of exceptions with a reason: `@repo/client-react` (plugin and setup per project), `@repo/typescript-config` (tests its own
files), `@repo/eslint-config` (plain JavaScript), and this package (defines the builder).

## Verification

`pnpm --filter @repo/vitest-config test:unit | test:integration | test:coverage | typecheck | lint`. The unit tests read the
returned configuration as data; mutation proof is in `references/shared-vitest-config-task-record.md`.

Owner: the repository maintainers. A new option needs two workspaces that use it; otherwise the workspace keeps its own file.

## Ownership

Platform engineering.
