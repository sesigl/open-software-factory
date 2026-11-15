---
status: accepted
date: 2026-11-14
---

# 0139. Git's Basic form for every secret, when a new value reaches a sandbox, and the check before a stage

## Context

TODO item T-57 lets an admin store the value of an agent's secret in OpenBao from the factory UI. ADR 0137 gave the
secrets port its write side and left three decisions to this slice:

- **Git's Basic form of a secret from OpenBao.** git sends a token over HTTPS as Basic credentials, base64 of
  `x-access-token:<token>` (ADR 0096). For a secret from a file or a variable, the egress proxy's start script writes
  that form of the value to `/osf/basic/` and the proxy configuration swaps the placeholder's Basic form for it. A
  secret from OpenBao got no such form, because the start script never holds its value, so `git clone` and `git push`
  with a token stored in the UI were said not to work.
- **When a changed value takes effect**: at the start of a sandbox, or per request. The page `/secrets` repeats the
  answer to people, so it must be what the pinned egress proxy does.
- **A run that cannot work says so first.** A stage whose agent declares `ref:openbao/<name>` without a value fails at
  its agent's first request to the forge or the API, minutes into the run. It should fail before its first turn and
  name the secret. The check may read a secret's metadata, never its value (ADR 0137's `read` policy).

What was verified, against iron-proxy 0.54.0 (the image pinned by digest in `@opensoftware/sandbox-egress`, which
reports `0.54.0`, and its source at the tag `v0.54.0`):

- **iron-proxy reads inside Basic credentials itself.** Its `secrets` transform, for a header named `Authorization`
  whose value is `Basic <base64>`, decodes the base64, swaps the placeholder in `user:password`, and encodes it again
  (`replaceInHeader` and `headerContains` in `internal/transform/secrets/secrets.go`, since v0.1.0). This holds for
  every source, `vault_kv` included, and for any user name. ADR 0096 said it does not decode Basic credentials; that
  was not so.
- Measured on the docker adapter: SCN-SANDBOX-023 (a secret from a file, `curl -u x-access-token:$GH_TOKEN`) passes
  with the second swap of ADR 0096 removed from the configuration, and a copy of SCN-SANDBOX-018 that sends the
  OpenBao secret with `curl -u` received `Basic` of `x-access-token:<value>` at the API. The second swap and the files
  of `/osf/basic/` never did anything: the first swap, in every header, already replaced the placeholder.
- **The `vault_kv` source reads lazily and keeps the value.** It reads OpenBao at the first request that matches a
  secret's rules, the hosts of `egress`, not at the start. Without a `ttl` it keeps the first value it read for as
  long as the proxy runs; a read that fails before any success is kept for `failure_ttl`, one minute by default, and
  the request goes on without the swap (`buildLazySource` and `cachedValue` in
  `internal/transform/secrets/resolver.go`). The library sets no `ttl`. SCN-SANDBOX-029 measures it on each adapter.
- OpenBao 2.7.2 answers `GET <mount>/metadata/<name>` with 404 for a secret it does not have, and with
  `current_version` and, per version, `deletion_time` (empty unless deleted) and `destroyed`, for a token whose policy
  may `read` the metadata, without the value. Measured on the pinned binary.
- `host.docker.internal` does not resolve on this Linux development container (`getent hosts` is empty), nor on a
  Linux CI runner: only a container that Docker gives the name reaches the host by it.

## Decision

- **One swap per secret, in every header, for every provider.** The proxy configuration swaps each placeholder in
  every header for the hosts of `egress`, and iron-proxy finds it in git's Basic credentials too. The second swap of
  ADR 0096, the files of `/osf/basic/` and the exports `basicPlaceholder` and `GIT_USER` of
  `@opensoftware/sandbox-egress` go; `startScript()` takes no secrets. With `GH_TOKEN` set to the placeholder,
  `git clone` and `git push` over HTTPS work with a token from OpenBao, a file or a variable, and with any user name a
  forge expects (`x-access-token`, `oauth2`, `x-token-auth`). This supersedes the bullet "Git's Basic credentials" of
  ADR 0096; its measurement that GitHub refuses a token in a plain header stands.
- **A new value reaches the sandboxes that start after it is stored.** A sandbox reads each secret from OpenBao at its
  first request to an allowed host and keeps that value until it ends. Each stage runs in a sandbox of its own
  (ADR 0068), so the sentence for people, on the page `/secrets` and in the docs, is: *"A new value takes effect in
  the stages that start after you save it. A stage that is already running may keep the old value until it ends."*
  Deleting a value does not stop a running stage either. SCN-SANDBOX-029 proves both halves on each adapter, so an
  upgrade of iron-proxy that changes this fails a scenario before the sentence becomes untrue.
- **The secrets adapter answers whether a secret has a value.** The port gets a fifth command, `exists <name>`, which
  prints `{"name", "exists"}`. For OpenBao, `exists` is true when the metadata of the secret has a current version
  that is neither deleted nor destroyed; it reads the metadata only, so the read token may ask, and it prints no value.
  A token that may not read the metadata exits 1 with `the token may not read "<name>"`.
