import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { chainOptionSchema } from "@ador/shared/chain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createCollectionStudioEntrypoint } from "../src/entrypoint.tsx";
import { CollectionsSurface } from "../src/ui/collections-surface.tsx";
import { NewCollectionSurface } from "../src/ui/new-collection-surface.tsx";
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
    // Starting a collection is a page of its own, reached by a button here, never a form on this page.
    expect(markup).toContain('href="/studio/collections/new"');
    expect(markup).toContain("New collection");
    expect(markup).not.toContain("Collection name");
  });

  it("frame the page that starts a collection, with the form and a way back", () => {
    const markup = renderToStaticMarkup(
      <NewCollectionSurface navigation={navigation} targetChains={[enabled]} />,
    );
    expect(markup).toContain("<h1>New collection</h1>");
    expect(markup).toContain("Collection name");
    expect(markup).toContain("Bitcoin signet");
    expect(markup).toContain('href="/studio/collections"');
    expect(markup).toContain("Cancel");
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
    const [list, creating, wizard] = entrypoint.pages ?? [];
    const context = { actorUserId: id(), navigation, params: {} };
    const listMarkup = renderToStaticMarkup(<>{list?.render(context)}</>);
    // The list loads in the browser; the chains an entry may use are offered where a collection starts.
    expect(listMarkup).toContain("Loading your collections…");
    const createMarkup = renderToStaticMarkup(<>{creating?.render(context)}</>);
    expect(createMarkup).toContain("Bitcoin signet");
    expect(createMarkup).not.toContain("Disabled chain");
    const wizardMarkup = renderToStaticMarkup(
      <>{wizard?.render({ ...context, params: { collectionId: id() } })}</>,
    );
    expect(wizardMarkup).toContain("Loading your collection…");
  });
});
