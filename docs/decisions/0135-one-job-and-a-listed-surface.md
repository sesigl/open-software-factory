---
status: accepted; amended by 0159 (when a new package is right)
topic: packages
date: 2026-11-14
---

# 0135. Every published package has one job and a listed surface; `factory-source` in place of `factory-files`

## Context

The owner decided on 14 November 2026 that every package this repository publishes, module, adapter or library, has
a cohesive responsibility that is easy to understand, and a narrow API. Three things worked against it:

- A library's surface in its `AGENTS.md` could say "the exports of `src/index.ts`", so nothing kept the exports narrow.
  `@opensoftware/sandbox-egress` exports 20 values that way, and `cli`, `contracts` and `testkit` exported values that
  their surface did not name.
- A surface or a description could fall behind the code: the console's still said "read-only" and named `/pico.css`
  after it got its sign-in and forms.
- The library `@opensoftware/factory-files` that ADR 0134 and `TODO.md` plan was to fetch a factory, read its access
  file, edit `factory.yaml` (T-58) and check skills (T-59): "anything about a factory's files", a job that grows with
  every item.

## Decision

- **One job.** A published package says what it does in one sentence, its `package.json` description and the first
  sentence of its README. A sentence that needs "and" to join two jobs is a sign for two packages.
- **A listed surface.** The section "Public surface" of its `AGENTS.md` names every way in: commands, routes, events,
  files, and for a library every value its entry points export. Types describe the values and need no entry.
- **The check SURFACE** fails when an entry point of a package exports a value that the surface does not name, and
  when it uses `export *`, which hides what it adds. So the API grows only by a change to the list, which review sees.
- **`@opensoftware/factory-source` in place of `@opensoftware/factory-files`**, with one job: give a factory's folder,
  from a path or from `git+<url>#<ref>` with a token for a private repository (the foreman's fetch of ADR 0124).
  - The access file is a format of `contracts/` (ADR 0134): `validate("access", …)` checks it, and a reader keeps the
    small adapter it needs, as the console does.
  - Edits of `factory.yaml` (T-58) and the rules of skills (T-59) belong to `factory-spec`, which owns `factory.yaml`:
    commands of the `factory` CLI that the console runs as a separate process, as it runs a forge adapter (ADR 0073).
- **`sandbox-egress` gets narrower** in an item of its own (`TODO.md`): until then its surface lists its 20 values.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A listed surface and the check SURFACE (chosen) | Every new export is a visible line in review; cheap to run | Types stay unlisted |
| API Extractor reports (`.api.md`) | A full report with types; a known tool | A build step and a report per package; the values are what callers depend on |
| Only a rule in prose | Nothing to build | Drifts, as the console's surface did |
| Keep `factory-files` with four jobs | One package for the console | Grows with every item; its users need one job each |

## Prior art

- **API Extractor** (MIT, Microsoft, active): checked; its reports list the whole API with types. Kept as an option for
  when a library's types need review too.
- **`publint`** and **`are-the-types-wrong`** (MIT, active): check how a package exports, not what. Not needed here.

## Consequences

- A new export is a change to two files, the code and its `AGENTS.md`, and review sees both.
- T-56, T-58 and T-59 in `TODO.md` name `factory-source` and `factory-spec` in place of `factory-files`.
- Revisit when a library's types change callers as often as its values do: then API Extractor.
