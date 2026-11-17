# AGENTS.md for `packages/testkit`

Adds rules for the testkit. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use the testkit:

- Library: the exports of `src/index.ts` (`scenario` and its context, and `HARNESS_AGENT`, the file of the scripted
  harness agent for a sandbox), used by system tests; `@opensoftware/testkit/harness-agent` exports `HARNESS_AGENT`
  alone, for a process that must not load the rest
- Library: `@opensoftware/testkit/readme` (`src/support/readme.ts`: `documentedEnv`, `readmeSection`, `isDocumented`), used by
  the checks that read a module's README without running a test (ADR 0042)
- Library: `@opensoftware/testkit/global-setup` (`src/sut/global-setup.ts`: `setup`), the global setup of a vitest
  config that runs the shared starts of `sut.shared` once per test run (ADR 0162); `testkit run` uses it
- CLI: `testkit <command>` (`bin/testkit.ts`, see `README.md#commands`), run in a module folder

The testkit's own system tests use the CLI on small modules they write into `$INPUT`, and call
`@opensoftware/testkit/readme` directly. A fake's scenarios call the fake in the test's process, as a library's
tests do (ADR 0039, T-85): today those of `fakes.forge`, `fakes.github`, `fakes.modelGateway`, `fakes.http`,
`fakes.slack`, `fakes.oidc`, `fakes.personIssuer`, `fakes.traceStore` and `fakes.sentry`, with the clients of
`system-tests/forge.ts`, `github.ts`, `model.ts`, `slack.ts`, `oidc.ts` and `person-issuer.ts`; `fakes.http` stands
in for a module's webhook. The scenarios of the scenario runner itself keep the nested run, and so do those of a fake
that need it: across two scenarios (SCN-TK-101), a call that fails the nested test (SCN-TK-007, -028, -055, -089,
-172), a call from a container the module starts (SCN-TK-078, -116, -120), and a fake that is a program the module
starts or that needs a socket client (`fakes.harness`, `fakes.inference`, `fakes.sandbox`, `fakes.nats`): a system
test starts no process and imports no Node built-in.

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

- System tests: 200 seconds of wall time on the CI runner.
- Most of it: the nested vitest of `testkit run` on a demo module, about 1.3 s each, and a Forgejo per worker for
  the `fakes.forge` scenarios.

## Quality limits

Checked by DUP (ADR 0037):

- Duplication: at most 3% of the source lines.

## Scenario prefix

`SCN-TK-NNN`
