import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { platformSessionCookieName } from "@ador/shared/auth";
import { AccessState } from "@repo/ui/arcade";

import { platformComposition } from "../../../../../configs/platform";
import { resolvePageAccess } from "../../server/auth/page-access";
import { getPageAccessDependencies } from "../../server/auth/runtime";
import {
  actorNavigation,
  navigationForSession,
  visitorNavigation,
} from "../../server/navigation";

export default async function FeaturePage({
  params,
}: PageProps<"/[[...path]]">) {
  const { path = [] } = await params;
  const routePath = `/${path.join("/")}`;
  const match = await platformComposition.features.resolvePage(routePath);
  if (!match) notFound();
  const { page: contribution, params: routeParams } = match;
  const navigationContributions = platformComposition.features.listNavigation();
  const token = (await cookies()).get(platformSessionCookieName)?.value;
  if (contribution.access.kind === "public") {
    return contribution.render({
      actorUserId: null,
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
  if (access.kind !== "allowed") {
    return (
      <AccessState
        navigation={visitorNavigation(navigationContributions, routePath)}
        retryHref={routePath}
        state={access.kind}
      />
    );
  }
  return contribution.render({
    actorUserId: access.actorUserId,
    navigation: await actorNavigation(
      navigationContributions,
      routePath,
      access.actorUserId,
      getPageAccessDependencies,
    ),
    params: routeParams,
  });
}
