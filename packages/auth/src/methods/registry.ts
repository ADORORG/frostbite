import {
  methodKindSchema,
  type LinkedMethod,
  type MethodAdapter,
  type MethodDescription,
} from "./contracts.ts";

export interface MethodRegistry<Context> {
  // The kinds this deployment offers, in the order they were registered.
  describe(): readonly MethodDescription[];
  // Every method the account has, from every adapter: the order they were registered, then by id, so the answer is the same each time.
  list(context: Context, userId: string): Promise<readonly LinkedMethod[]>;
  // A name for the account from the first method that has one (in registration order), or null.
  label(context: Context, userId: string): Promise<string | null>;
  // The accounts any method finds for the text, each once.
  lookup(context: Context, text: string): Promise<readonly string[]>;
}

// The set of sign-in methods a deployment offers, composed once at the composition root. A malformed or repeated kind, or a set in which
// nothing can sign in, stops boot: an account in such a deployment could never get in.
export function createMethodRegistry<Context>(
  adapters: readonly MethodAdapter<Context>[],
): MethodRegistry<Context> {
  const seen = new Set<string>();
  for (const adapter of adapters) {
    methodKindSchema.parse(adapter.kind);
    if (seen.has(adapter.kind))
      throw new Error(
        `The sign-in method "${adapter.kind}" is registered twice.`,
      );
    seen.add(adapter.kind);
  }
  if (!adapters.some(({ canSignIn }) => canSignIn))
    throw new Error(
      "At least one registered sign-in method must be able to sign in.",
    );
  return {
    describe: () =>
      adapters.map(({ assurance, canSignIn, kind }) => ({
        assurance,
        canSignIn,
        kind,
      })),
    list: async (context, userId) => {
      const listed = await Promise.all(
        adapters.map(async (adapter) => {
          const ids = await adapter.list(context, userId);
          if (ids.some((id) => id === "") || new Set(ids).size !== ids.length)
            throw new Error(
              `The "${adapter.kind}" method listed an empty or repeated id.`,
            );
          return [...ids].sort().map((id): LinkedMethod => ({
            assurance: adapter.assurance,
            canSignIn: adapter.canSignIn,
            id,
            kind: adapter.kind,
          }));
        }),
      );
      return listed.flat();
    },
    label: async (context, userId) => {
      for (const adapter of adapters) {
        const label = (await adapter.label?.(context, userId)) ?? null;
        if (label !== null) return label;
      }
      return null;
    },
    lookup: async (context, text) => {
      const found = await Promise.all(
        adapters.map((adapter) => adapter.lookup?.(context, text) ?? []),
      );
      return [...new Set(found.flat())];
    },
  };
}
