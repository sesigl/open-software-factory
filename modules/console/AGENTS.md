# AGENTS.md for module `console`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0072, ADR 0073.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `console <command>` (see `README.md#commands`)
- Web pages of `console serve` on `PORT`: `/`, `/runs/<runId>`, `/factory`, `/factory/agents/<name>`, `/inbox` and
  `/pico.css`
  (see `README.md#pages`). Read-only: any method but `GET` and `HEAD` answers 405.
- Outside systems it calls: the foremen's HTTP API at `CONSOLE_FOREMAN_URL`, intake's at `CONSOLE_INTAKE_URL` and
  gatekeeper's at `CONSOLE_GATEKEEPER_URL` (`contracts/openapi/openapi.json`), only with `GET`; the forge port's
  adapter in `CONSOLE_FORGE_ADAPTER`, only with its read-only command `prs` (ADR 0073)
- Input: the factory definition in `CONSOLE_FACTORY`
- Server state: none
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `pages` →
`adapters` → `domain`. `domain` holds the run states, the order of a merged run list, a run's age, the URL
templates and the inbox's states, without I/O; `adapters` call the APIs, run the forge adapter and read the factory
file; `pages` are Preact components written
with htm that render HTML and import only `domain` and the types of `adapters`; `commands` join them: `serve` runs the
Fastify server. The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner (35 scenarios; each starts one server, and the foremen, intake
  and gatekeeper are `fakes.http`; the inbox's forge is `fakes.github` behind the built forge-github adapter).

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-CONSOLE-NNN`
