# AGENTS.md for `packages/harness-proxy`

Adds rules for the harness-proxy library. The root `AGENTS.md` applies in full. Decisions: ADR 0039, ADR 0050,
ADR 0051.

## Public surface

The only way a system test or another program may use the library:

- Library: the exports of `src/index.ts` (`serveProxy`, `allowlistOf`, `exportTranscript`), imported as
  `@opensoftware/harness-proxy`

The library's system tests import it by its package name and call it in their own process (ADR 0039): `sut.acp.serve`
connects a client to `serveProxy`, and the testkit's scripted harness is the agent behind it. Files go through
`sut.files`; `sut.files.path` gives their absolute path.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| api | `src/index.ts` | the public exports |
| adapters | `src/proxy.ts`, `src/transcript.ts`, `src/store.ts` | the ACP connections, the agent process, the session files |
| domain | `src/domain/` | the allowlist, the shape of the session record, the run record; no I/O |

Only code that two or more harness adapters need belongs here. What one product needs stays in its adapter.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 30 seconds in total on the CI runner. SCN-HPROXY-005 waits the 3 seconds of the cancel deadline.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-HPROXY-NNN`
