---
covers: [adapters/secrets/openbao/src/**]
---

# secrets-openbao

Stores, lists and deletes the values of the factory's secrets in [OpenBao](https://openbao.org) without ever printing
one, behind the factory's secrets port. It calls OpenBao's HTTP API, keeps the values in a KV version 2 mount where a
sandbox's egress proxy reads them, and keeps no state of its own. Decision:
[ADR 0137](../../../docs/decisions/0137-secrets-port-write-side-and-openbao.md). The port's scenarios are in
[`ports/secrets/features/`](../../../ports/secrets/features/secrets.feature), this adapter's own scenarios in
[`features/`](features/openbao.feature).

## Quick start

```sh
export OSF_OPENBAO_ADDR=http://127.0.0.1:8200 OSF_OPENBAO_MOUNT=secret
# Once, with a token that may write policies: the console's policy and token.
npx @opensoftware/secrets-openbao policy write | bao policy write osf-console -
export OSF_OPENBAO_TOKEN=$(bao token create -policy=osf-console -field=token)

printf %s "$LINEAR_TOKEN" | npx @opensoftware/secrets-openbao put linear-token --by ada   # {"name":"linear-token","version":1}
npx @opensoftware/secrets-openbao list          # {"name":"linear-token","version":1,"changed":"2026-11-14T20:01:02.5Z","by":"ada"}
npx @opensoftware/secrets-openbao probe         # {"ttl":2764799,"expires":"2026-12-16T20:01:02.5Z"}
npx @opensoftware/secrets-openbao delete linear-token   # {"name":"linear-token","deleted":true}
```

An agent that declares `ref:openbao/linear-token` in `factory.yaml` then gets this value through its sandbox's egress
proxy ([`ports/secrets/README.md`](../../../ports/secrets/README.md)).

## How it behaves

- **Values.** `put` reads the value from standard input and drops one final line break, so `echo` works too. It
  writes the field `value` of the KV version 2 secret `<mount>/data/<name>`, the field the egress proxy reads, and
  then the person of `--by` as `changed_by` in the secret's `custom_metadata`. The person has at most 128
  characters and no control character, checked before any request, so OpenBao's limit of 512 bytes never leaves a
  version without its person. No command prints a value, and no
  error names one.
- **Names.** `A-Z`, `a-z`, `0-9`, `_`, `.` and `-` in folders split by `/`, like `team/linear-token`, as
  `SecretReference` in `contracts/` allows; no folder is empty, `.` or `..`. `list` walks the folders and prints the
  names sorted.
- **Versions.** Each `put` makes a new version; OpenBao keeps the last 10 by default. `delete` removes the metadata
  and every version.
- **Two tokens, two policies, one mount per factory.** `policy write` prints the policy of the console's token: it
  may write values, read and change metadata, list and delete, and OpenBao refuses it a read of a value. `policy
  read` prints the policy of the egress proxy's token: it reads values and metadata, and nothing else. Both tokens
  also need OpenBao's `default` policy, which every token gets unless it is made without it.
- **probe** reads the token's `ttl` (seconds) and `expire_time`, and asks OpenBao for the mount as OpenBao's own CLI
  does. A mount that does not exist, is no KV version 2 mount or that the token may not use exits 1 and names it.
- **Errors.** A store that does not answer exits 1 with `the store at <address> does not answer`; a token OpenBao
  does not know with `the store refused the token`; a token without the right with `the token may not write
  "<name>"`, `the token may not delete "<name>"` or `the token may not list the secrets`. Any other answer of OpenBao,
  such as 413 for a request over its `max_request_size` of 32 MiB, exits 1 with OpenBao's status and message.
- **Not yet:** a token's renewal. A token of OpenBao 2.7.2 lives at most 768 hours by default; `probe` says how long.

## Commands

| Command | What it does |
| --- | --- |
| `secrets-openbao put <name> --by <person>` | Store the value on standard input as a new version; print `{"name", "version"}`. |
| `secrets-openbao list` | Print each secret as `{"name", "version", "changed", "by"}`, sorted by name; `by` is `null` for a secret another client stored. |
| `secrets-openbao delete <name>` | Remove the secret with every version; print `{"name", "deleted"}`, with `deleted` false when there was none. |
| `secrets-openbao probe` | Check that OpenBao answers to the token and that the mount is KV version 2; print `{"ttl", "expires"}` of the token. |
| `secrets-openbao policy write\|read` | Print the policy of the console's token (`write`) or of the egress proxy's (`read`) for the mount. |

## Releases

release-please opens a release pull request from the Conventional Commits under `adapters/secrets/openbao/`. Merging
it creates the tag `secrets-openbao-v<version>`. The workflow `.github/workflows/publish-secrets-openbao.yml` then
builds the package and publishes it to npm as `@opensoftware/secrets-openbao`. The first release is `0.1.0`; until
`1.0.0`, a breaking change raises the minor version. The one-time setup is the same as for contracts
([`contracts/README.md`](../../../contracts/README.md#releases)). No credential is stored in the repository.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OSF_OPENBAO_ADDR` | string |  | OpenBao's address, for example http://127.0.0.1:8200. Required by every command but policy. |
| `OSF_OPENBAO_TOKEN` | string |  | An OpenBao token with the policy that policy write prints, the console's; or with the one of policy read, which only reads. Required by every command but policy. |
| `OSF_OPENBAO_MOUNT` | string | `"secret"` | The factory's KV version 2 mount: one mount per factory, the same as the egress proxy's. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-SOPENBAO-001 | implemented | policy write and policy read print the two policies of the mount "secret" by default |
| SCN-SOPENBAO-002 | implemented | The token of policy read reads a value and its metadata |
| SCN-SOPENBAO-003 | implemented | A mount that is no KV version 2 mount of the token is refused |
| SCN-SOPENBAO-004 | implemented | A value over OpenBao's request limit is refused and not stored |
| SCN-SOPENBAO-005 | implemented | A command without OpenBao's address or token is a usage error |
| SCN-SOPENBAO-006 | implemented | policy without write or read is a usage error |
| SCN-SOPENBAO-007 | implemented | An address with a final slash reaches OpenBao |
| SCN-SOPENBAO-008 | implemented | A command with an argument too many shows the usage |
