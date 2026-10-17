import {
  administeredGame,
  chain,
  game,
  network,
  service,
  startAndSign,
} from "./fixture.ts";

// Signs, sends, lets the network confirm and follows the step to where it stops.
export async function runToEnd(input: Parameters<typeof startAndSign>[0]) {
  const { signed, step } = await startAndSign(input);
  const sent = await service.submitSigned({
    signed,
    staffId: input.staffId,
    stepId: step.id,
  });
  if (!sent.ok) throw new Error("not sent");
  network.controls.advance(chain, 3);
  let last = sent.step;
  for (let turn = 0; turn < 4; turn += 1) {
    const refreshed = await service.refresh(step.id);
    if (!refreshed.ok) throw new Error("not refreshed");
    last = refreshed.step;
  }
  return last;
}

// The game as the platform finds it before its contract is made.
export const withoutContract = () => {
  game.current = { ...administeredGame(), contract: null };
};
