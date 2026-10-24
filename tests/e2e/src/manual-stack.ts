import { creatorE2EFixtures, publicCollection } from "./creator-fixtures.ts";
import { signInPath } from "./sign-in-picker.ts";
import {
  resolveE2EServerConfig,
  type E2EServerConfig,
} from "./server-config.ts";

// The local manual-test stack: the same services and seeded users as the browser test run, kept alive, with their data kept between
// runs, so a person can drive the product by hand. This module holds the parts that are plain
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
  readonly id: string;
  // Where the person lands after signing in: the page their goal starts on.
  readonly landing: string;
  readonly label: string;
  readonly token: string;
}

// The people worth being, in the order a tour makes sense. Their sessions are fixed fixture tokens in a
// throwaway database on this machine only; the server is bound to the loopback address.
export const stackActors: readonly StackActor[] = [
  {
    id: "creator",
    landing: "/studio/collections",
    goal: "Upload images, build and submit a collection, read the feedback.",
    label: "Creator (approved)",
    token: creatorE2EFixtures.collectionWizardCreator.sessionToken,
  },
  {
    id: "second-creator",
    landing: "/studio/collections",
    goal: "A second approved creator, to see that one creator never reaches another's drafts.",
    label: "Second creator (approved)",
    token: creatorE2EFixtures.collectionOtherCreator.sessionToken,
  },
  {
    id: "applicant",
    landing: "/studio",
    goal: "Apply to become a creator; not approved yet, so collection changes are refused.",
    label: "Applicant (not approved)",
    token: creatorE2EFixtures.applicant.sessionToken,
  },
  {
    id: "reviewer",
    landing: "/admin/collection-reviews",
    goal: "Work the review queue, decide on submissions, read the activity log.",
    label: "Reviewer",
    token: creatorE2EFixtures.reviewer.sessionToken,
  },
  {
    id: "staff",
    landing: "/admin",
    goal: "Staff without the reviewer role: the admin console, but not collection decisions.",
    label: "Staff (no reviewer role)",
    token: creatorE2EFixtures.staff.sessionToken,
  },
] as const;

export const stackPages = [
  ["/", "The arcade shell and navigation"],
  [
    "/collections",
    `The public catalog (one approved collection, "${publicCollection.name}", is seeded)`,
  ],
  ["/studio", "Creator: the studio overview and next step"],
  ["/studio/uploads", "Creator: your image library"],
  ["/studio/uploads/new", "Creator: add an image"],
  ["/studio/collections", "Creator: collection drafts and the wizard"],
  ["/admin", "Staff: the admin overview of the areas you may open"],
  ["/admin/collection-reviews", "Reviewer: the review queue"],
  ["/admin/collection-activity", "Reviewer: the activity log"],
  [
    "/admin/creator-applications",
    "Reviewer: the creator application queue, filter and sort, then open one to decide",
  ],
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
    `To sign in, open ${input.baseURL}${signInPath} and pick a person. Real sign-in is by wallet and is not`,
    "enabled yet, so this local page stands in for it. Sign out from the same page.",
    "",
  ];
  for (const actor of actors) lines.push(`  ${actor.label}: ${actor.goal}`);
  lines.push("", "Pages worth visiting:");
  for (const [path, note] of stackPages)
    lines.push(`  ${input.baseURL}${path}  ${note}`);
  lines.push(
    "",
    "The database and the stored files are kept in Docker volumes when you stop the stack (Ctrl+C), and are there next time.",
    "`pnpm stack --fresh` deletes them (after asking) and starts over. Storage is local MinIO, not R2. The rewards chain, if the line",
    "below names one, is real: what is sent to it stays there whatever happens to this stack.",
    "",
  );
  return lines.join("\n");
}
