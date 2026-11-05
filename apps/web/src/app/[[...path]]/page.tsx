import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { platformSessionCookieName } from "@ador/shared/auth";
import { AccessState } from "@repo/ui/arcade";

import { platformComposition } from "@repo/configs/platform";
import { resolvePageAccess } from "../../server/auth/page-access";
import { declaredMetadata } from "../../server/metadata/declared";
import { pageMetadata } from "../../server/metadata/next-metadata";
import { readSiteIdentity } from "../../server/metadata/site";
import { pageOutcome } from "../../server/auth/page-outcome";
import { getPageAccessDependencies } from "../../server/auth/runtime";
import {
  actorNavigation,
  navigationForSession,
  visitorNavigation,
} from "../../server/navigation";

// What a search engine or a pasted link sees. Only a public page that declares its metadata is shared; every other page, and
// anything that does not resolve, is kept out of search results and shows no preview.
export async function generateMetadata({
  params,
}: PageProps<"/[[...path]]">): Promise<Metadata> {
  const { path = [] } = await params;
  const routePath = `/${path.join("/")}`;
  const match = await platformComposition.features.resolvePage(routePath);
  return pageMetadata(
    await declaredMetadata(match),
    readSiteIdentity(),
    routePath,
  );
}

export default async function FeaturePage({
  params,
}: PageProps<"/[[...path]]">) {
  const { path = [] } = await params;
  const routePath = `/${path.join("/")}`;
  const match = await platformComposition.features.resolvePage(routePath);
  if (!match) notFound();
  const { page: contribution, params: routeParams } = match;
  const navigationContributions = platformComposition.features.listNavigation();
  // The landing page lays out every feature's part of it; the contributions are only drawn by the page that uses them.
  const homeSections = await platformComposition.features.listHomeSections();
  const token = (await cookies()).get(platformSessionCookieName)?.value;
  if (contribution.access.kind === "public") {
    return contribution.render({
      actorUserId: null,
      homeSections,
      navigation: await navigationForSession(
        navigationContributions,
        routePath,
        token,
        getPageAccessDependencies,
      ),
      params: routeParams,
    });
  }
  const access = await resolvePageAccess(
    contribution.access,
    token,
    getPageAccessDependencies,
  );
  const outcome = pageOutcome(access, routePath);
  // The sign-in page's address is built from a validated path (`signInHref`), so the router's typed routes cannot check it ahead of time.
  if (outcome.kind === "redirect") redirect(outcome.to as Route);
  if (outcome.kind === "state" || access.kind !== "allowed") {
    return (
      <AccessState
        navigation={visitorNavigation(navigationContributions, routePath)}
        retryHref={routePath}
        state={outcome.kind === "state" ? outcome.state : "unavailable"}
      />
    );
  }
  return contribution.render({
    actorUserId: access.actorUserId,
    homeSections,
    navigation: await actorNavigation(
      navigationContributions,
      routePath,
      access.actorUserId,
      getPageAccessDependencies,
    ),
    params: routeParams,
  });
}
