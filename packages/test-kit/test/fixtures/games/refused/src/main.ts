import { createGameClient } from "@frostbite/game-sdk/client";

const client = createGameClient({ timeoutMs: 100 });
void client
  .ready()
  .then(() => client.milestones.unlock("not-declared"))
  .catch(() => undefined);
