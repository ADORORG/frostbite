import { platformSessionCookieName } from "@ador/shared/auth";

import { creatorE2EFixtures, publicCollection } from "./creator-fixtures.ts";
import {
  resolveE2EServerConfig,
  type E2EServerConfig,
} from "./server-config.ts";

// The local manual-test stack: the same disposable services and seeded users as the browser test run,
// kept alive so a person can drive the product by hand. This module holds the parts that are plain
// data and text; `scripts/manual-stack.ts` starts the processes.

// A different default port from the test run, so the two can run side by side.
const defaultStackBaseURL = "http://localhost:4174";

export function resolveStackServer(
  environment: NodeJS.ProcessEnv = process.env,
): E2EServerConfig {
  return resolveE2EServerConfig(
    environment.STACK_BASE_URL ?? defaultStackBaseURL,
  );
}

export interface StackActor {
  readonly goal: string;
  readonly label: string;
  readonly token: string;
}

// The people worth being, in the order a tour makes sense. Their sessions are fixed fixture tokens in a
// throwaway database on this machine only; the server is bound to the loopback address.
export const stackActors: readonly StackActor[] = [
  {
    goal: "Upload images, build and submit a collection, read the feedback.",
    label: "Creator (approved)",
    token: creatorE2EFixtures.collectionWizardCreator.sessionToken,
  },
  {
    goal: "A second approved creator, to see that one creator never reaches another's drafts.",
    label: "Second creator (approved)",
    token: creatorE2EFixtures.collectionOtherCreator.sessionToken,
  },
  {
    goal: "Apply to become a creator; not approved yet, so collection changes are refused.",
    label: "Applicant (not approved)",
    token: creatorE2EFixtures.applicant.sessionToken,
  },
  {
    goal: "Work the review queue, decide on submissions, read the activity log.",
    label: "Reviewer",
    token: creatorE2EFixtures.reviewer.sessionToken,
  },
  {
    goal: "Staff without the reviewer role: the admin console, but not collection decisions.",
    label: "Staff (no reviewer role)",
    token: creatorE2EFixtures.staff.sessionToken,
  },
] as const;

// A line to paste into the browser console on the stack's page: the session cookie is a host-only,
// secure cookie, which a page on localhost may set. Reload afterwards.
export function cookieSnippet(token: string): string {
  return `document.cookie = "${platformSessionCookieName}=${token}; path=/; Secure"`;
}

export const stackPages = [
  ["/", "The arcade shell and navigation"],
  [
    "/collections",
    `The public catalog (one approved collection, "${publicCollection.name}", is seeded)`,
  ],
  ["/studio/uploads", "Creator: upload images"],
  ["/studio/collections", "Creator: collection drafts and the wizard"],
  ["/admin/collection-reviews", "Reviewer: the review queue"],
  ["/admin/collection-activity", "Reviewer: the activity log"],
  ["/admin/creator-applications", "Reviewer: creator application review form"],
] as const;

export function formatStackGuide(input: {
  readonly actors?: readonly StackActor[];
  readonly baseURL: string;
}): string {
  const actors = input.actors ?? stackActors;
  const lines = [
    "",
    `The Well is running at ${input.baseURL}`,
    "",
    "To be someone: open the site, paste that person's line into the browser console, and reload.",
    "To be nobody: clear the site's cookies.",
    "",
  ];
  for (const actor of actors)
    lines.push(
      `${actor.label}: ${actor.goal}`,
      `  ${cookieSnippet(actor.token)}`,
      "",
    );
  lines.push("Pages worth visiting:");
  for (const [path, note] of stackPages)
    lines.push(`  ${input.baseURL}${path}  ${note}`);
  lines.push(
    "",
    "Everything here is disposable: the database, the storage, and the users disappear when you stop",
    "the stack (Ctrl+C). Nothing is on a chain; storage is local MinIO, not R2.",
    "",
  );
  return lines.join("\n");
}
