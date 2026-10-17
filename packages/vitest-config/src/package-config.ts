import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Coverage floor in percent. It sits a hair above 90 because the repository rule is "above 90",
 * and a report that rounds to exactly 90.0 must fail.
 */
export const defaultCoverageThreshold = 90.01;

/** Reporters every workspace emits: human text, a machine summary, and lcov for the merged report. */
const coverageReporters = ["text", "json-summary", "lcov"];

/** The integration suites of database-backed packages are slower than the five-second default. */
export const databaseTestTimeoutMs = 15_000;

/** jsdom suites render whole React trees; on a busy machine they exceed the five-second default without being wrong. */
export const domTestTimeoutMs = 15_000;

/** Unit suites in node are fast alone, but a busy machine running many workspaces at once pushes some past the five-second default. */
export const unitTestTimeoutMs = 15_000;

/** File suffix a test glob matches: `.ts` files, `.tsx` files, or both. */
export type TestExtension = "ts" | "tsx" | "{ts,tsx}";

export interface PackageVitestOptions {
  readonly coverage: {
    readonly exclude?: readonly string[];
    /** Source globs the coverage report and its thresholds measure. */
    readonly include: readonly string[];
    /** Overrides `defaultCoverageThreshold` for a package that guards a critical invariant. */
    readonly threshold?: number;
  };
  /**
   * Adds a `unit-dom` project that runs `*.dom.test.{ts,tsx}` in jsdom with this setup file
   * (relative to the package). Other projects keep the package environment.
   */
  readonly dom?: { readonly setupFile: string };
  /** Environment of the unit and integration projects (inline projects do not inherit the root's). Defaults to node. */
  readonly environment?: "jsdom" | "node";
  /** `false` for packages whose integration files share one database. Defaults to true. */
  readonly fileParallelism?: boolean;
  /** Per-test timeout of the integration project, for suites that need more than the default. */
  readonly integrationTimeoutMs?: number;
  /** Adds the React plugin, for packages that contain `.tsx` source. */
  readonly react?: boolean;
  /** Resolves `paths` from the package tsconfig. */
  readonly tsconfigPaths?: boolean;
  /** Test file suffixes per project. Both default to `ts`. */
  readonly tests?: {
    readonly integration?: TestExtension;
    readonly unit?: TestExtension;
  };
}

/**
 * The vitest configuration every workspace shares: a `unit` and an `integration` project selected
 * by file name (`*.unit.test.*`, `*.integration.test.*`), v8 coverage with thresholds, and the
 * few per-package differences as explicit options.
 */
export function packageVitestConfig(options: PackageVitestOptions) {
  const unit = options.tests?.unit ?? "ts";
  const integration = options.tests?.integration ?? "ts";
  const threshold = options.coverage.threshold ?? defaultCoverageThreshold;
  const environment = options.environment;
  const withEnvironment = environment === undefined ? {} : { environment };
  return defineConfig({
    ...(options.react === true ? { plugins: [react()] } : {}),
    ...(options.tsconfigPaths === true
      ? { resolve: { tsconfigPaths: true } }
      : {}),
    test: {
      coverage: {
        ...(options.coverage.exclude === undefined
          ? {}
          : { exclude: [...options.coverage.exclude] }),
        include: [...options.coverage.include],
        provider: "v8",
        reporter: coverageReporters,
        thresholds: {
          branches: threshold,
          functions: threshold,
          lines: threshold,
          statements: threshold,
        },
      },
      ...(options.fileParallelism === false ? { fileParallelism: false } : {}),
      projects: [
        {
          test: {
            include: [`test/**/*.unit.test.${unit}`],
            name: "unit",
            testTimeout: unitTestTimeoutMs,
            ...withEnvironment,
          },
        },
        ...(options.dom === undefined
          ? []
          : [
              {
                test: {
                  environment: "jsdom" as const,
                  include: ["test/**/*.dom.test.{ts,tsx}"],
                  name: "unit-dom",
                  setupFiles: [options.dom.setupFile],
                  testTimeout: domTestTimeoutMs,
                },
              },
            ]),
        {
          test: {
            include: [`test/**/*.integration.test.${integration}`],
            name: "integration",
            ...withEnvironment,
            ...(options.integrationTimeoutMs === undefined
              ? {}
              : { testTimeout: options.integrationTimeoutMs }),
          },
        },
      ],
    },
  });
}
