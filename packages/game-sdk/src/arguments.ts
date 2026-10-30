// What a command says when its arguments cannot be read (an option it does not know, or one given with no value): the reason, then how to use
// it, instead of a stack trace. One wording for every command of the SDK.
export function argumentProblem(error: unknown, usage: string): string {
  return `${error instanceof Error ? error.message : "The arguments are not valid."}\n${usage}`;
}