- **The foreman asks before a stage, through the secrets adapter as a program.** Before a sandboxed stage clones its
  repositories, creates its sandbox or starts its agent, the foreman runs `exists <name>` for each of the agent's
  secret references whose provider is a store: any provider but `file` and `env`, which the sandbox adapter resolves
  itself and whose missing value its `create` already refuses (ADR 0055). The adapter's command line comes from
  `FOREMAN_SECRETS`, a JSON object from provider name to command line like `FOREMAN_FORGES`; a provider it does not
  name runs `npx -y @opensoftware/secrets-<provider>@<range>` at factory.lock's pin or the range under
  `providers.secrets` (ADR 0110, ADR 0125). The adapter gets the foreman's environment, which already holds
  `OSF_OPENBAO_ADDR`, `OSF_OPENBAO_TOKEN` (the read token) and `OSF_OPENBAO_MOUNT` for the sandbox adapter.
  - A secret without a value fails the stage before its first turn, with the reason
    `the secret "ref:openbao/<name>" has no value; store it and run again`.
  - An adapter that fails (the store does not answer, refuses the token) fails the stage with the reason
    `the secrets adapter's exists failed: <its error>`, as the foreman words every adapter's failure: a stage whose
    secrets cannot be checked does not start.
  - Either is a fact of the run, not an error of the activity, so Temporal does not try the stage again; a person
    runs the run again after storing the value (ADR 0105). The run's view shows the reason in the stage's `reason`,
    which the contract already has. A stage without a sandbox gets no secrets (ADR 0068) and is not checked.
- **`fakes.openbao({ containers: true })`** listens on every interface and gives `containerUrl`,
  `http://host.docker.internal:<port>`, as `fakes.http(routes, { containers: true })` does. A test process starts at
  most one server of each kind, so a fake for the host stays on loopback. The sandbox adapters' new OpenBao scenarios
  (SCN-SANDBOX-028 and -029) use it with a token of the `read` policy, so the egress proxy reads the real server.
  SCN-SANDBOX-018 and -019 stay on `fakes.http`: their steps name the token `osf-test-bao-token`, the mount `secret` and
  the request OpenBao received, which only a fake that records requests can show.

## Options considered

| Option for Git's Basic form | For | Against |
| --- | --- | --- |
| One swap per secret, iron-proxy decodes Basic (chosen) | No code; every provider and every user name; nothing of a secret on the proxy's disk | Relies on iron-proxy's decoding, which SCN-SANDBOX-023 and -028 pin |
| iron-proxy's `inject` with a formatter, `Basic {{ base64 "x-access-token:" .Value }}` | Also in iron-proxy | Sets the header on every request to the host, also where the agent sent none; one user name |
| The start script reads OpenBao and writes the Basic file | Same shape as files and variables | The value on the proxy's disk; an HTTP client and the token in the script; a changed value never reaches it |
| Keep ADR 0096's files and add nothing | No change | Code and a public surface that do nothing, and docs that say OpenBao does not work |

| Option for a new value | For | Against |
| --- | --- | --- |
| iron-proxy's default, the first value a sandbox read (chosen) | No setting; a stage sees one value; one read of OpenBao per secret and sandbox | A running stage keeps an old or deleted value |
| A `ttl` such as one minute | A running stage gets a new value within a minute | A read per minute per secret and sandbox; a stage may see two values; a deleted value still stays, as iron-proxy serves the last value when a refresh fails |

| Option for who asks | For | Against |
| --- | --- | --- |
| The secrets adapter's `exists`, run by the foreman (chosen) | The store's API stays in its adapter, as the forge's does (ADR 0057); the foreman's tests need no Docker | One more command of the port and one more map of the foreman |
| The foreman reads OpenBao's metadata over HTTP | No program | The foreman knows OpenBao's paths and errors; another store changes the module |
| The sandbox adapter's `create` asks | No new command; also guards a direct call of the adapter | The adapter and its egress proxy must reach OpenBao at one address: in the adapters' own tests the adapter runs on the host, where `host.docker.internal` does not resolve, and the proxy in a container; and the library would do network I/O |
| Check every stage when the run starts | Fails sooner | A value stored while an earlier stage runs would not count; each stage's own check is enough |

## Prior art

No new module, dependency or service. iron-proxy (Apache-2.0, ADR 0054) at the pinned 0.54.0: its `secrets`
transform's Basic decoding and its lazy, cached `vault_kv` source, read in its source and measured as above; its
`ttl` and `inject` options were checked and not taken. OpenBao 2.7.2 (MPL-2.0, ADR 0137): KV version 2 metadata.
git's credential helper protocol and gh's helper, which sends the user `x-access-token` (ADR 0096).

## Consequences

- A token stored in the UI works for `git clone`, `git fetch` and `git push` over HTTPS in a sandbox, through both
  sandbox adapters, with no change to the agent or its prompt.
- `@opensoftware/sandbox-egress` loses two exports, a breaking change of a 0.x library: its next release raises the
  minor version.
- A stage that cannot get its secret fails in seconds with the reason, before it clones a repository or starts a
  sandbox. Each check is a process: a few hundred milliseconds with `FOREMAN_SECRETS`, longer with `npx`.
- A factory with `ref:openbao/` secrets now needs the secrets adapter wherever the foreman runs; the Compose profile and
  the chart name it in their slice of T-57.
- A running stage keeps the value it first read. Revisit when a sandbox lives longer than a stage, or when people ask to
  rotate a value under a running stage.
- iron-proxy names a `vault_kv` secret in its audit log by its path, so the egress log names such a secret by the last
  folder of its path, not by its variable. Revisit with the egress log.
