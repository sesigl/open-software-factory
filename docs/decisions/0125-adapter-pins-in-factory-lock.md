---
status: accepted
date: 2026-11-14
---

# 0125. Adapter pins in factory.lock: `factory plan --adapters` writes them, the foreman runs them

## Context

ADR 0110 made an adapter that the foreman's maps do not name run `npx -y @opensoftware/<port>-<name>@<range>`, the
range under `providers`. A range still moves: two runs of one factory commit can run two versions, and the run's view
shows a range, not what ran. ADR 0110 left the pin open until `factory plan` pins adapters in `factory.lock` and the
lock is a contract both modules read (`TODO.md` T-43). `factory plan` already pins registry MCP servers in
`factory.lock` (ADR 0020); the lock had no schema in `contracts/`.

## Decision

- **A contract.** `contracts/factory-lock/factory-lock.schema.json` (TypeSpec `FactoryLock`) describes the lock as
  factory-spec writes it: `version: 1`, `mcp` as before, and the new optional `adapters.<port>.<name>` with
  `{ range, version }`. A new format and an optional field: additive (CONTRACT).
- **Who pins.** `factory plan --adapters` resolves each adapter under `providers.harness`, `sandbox`, `forge` and
  `inference` to the newest version of `@opensoftware/<port>-<name>` inside its range, from the npm registry's
  packument at `FACTORY_NPM_REGISTRY` (default `https://registry.npmjs.org`), and writes it with the range it came
  from. A pin whose range is unchanged is kept without asking the registry; a changed range is pinned again; an
  adapter no longer declared is dropped. `factory plan` without the flag keeps the lock's adapter pins as they are.
- **Opt in.** Pinning is a flag, not the default: every plan of a factory with `providers` would else need the npm
  registry, also for a person who only wants the diff, and offline plans would fail.
- **Who reads.** The foreman reads `adapters` of `factory.lock` next to `factory.yaml`. An adapter whose pin's range
  equals the declared range runs at the pinned version, `npx -y @opensoftware/<port>-<name>@<version>`, and the run's
  view names that version; a pin of another range is stale and the range runs, as in ADR 0110.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `plan --adapters`, pin with its range (chosen) | Plans stay offline by default; a stale pin is never run | One more flag to know |
| Pin on every `plan` | No flag | Every plan needs the npm registry, every existing plan test a fake |
| Pin at the foreman's run start | No lock change | Registry at every start; ADR 0110 rejected it |
| Key pins by `<name>@<range>` like MCP references | Same shape as `mcp` | Port and name are what the foreman looks up; the range as a field is simpler to compare |

## Prior art

No new module, dependency or service. The npm registry's packument (`GET /<name>`, `versions`) is the API that npm
itself reads; `semver`'s `maxSatisfying` already picks MCP versions in factory-spec. Lock files with the range next to
the resolved version follow `package-lock.json` and `Cargo.lock`, which keep a resolution while the manifest's range
still holds.

## Consequences

- A factory's runs repeat the same adapter versions once its `factory.lock` is committed; the view shows them.
- Raising a range without `plan --adapters` falls back to the range until the next pin.
- `factory.lock` is not among the files the foreman's clean check names when Git does not track it (ADR 0110); a
  tracked, changed lock counts. Revisit if an untracked lock should stop a run.
