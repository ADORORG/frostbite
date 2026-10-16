import { devConfigSchema, hostedGameOf } from "./config.ts";
import { mountDevPage } from "./page-controller.ts";

// The browser's start: ask the server what game this is, then mount the page. A page that cannot say what is wrong would be a blank
// one, so a failure is written on the page.
async function start(): Promise<void> {
  const stage = document.getElementById("dev-stage");
  try {
    const answer = await fetch("/dev-config.json");
    const config = devConfigSchema.parse(await answer.json());
    mountDevPage({
      document,
      game: hostedGameOf(config.game),
      src: config.src,
      storage: window.localStorage,
      window,
    });
  } catch (error) {
    stage?.replaceChildren(
      Object.assign(document.createElement("p"), {
        textContent: `The test page could not start: ${error instanceof Error ? error.message : "unknown error"}`,
      }),
    );
  }
}

void start();
