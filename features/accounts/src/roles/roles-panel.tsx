"use client";

import { createRequester, sameOriginFetch } from "@ador/client-http";
import { platformRoles, type PlatformRole } from "@ador/shared/accounts";
import {
  ArcadeActionButton,
  ConsoleCard,
  ArcadeTextField,
  StatusLamp,
} from "@repo/ui/arcade";
import { useState, type FormEvent } from "react";

import {
  findPeople,
  grantRole,
  listPeople,
  suspendRole,
  type Person,
} from "./roles-flow.ts";

type Tone = "attention" | "ready" | "unavailable";

const roleMeaning: Record<PlatformRole, string> = {
  admin: "manages who holds roles",
  reviewer: "decides on submissions and applications",
  staff: "operates the platform",
};
function describe(role: Person["roles"][number]): string {
  if (role.status === "suspended") return "suspended";
  return role.effective ? "active" : "active, not working yet";
}

// Who holds platform roles, and giving or taking one. A change is shown as done only after the server did it and the list was read again;
// a role that is recorded but cannot work yet (it needs a sign-in method the person lacks) is said to be exactly that.
export function RolesPanel({
  initialPeople,
}: {
  readonly initialPeople: readonly Person[];
}) {
  const [people, setPeople] = useState(initialPeople);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<readonly Person[] | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: Tone }>({
    text: "Changes are recorded with who made them. Your own role can be suspended only while another administrator is working.",
    tone: "attention",
  });
  const request = createRequester(sameOriginFetch);

  async function search(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      const matches = await findPeople(request, query);
      setFound(matches);
      setMessage({
        text:
          matches.length === 0
            ? "Nobody has that address. Check how it is written; only an exact match is found."
            : `${matches.length === 1 ? "One account matches" : `${matches.length} accounts match`}.`,
        tone: matches.length === 0 ? "unavailable" : "ready",
      });
    } catch {
      setMessage({
        text: "The search could not be completed. Try again.",
        tone: "unavailable",
      });
    }
    setWorking(false);
  }

  async function change(
    person: Person,
    role: PlatformRole,
    action: "grant" | "suspend",
  ) {
    setWorking(true);
    const outcome =
      action === "grant"
        ? await grantRole(request, person.userId, role)
        : await suspendRole(request, person.userId, role);
    if (outcome.kind === "failed") {
      setMessage({ text: outcome.message, tone: "unavailable" });
    } else {
      let listed = true;
      try {
        setPeople(await listPeople(request));
        if (found !== null) setFound(await findPeople(request, query));
      } catch {
        listed = false;
      }
      const said =
        outcome.kind === "unchanged"
          ? `${person.label} already had that: nothing changed.`
          : `${person.label}: ${role} ${outcome.kind}.`;
      const caveat =
        (outcome.kind === "granted" || outcome.kind === "reinstated") &&
        !outcome.effective
          ? " The role is recorded but does not work yet: this account needs a wallet."
          : "";
      setMessage({
        text: listed
          ? `${said}${caveat}`
          : `${said}${caveat} The list could not be refreshed. Reload the page.`,
        tone: listed ? (caveat === "" ? "ready" : "attention") : "attention",
      });
    }
    setWorking(false);
  }

  function row(person: Person) {
    return (
      <li key={person.userId}>
        <strong>{person.label}</strong>
        <ul aria-label={`Roles of ${person.label}`}>
          {platformRoles.map((role) => {
            const held = person.roles.find((entry) => entry.role === role);
            const active = held?.status === "active";
            return (
              <li key={role}>
                <span>
                  {role} ({roleMeaning[role]}):{" "}
                  {held === undefined ? "not held" : describe(held)}
                </span>{" "}
                <ArcadeActionButton
                  ariaLabel={`${active ? "Suspend" : held === undefined ? "Grant" : "Reinstate"} ${role} for ${person.label}`}
                  disabled={working}
                  onClick={() =>
                    void change(person, role, active ? "suspend" : "grant")
                  }
                  size="small"
                  tone={active ? "yellow" : "mint"}
                >
                  {active
                    ? "Suspend"
                    : held === undefined
                      ? "Grant"
                      : "Reinstate"}
                </ArcadeActionButton>
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  return (
    <>
      <ConsoleCard
        count={people.length}
        glyph="★"
        lead="Everyone who holds a platform role, and whether it works yet."
        title="Current role holders"
        wide
      >
        <StatusLamp label={message.text} tone={message.tone} />
        {people.length === 0 ? (
          <p>Nobody holds a platform role.</p>
        ) : (
          <ul aria-label="People with roles">{people.map(row)}</ul>
        )}
      </ConsoleCard>
      <ConsoleCard
        glyph="⌕"
        lead="Find a person to give a role to, by something they sign in with."
        title="Find a person"
        wide
      >
        <form className="arcade-form" onSubmit={(event) => void search(event)}>
          <ArcadeTextField
            hint="An email address or wallet address they sign in with, or their account id. Exact matches only."
            label="Email, wallet address or account id"
            onChange={setQuery}
            required
            value={query}
          />
          <div className="arcade-actions">
            <ArcadeActionButton busy={working} type="submit">
              Find
            </ArcadeActionButton>
          </div>
        </form>
        {found === null || found.length === 0 ? null : (
          <ul aria-label="Search results">{found.map(row)}</ul>
        )}
      </ConsoleCard>
    </>
  );
}
