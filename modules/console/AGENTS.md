# AGENTS.md for module `console`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0072, ADR 0073, ADR 0115, ADR 0120, ADR 0130, ADR 0132, ADR 0141, ADR 0144, ADR 0149, ADR 0150, ADR 0152.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `console <command>` (see `README.md#commands`)
- Web pages of `console serve` on `PORT` (see `README.md#pages`): `/`, `/runs/<runId>`, `/work`, the rows of its island `/work/items` as JSON (ADR 0152), `/factory`,
  `/factory/agents/<name>`, `/inbox`, `/improvement`, `/health`, `/secrets` and `/secrets/delete` (ADR 0137), `/skills` and `/skills/<name>` (ADR 0141), `/skills/<name>/switch` (ADR 0149), `/changes` (ADR 0144); the sign-in `/signin`, `/signin/start`,
  `/signin/callback` and `POST /signout` (ADR 0134); `/theme` (ADR 0133); the probe `/v1/ready`; the key set of the
  person proof `/.well-known/jwks.json`, without a session and for every host, 404 without `CONSOLE_SIGNING_KEY`
  (ADR 0151); and the files
  `/_astro/<file>` and `/favicon.svg`. Any other method but `GET` and `HEAD` answers 405, except the forms
  `POST /work`, `POST /runs/<runId>/retry`, `POST /runs/<runId>/signals` and `POST /runs/<runId>/gates/<gateId>` with
  `CONSOLE_USER_HEADER` or `CONSOLE_SIGN_IN` (ADR 0089, ADR 0105, ADR 0118, ADR 0134), and `POST /secrets` and
  `POST /secrets/delete`, which answer 404 without roles or a store and 403 to anyone but an admin (ADR 0137), and
  `POST /changes`, `POST /changes/<number>/retry`, `POST /changes/<number>/discard` and `POST /changes/<number>/merge`,
  which answer 404 without `CONSOLE_FACTORY_REPOSITORY` or roles and 403 to anyone but an admin or a factory engineer
  (ADR 0144); `POST /changes` takes one edit or, in the field `edits`, the line of several (ADR 0149).
- Outside systems it calls: the foremen's HTTP API at `CONSOLE_FOREMAN_URL`, intake's at `CONSOLE_INTAKE_URL` and
  gatekeeper's at `CONSOLE_GATEKEEPER_URL` (`contracts/openapi/openapi.json`), only with `GET`, and with `POST` for the actions (intake's
  `/v1/work-items`, the foreman's `/v1/runs/<runId>/retry` and `/v1/runs/<runId>/signals`, gatekeeper's
  `/v1/gates/<gateId>/decisions`), each action with `CONSOLE_SIGNING_KEY` with the person's proof in the header
  `OSF-Person`, signed through `@opensoftware/person-proof` (ADR 0151); the forge port's
  adapter in `CONSOLE_FORGE_ADAPTER`, only with its read-only command `prs` (ADR 0073); with `console doctor --deep`
  only, the model gateway at `CONSOLE_MODEL_URL` (one `POST /chat/completions` per route) and the harness started by
  `CONSOLE_HARNESS_COMMAND` (ACP `initialize`, ADR 0120), the trace store, and the sandbox adapter in
  `CONSOLE_SANDBOX_COMMAND`, only with its command `probe` (ADR 0120); the secrets port's adapter in
  `CONSOLE_SECRETS_ADAPTER` with `list`, `put` and `delete` for `/secrets`, with `list` for `/skills` and
  `/skills/<name>`, and with `probe` and `list` for `console doctor` and `/health`, with `OSF_OPENBAO_ADDR`, `OSF_OPENBAO_TOKEN` and `OSF_OPENBAO_MOUNT` (ADR 0137); a value goes
  only to the standard input of `put`; factory-spec's `factory` in `CONSOLE_FACTORY_COMMAND`, only with
  `skills --file <CONSOLE_FACTORY>`, which prints the `skill-catalog` contract (ADR 0141, ADR 0143), and
  `edit --file <the fetched factory.yaml>`, or a file beside it for each edit after the first, for a change; with `CONSOLE_FACTORY_REPOSITORY`, the forge adapter with
  `CONSOLE_FACTORY_TOKEN` for `rules`, `branch`, `commit`, `open-pr`, `merge`, `prs`, `pr` and `close` on that
  repository, and Git, which fetches it into `CONSOLE_FACTORY_CACHE` through `@opensoftware/factory-source` (ADR 0144); `console doctor` and `/health` fetch it and run `rules` too (ADR 0150)
- Input: the factory definition in `CONSOLE_FACTORY` and the access file in `CONSOLE_ACCESS`
- With `CONSOLE_SIGN_IN`: the identity provider at `CONSOLE_OIDC_ISSUER`, or GitHub at `CONSOLE_GITHUB_URL` and
  `CONSOLE_GITHUB_API_URL`
