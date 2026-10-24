# AGENTS.md for `packages/channel-kit`

Adds rules for the channel-kit library. The root `AGENTS.md` applies in full. Decisions: ADR 0039, ADR 0059.

## Public surface

The only way a system test or another program may use the library:

- Library: the exports of `src/index.ts` (`runChannel` and the types `Channel`, `Delivery`, `Keep`, `Line`, `Post`,
  `Webhook`), imported as `@opensoftware/channel-kit`

The library's system tests import it by its package name and call it in their own process (ADR 0039), with a channel
"demo" whose webhook and post the test chooses. Files go through `sut.files`; `sut.files.path` gives their absolute
path.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| api | `src/index.ts` | the public exports |
| program | `src/program.ts` | `runChannel`: the usage, the arguments and the exit code |
| commands | `src/commands.ts` | receive around the chat's webhook, reply and ask around its post |

Only code that two or more channel adapters need belongs here. What one chat needs stays in its adapter. The library
does not depend on Vercel Chat SDK: an adapter hands it the SDK's webhook and posts with the SDK itself.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 30 seconds in total on the CI runner.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-CKIT-NNN`
