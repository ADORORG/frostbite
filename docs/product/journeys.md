# Journeys

The flows each kind of person follows, written so navigation, pages and tests can be checked against
them. Defaults are chosen and logged in `docs/session-findings.md` (section Q); change here first.

## Rules for every page

1. The page says where you are (breadcrumb) and offers the next step in plain words.
2. Nothing sends a person out of a flow without a link back to it.
3. The top bar has at most five links; account and area links live in one menu shown by role.
4. A person is never shown an action they cannot do; if they must wait, the page says why.
5. Content is at most one readable column (about 72rem), two columns on desktop where it helps.

## One page, one job (applies to every feature)

Each feature separates three kinds of page and links them with clear buttons:

- **Overview** (what exists): a list with status filters and a primary "New …" button.
- **Create** (make one): its own page, one focused form, "Cancel" back to the overview.
- **Detail / editor** (work on one): breadcrumb back to the overview, next-step button.
  Never a list and a create form stacked on one page.

| Feature             | Overview                                                                                                                | Create                        | Detail                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| Collections         | `/studio/collections`: tabs Drafts, In review, Needs changes, Live; cards with cover, name, supply, status, next action | `/studio/collections/new`     | `/studio/collections/:id` wizard                               |
| Uploads             | `/studio/uploads`: library grid, filter by purpose, "Use in a collection"                                               | `/studio/uploads/new`         | image detail (purpose, size, state; "where used" needs an API) |
| Creator application | `/studio` dashboard card                                                                                                | `/studio/creator-application` | same page, status card, read-only after submit                 |
| Reviews             | `/admin/collection-reviews`: queue with filters                                                                         | none                          | `/admin/collection-reviews/:id`                                |

## Top bar by role

- Visitor: Collections, Games, Sign in.
- Signed in: Collections, Games, Studio (if creator or applicant), Admin (if staff), account menu
  (Account, Connect wallet, Sign out). Launches and Creators appear only when they list something.

## Creator (approved)

Studio home → **Collections** (drafts list, Start a collection) → collection page:
Details → Supply and chain → Images → Items → Review and submit → status and feedback.

- Studio home is a dashboard: drafts, uploads, application standing, the next step.
- Images step lists the whole library for any purpose that fits; "Upload images" opens the uploader in
  place (or returns to this step afterwards).
- Uploads is part of the studio: Library | Upload, with "Use in a collection" on each image.

## Applicant (not approved)

Studio home explains standing (draft / submitted / needs changes) and links to the application.
Collections and uploads show "Available once approved", not forms that fail.

## Reviewer

Admin home lists Collection reviews, Creator applications, Activity log; queue → submission → decision →
back to the queue. Everything stays under an Admin sidebar.

## Staff without reviewer role

Admin home shows what they can see; review actions are absent, not refused.

## Visitor

Home → Collections → collection detail; Games; Sign in.