- Server state: none; with `CONSOLE_FACTORY_REPOSITORY` a cache of the factory's repository, which it fetches again
  at each change
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `templates`
(`src/web/`) → `pages` → `adapters` → `domain`. Every page is a template on Astro (ADR 0132), in
`src/web/pages/<path>.astro`: its route in `serve` loads the data, a function of `pages` computes every value it shows,
and `adapters/web.ts` hands them to Astro as `locals.page` with the status. A template holds no logic (TEMPLATE); the
health page is the first. Astro's own Origin check is off: the route of each form checks `Origin` first and answers a
form from another site with its own problem page, which Astro only renders. Every answer has a Content-Security-Policy whose scripts are only the console's own files (`script-src 'self'`, ADR 0152): no inline script, hash, nonce or eval. The design system `@opensoftware/ui` is a `devDependency`: Astro compiles its components, styles and faces
into `dist/web/` and copies its brand files beside them (`publicDir`), and the console serves them at `/_astro/` and
`/favicon.svg` from its own origin. So no built file may resolve `@opensoftware/ui`: the published console does not have it; an island's SolidJS is bundled into its script in `dist/web/client/_astro/`, and `solid-js` and `vite-plugin-solid` are `devDependencies` for that build. Islands: each island a page uses is listed here with the reason why a page load is not enough (T-55):

- `work-list` of `@opensoftware/ui` on `/work`: the page reloaded itself every `CONSOLE_REFRESH` seconds, which threw
  away a half-typed "Submit work" form, and axe flags a reload (`meta-refresh`, WCAG 2.2.1). The island loads the
  rows from `/work/items`, which the route of the page computes with the same functions (`pages/work.ts`), so the
  browser formats nothing; a browser without script still reloads (`<noscript>`).

 `domain` holds the run states, the order of a merged run list, a run's age, the URL
templates, the inbox's states, the states of the secrets, what a skill needs and the safe HTML of a skill's Markdown
(markdown-it, ADR 0141), a change's edits, branch, title, body and state (ADR 0144), and the edits of a skill's
switch (ADR 0149), without I/O; `adapters` call
the APIs, run the forge and the secrets adapters and `factory`, fetch the factory's repository, and read the factory
file; `pages` compute the data of each template and import only `domain` and the types of `adapters` (since T-60 the console has
no other stack: no Preact, htm or Pico CSS); `commands` join them: `serve` runs the
Fastify server. The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Journeys

A journey runs in Chromium (`@kind=journey`, ADR 0131) only for a main flow. Each has its reason here:

- SCN-CONSOLE-163, sign in and land on the runs: the first thing every person does, across the provider and three
  pages, and the only proof that the shell's styles show the navigation on a desktop.
- SCN-CONSOLE-164, the shell on a phone: only a browser lays out the page, so only it shows that the navigation
  folds away behind "Menu" and opens again.
- SCN-CONSOLE-189, store a secret: the main flow of an admin across the sign-in, the navigation and the form, and
  the only proof that a browser sends the form "Store value" with the console's own `Origin`, that the value field
  takes the typed value, and that the list beside the form reads well and passes axe.

- SCN-CONSOLE-220, propose a change: the main flow of a factory engineer across the sign-in, the navigation and the
  form, and the only proof that a browser sends the form "Propose change" with its two lists and the console's own
  `Origin`, and that the page of the changes reads well and passes axe.

- SCN-CONSOLE-235, switch a skill on: the main flow of T-59 across the skill's page, the page that asks first and
  the changes, from "Checking" to "Live", and the only proof that a browser sends the switch's `GET` form and the
  hidden line of edits, and that the skill's page with its switches passes axe.

- SCN-CONSOLE-245, the buttons of a failed change: no other journey shows a change's buttons ("Try again",
  "Discard", "Merge" are one class, `osf-button`, as a button of a form), so it is the only proof that they keep the
  design system's colours in a browser and pass axe's colour contrast.

- SCN-CONSOLE-246, the runs on a phone: only a browser lays out the cards and keeps "Submit work" at the bottom of
  the screen while the page scrolls, and only it shows that the cards are still the rows of a table and that a tap
  on a card opens its run.

- SCN-CONSOLE-249, a gate rejected on a phone: only a browser lays out a run's stages as cards with the gate's forms
  inside the screen, and only it shows that the field "Reason" of the inline form takes the typed text and that a
  browser's form with the console's own `Origin` leads back to the run's page; the run page passes axe there.

- SCN-CONSOLE-257, submit work on a phone: the main flow of a person who brings work, and the only proof that a
  browser lays out the inbox's proposals and the work items as cards and the form's fields in one column inside the
  screen, that it sends the form "Submit work" with its `select` and the console's own `Origin`, and that both pages
  pass axe.

- SCN-CONSOLE-266, the health, the factory and the cost and scores on a phone: only a browser lays out their tables
  as cards (a check with its state above its name, an agent whose card opens its page, a count that names its column)
  and an agent's facts inside the screen, and only it shows that "Menu" leads to "Factory" and that the four pages
  pass axe.

- SCN-CONSOLE-279, the work list refreshes while a person types: only a browser runs the island, so it is the only
  proof that the list shows a new work item after `CONSOLE_REFRESH` seconds without a reload, that the typed title
  stays, and that the work page with its refresh on passes axe. It pauses the browser's clock and runs it 10 seconds
  on (Playwright's clock), after it typed, since Playwright's actions wait for animation frames.

The others start the console with `CONSOLE_REFRESH=0`: axe's rule `meta-refresh` (WCAG 2.2.1) flags the runs page's
reload, which stays until live updates replace it (`TODO.md`, T-60).

## Budget

- System tests: 210 seconds of wall time on the CI runner.
- Most of it: the journeys in Chromium with axe; a scenario with a console and fakes takes 0.3 to 0.8 s.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-CONSOLE-NNN`
