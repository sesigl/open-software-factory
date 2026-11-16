---
covers: [modules/console/**]
---

# The factory UI

The console is the factory's web UI and the backend of the browser (ADR 0130). A person reads the runs, signs in,
stores secrets, gives agents skills and changes the factory there. Git stays the source of truth: the UI shows the
factory and proposes a change as a pull request (P3). This page describes the target of wave 6, whose items are in
[`docs/history/todo-waves-0-6.md`](../history/todo-waves-0-6.md); each item of the wave says which part it builds.

## How the parts connect

```text
browser ─────────────▶ console            the only server a browser reaches: pages, forms, the session cookie
                         ├─ HTTP with a service token and the person proof ─▶ foreman, intake, gatekeeper
                         ├─ secrets adapter, a program ─▶ OpenBao       writes values, lists names, cannot read a value
                         ├─ forge adapter, a program ───▶ the forge     commit, pull request, merge when green
                         └─ a folder, or git fetch ─────▶ the factory's files: factory.yaml, access.yaml, skills
identity provider ◀──── redirects of the sign-in ────▶ console
sandbox's egress proxy ─ reads ─▶ OpenBao  as today: it swaps the placeholder for the value on the way out
```

- No API gateway, and no module API that a browser calls. The modules keep their HTTP APIs and tokens; a team's own
  UI or script uses them with a token (SCN-FACTORY-ACCESS-002).
- The console keeps no database. The session is an encrypted cookie, who may sign in is the access file in Git, a
  secret's value is in OpenBao, and the state of a change is its pull request. Its only folder is a cache of the
  factory's repository.
- A page renders on the server and works without script. An island adds comfort; no feature depends on one.
- An island is a SolidJS component in `.tsx` in `packages/ui/src/islands/`. A page includes it with a `<script>` of an
  Astro component, which Vite bundles into a file of `/_astro/`; no `client:*` directive, since Astro writes those as
  inline scripts. So the console's policy allows scripts of its own origin only: `script-src 'self'`, without inline
  script, hash or nonce. The script imports the island's mount script, which renders the component into its element
  with the properties the server wrote on it as JSON (`data-props`), and TEMPLATE allows a `<script>` nothing else.
- The first island, `work-list`, keeps the list of the work page fresh without a reload: it loads the rows from
  `/work/items` every `CONSOLE_REFRESH` seconds, ready to show, since the route computes them with the page's own
  functions; a browser without script reloads the page, from a `<noscript>` (ADR 0152).

## The path of a request

| Request | Path |
| --- | --- |
| A page | The browser asks the console for `GET /runs`. The console checks the session (or the proxy's header), asks the foremen with their service tokens, renders the HTML on the server and answers it. |
| A form | The browser posts the form to the console. The console checks the session, the role and that the `Origin` is its own, makes one call of a module API, a secrets adapter or a forge adapter with the person as the actor, and answers with a redirect (303) to a page that shows the result. |
| A change | A factory engineer edits a setting of the factory on `/changes`. The console fetches the newest commit of the factory's repository into its cache, runs `factory edit` on it, writes the result on a new branch from that commit through the forge adapter, opens a pull request that names the person and asks the forge to merge it when its check `factory` is green (ADR 0144). The page asks the forge for each change's state and links the pull request when it fails. The merged commit is the factory version of the next run. |
| A skill's switch | A factory engineer switches a skill on for an agent on `/skills/<name>`. A page lists first each edit the switch makes: the secret reference, its provider and the egress host the agent lacks, then the skill. Confirmed, it is one change of several edits: `factory edit` runs once per edit, and the pull request's title holds every edit and its body lists each one (ADR 0149). Until it is live, the skill's page shows the change beside the agent. |

## The three modes

| Mode | Set by | What a person gets |
| --- | --- | --- |
| Open, read-only | Nothing (the default) | The pages, read-only (ADR 0072). A page or form that needs a role answers 404. |
| Behind a proxy | `CONSOLE_USER_HEADER` (ADR 0089) | The person comes from the proxy's header. Without an access file every person acts as a `member`; with one its roles apply, and a person who is not in it gets 403. |
| Own sign-in | One explicit setting that names this mode (T-56) | The sign-in page with OpenID Connect or GitHub, the session and the roles. Every page needs a session. |

The own sign-in is switched on by name, never inferred. With it on, a missing provider setting stops the console at
its start.

## The person, proven to the modules

A form's call of foreman, intake or gatekeeper names the person in its body, as `requester` or `by`. A module trusts
that name only with a person proof (ADR 0151, T-61): a JSON Web Token in the header `OSF-Person` that the console
signs with its Ed25519 key `CONSOLE_SIGNING_KEY` for this one call. It names the person and their role, the module as
its audience, the request's method, path and body digest, and ends after 30 seconds. The console publishes its public
keys at `/.well-known/jwks.json`; a module fetches them from the address in its setting `<MODULE>_PERSON_KEYS`. In
both modes with actions the console signs: for the session's person, or for the person of the proxy's header. A team's
own tool acts as itself with the API token, or signs proofs with a key of its own that the modules' setting names. The
formats are `person-proof` and `person-keys` in `contracts/`.

## Three kinds of UI test

Each is a system test: one scenario, one test, the built console from outside (T-52).

| Kind | Runs | Proves |
| --- | --- | --- |
| Page scenario | The built console over HTTP; the test reads the HTML by role and name; no browser | What a page shows and what a form does. The default. |
| Journey scenario | The built console with its fakes, in Chromium | One main flow of a person from start to end, across pages |
| Island scenario | One island on its page of the workbench, in Chromium | Everything the island does, as a whole |

A test finds elements by role, label or text, never by a CSS class, a tag or a test ID. No test compares pixels; a
journey's screenshots are evidence on the pull request.

The workbench is a static site of plain Astro pages in `packages/ui`, one page per island and state. An island
scenario serves it with `sut.site` and opens a page with `sut.browser`. During a mutation run `sut.browser` sets
Stryker's active mutant in the page before its first script, so MUTATION counts an island's lines (ADR 0152). The
build of `packages/ui` writes it to `dist/workbench/`, with static JSON in place of a route, and an island scenario
pauses the browser's clock (`page.clock.pauseAt`) and runs it on (`page.clock.runFor`), so no test waits for time.
