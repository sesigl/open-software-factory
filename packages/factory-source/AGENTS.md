# AGENTS.md for `packages/factory-source`

Adds rules for the factory-source library. The root `AGENTS.md` applies in full. Decisions: ADR 0124, ADR 0135,
ADR 0142, ADR 0146.

## Public surface

The only way a system test or another program may use the library:

- Library, imported as `@opensoftware/factory-source`: `factorySource`, `pinnedFolder` and `FetchError`, and their types.

The library's system tests import it by its package name and call it in their own process (ADR 0039). Files go
through `sut.files`; `sut.files.path` gives their absolute path. A remote is `$INPUT` at a `file://` URL (`sut.git` commits and
tags it); a private remote over HTTP is `fakes.http` answering Git's first request with 401, whose headers show the
credentials Git sent.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| api | `src/index.ts` | the public exports |
| source | `src/source.ts`, `src/pinned.ts` | the setting: a path or `git+<url>#<ref>`, and one fetch at a time; a folder at `git+<url>#<ref>:<path>`, its pin and its hash |
| git | `src/git.ts` | the Git CLI: the bare repository, the folder per commit, the token in Git's environment |

The library gives a folder. What the files in it mean, and whether a local folder must be clean (ADR 0110), stays
with its caller.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 45 seconds of wall time on the CI runner.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-FSOURCE-NNN`
