import { createGameClient } from "@ador/game-sdk/client";

const out = document.getElementById("out");
const client = createGameClient({ timeoutMs: 200 });
void (async () => {
  try {
    await client.ready();
    const before = await client.progress.load();
    await client.progress.save({
      visits:
        typeof before === "object" &&
        before !== null &&
        "visits" in before &&
        typeof before.visits === "number"
          ? before.visits + 1
          : 1,
    });
    await client.milestones.unlock("first-five");
    const list = await client.milestones.list();
    const info = await client.player.info();
    if (out)
      out.textContent = `done ${list.filter((m) => m.status === "unlocked").length} ${String(info.signedIn)}`;
  } catch (error) {
    if (out)
      out.textContent = `failed ${error instanceof Error ? error.message : "?"}`;
  }
})();
