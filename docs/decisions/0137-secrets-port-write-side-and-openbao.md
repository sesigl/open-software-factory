---
status: accepted
topic: ports
date: 2026-11-14
---

# 0137. The secrets port gets a write side; the adapter `secrets-openbao` and `fakes.openbao`

## Context

TODO item T-57 lets an admin store the value of an agent's secret in the factory UI. Values live in OpenBao (decided
by the owner, wave 6 of `TODO.md`; OpenBao is in `docs/architecture/stack.md` because Vault moved to the Business
Source License). Today only the read side exists: a sandbox's egress proxy reads `ref:openbao/<name>` as the field
`value` of a KV secret, through iron-proxy's `vault_kv` source (`ports/secrets/README.md`, ADR 0054, ADR 0055).
Nothing writes to OpenBao, and the tests of the sandbox adapters stand in for it with `fakes.http`.

The console must store, list and delete values and must never be able to show one (ADR 0130: the secret store's
operations belong to the secrets port and its adapter, a program the console runs). The console is a module, so it
cannot import an adapter (ISOLATION); the forge port solved this with commands of an adapter program (ADR 0057).

This ADR decides the port's write side, the adapter and its test store. The later slices of T-57 decide the rest:
Git's form of a secret from OpenBao and when a changed value takes effect, the stage that fails before its first
turn, OpenBao in the Compose profile and the chart, the page `/secrets` and `console doctor`.

## Decision

- **The port's write side is a program with four commands**, like the forge port. Their shared behavior is the
  `@conformance` scenarios in `ports/secrets/features/` (prefix `SCN-SECRET`); each adapter has one system test per
  scenario.
  - `put <name> --by <person>` reads the value from standard input, without its final line break, and stores it as a
    new version; it prints `{"name", "version"}`. The value is never an argument or a variable: those show in `ps`, in
    a shell's history and in a process's environment. An empty value is a usage error, and so is a person over 128
    characters or with a line break or another control character, checked before any request: OpenBao refuses such
    a person in the metadata only after the value is stored (over 512 bytes, or unprintable), and 128 characters of up
    to 4 bytes stay below its limit while they hold an email address or a login.
  - `list` prints one `{"name", "version", "changed", "by"}` per secret, sorted by name: the time and the person of
    the last change, and the current version. A name may hold `/`, so `list` walks the folders. `by` is `null` for a
    secret that another client stored.
  - `delete <name>` removes the secret with every version and prints `{"name", "deleted"}`; `deleted` is false when
    the store has no such secret.
  - `probe` checks that the store answers to the token, and prints how long the token still lives: `{"ttl",
    "expires"}`.
  - No command prints a value, and no error names one. A name follows `SecretReference` of
    `contracts/typespec/factory-definition.tsp`: `A-Z a-z 0-9 _ . -` in folders split by `/`, and no empty, `.` or `..`
    folder, so a name cannot step out of the store's folder. A wrong name is a usage error before any request.
  - Errors every adapter names alike: `the store at <address> does not answer`, `the store refused the token`, and
    `the token may not write "<name>"`, `the token may not delete "<name>"` and `the token may not list the secrets`
    for a token without that right.
- **The adapter `adapters/secrets/openbao`** (`@opensoftware/secrets-openbao`, core, prefix `SCN-SOPENBAO`) calls
  OpenBao's HTTP API with `fetch`. It reads the variables the sandbox adapters already read: `OSF_OPENBAO_ADDR`,
  `OSF_OPENBAO_TOKEN` and `OSF_OPENBAO_MOUNT` (default `secret`).
  - **KV version 2, the value in the field `value`**, at `<mount>/data/<name>`: what iron-proxy's `vault_kv` source
    reads with `json_key: "value"` (`packages/sandbox-egress/src/domain/proxy-config.ts`; SCN-SANDBOX-018 expects the
    read of `secret/data/linear-token`). KV version 2 keeps versions, so a changed value is a new version, and keeps
    metadata apart from the value, so a token can read one without the other.
  - **The person in the secret's metadata**: `put` writes the value, then `custom_metadata.changed_by` of the
    secret's metadata. `list` reads the current version, its `created_time` and `changed_by` from the metadata.
  - **Two tokens with two policies, one mount per factory.** `secrets-openbao policy write` and `policy read` print
    the two policies for the mount, so the profile's job, the chart's docs and the tests apply the same text:
    - `write`, the console's token: `create` and `update` on `<mount>/data/*`, and `read`, `list`, `update` and
      `delete` on `<mount>/metadata/*`. It writes and deletes values and reads names and metadata, and OpenBao refuses
      it a read of `<mount>/data/*`, so a fault in the console cannot show a secret.
    - `read`, the egress proxy's token: `read` on `<mount>/data/*` and `<mount>/metadata/*`. It reads every value of
      the mount and, for the foreman's check before a stage, whether a secret exists; it cannot write or list.
    - Both tokens also hold OpenBao's policy `default`, which every token gets unless it is made without it: it lets a
      token read `auth/token/lookup-self`, which `probe` asks for the token's lifetime.
  - Any other answer of OpenBao, such as 413 for a request over its `max_request_size` of 32 MiB, exits 1 with
    OpenBao's status and message, which never holds the value.
  - `probe` reads `auth/token/lookup-self` (its `ttl` in seconds and `expire_time`), then the mount through
    `sys/internal/ui/mounts/<mount>`, the call OpenBao's own CLI makes to learn a KV mount's version. A mount the token
    may not use, or one that is not KV version 2, exits 1 and names the mount.
  - A refusal (HTTP 403) is either a token OpenBao does not know or a token without the right; the adapter tells them
    apart with `lookup-self`, which every token with the policy `default` may call.
