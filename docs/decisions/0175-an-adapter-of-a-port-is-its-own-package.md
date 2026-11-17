---
status: accepted
topic: packages
date: 2026-11-17
---

# 0175. An adapter of a port is its own package

## Context

ADR 0159 set a bar for a new package and planned two merges of small packages: `TODO.md` T-89 (one package
`@opensoftware/harness` for the adapters `acp`, `claude-code`, `codex` and `opencode` and the library `harness-proxy`)
and T-90 (one channel package, and `postgres` in a shared library). Its point 4 said that an adapter may be smaller
than a library, "then prefer one package per port family with one command per product". Before any code moved, the
merge of the harness adapters was looked at in the code, on 17 November 2026:

- **A product adapter carries its product's exact pin** (ADR 0052, ADR 0053). `adapters/harness/claude-code/package.json`
  depends on `@agentclientprotocol/claude-agent-acp` `0.94.0`, `adapters/harness/codex/package.json` on
  `@agentclientprotocol/codex-acp` `2.2.2`, `adapters/harness/opencode/package.json` on `opencode-ai` `1.19.4`;
  `adapters/harness/acp/package.json` depends only on `@opensoftware/cli` and `@opensoftware/harness-proxy`. Measured
  with `npm view <package> dist.unpackedSize` for the pinned package and its linux-x64 binary (npm installs one
  platform's optional dependency): the Claude agent about 292 MB (`claude-agent-acp` 2.0 MB,
  `@anthropic-ai/claude-agent-sdk` 0.3.303 4.7 MB, `claude-agent-sdk-linux-x64` 285.8 MB), Codex about 449 MB
  (`codex-acp` 1.7 MB, `@openai/codex` 0.160.1-linux-x64 446.8 MB), opencode about 215 MB (`opencode-linux-x64`
  214.5 MB). One package would install about 950 MB on Linux, also for a user of the core adapter `acp`. Optional
  peers instead would give up the exact pins that DEPS enforces.
- **The name `@opensoftware/<port>-<name>` is behavior.** foreman's fallback runs
  `npx -y @opensoftware/${port}-${name}@<range>`, with `run` after it for a harness, for every adapter that
  `FOREMAN_HARNESSES` (or the map of its port) does not name (`fallbackOf` in `modules/foreman/src/domain/adapters.ts`,
  ADR 0110, SCN-FORE-136). `factory plan --adapters` pins `providers.<port>.<name>` to the newest npm version of
  `@opensoftware/${port}-${name}` in its range (`modules/factory-spec/src/commands/plan.ts`, SCN-FSPEC-066 to 069).
- **The tooling finds an adapter at `adapters/<port>/<adapter>/`.** spec-trace reads `"conformance": { "tag":
  "@conformance", "ports": "ports/{port}/features", "adapters": "adapters/{port}/{adapter}" }` from `spec-trace.json`
  and asks each such folder for exactly one test per `@conformance` scenario of its port (`adaptersOf` in
  `modules/spec-trace/src/domain/rules.ts`). The testkit starts the first `bin` of the unit's `package.json` and finds
  the port's scenarios from the path `adapters/<port>/<adapter>` (`packages/testkit/src/support/module.ts`). The
  checks' unit globs list `adapters/*/*/package.json` (`tools/checks/lib/cruise.ts`, `tools/checks/quality.ts`,
  `tools/checks/surface.ts`, `tools/checks/docs.ts`, `tools/checks/boundary.ts`).

One harness package would therefore need new behavior in spec-trace (several adapters in one folder), the testkit
(one `bin` per adapter in one package), foreman's fallback and `factory plan --adapters` (an adapter name that is not
a package name), three pull requests and steps on npm (a new name, four deprecations), to save four releases that are
already automated.

