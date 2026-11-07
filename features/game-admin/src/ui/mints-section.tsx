"use client";

import type { ListGameMintsResponse } from "@frostbite/shared/games";
import { ArcadeActionButton, SectionBlock } from "@repo/ui/arcade";
import { useEffect, useMemo, useState } from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import { shortAddress, unitsLabel } from "../domain/mint-copy.ts";

type Mint = ListGameMintsResponse["mints"][number];

// A game's mints and what the platform fee has brought in: the totals, then its completed mints newest first, a page at a time. The
// totals are read from a row kept for the game and the list by its index, so this costs the same however many mints there are.
export function MintsSection({
  api: injected,
  gameId,
}: {
  readonly api?: GameAdminApi;
  readonly gameId: string;
}) {
  const api = useMemo(() => injected ?? createGameAdminApi(), [injected]);
  const [totals, setTotals] = useState<ListGameMintsResponse["totals"] | null>(
    null,
  );
  const [mints, setMints] = useState<readonly Mint[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    api
      .mints(gameId)
      .then((page) => {
        if (!current) return;
        setTotals(page.totals);
        setMints(page.mints);
        setNext(page.next);
        setProblem(null);
      })
      .catch(() => {
        if (current)
          setProblem("The mints could not be loaded. Reload the page.");
      });
    return () => {
      current = false;
    };
  }, [api, gameId]);
  const older = async (after: string) => {
    setWorking(true);
    try {
      const page = await api.mints(gameId, after);
      setTotals(page.totals);
      setMints((held) => [...held, ...page.mints]);
      setNext(page.next);
      setProblem(null);
    } catch {
      setProblem("The older mints could not be loaded. Try again.");
    } finally {
      setWorking(false);
    }
  };
  return (
    <SectionBlock
      description="Milestones players have minted, and the platform fee they carried."
      title="Mints and fees"
    >
      {problem === null ? null : <p role="alert">{problem}</p>}
      {totals === null ? (
        problem === null ? (
          <p role="status">Loading the mints…</p>
        ) : null
      ) : (
        <dl aria-label="Mint totals" className="mint-totals">
          <div>
            <dt>Minted</dt>
            <dd>{totals.completed.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>On their way</dt>
            <dd>{totals.inProgress.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Fees accrued</dt>
            <dd>{unitsLabel(totals.feesAccruedUnits)}</dd>
          </div>
        </dl>
      )}
      {totals !== null && mints.length === 0 ? (
        <p>No milestone has been minted from this game yet.</p>
      ) : null}
      {mints.length === 0 ? null : (
        <ul aria-label="Latest mints" className="mint-list">
          {mints.map((mint) => (
            <li key={mint.claimId}>
              <span>{mint.completedAt.slice(0, 16).replace("T", " ")}</span>
              <span>{mint.milestoneId}</span>
              <span title={mint.wallet}>{shortAddress(mint.wallet)}</span>
              <span>
                {mint.platformFeeUnits === "0"
                  ? "no fee"
                  : unitsLabel(mint.platformFeeUnits)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {next === null ? null : (
        <ArcadeActionButton busy={working} onClick={() => void older(next)}>
          Show older mints
        </ArcadeActionButton>
      )}
    </SectionBlock>
  );
}
