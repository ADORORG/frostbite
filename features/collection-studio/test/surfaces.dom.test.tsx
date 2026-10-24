import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { chainOptionSchema, type ChainOption } from "@ador/shared/chain";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createCollectionStudioEntrypoint } from "../src/entrypoint.tsx";
import { CollectionsSurface } from "../src/ui/collections-surface.tsx";
import { StudioHomeSurface } from "../src/ui/studio-home-surface.tsx";
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
  it("frame the list in the platform shell, with a heading", () => {
    const markup = renderToStaticMarkup(
      <CollectionsSurface navigation={navigation} targetChains={[enabled]} />,
    );
    expect(markup).toContain("<h1>Collections</h1>");
    expect(markup).toContain('<p class="arcade-eyebrow">Studio</p>');
    expect(markup).toContain("Collections beta");
    expect(markup).toContain("Skip to main content");
    expect(markup).not.toContain("NO CHAIN ACTION");
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
    // Whether to show the form depends on who is asking, which is learned in the browser.
    expect(markup).toContain("Checking your creator status…");
    expect(markup).toContain('href="/studio/collections"');
  });

  it("frame the studio home, whose parts load in the browser", () => {
    const markup = renderToStaticMarkup(
      <StudioHomeSurface navigation={navigation} />,
    );
    expect(markup).toContain("<h1>Creator studio</h1>");
    expect(markup).toContain("Loading your standing…");
    expect(markup).toContain("Loading your collections…");
    expect(markup).toContain("Loading your images…");
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
    const [home, list, creating, wizard] = entrypoint.pages ?? [];
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual([
      "/studio",
      "/studio/collections",
      "/studio/collections/new",
      "/studio/collections/[collectionId]",
    ]);
    const context = { actorUserId: id(), navigation, params: {} };
    expect(renderToStaticMarkup(<>{home?.render(context)}</>)).toContain(
      "Creator studio",
    );
    const listMarkup = renderToStaticMarkup(<>{list?.render(context)}</>);
    expect(listMarkup).toContain("Loading your collections…");
    // The chains a collection may target are offered where one starts; only the enabled ones are passed.
    const element = creating?.render(context);
    if (!isValidElement<{ targetChains: readonly ChainOption[] }>(element))
      throw new Error("the create page did not render an element");
    expect(element.props.targetChains.map(({ chainId }) => chainId)).toEqual([
      enabled.chainId,
    ]);
    const wizardMarkup = renderToStaticMarkup(
      <>{wizard?.render({ ...context, params: { collectionId: id() } })}</>,
    );
    expect(wizardMarkup).toContain("Loading your collection…");
  });
});
