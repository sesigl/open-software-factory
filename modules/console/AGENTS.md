# AGENTS.md for module `console`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0072, ADR 0073, ADR 0115, ADR 0120, ADR 0130, ADR 0132, ADR 0141, ADR 0144.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `console <command>` (see `README.md#commands`)
- Web pages of `console serve` on `PORT` (see `README.md#pages`): `/`, `/runs/<runId>`, `/work`, `/factory`,
  `/factory/agents/<name>`, `/inbox`, `/improvement`, `/health`, `/secrets` and `/secrets/delete` (ADR 0137), `/skills` and `/skills/<name>` (ADR 0141), `/changes` (ADR 0144); the sign-in `/signin`, `/signin/start`,
  `/signin/callback` and `POST /signout` (ADR 0134); `/theme` (ADR 0133); the probe `/v1/ready`; and the files
  `/pico.css`, `/_astro/<file>` and `/favicon.svg`. Any other method but `GET` and `HEAD` answers 405, except the forms
  `POST /work`, `POST /runs/<runId>/retry`, `POST /runs/<runId>/signals` and `POST /runs/<runId>/gates/<gateId>` with
  `CONSOLE_USER_HEADER` or `CONSOLE_SIGN_IN` (ADR 0089, ADR 0105, ADR 0118, ADR 0134), and `POST /secrets` and
  `POST /secrets/delete`, which answer 404 without roles or a store and 403 to anyone but an admin (ADR 0137), and
  `POST /changes`, `POST /changes/<number>/retry`, `POST /changes/<number>/discard` and `POST /changes/<number>/merge`,
  which answer 404 without `CONSOLE_FACTORY_REPOSITORY` or roles and 403 to anyone but an admin or a factory engineer
  (ADR 0144).
- Outside systems it calls: the foremen's HTTP API at `CONSOLE_FOREMAN_URL`, intake's at `CONSOLE_INTAKE_URL` and
  gatekeeper's at `CONSOLE_GATEKEEPER_URL` (`contracts/openapi/openapi.json`), only with `GET`, and with `POST` for the actions (intake's
  `/v1/work-items`, the foreman's `/v1/runs/<runId>/retry` and `/v1/runs/<runId>/signals`, gatekeeper's
  `/v1/gates/<gateId>/decisions`); the forge port's
  adapter in `CONSOLE_FORGE_ADAPTER`, only with its read-only command `prs` (ADR 0073); with `console doctor --deep`
  only, the model gateway at `CONSOLE_MODEL_URL` (one `POST /chat/completions` per route) and the harness started by
  `CONSOLE_HARNESS_COMMAND` (ACP `initialize`, ADR 0120), the trace store, and the sandbox adapter in
  `CONSOLE_SANDBOX_COMMAND`, only with its command `probe` (ADR 0120); the secrets port's adapter in
  `CONSOLE_SECRETS_ADAPTER` with `list`, `put` and `delete` for `/secrets`, with `list` for `/skills` and
  `/skills/<name>`, and with `probe` and `list` for `console doctor` and `/health`, with `OSF_OPENBAO_ADDR`, `OSF_OPENBAO_TOKEN` and `OSF_OPENBAO_MOUNT` (ADR 0137); a value goes
  only to the standard input of `put`; factory-spec's `factory` in `CONSOLE_FACTORY_COMMAND`, only with
  `skills --file <CONSOLE_FACTORY>`, which prints the `skill-catalog` contract (ADR 0141, ADR 0143), and
  `edit --file <the fetched factory.yaml>` for a change; with `CONSOLE_FACTORY_REPOSITORY`, the forge adapter with
  `CONSOLE_FACTORY_TOKEN` for `rules`, `branch`, `commit`, `open-pr`, `merge`, `prs`, `pr` and `close` on that
  repository, and Git, which fetches it into `CONSOLE_FACTORY_CACHE` through `@opensoftware/factory-source` (ADR 0144)
- Input: the factory definition in `CONSOLE_FACTORY` and the access file in `CONSOLE_ACCESS`
- With `CONSOLE_SIGN_IN`: the identity provider at `CONSOLE_OIDC_ISSUER`, or GitHub at `CONSOLE_GITHUB_URL` and
  `CONSOLE_GITHUB_API_URL`
- Server state: none; with `CONSOLE_FACTORY_REPOSITORY` a cache of the factory's repository, which it fetches again
  at each change
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `templates`
(`src/web/`) → `pages` → `adapters` → `domain`. A page that has moved to Astro (ADR 0132) is a template in
`src/web/pages/<path>.astro`: its route in `serve` loads the data, a function of `pages` computes every value it shows,
and `adapters/web.ts` hands them to Astro as `locals.page` with the status. A template holds no logic (TEMPLATE); the
health page is the first. Every answer has a Content-Security-Policy without script. The design system `@opensoftware/ui` is a `devDependency`: Astro compiles its components, styles and faces
into `dist/web/` and copies its brand files beside them (`publicDir`), and the console serves them at `/_astro/` and
`/favicon.svg` from its own origin. So no built file may resolve `@opensoftware/ui`: the published console does not have it. Islands: none yet; each island
a page uses is listed here with the reason why a page load is not enough (T-55). `domain` holds the run states, the order of a merged run list, a run's age, the URL
templates, the inbox's states, the states of the secrets, what a skill needs and the safe HTML of a skill's Markdown
(markdown-it, ADR 0141), and a change's edit, branch, title, body and state (ADR 0144), without I/O; `adapters` call
the APIs, run the forge and the secrets adapters and `factory`, fetch the factory's repository, and read the factory
file; `pages` are Preact components written
with htm that render HTML and import only `domain` and the types of `adapters`; `commands` join them: `serve` runs the
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