- **`fakes.openbao()` in the testkit** runs the real OpenBao binary in development mode (`bao server -dev`, data in
  memory), pinned by `make install` like `temporal` and `nats-server` (ADR 0067). As for Temporal and PostgreSQL
  (ADR 0129), the first scenario of a test process starts the server and each scenario gets a KV version 2 mount of its
  own. The fake gives the address and the mount, makes a token with a policy and a lifetime, and reads and writes a
  secret of the mount as another client would. The root token stays inside the fake.
- **`sut.cli` takes `stdin`**: the text a scenario writes to the program's standard input, which is closed after it.
  `put` reads its value there.
- **Pinned OpenBao 2.7.2**, the latest release of 26 October 2026, from its GitHub release
  (`openbao_2.7.2_<os>_<arch>.tar.gz`), checked against the SHA-256 of the release's `checksums.txt`.

Decided in a later slice of T-57, not here:

- When a changed value reaches a sandbox (at its start or per request), and Git's Basic form of a secret from OpenBao.
- Who initializes OpenBao in the Compose profile, where the unseal key and the root token go, how it unseals after a
  restart without a person, and how the two tokens reach the services. One fact for that slice: the token auth mount
  of OpenBao 2.7.2 has a default and a maximum lifetime of 768 hours (32 days), measured on the pinned binary.
- The chart's values for a team's own OpenBao.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Commands of an adapter program (chosen) | The console runs it like a forge adapter; ISOLATION holds; another store is another program | A process per call |
| A library the console imports | No process | Modules may not import adapters (ISOLATION) |
| `bao` CLI from the console | OpenBao's own tool | The console would know OpenBao's paths, policies and errors and ship a second binary; no port for another store |
| Value as an argument or a variable of `put` | Simple to call | Visible in `ps`, `/proc/<pid>/environ` and shell history |
| One token for the console and the proxy | One secret to manage | A fault in the console could read every value |
| KV version 1 | Simpler paths | No versions, no metadata apart from the value: the person could only live next to the value |
| Policies only in the docs | No command | The profile's job, the chart's docs and the tests would each copy the text |
| Plain `fetch` (chosen) | No dependency; six endpoints | The adapter keeps its own error mapping |
| A client library | Ready-made calls | See prior art: each adds a dependency tree for six calls |
| OpenBao in a container for the tests | The same binary | Docker for each suite; a container start costs more than the process |
| A hand-written HTTP fake of OpenBao | No binary | Policies are the point of the scenarios; only the real server enforces them (ADR 0049) |

## Prior art

- **OpenBao** (MPL-2.0, Linux Foundation, active; 2.7.2 of 26 October 2026): adopted, as chosen in
  `docs/architecture/stack.md`. Development mode starts unsealed, in memory, with a KV version 2 mount at `secret/`
  and a root token of the caller's choice, in about a second.
- **node-vault** (MIT, 0.13.0 of October 2026, active): a generic Vault client on axios, mustache and tv4. Checked, not
  adopted: three dependencies and a templated API for six calls.
- **hashi-vault-js** (MIT, 0.5.3 of August 2026) and **@litehex/node-vault** (MIT, 1.1.7 of August 2026): checked, not
  adopted for the same reason. OpenBao publishes official clients for Go only.
- **iron-proxy** (Apache-2.0, ADR 0054): its `vault_kv` source reads KV version 2 at `<mount>/data/<path>` with the
  token in `VAULT_TOKEN` and takes the field named by `json_key`. The adapter writes what it reads.
- **OpenBao's container image** (`quay.io/openbao/openbao`): ships the same binary. Not used: the pinned binary needs
  no Docker.

## Consequences

- The console, a script or an operator stores a value with `printf %s "$VALUE" | secrets-openbao put <name> --by
  <person>`, and nothing in the factory can print it back through this port.
- A secret that is not sent in an HTTP request does not work through the egress proxy; the port does not change that.
- The tests of the sandbox adapters can move from `fakes.http` to `fakes.openbao` in a later slice; the server listens
  on loopback only, so a container cannot reach it yet.
- `sys/internal/ui/mounts` is an internal endpoint of OpenBao. Revisit `probe` if a release of OpenBao changes it.