The same three reasons were checked for the channel adapters (T-90's first half), and the library `postgres`
(its second half) against ADR 0159's bar.

## Decision

**An adapter of a port is its own package, named `@opensoftware/<port>-<name>`, in `adapters/<port>/<name>/`,
whatever its size.** The port's conformance, the testkit, foreman's fallback and `factory plan --adapters` are built
on that name and that folder, and a product adapter carries its product's exact pin. An adapter's ADR answers
`## Why a package` with the port it implements (ADR 0159, point 2); its size needs no reason.

**ADR 0159's size floor (about 300 lines) applies to libraries, not to adapters.** Point 4's advice to prefer one
package per port family is withdrawn. A new library still needs all four points of ADR 0159.

**`harness-proxy` stays a library.** It has 388 lines in `packages/harness-proxy/src` and four users today, the
four harness adapters, and none of them may import another (ISOLATION).

**The channel adapters stay too.** `adapters/channel/github` and `adapters/channel/slack` (163 and 209 lines, both on
`packages/channel-kit` of 152 lines) pin no large product: `channel-github` pins the Chat SDK packages
`@chat-adapter/github`, `@chat-adapter/state-memory` and `chat` `4.43.0`, and `channel-slack` bundles them and has no
dependency. No code builds `@opensoftware/channel-<name>` from a pattern, but gatekeeper and intake start the Slack
adapter by its npm name by default (`npx -y @opensoftware/channel-slack` in `modules/gatekeeper/src/commands/load.ts`
and `modules/intake/src/commands/serve.ts`), and the folder rule holds for the 10 `@conformance` scenarios of
`ports/channel/features/channel.feature`, so the name and the folder reasons hold; T-90's channel half closes with
T-89.

**`postgres` stays a library.** `packages/postgres/src` has 34 lines (`openPool` and `transaction`, ADR 0082) and two
users, gatekeeper and intake, which no longer create a pool of their own. It is far under the floor, but no existing
library fits its job: `cli`, `testkit`, `contracts`, `factory-source` and `spec-files` do not depend on `pg`, and a
copy in each of the two modules would be a clone of more than the 15 lines DUP accepts across units. ADR 0159's floor
does not apply to packages that exist today. No module repeats its code: DUP passes, and the one other `BEGIN` and
`COMMIT` in a module, `transaction` in `modules/ledger/src/adapters/postgres.ts`, runs on a single `pg.Client` and
rolls back by closing the connection, so it is not a copy of the pool's helper. T-90's second half closes as "already
a shared library".

**Amends** ADR 0159 (point 4 and the merges its consequences plan).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One package `@opensoftware/harness` for the four adapters and `harness-proxy` (T-89 as planned) | One release, one changelog, one publish workflow instead of five | About 950 MB per install on Linux, also for `acp`; exact pins become optional peers that DEPS cannot enforce; new behavior in spec-trace, the testkit, foreman and factory-spec; three pull requests; a new npm name and four deprecations |
| Merge only the three product adapters, keep `acp` alone | `acp` stays small | Still about 950 MB per install of the merged package; the same changes to spec-trace, the testkit, foreman and factory-spec |
| Keep each adapter its own package (chosen) | Each install carries one product; name and folder keep working as built; nothing to change | Four small packages keep their releases, which are already automated |

## Prior art

Opened and read on npm (`npm view`):

- **Agent Client Protocol adapters** (`@agentclientprotocol/claude-agent-acp` 0.94.0 and `@agentclientprotocol/codex-acp`
  2.2.2, Apache-2.0, active): the ACP project publishes one package per product, each with its product as a
  dependency. Adopted: one adapter, one product, one package.
- **Vercel Chat SDK** (`chat` 4.43.0 with `@chat-adapter/github`, `@chat-adapter/slack` and `@chat-adapter/state-memory`,
  MIT, active): one core package and one package per platform adapter. Our channel adapters follow the same split.
- **opencode** (`opencode-ai` 1.19.4, MIT, active) and **Codex** (`@openai/codex` 0.160.1, Apache-2.0, active): a small
  package that pulls only the platform's binary through optional dependencies. Shows where the weight of a product
  adapter is, and that one package for all products cannot avoid it.

## Consequences

- T-89 and T-90 close without code. No package is renamed or deprecated on npm.
- A new adapter of a port needs no line count in its ADR; a new library still does.
- `skills/new-module`, `skills/write-adr` and `docs/explanation/module-tiers.md` no longer advise one package per port
  family.
- Revisit when a port gets an adapter that pins no product and could not be told apart from another adapter by its
  configuration alone, or when spec-trace and the testkit learn several adapters per folder for another reason.
