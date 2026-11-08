import { idempotencyKeySchema } from "@frostbite/shared/http";
import { uuidV7Schema } from "@frostbite/shared/identifiers";

// A signed-in request and an anonymous one, as the HTTP layer hands them to an operation.
export const userId = uuidV7Schema.parse(
  "01890f0e-7c8a-7b3a-8a3e-0123456789ab",
);
export const otherUserId = uuidV7Schema.parse(
  "01890f0e-7c8a-7b3a-8a3e-0123456789ac",
);
export const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
  idempotencyKey: idempotencyKeySchema.parse("request-key-00000001"),
};
export const anonymous = { ...context, actorUserId: null };
export const other = { ...context, actorUserId: otherUserId };
