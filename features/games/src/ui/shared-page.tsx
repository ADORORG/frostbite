import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import { ArcadeButton, ArcadePanel, StatusLamp } from "@repo/ui/arcade";

import { shareCopy } from "../domain/share-copy.ts";
import type { SharedView } from "../domain/shared-view.ts";
import { GamesFrame } from "./games-frame.tsx";

// The page a shared link opens: what was shared, how the platform knows it, and a way to play. It carries nothing about who shared it.
export function SharedPage({
  navigation,
  view,
}: {
  readonly navigation: readonly NavigationItem[];
  readonly view: SharedView;
}) {
  return (
    <GamesFrame navigation={navigation}>
      <ArcadePanel eyebrow={view.kicker} title={view.title}>
        <p>{view.subtitle}</p>
        {view.verification === null ? null : (
          <StatusLamp
            label={shareCopy.verification[view.verification]}
            tone={view.verification === "replay-verified" ? "ready" : "neutral"}
          />
        )}
        <ArcadeButton href={view.playHref} tone="cyan">
          {view.playLabel}
        </ArcadeButton>
      </ArcadePanel>
    </GamesFrame>
  );
}

// A link that is ended or never was. It says no more than that.
export function SharedNotFound({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <GamesFrame navigation={navigation}>
      <ArcadePanel title={shareCopy.notFoundTitle}>
        <p>{shareCopy.notFoundBody}</p>
        <ArcadeButton href="/games" tone="cyan">
          {shareCopy.browse}
        </ArcadeButton>
      </ArcadePanel>
    </GamesFrame>
  );
}
