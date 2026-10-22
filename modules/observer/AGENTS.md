# AGENTS.md for module `observer`

Adds rules for this module. The root `AGENTS.md` applies in full. Decision: ADR 0046.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `observer <command>` (see `README.md#commands`)
- Input: `score` records (`.jsonl`) and run records below the paths named on the command line; `problems.json` for
  `propose`; a repository on GitHub or Forgejo, cloned with Git and reached through the forge API; the model gateway at
  `OBSERVER_INFERENCE_URL`
- Output: `$OUTPUT/problems.json`, `$OUTPUT/proposal.json` and `$OUTPUT/check.json` (or `--out`), the Markdown of
  `--markdown`; a branch `observer/*` and a pull request on the forge; a comment on a pull request with `--comment`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` groups scores into problems, writes the prompt, reads the model's answer, applies its edits,
writes the pull request text, parses forge URLs and computes the before-and-after verdict, without I/O; `adapters`
read and write files, run Git, and call the model gateway and the forge API; `commands` join them. The ARCH check
enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 90 seconds in total on the CI runner. SCN-OBS-013 to -016 and -029 need Docker (Forgejo, about 10
  seconds each); the others read files, a scripted model gateway and a scripted forge API.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-OBS-NNN`
