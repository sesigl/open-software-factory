---
covers: [modules/console/src/**]
---

# console

The web UI of a factory, where the people on its access list follow its runs and act on them. It shows every run of every foreman with its state, origin, requester, pull
request and age; one run's requests, stages, gates, checks, transcripts and trace; the factory definition with
a link to the file in Git, where it changes; and the self-improvement inbox of observer's open proposals. A person
submits work and acts on runs and gates through its forms, signed in by its own sign-in or by a proxy in front. It keeps no
state: each page asks the foreman's, intake's and gatekeeper's APIs, or the forge port's adapter, when it is opened.
Temporal, the trace store and the dashboards keep their own UIs; the console links to them. Decisions:
[ADR 0072](../../docs/decisions/0072-console.md), [ADR 0073](../../docs/decisions/0073-forge-prs-and-console-inbox.md)
(the inbox).

## Quick start

This quick start is scenario `SCN-CONSOLE-001` and is tested on every change. It needs a running foreman
([`modules/foreman`](../foreman/README.md)) with the API token `dev-token`, here on port 8081:

```sh
export CONSOLE_FOREMAN_URL=http://localhost:8081 CONSOLE_FOREMAN_TOKEN=dev-token
npx @opensoftware/console serve
```

Open <http://localhost:8080>. The page lists the foreman's runs, the running ones first, and reloads itself every
10 seconds.

## Commands

| Command | What it does |
| --- | --- |
| `console serve` | Serve the pages below on `PORT`. Exits 2 without `CONSOLE_FOREMAN_URL`. |
| `console doctor [--deep]` | Check the factory as [Health](#health) describes, print one line per check (`ok    <check>` or `FAIL  <check>: <what to do>`) and the count, and exit 1 when a check fails. |

## Pages

| Page | What it shows |
| --- | --- |
| `/` | The runs of every foreman: title, factory, state, source, requester, pull request and age. Runs that have not ended come first, the one that started last first, then the ended runs, the one that ended last first. A foreman that does not answer is named above the list. The page shows the first page of each foreman's runs and links "Next page" (`?page=`) while one has more ([ADR 0115](../../docs/decisions/0115-lists-in-pages.md)). |
| `/?state=<state>` | Only the runs in the state `running`, `blocked`, `complete`, `failed` or `cancelled`, as the foremen filter them. Another state answers 400. |
| `/runs/<runId>` | One run: its state, factory and factory version, age, pull request, trace and Temporal history; its origin, or with `CONSOLE_INTAKE_URL` every request of its work item; and its stages as its evidence, each with its agent ("waits" for a stage that only waits, ADR 0107), state, transcript, gate, checks and the reason it failed. A run that a person ran again names its attempt and links the run before it. 404 when no foreman knows the run. |
| `/work` | With `CONSOLE_INTAKE_URL`: intake's latest work items, the one received last first, each with its origin, type, status, source, requester, run and age, also work that waits without a run, one page of intake's inbox at a time with a link "Next page" (`?cursor=`) while more follow; an intake that does not answer is named above the list. With actions, the form "Submit work". 404 without `CONSOLE_INTAKE_URL`. |
| `/factory` | The factory definition in `CONSOLE_FACTORY`: its name, description, agents with their harness, model and effort, and providers, and the link to the file on the branch where it changes. |
| `/factory/agents/<name>` | One agent's configuration, each field with its value and a list or a map as YAML, and the link to the file on the branch where it changes. 404 for an agent the factory does not declare. |
| `/health` | The checks of `console doctor` as a table: each check, its state and what to do. 200 when every check is ok, else 503. |
| `/inbox` | The self-improvement inbox: the open pull requests of `CONSOLE_INBOX_REPOSITORY` whose branch starts with `CONSOLE_INBOX_PREFIX` (default `observer/`), newest first, each with its link, branch, author, state ("approved", "changes requested" or "needs review") and age. A forge adapter that fails is named above the list. 404 without `CONSOLE_INBOX_REPOSITORY`. |
| `/secrets` | Only for an admin or a factory engineer ([Secrets](#secrets)): the secrets that the factory's agents declare and the names in the secret store, each "Missing", "Set", "Set outside the UI", "Not used" or "Unknown", and the form "Store a value". `?name=<name>` fills the form's name. A person without the role `admin` gets 403. 404 in a console without roles or without `OSF_OPENBAO_ADDR`. |
| `/secrets/delete?name=<name>` | Only for an admin ([ADR 0148](../../docs/decisions/0148-a-factory-engineer-stores-secrets.md)): asks before the secret of that name is deleted, with the button "Delete" and the link "Cancel". |
| `/skills` | Every skill the factory's agents use ([Skills](#skills)): its name, description, source with its pinned commit, agents and what it needs, with the state of each secret it needs. In every mode. |
| `/skills/<name>` | One skill: its `SKILL.md` as Markdown, its files, each agent of the factory with whether it has the skill, and what it needs, and the problems lint names in its files. For an admin or a factory engineer with `CONSOLE_FACTORY_REPOSITORY`, a switch per agent ([Switch a skill](#switch-a-skill)); an open change shows beside its agent. 404 for a skill no agent uses, 502 when `factory skills` fails. |
| `/skills/<name>/switch?agent=<agent>` | The page that asks before a switch: each edit of its change in plain words, and the form "Propose change". 404 without `CONSOLE_FACTORY_REPOSITORY` or roles and for an agent the factory does not have, 403 to anyone but an admin or a factory engineer. |
| `/changes` | The changes of the factory that the console proposed as pull requests ([Changes](#changes)), each "Checking", "Ready", "Failed", "Conflict", "Live" or "Discarded", and for an admin or a factory engineer the forms "Propose a change" and "Declare a secrets provider" and the buttons "Try again", "Discard" and "Merge". Without `CONSOLE_FACTORY_REPOSITORY` it says that the factory is a local folder. |
| `/improvement` | Cost and scores of the factory's runs, from the files below `CONSOLE_IMPROVE_DIR`: the total cost and the number of runs, each scorer with its scored runs, passes, pass rate and judge cost, and each stage of a run with its outcome and cost, linked to the run's page. 404 without `CONSOLE_IMPROVE_DIR`. |

The runs page `/` has the new look of the design system ([ADR 0133](../../docs/decisions/0133-design-system.md)): a
navigation column with the factory's name, only the pages that work in this console (the runs with a count of those
that wait for a person, and the dashboards below them), and the account with the
signed-in person, "Sign out" and the link to the other theme. On a phone the navigation folds behind "Menu", each
run is a card, and "Submit work" stays at the bottom of the screen. The page of a run `/runs/<runId>` has the new
look too: its facts below its title, its forms below them, and its stages as a table whose rows are cards on a phone; a
run that no foreman knows, and a form of the page that a module refuses, answer with a problem in the same shell. The
work page `/work` and the inbox `/inbox` have the new look too, and the navigation links them among its pages: the
form "Submit work" beside the work items, above them on a phone with its fields in one column, and the work items and
the proposals as tables whose rows are cards on a phone. A form without the signed-in person or from another site
answers with a problem in the same shell, with the way back to the form's page. The theme
is dark unless the cookie `osf_theme` says light; `/theme?to=light&next=<path>` sets it and returns to the page. The
secrets, skills and changes pages have the new look too, and its navigation links Secrets for an admin and a factory engineer, Skills for
everyone and Changes with `CONSOLE_FACTORY_REPOSITORY`. Since T-60 every page has the new look, and the navigation
has no "Classic pages": the factory's definition `/factory` with its agents as a table whose rows are cards on a
phone, an agent's page with its fields as facts below the way back, the cost and scores `/improvement` (with
`CONSOLE_IMPROVE_DIR`) with its two tables, and the health page `/health` with a check per row and its state as a
shape and a word. Every problem of a page, like an unknown state of the runs, a page without its setting, a person
without the role or a change that fails, answers in the same shell, with the way back to a page this console has.

Every page links the runs, the work items (with `CONSOLE_INTAKE_URL`), the inbox (with `CONSOLE_INBOX_REPOSITORY`),
Secrets, Skills and Changes as above, the factory, the cost and scores (with `CONSOLE_IMPROVE_DIR`), the health page
and the dashboards in `CONSOLE_LINKS`. The runs pages, the page of a run and the work page reload themselves every
`CONSOLE_REFRESH` seconds. Without `CONSOLE_USER_HEADER` the console is read-only: it has no forms, and any method but
`GET` and `HEAD` answers 405. It shows what the foreman and intake show, so run it behind your sign-in proxy, such as
oauth2-proxy. Every answer carries a Content-Security-Policy that allows only the console's own files and no script.
The pages render on the server; the health page was the first that Astro renders, the runs page the second ([ADR 0132](../../docs/decisions/0132-astro-in-the-console.md)), and
since T-60 Astro renders every page, with the same URLs.

Actions ([ADR 0089](../../docs/decisions/0089-console-actions.md)): set `CONSOLE_USER_HEADER` to the header in which
your sign-in proxy sends the signed-in person, like `X-Forwarded-Email`. Then `/work` has the form "submit work"
(title, type and description), which the console posts to intake with that person as the requester and the origin
`console`; intake checks the fields. A form without the header answers 401, a form from another site 403, and a
form that intake refuses 502 with intake's answer. Without `CONSOLE_INTAKE_URL` the console takes no form "submit work".
The page of a `failed` or `cancelled` run has the form "run again" ([ADR 0105](../../docs/decisions/0105-run-a-work-item-again.md)),
which the console posts to the foreman's `POST /v1/runs/<runId>/retry` with that person as `by`; it then leads to the
new run's page. A retry that the foreman refuses answers with the foreman's status and its problem's detail.
The page of a `running` or `blocked` run has the forms "Steer" (with a message), "Take over" (while a stage runs),
"Hand back" (while a person holds a stage) and "Cancel", which the console posts to the foreman's
`POST /v1/runs/<runId>/signals` with that person as `by`; the run lists them under "Actions"
([ADR 0118](../../docs/decisions/0118-actions-record-the-person.md)). With `CONSOLE_GATEKEEPER_URL` a pending gate of a
stage has the forms "Approve" and "Reject" (with a reason), which the console posts to gatekeeper's
`POST /v1/gates/<gateId>/decisions` with that person as `by`: gatekeeper refuses a person who is in no group the gate
waits for, so list the identity the proxy sends, like `ada@acme.dev`, in gatekeeper's groups. Each form leads back to
the run's page, or answers with the API's status and its problem's detail. Only set the variable behind a
proxy that sets the header and removes it from the browser's requests.

Cost and scores ([ADR 0123](../../docs/decisions/0123-cost-and-scores-in-the-console.md)): the scheduled jobs of the
improvement path write run records as [runlog](../runlog/README.md) writes them and scores as
[scorekit](../scorekit/README.md) writes them, in the formats of the [contracts](../../contracts/README.md), to one
folder. Set `CONSOLE_IMPROVE_DIR` to it. The console reads every `.json` and `.jsonl` file below it when `/improvement`
is opened: each `invoke_agent` span of a run record is one stage with its `osf.cost.usd`, and each score counts for its
scorer, a score of 1 as a pass, with its `osf.judge.cost.usd`. Other records, lines that are no JSON and other files are
skipped.

Several factories: list each foreman in `CONSOLE_FOREMAN_URL`, comma-separated, and their tokens in the same order in
`CONSOLE_FOREMAN_TOKEN`, or one token for all.

The inbox: observer opens each proposal as a pull request from a branch `observer/<problem>-<hash>`
([observer](../observer/README.md)). The console runs the forge port's adapter in `CONSOLE_FORGE_ADAPTER` with
`prs <repo> --head <prefix>` ([forge port](../../ports/forge/README.md)), with `CONSOLE_FORGE_URL` and
`CONSOLE_FORGE_TOKEN` as its `FORGE_URL` and `FORGE_TOKEN`. A token that may read pull requests is enough. For a
Forgejo, such as Codeberg, set `CONSOLE_FORGE_ADAPTER=npx -y @opensoftware/forge-forgejo` and its URL.

Links: `CONSOLE_TRACE_URL` and `CONSOLE_SESSION_URL` are URL templates of the trace store, such as Langfuse or
Phoenix, with `{runId}` or `{traceId}`, and `{sessionId}`. `{traceId}` is the run's `traceId`, which a foreman with
traces names ([ADR 0087](../../docs/decisions/0087-run-traces.md)); Phoenix finds a trace by it. The foreman sets the run's ID as `osf.run.id` on every run's traces
([runlog](../runlog/README.md)), and a stage's harness session is its transcript. `CONSOLE_SPAN_URL`, with `{traceId}`
and `{spanId}`, makes each started stage's name a link to its span in the run's trace, such as Jaeger's
`/trace/{traceId}?uiFind={spanId}` ([ADR 0121](../../docs/decisions/0121-stage-run-record-in-the-trace.md)). `CONSOLE_TEMPORAL_URL` links the
run's history: `<url>/namespaces/<CONSOLE_TEMPORAL_NAMESPACE>/workflows/<runId>`.

## Sign-in

The console signs people in itself when `CONSOLE_SIGN_IN` names the provider ([ADR 0134](../../docs/decisions/0134-console-sign-in-roles-and-modes.md)):
`oidc` for OpenID Connect (Google, a company's provider) or `github`. Every page then needs a session: a page without
one sends the person to `/signin` and back to the page after the sign-in, a form without one answers 401, and a form
whose `Origin` is not `CONSOLE_URL` answers 403. Who may sign in is the access file (`CONSOLE_ACCESS`, by default
`access.yaml` beside `CONSOLE_FACTORY`), read again at each request: a person removed from it loses access at the next
page. Only an email the provider marks as verified counts; a person not on the list reads why. Without a valid access
file with an admin, nobody signs in. "Sign out" in the navigation ends the session.

```yaml
# access.yaml
version: 1
people:
  - email: ada@acme.dev
    role: admin
  - email: varun@acme.dev
    role: member
```

The session is an encrypted cookie (`HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS) that lasts
`CONSOLE_SESSION_HOURS`; `CONSOLE_SESSION_SECRET` may name two keys, so a key changes without signing anyone out.
The provider's callback is `<CONSOLE_URL>/signin/callback`. With the sign-in on, the console does not start without
its provider's settings and the session key, on an address that is neither `https://` nor loopback, or with
`CONSOLE_USER_HEADER` too. Open the console on `localhost` (the default `CONSOLE_URL`): a request for another host,
like `127.0.0.1`, is sent there first, so the session cookie stays off the tools of the profile on `127.0.0.1`.
`/v1/ready` answers without a session whether the console reads its factory, for health checks. It answers for
every host name: a container's health check asks `127.0.0.1`, while a page asked at another host than `CONSOLE_URL`
is sent there.

Whoever may write to the factory's repository can make themselves `admin`: write access to that repository is admin
access to the factory, and the repository should be private, since the access file holds emails.

## Secrets

An admin or a factory engineer stores the values of the agents' secrets on `/secrets`
([ADR 0137](../../docs/decisions/0137-secrets-port-write-side-and-openbao.md),
[ADR 0148](../../docs/decisions/0148-a-factory-engineer-stores-secrets.md)); only an admin deletes one.
The page needs a role, so it exists with the own sign-in or behind a sign-in proxy with an access file, and needs the
factory's OpenBao in `OSF_OPENBAO_ADDR`; otherwise it and its forms answer 404 and name what is missing, and the
navigation does not link it. Only an `admin` and a `factory-engineer` see it in the navigation; anyone else gets 403.
A factory engineer's page offers no "Delete", and the page and the form of a delete answer 403 to them: a delete removes
every version, and the next run of an agent that declares the secret fails.

The page lists, the missing ones first:

| State | When | The row says |
| --- | --- | --- |
| Missing | An agent declares `ref:openbao/<name>`, and the store has no such secret | The agents that need it, and the link "Store a value" |
| Unknown | An agent declares `ref:openbao/<name>`, and the store did not answer | The agents that need it; the page names the store's error above the list |
| Set | An agent declares it, and the store has it | The agents that use it, the version, and who stored it when (UTC, to the minute), and the link "Replace" |
| Set outside the UI | An agent declares `ref:env/<NAME>` or `ref:file/<name>` | The sandbox adapter's variable `OSF_SECRET_<NAME>`, or the file `<name>` in its `OSF_SECRETS_DIR` |
| Not used | The store has it, and no agent declares it | Who stored it when, and the link "Delete" |

The form "Store a value" has the secret's name and a password field for the value, with no autocomplete; the field
is empty on every page. It posts to `POST /secrets`, which runs the adapter in `CONSOLE_SECRETS_ADAPTER` as
`put --by=<the person's email> -- <name>` and writes the value only to the adapter's standard input. "Delete" leads to
a page that asks first; its form posts to `POST /secrets/delete`, which runs `delete -- <name>`. Each form answers 303
to `/secrets`, or shows the page with the problem: 400 for a name the adapter refuses, 502 for a store that refuses, 413
for a form over 64 KiB. Forms follow the rules of the console's other forms: with the own sign-in a form's `Origin`
must be `CONSOLE_URL`, behind a proxy a form from another site answers 403 and one without the person 401.

A value appears nowhere else: not in a page, a redirect, a header, an error or a line the console prints. The console
logs no request. The adapter prints no value and names none in an error ([secrets port](../../ports/secrets/README.md)),
and the console's token cannot read one: give it the policy that `secrets-openbao policy write` prints.

When a new value takes effect: a sandbox's egress proxy reads the value at the first request that needs it and keeps
it while the sandbox runs, so a value counts from the next sandbox that starts, like the next run's. It is sent only
to the hosts that the agents which declare it may reach (their `sandbox.egress`). The egress proxy swaps a placeholder
in an HTTP request, so a secret that is not sent in one, like an SSH key or a database password, does not work this
way.

## Skills

`/skills` lists every skill that the factory's agents use, from the folders of its repository and of other
repositories that `factory.lock` pins, and `/skills/<name>` shows one
([ADR 0141](../../docs/decisions/0141-skills-pages-and-markdown-from-a-repository.md)). Both pages exist in every
mode: open, behind a sign-in proxy and with the own sign-in. A skill of another repository shows its folder, the
repository's URL and the first 7 characters of its pinned commit, like
`skills/release-notes in https://github.com/acme/skills.git at 7c2e91d`, and one without a pin says
"not pinned in factory.lock" and shows the catalog's problem. The console does not read a
`SKILL.md` itself: it runs factory-spec's `factory skills --file <CONSOLE_FACTORY>` with the command line in
`CONSOLE_FACTORY_COMMAND` and shows what it prints, so the pages know what `factory lint` knows
([factory-spec](../factory-spec/README.md#the-skills-as-json)). What it prints is the format `skill-catalog` of the
contracts ([ADR 0143](../../docs/decisions/0143-skill-catalog-contract.md)), and the stand-in program of the console's
tests prints only JSON that fits it. When the program fails, `/skills` names its error above
an empty list and `/skills/<name>` answers 502.

Each secret a skill needs shows a state:

| State | When |
| --- | --- |
| Not declared | An agent that uses the skill declares no reference for it; `factory lint` fails |
| Missing, Unknown, Set | The agents give it from OpenBao, and the store at `OSF_OPENBAO_ADDR` has no such secret, does not answer, or has it, as on [Secrets](#secrets). Without `OSF_OPENBAO_ADDR` such a secret has no state |
| Set outside the UI | The agents give it from another provider, like `ref:env/<NAME>` |

With several references the worst shows, in this order. A host shows "Not allowed" when the sandbox of an agent that
uses the skill does not allow it. An admin or a factory engineer, who may open `/secrets`, gets the link "Store a value" beside a missing
secret.

The Markdown comes from a repository, so the page renders it safely with markdown-it: raw HTML, a script among it, is
text; an image shows its alternative text, so no image loads from anywhere; a link keeps its anchor only to `https:`,
`http:` or `mailto:`, with `rel="nofollow noreferrer"`, and any other, like `javascript:`, `data:` or a relative path,
keeps only its words. The page's Content-Security-Policy forbids every script as well.

### Switch a skill

On `/skills/<name>`, an admin or a factory engineer switches the skill on or off for each agent of the factory
([ADR 0149](../../docs/decisions/0149-a-skill-switched-per-agent-as-one-change.md)). A switch is a change of the
factory ([Changes](#changes)), so it needs `CONSOLE_FACTORY_REPOSITORY`; without it, or without the role, the page shows
whether each agent has the skill, no button, and why. Each button opens `/skills/<name>/switch?agent=<agent>`, which
lists every edit of the change in plain words before the person presses "Propose change":

- Switching on adds what the agent lacks of the skill's needs, then the skill: the secrets provider `openbao` at `^0`
  when the factory does not declare it and a secret is missing; for each missing secret the reference
  `ref:openbao/<name>`, like `ref:openbao/linear-token` for `LINEAR_TOKEN`, whose value an admin or a factory engineer stores on
  [Secrets](#secrets); for each host the agent's sandbox does not allow, the host, which widens what the sandbox can
  reach. An agent without a sandbox gets no host. What the agent lacks comes from `CONSOLE_FACTORY`.
- Switching off removes only the skill's entry: a secret or a host may serve another skill of the agent.
- The skill's entry is the one with which an agent already names it, like `./skills/release-notes` or
  `git+https://github.com/acme/skills.git#v1.2:skills/release-notes`, so a skill of another repository keeps its pin.

All edits of a switch are one pull request; its body lists each one. While it is open, the agent shows "Switching on"
or "Switching off", the change's state and the link to its pull request in place of the button.

## Changes

A person with the role `admin` or `factory-engineer` changes the factory on `/changes`
([ADR 0144](../../docs/decisions/0144-console-changes-as-pull-requests.md)). Each change is a pull request on the
factory's repository that names the person; the forge merges it when its check `factory` passes, and a run keeps the
factory version it started with, so a change is live for the next run. Everyone who may open the console sees the
page; its forms and buttons need the role, anyone else gets 403.

Set `CONSOLE_FACTORY_REPOSITORY` to the repository as `git+<url>#<branch>`, `CONSOLE_FACTORY_TOKEN` to a forge token
for it, `CONSOLE_FACTORY_USER` to that token's user as the forge adapter names an author, and the forge adapter in
`CONSOLE_FORGE_ADAPTER` with `CONSOLE_FORGE_URL`, like `npx -y @opensoftware/forge-forgejo`. The console fetches the
repository with Git into `CONSOLE_FACTORY_CACHE`. Without `CONSOLE_FACTORY_REPOSITORY` the factory is a local folder:
the page says so, offers no form, and the forms answer 404.

The token is not the inbox's read-only `CONSOLE_FORGE_TOKEN`:

| Forge | The token needs |
| --- | --- |
| GitHub | A fine-grained token or an app for the one repository: Contents read and write, Pull requests read and write, Commit statuses read, Checks read, Administration read (to read the branch's rules) and Metadata read |
| Forgejo | The scopes `write:repository` and `write:issue`, of a user who may write to the repository |

The form "Propose a change" takes one edit of `factory edit` ([factory-spec](../factory-spec/README.md#edits-factory-edit)):
add or remove an egress host, a secret reference or a skill of an agent; "Declare a secrets provider" takes a name and
a range. The console checks each value first and names what it refused: an egress host must be a host name like
`api.linear.app`, without a scheme, a port, a path or a wildcard. Then it:

1. fetches the newest commit of the branch and reads the branch's rules with `rules`; a branch that does not require
   the check `factory` gets no change (409), since nothing would check it before it merges;
2. runs `factory edit --file <the fetched factory.yaml> <edit> -- <agent or name> <value>` in `CONSOLE_FACTORY_COMMAND`
   (400 when it refuses the edit or the edit changes nothing);
3. creates the branch `console/<edit>-<agent>-<commit>-<hash of the edit>` from that commit, commits the edited
   `factory.yaml` with the trailer `Requested-by: <email>`, and opens the pull request titled
   `factory edit <edit> <agent or name> <value>`, whose body says what changes and who asked;
4. asks the forge to merge it when its checks pass (`merge --when-green`) and answers 303 to `/changes`.

A change may hold several edits, like a [switch of a skill](#switch-a-skill)
([ADR 0149](../../docs/decisions/0149-a-skill-switched-per-agent-as-one-change.md)): `POST /changes` then takes them in
the field `edits` as one line, each edit's three words separated by `; `, like
`add-egress review api.linear.app; add-skill review ./skills/release-notes`, and checks each like the form. The
console runs `factory edit` once per edit, in that order, each on the text the one before printed, and commits the
result once. The title is `factory edit ` and that line, the branch names the last edit, the hash covers every edit,
and the body lists each edit as an item. A forge refuses a title over 255 characters, about six edits.

The branch starts at the commit that was read, so a change that reached the branch in between shows as a conflict and
overwrites nothing. The page asks the forge when it is opened, for the newest 50 pull requests of the token's user;
the console keeps no state:

| State | When | Buttons |
| --- | --- | --- |
| Checking | Open, while its check `factory` has no result. The page reloads itself every `CONSOLE_REFRESH` seconds | none |
| Ready | Open, its check `factory` passed, and the forge has not merged it: a forge that cannot merge when green, like a GitHub repository without "Allow auto-merge" or on a plan without it | "Merge" |
| Failed | A check failed; the page names it and links the pull request | "Try again", "Discard" |
| Conflict | It conflicts with a newer commit of the branch | "Try again", "Discard" |
| Live | Merged: "Live for the next run: factory version <commit>" | none |
| Discarded | Closed without a merge | none |

"Try again" closes the pull request, deletes its branch and makes the same change on the newest commit; it reads the
edits from the pull request's title and checks each like a form, since anyone who may write to the repository can change
a title. "Discard" closes it and deletes its branch. "Merge" merges a change whose check `factory` passed, and answers
409 for any other. Each button acts only on a pull request of `CONSOLE_FACTORY_USER` from a `console/` branch.

On GitHub, a private repository on a plan without auto-merge or required checks cannot require the check: the
console then refuses changes. [A factory on a forge](../../deploy/README.md#a-factory-on-a-forge) says how to set
the branch up, with the reference factory's workflow that posts the check, and `console doctor` checks it.

## Health

`console doctor` and `/health` check, in this order ([ADR 0086](../../docs/decisions/0086-health-routes.md)):

1. Each foreman, intake and gatekeeper the console names: its `GET /v1/health`, one line per check the server reports
   (such as `foreman temporal` or `intake nats`), and whether it accepts the console's token. A server that does not
   answer names the variable of its URL; a refused token names the console's variable and the server's own.
2. `factory`: the definition in `CONSOLE_FACTORY` can be read.
   With `CONSOLE_FACTORY_REPOSITORY` ([ADR 0150](../../docs/decisions/0150-a-factory-repository-on-a-forge-in-the-profile.md)):
   `factory repository`, the newest commit of its branch can be fetched with `CONSOLE_FACTORY_TOKEN`, else it names
   Git's error and the two variables; and `factory check`, the forge adapter's `rules` of that branch require the check
   `factory` and no approval. Without the check the console refuses every change; with a required approval no change
   merges, since the token's user cannot approve its own pull request. The rules that cannot be read name the token
   and the adapter's variables.
3. `groups`, with `CONSOLE_GROUPS`: each group of the gatekeeper's groups file has a member who is not the example's
   `slack:U0EXAMPLE`, the member the reference `groups.json` ships in place of a person
   ([ADR 0114](../../docs/decisions/0114-the-example-member-of-the-reference-groups.md)). The check reads every group,
   not only the policy's approvers, and cannot tell whether a Slack ID belongs to a real person.
4. With `CONSOLE_SIGN_IN` ([ADR 0134](../../docs/decisions/0134-console-sign-in-roles-and-modes.md)): `sign-in`, for
   `oidc` the provider's discovery document at `<CONSOLE_OIDC_ISSUER>/.well-known/openid-configuration` answers; and
   `access`, the access file holds and has an admin who is not the example's `admin@example.com`, the person the
   reference `access.yaml` ships in place of one.
5. When an agent of the factory declares a secret of OpenBao (`ref:openbao/<name>`, [ADR 0137](../../docs/decisions/0137-secrets-port-write-side-and-openbao.md)):
   `secrets`, the adapter in `CONSOLE_SECRETS_ADAPTER` answers `probe` and `list` with the store at
   `OSF_OPENBAO_ADDR` and the token `OSF_OPENBAO_TOKEN`, else it names the adapter's error and the three variables;
   `secrets token`, the console's token lives 7 days or more, else it warns with the time the token ends, so there is
   a week to give the console a new one (a token of OpenBao lives at most 32 days by default; one without an end, like
   the root token, never warns); and `secret <name>` for each declared secret, which fails when the store has no
   value for it and names the agents that need it.
6. Only with `console doctor --deep` ([ADR 0120](../../docs/decisions/0120-deep-checks-of-console-doctor.md)):
   `model <route>`, one chat completion of one token per model route of the factory definition's agents through the
   gateway in `CONSOLE_MODEL_URL`, and `harness`, the command in `CONSOLE_HARNESS_COMMAND` answers ACP `initialize`
   within 10 seconds. A model call costs money, so `/health` and `console doctor` without `--deep` never make one.
   With `CONSOLE_TRACES_URL` also `traces`: one span `console doctor` of the service `console` goes by OTLP/HTTP to
   the collector in `CONSOLE_OTLP_URL`, and Jaeger's query API `GET /api/traces/{traceId}` must find it within
   5 seconds. A collector that refuses the span names `CONSOLE_OTLP_URL`; a span that does not arrive names the
   collector's exporter and `CONSOLE_TRACES_URL`.
   With `CONSOLE_SANDBOX_COMMAND` also `sandbox`: the sandbox adapter's `probe <template> example.com`
   ([sandbox port](../../ports/sandbox/README.md)) starts a sandbox from `CONSOLE_SANDBOX_TEMPLATE` with no allowed
   host, sends one HTTPS request to `example.com` and removes the sandbox; it must print `refused example.com`. A
   sandbox that reaches the host names the adapter's egress proxy; one that does not start names the adapter's reason,
   `CONSOLE_SANDBOX_COMMAND` and `CONSOLE_SANDBOX_TEMPLATE`.
   With `CONSOLE_NATS_URL` also `events`: the console publishes one `doctor.ping@v1` with a fresh random ID on
   `osf.doctor.ping.v1` through JetStream, and asks each foreman of `CONSOLE_FOREMAN_URL` every 250 ms for
   `GET /v1/doctor/pings/{id}` until one answers 200, for 10 seconds. A NATS server that does not answer names
   `CONSOLE_NATS_URL`; one without a stream for the subject names the foreman's `FOREMAN_NATS_URL`, as the foreman
   adds the stream `OSF`; a ping that no foreman shows names the foreman's release and its `FOREMAN_NATS_URL`.

The links to the Temporal UI and the trace store are for the browser, so the console does not check them; the
foreman's `temporal` check covers Temporal.

A server of a release before `/v1/health` fails its check with the advice to update it. When every check is ok,
`console doctor` prints the count last, like `all 7 checks ok`. A warning prints `WARN  <check>: <what to do>`, counts
as ok, adds itself to the count, like `all 5 checks ok, warnings: 1`, and shows on `/health` as "warning" with status 200.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `CONSOLE_ACCESS` | string |  | serve, with CONSOLE_SIGN_IN: the access file, read again at each request. Default access.yaml beside CONSOLE_FACTORY. Without a valid file with an admin nobody signs in. |
| `CONSOLE_BRANCH` | string | `"main"` | serve: the branch where the factory definition changes. |
| `CONSOLE_FACTORY` | string | `"factory.yaml"` | serve: the factory definition that /factory shows, read-only. |
| `CONSOLE_FACTORY_COMMAND` | string | `"npx -y @opensoftware/factory-spec"` | serve: the command line of factory-spec's factory, which /skills and /skills/<name> run with skills --file <CONSOLE_FACTORY> (ADR 0141), and a change with edit --file <the newest factory.yaml> (ADR 0144). |
| `CONSOLE_FACTORY_CACHE` | string |  | serve, with CONSOLE_FACTORY_REPOSITORY: the folder of the console's copy of the factory's repository. Default: a folder per repository below the system's temporary folder. |
| `CONSOLE_FACTORY_PATH` | string | `"factory.yaml"` | serve: the path of the factory definition in its Git repository. |
| `CONSOLE_FACTORY_REPOSITORY` | string |  | serve: the factory's repository on a forge as git+<url>#<branch>, like git+https://github.com/acme/factory.git#main. With it, /changes proposes a change of the factory as a pull request into that branch (ADR 0144), and /skills/<name> switches a skill per agent (ADR 0149); without it the factory is a local folder and the console changes nothing. |
| `CONSOLE_FACTORY_TOKEN` | string |  | serve, with CONSOLE_FACTORY_REPOSITORY: the forge token of the changes, the forge adapter's FORGE_TOKEN for them. It writes the contents and the pull requests of the repository and reads its branch's rules; the console fetches the repository with it too (ADR 0142). |
| `CONSOLE_FACTORY_USER` | string |  | serve, with CONSOLE_FACTORY_REPOSITORY: the user of CONSOLE_FACTORY_TOKEN as the forge adapter names an author, like forgejo:factory-bot or github:acme-factory. /changes lists only its pull requests. |
| `CONSOLE_FOREMAN_TOKEN` | string |  | serve: the foreman's FOREMAN_API_TOKEN, sent as Authorization: Bearer <token>; several, comma-separated, in the order of CONSOLE_FOREMAN_URL, or one for all. |
| `CONSOLE_FOREMAN_URL` | string |  | serve: the base URL of a foreman's API, or several, comma-separated, one per factory. Required. |
| `CONSOLE_FORGE_ADAPTER` | string | `"npx -y @opensoftware/forge-github"` | serve: the command line of the forge port's adapter that /inbox runs with prs (ADR 0073). |
| `CONSOLE_FORGE_TOKEN` | string |  | serve: the adapter's FORGE_TOKEN; a token that may read pull requests is enough. |
| `CONSOLE_FORGE_URL` | string |  | serve: the forge's API, the adapter's FORGE_URL, like https://codeberg.org for forge-forgejo. Default: the adapter's own. |
| `CONSOLE_GATEKEEPER_TOKEN` | string |  | serve: gatekeeper's GATEKEEPER_API_TOKEN. |
| `CONSOLE_GATEKEEPER_URL` | string |  | serve: the base URL of gatekeeper's API. Set, a run's page shows each gate's state and who it waits for. |
| `CONSOLE_GITHUB_API_URL` | string | `"https://api.github.com"` | serve, with CONSOLE_SIGN_IN=github: GitHub's API, from which the console reads the person's verified primary email. |
| `CONSOLE_GITHUB_CLIENT_ID` | string |  | serve, with CONSOLE_SIGN_IN=github: the client ID of the GitHub OAuth app. Its callback address is <CONSOLE_URL>/signin/callback. |
| `CONSOLE_GITHUB_CLIENT_SECRET` | string |  | serve, with CONSOLE_SIGN_IN=github: the OAuth app's client secret. |
| `CONSOLE_GITHUB_URL` | string | `"https://github.com"` | serve, with CONSOLE_SIGN_IN=github: GitHub's address for the sign-in, for GitHub Enterprise Server. |
| `CONSOLE_GROUPS` | string |  | doctor and /health: the groups file of the factory's gatekeeper, like /factory/groups.json. Set, a group without a member but the example's slack:U0EXAMPLE fails the check groups. |
| `CONSOLE_HARNESS_COMMAND` | string |  | doctor --deep: the command line, run with sh -c, that starts the harness's ACP agent, like claude-code-acp; it must answer ACP initialize within 10 seconds. |
| `CONSOLE_IMPROVE_DIR` | string |  | serve: the folder the improvement jobs write run records and scores to. Set, the page /improvement shows each scorer's pass rate and judge cost and each run's stages with their cost. |
| `CONSOLE_INBOX_PREFIX` | string | `"observer/"` | serve: the start of the branch names that /inbox lists. |
| `CONSOLE_INBOX_REPOSITORY` | string |  | serve: the repository of observer's pull requests, as <owner>/<name>, like acme/factory. Set, /inbox lists its open proposals. |
| `CONSOLE_INTAKE_TOKEN` | string |  | serve: intake's INTAKE_API_TOKEN. |
| `CONSOLE_INTAKE_URL` | string |  | serve: the base URL of intake's API. Set, a run's page lists every request of its work item. |
| `CONSOLE_LINKS` | string |  | serve: the dashboards every page links, as name=url, comma-separated, like Grafana=https://grafana.acme.dev. |
| `CONSOLE_MODEL_TOKEN` | string |  | doctor --deep: the gateway's key, sent as Authorization: Bearer <token>. |
| `CONSOLE_MODEL_URL` | string |  | doctor --deep: the OpenAI-compatible base URL of the model gateway (LiteLLM), ending in /v1; it gets one chat completion of one token per model route of the factory definition. |
| `CONSOLE_NATS_URL` | string |  | doctor --deep: the NATS server of the factory, like nats://nats:4222. Set, doctor --deep publishes one doctor.ping@v1 on osf.doctor.ping.v1 and waits 10 s for a foreman of CONSOLE_FOREMAN_URL to show it at GET /v1/doctor/pings/{id}. |
| `CONSOLE_OIDC_CLIENT_ID` | string |  | serve, with CONSOLE_SIGN_IN=oidc: the console's client at the provider. Its callback address is <CONSOLE_URL>/signin/callback. |
| `CONSOLE_OIDC_CLIENT_SECRET` | string |  | serve, with CONSOLE_SIGN_IN=oidc: the client's secret. |
| `CONSOLE_OIDC_ISSUER` | string |  | serve, with CONSOLE_SIGN_IN=oidc: the provider's issuer, whose discovery document is <issuer>/.well-known/openid-configuration, like https://accounts.google.com. |
| `CONSOLE_OTLP_URL` | string |  | doctor --deep: the OTLP/HTTP base URL of the collector, like http://jaeger:4318; it gets one span "console doctor" of the service "console" at /v1/traces. |
| `CONSOLE_REFRESH` | string | `"10"` | serve: the seconds after which the browser reloads the runs pages; 0 turns the reload off. |
| `CONSOLE_REPOSITORY_URL` | string |  | serve: the web URL of the factory's Git repository, like https://github.com/acme/factory. Set, the configuration pages link the file. |
| `CONSOLE_SANDBOX_COMMAND` | string |  | doctor --deep: the command line, run with sh -c, of a sandbox adapter, like sandbox-docker. Set, doctor --deep runs its probe <template> example.com, which starts a sandbox with no allowed host, and wants "refused example.com". |
| `CONSOLE_SANDBOX_TEMPLATE` | string | `"curlimages/curl:8.17.0"` | doctor --deep: the template of the sandbox probe; it needs curl. |
| `CONSOLE_SECRETS_ADAPTER` | string | `"npx -y @opensoftware/secrets-openbao"` | serve, doctor and /health: the command line of the secrets port's adapter that /secrets runs with list, put and delete, and console doctor with probe and list (ADR 0137). It gets the console's environment with OSF_OPENBAO_ADDR, OSF_OPENBAO_TOKEN and OSF_OPENBAO_MOUNT, and a value only on the standard input of put. |
| `CONSOLE_SESSION_HOURS` | number | `12` | serve, with CONSOLE_SIGN_IN: how long a session lasts, in hours. |
| `CONSOLE_SESSION_SECRET` | string |  | serve, with CONSOLE_SIGN_IN: the key of the encrypted session cookie, or several separated by commas: the first encrypts, every one decrypts, so a key changes without signing everyone out. |
| `CONSOLE_SESSION_URL` | string |  | serve: the link to a stage's transcript, with {sessionId}, like https://langfuse.acme.dev/sessions/{sessionId}. |
| `CONSOLE_SIGN_IN` | string |  | serve: switches on the console's own sign-in with this provider: oidc (OpenID Connect, like Google or a company's provider) or github (ADR 0134). Every page then needs a session, and who may sign in is the access file. Unset, the console is open and read-only, or behind the sign-in proxy of CONSOLE_USER_HEADER; both set, it does not start. |
| `CONSOLE_SPAN_URL` | string |  | serve: the link to a stage's span in the run's trace, with {traceId} and {spanId}, like http://127.0.0.1:16686/trace/{traceId}?uiFind={spanId} for Jaeger. |
| `CONSOLE_TEMPORAL_NAMESPACE` | string | `"default"` | serve: the Temporal namespace of the runs, the foreman's FOREMAN_TEMPORAL_NAMESPACE. |
| `CONSOLE_TEMPORAL_URL` | string |  | serve: the base URL of the Temporal UI. Set, a run's page links its history. |
| `CONSOLE_TRACES_URL` | string |  | doctor --deep: the base URL of the trace store's Jaeger query API, like http://jaeger:16686. Set, doctor --deep sends one span to CONSOLE_OTLP_URL and waits 5 s for GET /api/traces/{traceId} to find it. |
| `CONSOLE_TRACE_URL` | string |  | serve: the link to a run's trace in the trace store, with {runId} or {traceId}, like https://langfuse.acme.dev/traces?run={runId} or Phoenix's http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/{traceId}. A run without a traceId gets no link from a template with {traceId}. |
| `CONSOLE_URL` | string |  | serve: the console's own address, the source of the provider's callback address and of the same-origin rule of forms with the sign-in. Default http://localhost:<PORT>. With the sign-in it must be https:// or loopback, else the console does not start. A request for another host is sent to this address. |
| `CONSOLE_USER_HEADER` | string |  | serve: the header in which the sign-in proxy sends the signed-in person, like X-Forwarded-Email. Set, the console takes actions in that person's name, such as submitting work on /work (ADR 0089); unset, it is read-only. Only set it behind a proxy that sets the header and removes it from the browser's requests. |
| `OSF_NOW` | string |  | The current time, like 2026-01-01T00:00:00Z, for the age of a run, the sign-in and the waits of `console doctor --deep`, which then pass at once. Default: the clock. |
| `OSF_OPENBAO_ADDR` | string |  | serve, doctor and /health: the address of the factory's OpenBao, like http://openbao:8200, for the secrets adapter. Set, an admin or a factory engineer stores secrets on /secrets, and an admin deletes them. |
| `OSF_OPENBAO_MOUNT` | string | `"secret"` | serve, doctor and /health: the factory's KV version 2 mount in OpenBao, the same as its sandboxes' egress proxy reads. |
| `OSF_OPENBAO_TOKEN` | string |  | serve, doctor and /health: the console's OpenBao token, with the policy that secrets-openbao policy write prints: it writes, lists and deletes secrets and cannot read a value. console doctor warns 7 days before it ends. |
| `OSF_SEED` | string |  | doctor --deep: set, the ID of the doctor's ping comes from it instead of from chance, so a test knows it. Leave it unset in a factory. |
| `PORT` | string | `"8080"` | serve: the port the web pages are served on. |

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/console/`. Merging it
creates the tag `console-v<version>`. The workflow `.github/workflows/publish-console.yml` then builds the package
and publishes it to npm as `@opensoftware/console`. When the newest tag is missing on npm, the next run of the
workflow on `main` publishes it. To publish a tag again, run the workflow by hand with the tag. The first release is
`0.1.0`; until `1.0.0`, a breaking change raises the minor version.

The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)): the
GitHub environment `npm`, a token only for the first version, then a trusted publisher for the workflow
`publish-console.yml`. No credential is stored in the repository.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-CONSOLE-001 | deprecated | A new user opens the runs page of the quick start |
| SCN-CONSOLE-002 | implemented | The help lists every command |
| SCN-CONSOLE-003 | implemented | An unknown command shows the usage |
| SCN-CONSOLE-004 | implemented | Serve without a foreman exits 2 and names the variable |
| SCN-CONSOLE-005 | implemented | A run's row shows its title, source, requester, pull request and age |
| SCN-CONSOLE-006 | implemented | The runs page lists the runs of two factories |
| SCN-CONSOLE-007 | implemented | Runs that have not ended come first, the newest first |
| SCN-CONSOLE-008 | implemented | A person filters the runs by the state "failed" |
| SCN-CONSOLE-009 | implemented | The runs page links a filter for each of the five states |
| SCN-CONSOLE-010 | implemented | An unknown state answers 400 and names the five states |
| SCN-CONSOLE-011 | implemented | A foreman that does not answer is named, and the other foreman's runs are listed |
| SCN-CONSOLE-012 | implemented | The runs page reloads itself every 10 seconds |
| SCN-CONSOLE-013 | implemented | The console calls each foreman with its token |
| SCN-CONSOLE-014 | implemented | A title with HTML is shown as text |
| SCN-CONSOLE-015 | implemented | The run page shows the stages with their agent and state |
| SCN-CONSOLE-016 | implemented | The run page links its Slack origin and its pull request |
| SCN-CONSOLE-017 | implemented | With intake, the run page lists every request of the work item |
| SCN-CONSOLE-018 | implemented | The run page links its trace and each stage's transcript |
| SCN-CONSOLE-019 | implemented | The run page links its history in the Temporal UI |
| SCN-CONSOLE-020 | implemented | The run page shows a stage's gate with its state and who it waits for |
| SCN-CONSOLE-021 | implemented | The run page shows the checks a stage waits for and why a stage failed |
| SCN-CONSOLE-022 | implemented | A run that no foreman knows answers 404 |
| SCN-CONSOLE-023 | deprecated | The factory page lists the agents with their harness and model |
| SCN-CONSOLE-024 | implemented | An agent's page is read-only and links to the file and the branch in Git |
| SCN-CONSOLE-025 | implemented | An agent that the factory does not declare answers 404 |
| SCN-CONSOLE-026 | implemented | A POST to the console answers 405 |
| SCN-CONSOLE-027 | implemented | Every page links the dashboards in "CONSOLE_LINKS" |
| SCN-CONSOLE-028 | implemented | A foreman that cannot be reached is named on the runs page |
| SCN-CONSOLE-029 | implemented | An origin link that is not http or https is shown as text |
| SCN-CONSOLE-030 | implemented | The inbox lists observer's open pull requests, the newest first |
| SCN-CONSOLE-031 | implemented | A proposal shows its age and the state "needs review" or "approved" |
| SCN-CONSOLE-032 | implemented | A proposal a reviewer asked to change shows "changes requested" |
| SCN-CONSOLE-033 | implemented | The inbox lists the branches of the prefix in "CONSOLE_INBOX_PREFIX" |
| SCN-CONSOLE-034 | implemented | A forge that refuses the token is named on the inbox |
| SCN-CONSOLE-035 | implemented | Without a repository the inbox answers 404 and names the variable |
| SCN-CONSOLE-036 | implemented | The factory page lists the agents with their harness, model and effort |
| SCN-CONSOLE-037 | implemented | A healthy factory passes every check of "console doctor" |
| SCN-CONSOLE-038 | implemented | "console doctor" names each failing check and what to do |
| SCN-CONSOLE-039 | implemented | A foreman that does not answer is named with the variable of its URL |
| SCN-CONSOLE-040 | implemented | The page "/health" shows the checks and answers 503 when one fails |
| SCN-CONSOLE-041 | implemented | The run page links the run's trace by its trace ID |
| SCN-CONSOLE-042 | implemented | A trace link with "{traceId}" is left out for a run without a trace ID |
| SCN-CONSOLE-043 | implemented | The work page lists each work item with its status and its run |
| SCN-CONSOLE-044 | implemented | Without intake the work page answers 404 and names the variable |
| SCN-CONSOLE-045 | implemented | A signed-in person submits work from the work page |
| SCN-CONSOLE-046 | implemented | A form without the signed-in person submits nothing |
| SCN-CONSOLE-047 | implemented | Without "CONSOLE_USER_HEADER" the console stays read-only |
| SCN-CONSOLE-048 | implemented | "console doctor" names a missing foreman URL, a server without "/v1/health" and a factory it cannot read |
| SCN-CONSOLE-049 | implemented | A form from another site submits nothing |
| SCN-CONSOLE-050 | implemented | The run page of a failed or cancelled run has the form "run again" for a signed-in person |
| SCN-CONSOLE-051 | implemented | A person runs a failed run again from the run page |
| SCN-CONSOLE-052 | implemented | The run page of a run that is running or complete has no form "run again" |
| SCN-CONSOLE-053 | implemented | A retry the foreman refuses shows the foreman's problem |
| SCN-CONSOLE-054 | implemented | The run page of a run that ran again links the run before it |
| SCN-CONSOLE-055 | implemented | The run page shows a stage that only waits with "waits" instead of an agent |
| SCN-CONSOLE-056 | implemented | "console doctor" fails on a group whose only member is the example's |
| SCN-CONSOLE-057 | implemented | The runs page links the next page while a foreman has more runs |
| SCN-CONSOLE-058 | implemented | The work page links the next page of intake's inbox |
| SCN-CONSOLE-059 | implemented | "console doctor" fails on a groups file it cannot read |
| SCN-CONSOLE-060 | implemented | A person steers a running run from the run page |
| SCN-CONSOLE-061 | implemented | A person takes over, hands back and cancels a run from the run page |
| SCN-CONSOLE-062 | implemented | A person approves and rejects a run's pending gate from the run page |
| SCN-CONSOLE-063 | implemented | A decision gatekeeper refuses shows gatekeeper's problem |
| SCN-CONSOLE-064 | implemented | "console doctor --deep" calls each model route once and asks the harness to initialize |
| SCN-CONSOLE-065 | implemented | "console doctor --deep" names a failing model route and a harness that answers "initialize" with an error |
| SCN-CONSOLE-066 | implemented | "console doctor" without "--deep" calls no model |
| SCN-CONSOLE-067 | implemented | "console doctor --deep" names the variables of the gateway and the harness when they are not set |
| SCN-CONSOLE-068 | implemented | "console doctor --deep" names a gateway that does not answer and a harness that ends without a word |
| SCN-CONSOLE-069 | implemented | The page "/health" calls no model |
| SCN-CONSOLE-070 | implemented | The run page links each stage to its span in the run's trace |
| SCN-CONSOLE-080 | implemented | The run page lists the actions of a run with the person who sent each |
| SCN-CONSOLE-090 | implemented | The improvement page shows each scorer's pass rate and each run's cost |
| SCN-CONSOLE-091 | implemented | Without a folder the improvement page answers 404 |
| SCN-CONSOLE-092 | implemented | The improvement page reads only the records of ".json" and ".jsonl" files and skips other lines |
| SCN-CONSOLE-100 | implemented | "console doctor --deep" sends one span to the collector and finds it in the trace store |
| SCN-CONSOLE-101 | implemented | "console doctor --deep" names the path from the collector to the trace store when the span does not arrive |
| SCN-CONSOLE-102 | implemented | "console doctor --deep" names CONSOLE_OTLP_URL when no collector answers there |
| SCN-CONSOLE-110 | implemented | The run page links no span of a run whose foreman names no trace |
| SCN-CONSOLE-120 | implemented | "console doctor --deep" asks the sandbox adapter to probe a denied host and finds it refused |
| SCN-CONSOLE-121 | implemented | "console doctor --deep" names the egress proxy when a sandbox reaches the denied host |
| SCN-CONSOLE-122 | implemented | "console doctor --deep" names the adapter's reason and the variables when no sandbox starts |
| SCN-CONSOLE-123 | implemented | "console doctor --deep" without "CONSOLE_SANDBOX_COMMAND" skips the sandbox |
| SCN-CONSOLE-130 | implemented | "console doctor --deep" publishes a ping on NATS and finds it at the foreman |
| SCN-CONSOLE-131 | implemented | "console doctor --deep" names the foreman's consumer when the ping does not reach it in 10 seconds |
| SCN-CONSOLE-132 | implemented | "console doctor --deep" names the stream when no stream takes the ping |
| SCN-CONSOLE-133 | implemented | "console doctor --deep" names the variable when NATS does not answer |
| SCN-CONSOLE-134 | implemented | "console doctor --deep" without "CONSOLE_NATS_URL" skips the events |
| SCN-CONSOLE-135 | implemented | Every page allows only the console's own files and no script |
| SCN-CONSOLE-136 | deprecated | The page "/health" of a healthy factory answers 200 and has the navigation of every page |
| SCN-CONSOLE-137 | implemented | A person on the access list signs in and lands on the runs |
| SCN-CONSOLE-138 | implemented | A person who is not on the access list is refused and reads why |
| SCN-CONSOLE-139 | implemented | An email that the provider did not verify is refused |
| SCN-CONSOLE-140 | implemented | After the sign-in the person comes back only to a page of the console |
| SCN-CONSOLE-141 | implemented | Sign out ends the session |
| SCN-CONSOLE-142 | implemented | A session past its end asks to sign in again |
| SCN-CONSOLE-143 | implemented | A session of the previous key stays valid after a second key is added |
| SCN-CONSOLE-144 | implemented | A person removed from the access file loses access at the next page |
| SCN-CONSOLE-145 | implemented | With the sign-in a form must come from the console's own address |
| SCN-CONSOLE-146 | implemented | The probe "/v1/ready" answers without a session |
| SCN-CONSOLE-147 | implemented | The console with the sign-in does not start without a setting of its provider |
| SCN-CONSOLE-148 | implemented | A person signs in with GitHub |
| SCN-CONSOLE-149 | implemented | The console with the sign-in does not start on an address that is neither loopback nor HTTPS |
| SCN-CONSOLE-150 | implemented | The console does not start when it signs people in and a sign-in proxy names the person too |
| SCN-CONSOLE-151 | implemented | Behind a sign-in proxy with an access file, a person who is not in it gets 403 |
| SCN-CONSOLE-152 | implemented | Behind a sign-in proxy with an access file, a person in it sees the runs |
| SCN-CONSOLE-153 | implemented | The sign-in page has the look of the design system, served from the console itself |
| SCN-CONSOLE-154 | implemented | Without an access file nobody can sign in, and the page names the file |
| SCN-CONSOLE-155 | implemented | The probe "/v1/ready" answers 503 when the console cannot read its factory |
| SCN-CONSOLE-156 | implemented | With the sign-in a form without a session answers 401 |
| SCN-CONSOLE-157 | implemented | A new user opens the runs page of the quick start in the look of the design system |
| SCN-CONSOLE-158 | deprecated | The navigation of a console without intake, an inbox or cost and scores links only the pages that work |
| SCN-CONSOLE-159 | deprecated | The navigation of a console with intake, an inbox and cost and scores links their pages too |
| SCN-CONSOLE-160 | implemented | The link "Runs" counts the runs that wait for a person |
| SCN-CONSOLE-161 | implemented | A person switches to the light theme and back, and stays on the page |
| SCN-CONSOLE-162 | implemented | The shell has a skip link to the content and its landmarks |
| SCN-CONSOLE-163 | implemented | A person signs in and lands on the runs in the shell (journey) |
| SCN-CONSOLE-164 | implemented | On a phone the navigation folds away behind "Menu" (journey) |
| SCN-CONSOLE-165 | implemented | A page without a session redirects to the sign-in and comes back to that page |
| SCN-CONSOLE-166 | implemented | A session before its end stays valid |
| SCN-CONSOLE-167 | implemented | "console doctor" with the sign-in refuses an access file whose only admin is the example |
| SCN-CONSOLE-168 | implemented | "console doctor" with the sign-in names a provider that does not answer |
| SCN-CONSOLE-169 | implemented | "console doctor" with the sign-in of GitHub asks no OpenID Connect provider and accepts an admin beside the example |
| SCN-CONSOLE-170 | implemented | "console doctor" finds the discovery of an issuer that is set with a slash at its end |
| SCN-CONSOLE-171 | implemented | "console doctor" with the sign-in names the problem of an access file without an admin |
| SCN-CONSOLE-172 | implemented | The probe "/v1/ready" answers a health check that asks another host than the console's address |
| SCN-CONSOLE-173 | implemented | An admin stores a value for a missing secret, and the list says "Set" with the person |
| SCN-CONSOLE-174 | implemented | A declared secret without a value says "Missing" and names the agents that need it |
| SCN-CONSOLE-175 | implemented | A stored secret that no agent declares says "Not used" and offers "Delete" |
| SCN-CONSOLE-176 | implemented | The secrets of the providers "env" and "file" are listed as set outside the UI |
| SCN-CONSOLE-177 | deprecated | A member gets 403 for "/secrets" and its form, and only an admin's navigation links "Secrets" |
| SCN-CONSOLE-178 | deprecated | In the open mode "/secrets" and its form answer 404 |
| SCN-CONSOLE-179 | deprecated | Behind a sign-in proxy without an access file "/secrets" answers 404, and the navigation does not link it |
| SCN-CONSOLE-180 | implemented | Without a store "/secrets" answers 404 and names the variable |
| SCN-CONSOLE-181 | implemented | A stored value is in no output of the console |
| SCN-CONSOLE-182 | implemented | A name that the store's adapter refuses answers 400 and names the problem |
| SCN-CONSOLE-183 | implemented | A form over 64 KiB answers 413 and stores nothing |
| SCN-CONSOLE-184 | implemented | "Delete" asks first on a page of its own, then removes the secret |
| SCN-CONSOLE-185 | implemented | A store that does not answer is named on "/secrets", and its secrets say "Unknown" |
| SCN-CONSOLE-186 | implemented | "console doctor" names each secret of OpenBao that the factory declares without a value |
| SCN-CONSOLE-187 | implemented | "console doctor" names a store that does not answer |
| SCN-CONSOLE-188 | implemented | "console doctor" and "/health" warn when the console's token for the store ends within 7 days |
| SCN-CONSOLE-189 | implemented | An admin signs in and stores a secret (journey) |
| SCN-CONSOLE-190 | implemented | An adapter whose output is no JSON is named on "/secrets", and its secrets say "Unknown" |
| SCN-CONSOLE-191 | implemented | "/skills" lists each skill with its description, source, agents and needs, and the state of each secret |
| SCN-CONSOLE-192 | implemented | In the open mode and without a store, both pages answer, and a secret of OpenBao has no state |
| SCN-CONSOLE-193 | implemented | A store that does not answer is named on "/skills", and the secret's state is "Unknown" |
| SCN-CONSOLE-194 | implemented | A skill's page shows its SKILL.md as Markdown, its files, its agents and what it needs |
| SCN-CONSOLE-195 | implemented | The page of a skill that no agent uses answers 404 |
| SCN-CONSOLE-196 | implemented | A skill that lint refuses shows its problems, and a folder without a SKILL.md says so |
| SCN-CONSOLE-197 | implemented | Raw HTML in a SKILL.md is shown as text |
| SCN-CONSOLE-198 | implemented | A script in a SKILL.md is shown as text and never runs |
| SCN-CONSOLE-199 | implemented | An image in a SKILL.md is shown as its text, so no remote image loads |
| SCN-CONSOLE-200 | implemented | A link of a SKILL.md keeps its anchor only to the web or an email address |
| SCN-CONSOLE-201 | implemented | A factory program that fails is named on both pages |
| SCN-CONSOLE-202 | implemented | With the own sign-in a member opens both pages, without the link to store a value |
| SCN-CONSOLE-203 | deprecated | The navigation of a console without intake, an inbox or cost and scores links only the pages that work, Skills among them |
| SCN-CONSOLE-204 | deprecated | The navigation of a console with intake, an inbox and cost and scores links their pages too, Skills among them |
| SCN-CONSOLE-205 | implemented | A link by reference, an autolink and a link in a list or a quote follow the same rule |
| SCN-CONSOLE-206 | implemented | A factory engineer's change opens a pull request from the newest commit that names the person |
| SCN-CONSOLE-207 | implemented | A member gets 403 for the form "Propose change", and "/changes" offers a member no form |
| SCN-CONSOLE-208 | implemented | A change whose check passes merges and shows "Live" with the new factory version |
| SCN-CONSOLE-209 | implemented | A change whose check fails shows "Failed" with the check and the link to its pull request |
| SCN-CONSOLE-210 | implemented | A change made on an older commit shows "Conflict", and the main branch keeps the newer commit |
| SCN-CONSOLE-211 | implemented | "Try again" closes the failed pull request, deletes its branch and makes the change again on the newest commit |
| SCN-CONSOLE-212 | implemented | "Discard" closes the failed pull request and deletes its branch, and the change shows "Discarded" |
| SCN-CONSOLE-213 | implemented | On a forge that cannot merge when green, a change waits as "Checking", shows "Ready" with "Merge" once its check passes, and "Merge" merges it |
| SCN-CONSOLE-214 | implemented | "Merge" of a change whose check "factory" failed answers 409 and merges nothing |
| SCN-CONSOLE-215 | implemented | A repository whose main branch does not require the check "factory" gets no change, and the console says what is missing |
| SCN-CONSOLE-216 | implemented | A factory from a local folder offers no change and says why |
| SCN-CONSOLE-217 | implemented | The form takes only a host name as an egress host and names what it refused |
| SCN-CONSOLE-218 | implemented | "Try again" checks the edit in the pull request's title like a form, and refuses a title that a person changed |
| SCN-CONSOLE-219 | implemented | A pull request from a "console/" branch that another user opened is not a change of the console |
| SCN-CONSOLE-220 | implemented | A factory engineer proposes a change in Chromium and sees it checking |
| SCN-CONSOLE-221 | implemented | A factory repository that cannot be fetched answers 502 and names Git's error |
| SCN-CONSOLE-222 | implemented | The console does not start with a factory repository that is not "git+<url>#<branch>" |
| SCN-CONSOLE-223 | implemented | The console does not start with a factory repository and without "CONSOLE_FACTORY_USER" |
| SCN-CONSOLE-224 | implemented | The form takes only an agent's name, so no text of it reaches a branch name or a title |
| SCN-CONSOLE-225 | implemented | The form "Declare a secrets provider" opens a change for a name and a range, and names a range it refused |
| SCN-CONSOLE-226 | implemented | The page says in a sentence what each edit changes |
| SCN-CONSOLE-227 | implemented | The form names an unknown edit, a missing agent and each value that is no skill folder, secret reference, provider's name or range |
| SCN-CONSOLE-228 | implemented | With a forge that does not answer, "/changes" says that the changes could not be listed and still offers every edit |
| SCN-CONSOLE-229 | implemented | A value of each kind that the form takes passes its checks, with spaces around it too |
| SCN-CONSOLE-230 | implemented | A member gets 403 for "/secrets" and its form, and the navigation links "Secrets" for an admin and a factory engineer |
| SCN-CONSOLE-231 | implemented | A factory engineer stores a value and replaces it, and only an admin deletes a secret |
| SCN-CONSOLE-232 | implemented | In the open mode "/secrets" and its form answer 404 and name the roles that open it |
| SCN-CONSOLE-233 | implemented | Behind a sign-in proxy without an access file "/secrets" answers 404 and names the roles, and the navigation does not link it |
| SCN-CONSOLE-234 | implemented | A factory engineer switches a skill on for an agent, and the change lists the added provider, secret and host |
| SCN-CONSOLE-235 | implemented | A factory engineer switches a skill on in Chromium and sees the change checking, then live |
| SCN-CONSOLE-236 | implemented | A member sees whether each agent has the skill and why there is no switch, and a forge that does not answer is named |
| SCN-CONSOLE-237 | implemented | A factory from a local folder shows no switch on a skill's page and says why |
| SCN-CONSOLE-238 | implemented | Switching a skill off only removes the agent's entry |
| SCN-CONSOLE-239 | implemented | A skill of another repository whose needs an agent meets adds nothing but the skill's entry |
| SCN-CONSOLE-240 | implemented | A skill of another repository shows its repository and pinned commit, and one without a pin says so |
| SCN-CONSOLE-241 | implemented | "console doctor" fetches the private factory repository with its token and finds the check "factory" required on its main branch |
| SCN-CONSOLE-242 | implemented | "console doctor" names the settings when the factory repository does not answer |
| SCN-CONSOLE-243 | implemented | "console doctor" fails when the main branch of the factory repository does not require the check "factory" |
| SCN-CONSOLE-244 | implemented | "console doctor" fails when the main branch of the factory repository requires an approval |
| SCN-CONSOLE-245 | implemented | The buttons of a failed change read well in Chromium and pass the accessibility checks |
| SCN-CONSOLE-246 | implemented | On a phone the runs are cards and "Submit work" stays at the bottom of the screen (journey) |
| SCN-CONSOLE-247 | implemented | The run page is in the shell of the new look, offers a read-only console no form and reloads itself |
| SCN-CONSOLE-248 | implemented | A signal the foreman refuses shows the foreman's problem in the shell of the new look |
| SCN-CONSOLE-249 | implemented | On a phone a person rejects a run's gate with a reason from the run page (journey) |
| SCN-CONSOLE-250 | implemented | A gate that is decided offers no form "Approve" or "Reject" |
| SCN-CONSOLE-251 | deprecated | The navigation of a console with intake, an inbox and cost and scores links Work and Inbox among the pages in the new look |
| SCN-CONSOLE-252 | implemented | The work page is in the shell of the new look and offers a signed-in person the form "Submit work" |
| SCN-CONSOLE-253 | implemented | A submission that intake refuses shows intake's answer in the shell of the new look |
| SCN-CONSOLE-254 | implemented | An intake that does not answer is named on the work page |
| SCN-CONSOLE-255 | implemented | A form the console refuses shows the reason in the shell of the new look, with the way back to its page |
| SCN-CONSOLE-256 | implemented | The inbox is in the shell of the new look and says when no proposal is open |
| SCN-CONSOLE-257 | implemented | On a phone a person reads the inbox as cards and submits work from the work form (journey) |
| SCN-CONSOLE-258 | implemented | The navigation of a console without intake, an inbox or cost and scores links only the pages that work, in one list |
| SCN-CONSOLE-259 | implemented | The navigation of a console with intake, an inbox and cost and scores links their pages in one list, the dashboards below it |
| SCN-CONSOLE-260 | implemented | Each problem of a page shows in the shell, with a way back that this console has |
| SCN-CONSOLE-261 | implemented | A problem of the secrets or the changes leads back to their page for a person who may open it |
| SCN-CONSOLE-262 | implemented | The page "/health" of a healthy factory answers 200 in the shell, with the navigation of every page |
| SCN-CONSOLE-263 | implemented | The factory page and an agent's page show in the shell, with "Factory" as the current page |
| SCN-CONSOLE-264 | implemented | An agent's page shows a list or a map of the agent as YAML |
| SCN-CONSOLE-265 | implemented | The improvement page shows in the shell, with "Cost and scores" as the current page |
