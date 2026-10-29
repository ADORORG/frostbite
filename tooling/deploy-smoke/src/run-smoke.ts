import { checks, type Check } from "./checks.ts";

export interface SmokeResult {
  readonly detail: string;
  readonly name: string;
  readonly ok: boolean;
}

// Runs every check against one deployment, one after another (it is one visitor, not a load test), and reports each, so a failure
// shows everything that is wrong at once. A request that does not answer in time is a failed check, not a hung command. Redirects
// are not followed: a check that wants to see one sees it.
export async function runSmoke(
  base: URL,
  options: {
    readonly checks?: readonly Check[];
    readonly fetcher?: typeof fetch;
    readonly timeoutMs: number;
  },
): Promise<readonly SmokeResult[]> {
  const fetcher = options.fetcher ?? fetch;
  const context = {
    base,
    get: (path: string) =>
      fetcher(new URL(path, base), {
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs),
      }),
  };
  const results: SmokeResult[] = [];
  for (const check of options.checks ?? checks) {
    try {
      await check.run(context);
      results.push({ detail: "ok", name: check.name, ok: true });
    } catch (cause) {
      results.push({
        detail: cause instanceof Error ? cause.message : "failed",
        name: check.name,
        ok: false,
      });
    }
  }
  return results;
}
