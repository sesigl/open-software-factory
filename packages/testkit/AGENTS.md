# AGENTS.md for `packages/testkit`

Adds rules for the testkit. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use the testkit:

- Library: the exports of `src/index.ts` (`scenario` and its context, and `HARNESS_AGENT`, the file of the scripted
  harness agent for a sandbox), used by system tests; `@opensoftware/testkit/harness-agent` exports `HARNESS_AGENT`
  alone, for a process that must not load the rest
- Library: `@opensoftware/testkit/readme` (`src/support/readme.ts`: `documentedEnv`, `readmeSection`, `isDocumented`), used by
  the checks that read a module's README without running a test (ADR 0042)
- CLI: `testkit <command>` (`bin/testkit.ts`, see `README.md#commands`), run in a module folder

The testkit's own system tests use the CLI on small modules they write into `$INPUT`, and call
`@opensoftware/testkit/readme` directly.

The testkit depends on no library in `packages/`: every library is tested with the testkit, so such a dependency
would be a cycle.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| cli | `bin/` | `testkit run` |
| api | `src/index.ts` | the public exports |
| scenario | `src/scenario.ts` | `scenario(id, fn)`, the steps and the context |
| sut | `src/sut/` | the handle on the module under test |
| fakes | `src/fakes/` | the systems a test controls instead of real ones |
| support | `src/support/` | reading a module's files, running processes |

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 480 seconds in total on the CI runner (409 seconds on CI with SCN-TK-109 to -112, ADR 0070; 446.6
  seconds with SCN-TK-121 and -122, ADR 0078). Most scenarios run `testkit run` on a demo module, which starts a
  nested vitest: about 2.5 seconds each, of which recording coverage for REACH is 0.3. With 79 scenarios the total
  passed 240 seconds on main. SCN-TK-080 to -082 each start a Forgejo and take about 20 seconds. `sut.pages` and `sut.browser` load happy-dom, Testing Library and
  Playwright at their first use: imported with the testkit, they cost every test process about 0.4 seconds (ADR 0131).
  testcontainers, the MCP client and the ACP client load at their first use too: the testkit's import went from about
  500 to about 145 milliseconds, and a demo module's scenario from about 2.5 to about 1.5 seconds. SCN-TK-182 to -184
  (fakes.personIssuer and fakes.personProof, ADR 0151) are demo modules too: about 1.4 seconds each, 4.2 together,
  measured on the development container; jose loads with the first issuer, not with the testkit.

## Quality limits

Checked by DUP (ADR 0037):

- Duplication: at most 3% of the source lines.

## Scenario prefix

`SCN-TK-NNN`