They start the console with `CONSOLE_REFRESH=0`: axe's rule `meta-refresh` (WCAG 2.2.1) flags the runs page's reload,
which stays until live updates replace it (`TODO.md`, T-60).

## Budget

- System tests: 260 seconds in total on the CI runner (174 scenarios). Raised from 120 seconds on 15 November 2026
  with the changes of the factory (T-58, ADR 0144): their 20 scenarios run against Forgejo (`fakes.forge`), which the
  console fetches with Git, as the TODO asks, since `fakes.github` holds no Git repository.
  - Measured on the development container: the 154 scenarios before took 76.5 seconds, the 20 of a change about 86,
    4.3 each. At the ratio of the last CI measure (110.1 seconds for those 154), the suite is about 235 seconds on a
    runner at reference speed; the budget follows the first CI measure of this suite once it is in.
  - Where the time of a change goes: Forgejo starts once per worker, 5 to 7 seconds in the first such scenario of the
    worker; a change is one fetch, one run of `factory edit` and about ten runs of the forge adapter, each a start of
    Node; the scenario of a conflict takes about 18 seconds, 10 of them in forge-forgejo's `pr`. Forgejo finds
    the conflict in under a second, but its API reads "not mergeable" both for a conflict and while it still checks,
    so `pr` waits 10 seconds for every pull request that is not mergeable (the adapter's README, "Merge state").
    Probed on Forgejo 11 on 15 November 2026: no field of the pull request and no answer of a merge tells the two
    apart, and the API refuses to set a pull request's update time, so a rule by the pull request's age has no fast
    system test. Open: a faster answer for a conflict.
  - Made faster first: the scenarios start Forgejo once per worker and not per scenario, wait on the forge and not
    on a reload of the page, and the scenarios of a refused form use no forge at all.
- Before that: 120 seconds for 154 scenarios. Raised from 95 seconds on 15 November 2026
  with the skills pages, measured in CI on a runner whose benchmark took exactly the reference time: 110.1 seconds, of
  which the 121 scenarios before the secrets page took 75.7 (0.63 each), the 18 of the secrets 20.2 (1.12 each) and
  the 15 of the skills 14.2 (0.95 each).
  - The 95 seconds came from one run on a fast runner (62.7 seconds at 0.748 times the reference, so 83.8 at BUDGET's
    measure, for 141 scenarios). BUDGET's measure follows a CPU benchmark of one process; this suite starts a console
    and often an adapter per scenario on four workers, and a slower runner slows that more than the benchmark says.
    So a budget of this suite follows the highest measure, with about 9% above it, like `deploy/`.
  - Made faster first: a console now starts without the Markdown library and without the health checks and the
    contracts they validate against; each loads with its first page. The imports of `serve` went from about 92 ms to
    about 70 ms on the development container, about 20 ms per scenario.
  - A scenario of the secrets takes about twice the time of another one: the console runs the built adapter
    `secrets-openbao` as a program against the testkit's real OpenBao. Each page of `/secrets` is one start of the
    adapter and a stored value two; Node's compile cache is already on (the testkit sets it). OpenBao starts once per
    worker, not per scenario, and `console doctor` already runs `probe` and `list` at the same time.
- Before that: 75 seconds for 117 scenarios (48 to 52 seconds of test time and 17 seconds on 4 workers on the
  development container; 65.7 seconds on the reference runner in CI). Raised from 60 seconds on 14 November 2026, when
  the scenarios grew from 88 to 117 with the sign-in, the shell and two journeys, measured:
  - each scenario starts its own console: about 200 ms to listen (Node, then 90 ms of imports for `serve`; `cli.ts`
    loads only the command it runs, which saved about 20 ms per scenario), and the foremen, intake and gatekeeper are
    `fakes.http`; the inbox's forge is `fakes.github` behind the built forge-github adapter;
  - the first page costs about 110 ms more than the next for Astro's handler; loading it while the server starts made
    the suite slower, since it competes with the start for the CPU;
  - a sign-in scenario walks four pages and the provider (0.6 to 1 s); the three that restart the console about 1.3 to
    1.9 s; each journey about 2 s, half of it Chromium's start;
  - per scenario the suite got cheaper: 0.53 s in 2026-11 before, 0.43 s now.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-CONSOLE-NNN`
