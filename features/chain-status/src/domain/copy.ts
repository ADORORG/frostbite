import type { StatusTone } from "@repo/ui/arcade";
import type { ChainIndexing } from "@ador/shared/chain";

// What the lamp says, in the platform's words. "Delayed" is about waiting and never about failing: nothing sent is lost or cancelled.
export interface IndexingLampView {
  readonly detail: string;
  readonly label: string;
  readonly tone: StatusTone;
}

const blocks = (count: number) => `${count} block${count === 1 ? "" : "s"}`;

export const unreachableLamp: IndexingLampView = {
  detail:
    "The platform could not be asked how the chain is doing. This page may be out of date; nothing you have sent is affected.",
  label: "Chain status unknown",
  tone: "neutral",
};

// The lamp for what the platform answered, or nothing where it follows no chain.
export function lampFor(
  indexing: Exclude<ChainIndexing, { state: "none" }>,
): IndexingLampView {
  if (indexing.state === "unavailable")
    return {
      detail: `The platform could not ask ${indexing.chain} how far its indexer has read. Nothing you have sent is affected; steps and claims show as complete only when the chain's records agree.`,
      label: "Chain status unknown",
      tone: "neutral",
    };
  const where = `${indexing.chain}: the indexer has read to block ${indexing.indexedHeight} of ${indexing.tipHeight}.`;
  switch (indexing.health) {
    case "current":
      return {
        detail: `${where} Everything on the chain is up to date.`,
        label: "Chain in sync",
        tone: "ready",
      };
    case "catching-up":
      return {
        detail: `${where} It is ${blocks(indexing.lag)} behind, which is normal. New transactions may take a little longer to show as complete.`,
        label: `${blocks(indexing.lag)} behind`,
        tone: "ready",
      };
    case "delayed":
      return {
        detail: `${where} It is ${blocks(indexing.lag)} behind. Steps and claims already sent are not lost and have not failed; they show as complete once the indexer catches up.`,
        label: `Delayed, ${blocks(indexing.lag)} behind`,
        tone: "attention",
      };
  }
}
