# AGENTS.md for module `console`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0072, ADR 0073, ADR 0115, ADR 0120, ADR 0130, ADR 0132, ADR 0141.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `console <command>` (see `README.md#commands`)
- Web pages of `console serve` on `PORT` (see `README.md#pages`): `/`, `/runs/<runId>`, `/work`, `/factory`,
  `/factory/agents/<name>`, `/inbox`, `/improvement`, `/health`, `/secrets` and `/secrets/delete` (ADR 0137), `/skills` and `/skills/<name>` (ADR 0141); the sign-in `/signin`, `/signin/start`,
  `/signin/callback` and `POST /signout` (ADR 0134); `/theme` (ADR 0133); the probe `/v1/ready`; and the files
  `/pico.css`, `/_astro/<file>` and `/favicon.svg`. Any other method but `GET` and `HEAD` answers 405, except the forms
  `POST /work`, `POST /runs/<runId>/retry`, `POST /runs/<runId>/signals` and `POST /runs/<runId>/gates/<gateId>` with
  `CONSOLE_USER_HEADER` or `CONSOLE_SIGN_IN` (ADR 0089, ADR 0105, ADR 0118, ADR 0134), and `POST /secrets` and
  `POST /secrets/delete`, which answer 404 without roles or a store and 403 to anyone but an admin (ADR 0137).
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
  `skills --file <CONSOLE_FACTORY>` (ADR 0141)
- Input: the factory definition in `CONSOLE_FACTORY` and the access file in `CONSOLE_ACCESS`
- With `CONSOLE_SIGN_IN`: the identity provider at `CONSOLE_OIDC_ISSUER`, or GitHub at `CONSOLE_GITHUB_URL` and
  `CONSOLE_GITHUB_API_URL`
- Server state: none
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
(markdown-it, ADR 0141), without I/O; `adapters` call the APIs, run the forge and the secrets adapters and
`factory`, and read the factory file; `pages` are Preact components written
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

Both start the console with `CONSOLE_REFRESH=0`: axe's rule `meta-refresh` (WCAG 2.2.1) flags the runs page's reload,
which stays until live updates replace it (`TODO.md`, T-60).

## Budget

- System tests: 95 seconds in total on the CI runner (140 scenarios; 83.8 seconds on the reference runner in CI).
  Raised from 75 seconds on 15 November 2026, when the scenarios grew from 123 to 140 with the secrets page, measured:
  - a scenario of the secrets takes about twice the time of another one: the console runs the built adapter
    `secrets-openbao` as a program against the testkit's real OpenBao. Each page of `/secrets` is one start of the
    adapter and a stored value two; a start takes about 0.15 s on the busy development container, 0.06 s of it Node's
    own, with Node's compile cache already on (the testkit sets it);
  - OpenBao starts once per worker (0.45 s), not per scenario, and `console doctor` already runs `probe` and `list`
    at the same time, so neither is left to save;
  - at the time of an older scenario each, the 17 new ones would still bring the suite to about 76 seconds.
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
