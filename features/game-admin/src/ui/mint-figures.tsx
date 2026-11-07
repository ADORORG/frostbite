"use client";

import type { ListGameMintTotalsResponse } from "@frostbite/shared/games";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import { unitsLabel } from "../domain/mint-copy.ts";

type Row = ListGameMintTotalsResponse["games"][number];

const Totals = createContext<ReadonlyMap<string, Row> | null>(null);

// Reads the totals of every game once, for the figures each game's tile shows: one request however many games there are, answered from
// a row per game.
export function MintFiguresBoundary({
  api: injected,
  children,
}: {
  readonly api?: GameAdminApi;
  readonly children: ReactNode;
}) {
  const api = useMemo(() => injected ?? createGameAdminApi(), [injected]);
  const [held, setHeld] = useState<ReadonlyMap<string, Row> | null>(null);
  useEffect(() => {
    let current = true;
    api
      .mintTotals()
      .then(({ games }) => {
        if (current) setHeld(new Map(games.map((row) => [row.gameId, row])));
      })
      .catch(() => {
        if (current) setHeld(new Map());
      });
    return () => {
      current = false;
    };
  }, [api]);
  return <Totals.Provider value={held}>{children}</Totals.Provider>;
}

// One game's figures on its tile: mints and the fees they carried. Nothing while the totals are being read, and nothing for a game
// the answer did not cover.
export function MintFigures({ gameId }: { readonly gameId: string }) {
  const row = useContext(Totals)?.get(gameId);
  if (row === undefined) return null;
  return (
    <p>
      {`${row.completed.toLocaleString("en-US")} minted · ${unitsLabel(row.feesAccruedUnits)} in fees`}
    </p>
  );
}
