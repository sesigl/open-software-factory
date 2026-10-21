---
status: accepted
date: 2026-10-21
---

# 0040. The library @opensoftware/cli runs the commands of every module

## Context

Every module is a command-line program. ledger, scorekit, proof and runlog each wrote the same code around their
commands: print the usage for `--help` or a missing command, run the command, print its lines, write each error
as `<module>: <message>`, exit 2 for a usage error and 1 for any other failure. ledger and scorekit also shared
reading the files and folders named on the command line, writing a file into its folder and the default output
path in `$OUTPUT`. proof and runlog read their version from `package.json` the same way. DUP listed four of these
copies in its baseline (ADR 0037).

## Decision

- **New library `packages/cli`**, published as `@opensoftware/cli` (prefix `SCN-CLI`, layout of ADR 0039). Layers:
  `api` (`src/index.ts`) → `program` → `files` → `errors`.
- **`runProgram({ name, usage, command, help }, io?)`** runs the chosen command and returns the exit code. A command
  gives `{ lines, errors, exitCode }`. Lines go to standard output, each error to standard error after the program's
  name. The exit code is `exitCode`, else 1 with errors, else 0. A thrown `UsageError` exits 2, any other error 1.
  `--help` prints the usage to standard output and exits 0; no command prints it to standard error and exits 2.
  The module still parses its own arguments with `node:util` `parseArgs`, so each module keeps typed options.
- **`UsageError` and `check(condition, message)`** replace the error classes of ledger, scorekit and runlog.
- **Files:** `readInputs(paths, pattern)` reads each file named and each matching file below each folder named,
  sorted by path; a missing path is a usage error. `writeText(path, text)` creates the folder.
  `outputPath(file, out?)` is `--out`, else the file in `$OUTPUT`, else in the current folder.
  `packageVersion(url)` reads a `package.json`.
- ledger, scorekit, proof and runlog use the library. Their behavior does not change: their scenarios pass
  unchanged. spec-trace and factory-spec keep their own entry code for now: spec-trace exits 2 on every error,
  factory-spec prints errors without its name.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A small library around `node:util` `parseArgs` | No dependency; the modules' help texts and exit codes stay as their scenarios fix them | We maintain about 80 lines |
| Adopt commander, yargs or cac for parsing and help | Generated help, subcommands, validation | Each generates its own help text and exit codes, which changes the output of implemented scenarios in four modules |
| Adopt citty | Small, typed subcommands | Same change of output; version 0.2 |
| Keep the copies | No change | DUP forbids new clones; every new module copies them again |

## Prior art

- commander (15.0.0, MIT, released September 2026, very active): not adopted; its help and error output would
  replace the modules' usage texts and exit codes.
- yargs (18.2.0, MIT, active) and cac (7.1.0, MIT, active): same reason.
- citty (0.2.2, MIT, unjs, active): same reason, and still before 1.0.
- clipanion (4.0.0-rc.4, MIT, last release 2024): not maintained enough.
- `node:util` `parseArgs` (Node.js built-in): kept; the modules already use it.
- tinyglobby (0.2.17, MIT) for `readInputs`: not adopted; a sorted walk of a folder is eight lines with `node:fs`.

## Consequences

- A new module gets help, errors and exit codes by handing its command to `runProgram`.
- A module's tests prove its CLI behavior as before; the library's scenarios prove the shared rules once.
- Changing an exit-code rule in the library changes four modules at once; the library's scenarios and theirs both
  run on such a change.
- Revisit when a module needs subcommands with their own options or generated help.
