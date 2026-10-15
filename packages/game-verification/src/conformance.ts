import { createVerifierRegistry, type RegisteredVerifier } from "./registry.ts";
import { verifyRun } from "./verify.ts";

export interface ConformanceCheck {
  readonly detail: string;
  readonly name: string;
  readonly ok: boolean;
}

const notAMilestone = "no-such-milestone";
const notAnInput = "no-such-input";

// What every verifier the platform registers must do, checked against one legal sample run it supplies. It is the
// standard a game's rules are held to before the platform trusts a verdict from them: it verifies its own run, refuses
// what it should refuse, is the same every time, and uses no clock and no randomness. A failing check names itself.
export function runVerifierConformance(
  registration: RegisteredVerifier,
): readonly ConformanceCheck[] {
  const { sample } = registration;
  const registry = createVerifierRegistry([registration]);
  const check = (name: string, run: () => string | null): ConformanceCheck => {
    try {
      const failure = run();
      return { detail: failure ?? "ok", name, ok: failure === null };
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : "threw",
        name,
        ok: false,
      };
    }
  };
  const verdict = (record: unknown) => verifyRun(registry, record);
  return [
    check("verifies its own sample run", () => {
      const result = verdict(sample);
      if (result.status !== "verified")
        return `the sample was refused: ${result.reason} (${result.detail})`;
      const missing = sample.claims.filter((id) => !result.earned.includes(id));
      return missing.length === 0
        ? null
        : `the replay did not earn ${missing.join(", ")}`;
    }),
    check("refuses a claim the run did not earn", () =>
      verdict({ ...sample, claims: [...sample.claims, notAMilestone] })
        .status === "rejected"
        ? null
        : "a milestone the run did not earn was accepted",
    ),
    check("refuses an input the game does not have", () => {
      const result = verdict({
        ...sample,
        inputs: [...sample.inputs, { type: notAnInput }],
      });
      return result.status === "rejected" && result.reason === "illegal-input"
        ? null
        : "an unknown input was not refused as illegal";
    }),
    check("gives the same verdict every time", () =>
      JSON.stringify(verdict(sample)) === JSON.stringify(verdict(sample))
        ? null
        : "two replays of one record differed",
    ),
    check("uses neither the clock nor randomness", () => {
      const now = Date.now;
      const random = Math.random;
      Date.now = () => {
        throw new Error("the rules read the clock");
      };
      Math.random = () => {
        throw new Error("the rules used Math.random");
      };
      try {
        const result = verdict(sample);
        return result.status === "verified"
          ? null
          : `with the clock and Math.random unavailable the sample was refused: ${result.reason}`;
      } finally {
        Date.now = now;
        Math.random = random;
      }
    }),
    check("answers a verdict, never an error, for odd inputs", () => {
      const odd: readonly unknown[] = [
        null,
        0,
        -1,
        1e9,
        "x",
        [],
        { a: [null] },
        true,
      ];
      for (let index = 0; index < odd.length * 4; index += 1) {
        const result = verdict({
          ...sample,
          inputs: [
            ...sample.inputs,
            { data: odd[index % odd.length], type: "pick" },
            { data: odd[(index + 3) % odd.length], type: "settle" },
          ],
        });
        if (result.status === "rejected" && result.reason === "verifier-error")
          return "the rules failed on an odd input instead of refusing it";
      }
      return null;
    }),
  ];
}
