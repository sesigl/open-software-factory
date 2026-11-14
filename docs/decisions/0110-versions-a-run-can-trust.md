---
status: accepted
date: 2026-11-13
---

# 0110. Versions a run can trust: a clean factory, adapters at the factory's range, command lines as lists

## Context

A run names its factory version, the commit of `HEAD` of the factory's folder (ADR 0067). The foreman reads
`factory.yaml` and the prompts from the folder, not from the commit, so a run whose folder has changes that are not
committed runs files that its version does not hold (`TODO.md` T-43).

An adapter that `FOREMAN_HARNESSES`, `FOREMAN_SANDBOXES`, `FOREMAN_FORGES` or `FOREMAN_INFERENCES` does not name runs
`npx -y @opensoftware/<port>-<name>`: the newest version on the registry, whatever range the factory declares under
`providers`. And each map entry is split at every space, so a program in a folder whose path holds a space cannot be
named.

Who serves a factory today:

- The foreman's system tests commit the README's factory into `$INPUT`, the Git repository of the testkit, with
  `sut.git.commit`, which adds every file. Some write helper scripts into `$INPUT` after that commit (`lingers.sh`,
  `forge.sh`); they are untracked and the factory does not read them. SCN-FORE-082 removes `factory.yaml` while the
  server runs and puts the same text back. The scenarios of an invalid factory write `factory.yaml` without a commit
  and stop at the definition's problem first.
- The Compose profile (`deploy/compose/compose.yaml`, service `factory`) and the Helm chart (the `factory` init
  container) copy the factory into a repository of their own and commit every file with `git add -A`; the dogfood
  setup and the e2e scenarios use the Compose service. Their folder is a clean checkout.
- A folder outside any Git repository already stops the server (SCN-FORE-026): no caller serves one.

## Decision

- **A clean folder.** `foreman serve` at the start, and every run's start and retry, read the factory through one
  function that also asks Git for the changes in the factory's folder: every tracked file of the folder that differs
  from `HEAD` (staged or not, deleted too), and every file the foreman reads, `factory.yaml`, the prompts and the
  inference config, that Git does not track. Untracked files the foreman does not read, such as a helper script, and
  ignored files do not count. A folder with changes is a usage error:
  `factory.yaml: commit the changed files <path>, <path>; a run's factory version is its commit`, with the paths
  relative to the factory's folder and sorted. `foreman serve` exits with code 2; `POST /v1/runs` and a retry answer
  400 with that text as the detail. A folder outside Git keeps its error of SCN-FORE-026: the deploys need no
  "no commit" version, and a run without a version is what this ADR removes.
- **Which version the fallback runs.** An adapter that its map does not name runs
  `npx -y @opensoftware/<port>-<name>@<version>` (with `run` after it for a harness). `<version>` is the exact version
  that `factory plan` pinned for that adapter in `factory.lock` when the lock has one, else the range under
  `providers.<port>.<name>`. An adapter the factory does not declare under `providers` (the `FOREMAN_SANDBOX` default)
  runs without a version, as before. This change reads the range; reading a pin waits until `factory plan` pins
  adapters and `factory.lock` is a contract both modules read (`TODO.md` T-43 keeps that slice open).
- **Command lines as lists.** A map entry is a JSON list of strings, the program and its arguments, taken as they are;
  a string keeps working and is split at each space, as before.
- **The run's view names the versions.** `RunView` gets the optional field `adapters`, a list of
  `{ port, name, version?, command?, configured? }` for every adapter under the factory's `providers`, in the order
  harness, sandbox, forge, inference: for a fallback the range as `version` and the command line the foreman builds as
  `command`; for an adapter a map names, the map's variable as `configured` and no command, since an operator's
  command line may hold a path or an argument that the view should not show. The field is optional, so the contract
  change is additive (CONTRACT); a run that started before keeps a view without it.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Clean check of tracked and read files (chosen) | Catches every change that a run would run; helper files and the data folder do not count | One more Git call per run start |
| `git status --porcelain` of the whole folder | Simplest | Every untracked file stops the server: a test's helper script, a log |
| Read the factory from the commit (`git show HEAD:…`) | No refusal needed | The prompts' relative paths and the inference config would also need reading from Git; a change that is not committed silently does nothing |
| A version "no commit" for a folder outside Git | Serves a plain folder | No deploy needs it; a run's version would name nothing |
| Pin the newest matching version at the run's start | Exact versions without the lock | Needs the registry at every start; two runs of one commit could run different versions |
| Shell-like quoting of the string | One format | A parser to own; a JSON list is already the format of the maps' values |

## Prior art

No new module, dependency or service. `npx` takes a package spec with a semver range (`pkg@^0`) as npm documents
for `npm install <name>@<range>`. Docker Compose, Kubernetes and GitHub Actions take a command as a list of
arguments next to a string, the form adopted here.

## Consequences

- A person who edits a prompt in place must commit it before a run starts; the error names the files.
- A deploy that copies a factory without committing it now stops; the Compose profile and the chart already commit.
- An adapter's version moves inside the factory's range only; the view shows the range each run asked for.
- Revisit when `factory.lock` pins adapters: the fallback then takes the pin, and the view the exact version. Done by
  ADR 0125.
