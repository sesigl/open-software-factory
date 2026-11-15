# AGENTS.md for `packages/person-proof`

Adds rules for the person-proof library. The root `AGENTS.md` applies in full. Decision: ADR 0151.

## Public surface

The only way a system test or another program may use the library:

- Library, imported as `@opensoftware/person-proof`: `personSigner`, `personChecker`, `SettingError` and
  `PERSON_HEADER`, and their types.

The library's system tests import it by its package name and call it in their own process (ADR 0039). An issuer's
key set is `fakes.personIssuer` of the testkit, which also signs the proofs that a checker must refuse, or a signer's
`keys` served by `fakes.http`. The clock is the `now` option, never the system's clock.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014). A file imports only its own layer and the layers below it.

| Layer | Paths | Holds |
| --- | --- | --- |
| api | `src/index.ts` | the public exports |
| proof | `src/signer.ts`, `src/checker.ts` | the issuer's side: the key set and a proof for a call; a module's side: a request's proof checked against the issuers' key sets |
| keys | `src/keys.ts` | the settings: the seeds of the signing keys, the issuers' key sets, the digest of a body |

The library proves a person. Which routes need a proof, what a module logs and answers, and which setting holds the
keys stay with its caller.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 15 seconds in total on the CI runner. The 16 scenarios take about 1 second locally: each starts
  fakes in the test process, and none starts a process.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-PPROOF-NNN`
