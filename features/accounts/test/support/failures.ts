import { ApiError } from "@frostbite/client-http";

// A failure as the requester reports it: the status class, and the reason the server named (none for what only the platform answers, such as
// a rate limit or a connection that never arrived).
export const apiFailure = (
  code: ApiError["code"],
  reason: string | null = null,
  message = "the server said no",
) => new ApiError(code, 400, message, null, reason);
