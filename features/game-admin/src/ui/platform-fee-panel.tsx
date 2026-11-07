"use client";

import type { GetPlatformFeeResponse } from "@frostbite/shared/games";
import { ArcadeInfoCard, SectionBlock, shortenMiddle } from "@repo/ui/arcade";
import { useEffect, useMemo, useState } from "react";

import { createGameAdminApi, type GameAdminApi } from "../client/api.ts";
import { shortAddress, unitsLabel } from "../domain/mint-copy.ts";
import { PlatformFeeForm } from "./platform-fee-form.tsx";

type ChainFee = GetPlatformFeeResponse["chains"][number];

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

function Current({ chain }: { readonly chain: ChainFee }) {
  const { current } = chain;
  if (current === null)
    return (
      <p>
        No fee is set. Claims carry no platform fee until one is saved here.
      </p>
    );
  return (
    <p>
      {current.feeUnits === "0"
        ? "No fee is charged."
        : `Each claim carries ${unitsLabel(current.feeUnits)} for the platform, paid to `}
      {current.feeUnits === "0" ? null : (
        <span title={current.treasury}>{shortAddress(current.treasury)}</span>
      )}
      {`. Set ${when(current.changedAt)} by ${current.changedBy ?? "an account that no longer exists"}.`}
    </p>
  );
}

// The platform's fee on milestone claims, for each network a game is on: what is charged now, who set it and when, a form that sets the
// fee and its treasury address together, and the settings before. Changing it affects the next claim a player starts; a claim already
// built keeps the fee it was shown.
export function PlatformFeePanel({
  api: injected,
}: {
  readonly api?: GameAdminApi;
}) {
  const api = useMemo(() => injected ?? createGameAdminApi(), [injected]);
  const [fees, setFees] = useState<GetPlatformFeeResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Read when the page opens, and again after a setting is saved, so what is shown is what the platform holds.
  const [reads, setReads] = useState(0);
  useEffect(() => {
    let current = true;
    api
      .platformFee()
      .then((held) => {
        if (!current) return;
        setFees(held);
        setProblem(null);
      })
      .catch(() => {
        if (current)
          setProblem("The platform fee could not be loaded. Reload the page.");
      });
    return () => {
      current = false;
    };
  }, [api, reads]);
  if (fees === null)
    return (
      <ArcadeInfoCard title="Platform fee">
        <p role={problem === null ? "status" : "alert"}>
          {problem ?? "Loading the platform fee…"}
        </p>
      </ArcadeInfoCard>
    );
  return (
    <SectionBlock
      description="What the platform charges on top of the network fee each time a player mints a milestone. The player is shown it before they sign."
      title="Platform fee"
    >
      {fees.chains.map((chain) => (
        <div data-testid={`platform-fee-${chain.chain}`} key={chain.chain}>
          <h3 title={chain.chain}>
            {shortenMiddle(chain.chain, { head: 10, tail: 4 })}
          </h3>
          <Current chain={chain} />
          <PlatformFeeForm
            chain={chain}
            onSave={async (input) => {
              const answer = await api.setPlatformFee(input);
              if (answer.status === "saved") setReads((count) => count + 1);
              return answer;
            }}
          />
          {chain.history.length === 0 ? null : (
            <details>
              <summary>{`Earlier settings (${String(chain.history.length)})`}</summary>
              <ul aria-label={`Earlier fee settings on ${chain.chain}`}>
                {chain.history.map((setting) => (
                  <li key={setting.changedAt}>
                    {`${when(setting.changedAt)}: ${setting.feeUnits === "0" ? "no fee" : unitsLabel(setting.feeUnits)} to ${shortAddress(setting.treasury)}, set by ${setting.changedBy ?? "an account that no longer exists"}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </SectionBlock>
  );
}
