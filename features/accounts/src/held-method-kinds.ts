import type { MethodRegistry } from "@frostbite/auth";
import type { MethodKind } from "@frostbite/shared/accounts";

// The kinds of method an account holds, as authorization asks for them.
export function createHeldMethodKinds<Context>(
  methods: Pick<MethodRegistry<Context>, "list">,
) {
  return async (
    context: Context,
    userId: string,
  ): Promise<ReadonlySet<MethodKind>> =>
    new Set((await methods.list(context, userId)).map(({ kind }) => kind));
}
