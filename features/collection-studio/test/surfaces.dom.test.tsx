import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { chainOptionSchema } from "@ador/shared/chain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createCollectionStudioEntrypoint } from "../src/entrypoint.tsx";
import { CollectionsSurface } from "../src/ui/collections-surface.tsx";
import { WizardSurface } from "../src/ui/wizard-surface.tsx";
import { id, signet } from "./support/stubs.ts";

const enabled = chainOptionSchema.parse({
  chainId: signet,
  displayName: "Bitcoin signet",
  enabled: true,
  family: "bitcoin-alkanes",
  role: "public-beta",
});
const disabled = chainOptionSchema.parse({
  chainId: "eip155:1",
  displayName: "Disabled chain",
  enabled: false,
  family: "evm",
  role: "production",
});
const navigation = [
  {
    area: "studio",
    current: "page",
    href: "/studio/collections",
    label: "Collections",
  },
] as const;

describe("collection pages", () => {
  it("frame the list in the platform shell, with a heading and the studio notices", () => {
    const markup = renderToStaticMarkup(
      <CollectionsSurface navigation={navigation} targetChains={[enabled]} />,
    );
    expect(markup).toContain("<h1>Collections</h1>");
    expect(markup).toContain("Skip to main content");
    expect(markup).toContain("PRIVATE DRAFTS");
    expect(markup).toContain("NO CHAIN ACTION");
    expect(markup).toContain('href="/studio/collections"');
    expect(markup).toContain("Loading your collections…");
    expect(markup).toContain("Start a collection");
  });

  it("frame one draft's wizard, which loads in the browser", () => {
    const markup = renderToStaticMarkup(
      <WizardSurface
        collectionId={id()}
        navigation={navigation}
        targetChains={[enabled]}
      />,
    );
    expect(markup).toContain("<h1>Collection</h1>");
    expect(markup).toContain("Loading your collection…");
    expect(markup).toContain("only you can see it");
  });

  it("are registered by the entrypoint with the enabled chains only", () => {
    const entrypoint = createCollectionStudioEntrypoint(
      createProviderRegistry([]),
      [enabled, disabled],
    );
    const [list, wizard] = entrypoint.pages ?? [];
    const context = { actorUserId: id(), navigation, params: {} };
    const listMarkup = renderToStaticMarkup(<>{list?.render(context)}</>);
    expect(listMarkup).toContain("Bitcoin signet");
    expect(listMarkup).not.toContain("Disabled chain");
    const wizardMarkup = renderToStaticMarkup(
      <>{wizard?.render({ ...context, params: { collectionId: id() } })}</>,
    );
    expect(wizardMarkup).toContain("Loading your collection…");
  });
});
