import type { GameAdminStep } from "@frostbite/shared/games";
import type { KeyValue } from "@repo/ui/arcade";

import { shortHash } from "./copy.ts";

// "23 Oct 19:06 UTC": a time for a person to read, in UTC so it reads the same everywhere. Not a date for a machine.
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
export function shortTime(iso: string): string {
  const at = new Date(iso);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${at.getUTCDate()} ${months[at.getUTCMonth()] ?? ""} ${two(at.getUTCHours())}:${two(at.getUTCMinutes())} UTC`;
}

// What a step does and where, as facts for the review: only those the step has. The fee is told apart (it has its own card).
export function stepFacts({
  summary,
}: Pick<GameAdminStep, "summary">): readonly KeyValue[] {
  const { template } = summary;
  return [
    { label: "Network", mono: true, value: summary.chain },
    { label: "Rewards contract", mono: true, value: summary.contractId },
    {
      label: "Template",
      value:
        template === undefined
          ? undefined
          : `${template.id} ${template.version}`,
    },
    { label: "Published at", mono: true, value: template?.address },
    {
      label: "Collectibles are made from the template at",
      mono: true,
      value: summary.collectibleAddress,
    },
    {
      label: "Largest drawing the contract will keep",
      value:
        summary.maxDrawingBytes === undefined
          ? undefined
          : `${summary.maxDrawingBytes} bytes`,
    },
    { label: "Claims allowed per wallet", value: summary.claimLimit },
    {
      label: "Drawing",
      value:
        summary.drawing === undefined
          ? undefined
          : `${summary.drawing.bytes} bytes, ${shortHash(summary.drawing.sha256)}`,
    },
    {
      label: "Claims will be",
      value:
        summary.paused === undefined
          ? undefined
          : summary.paused
            ? "paused"
            : "open",
    },
    { label: "Valid until", value: shortTime(summary.expiresAt) },
  ];
}
