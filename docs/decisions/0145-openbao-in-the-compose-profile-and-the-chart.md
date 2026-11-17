---
status: accepted
topic: install
date: 2026-11-15
---

# 0145. OpenBao in the Compose profile: it sets itself up and unseals itself, and a job makes the two tokens

## Context

TODO item T-57 lets an admin store the value of an agent's secret `ref:openbao/<name>` on the console's `/secrets`,
and the egress proxy of the next sandbox sends it to the agent's allowed hosts. The releases are done: console 0.9.0
has the page, foreman 0.13.0 checks a stage's secrets with `FOREMAN_SECRETS` (ADR 0139), the sandbox adapters read
`ref:openbao/<name>`, and `@opensoftware/secrets-openbao` 0.1.0 prints the two policies (ADR 0137). No profile runs
OpenBao yet, and the chart has no setting for it.

ADR 0137 left these decisions to this slice: who initializes OpenBao in the Compose profile and where the unseal key
and the root token go; how it unseals after a restart without a person; how the two tokens reach the services; and how
long the tokens live, since a token of the token auth mount of OpenBao 2.7.2 lives at most 768 hours (32 days) by
default. ADR 0075 keeps OpenBao out of the chart.

What was verified on OpenBao 2.7.2, the binary `make install` pins and the image `quay.io/openbao/openbao:2.7.2`:

- **The static seal** (`seal "static"`) unseals a node at every start with a 32-byte AES key, given as 64 hex digits
  or base64 through `env://<variable>` or `file://<path>`. With it, a restart needs no person.
- **Self-initialization** (`initialize` blocks in the server's configuration) runs a list of requests as root on the
  first start of an empty store, needs an auto-unseal such as the static seal, and revokes the root token of the
  initialization afterwards. A request may read a value from the server's environment (`eval_source = "env"`).
  `auth/token/create` with `id` from `OSF_OPENBAO_ROOT_TOKEN`, `policies = ["root"]` and `no_parent` gives a root
  token with that ID and no end.
- **Audit devices** can no longer be enabled through the API in 2.7.2 (`sys/audit/<path>` answers "invalid request");
  an `audit` block in the configuration enables one at every start.
- **The file storage is gone**; the integrated storage (`raft`) runs one node. With `performance_multiplier = 1` the
  node elects itself in about a second.
- A token with a chosen ID (`bao token create -id=...`) works and keeps its ID when it is made again after a revoke.
  OpenBao warns that such a token is hashed with SHA-1 instead of an HMAC with SHA-256 where it obfuscates tokens.
- The Docker CLI gives a container the proxy of `~/.docker/config.json` as `HTTP_PROXY`, which `bao` follows, so a
  call to `http://openbao:8200` from another container needs `NO_PROXY`.
- Measured on this development machine with the images present: `docker compose up --detach --wait openbao-setup`
  on an empty volume takes 4.2 s (OpenBao sets itself up, the job writes the policies, the mount and two tokens), and
  2.8 s again after `docker compose down`.
- **A health check must not ask with a token.** A first version checked health with `bao token lookup`, an
  authenticated request that OpenBao audits: on this machine the audit log grew from 27 to 73 lines in 30 s of an idle
  profile (52 entries for `auth/token/lookup-self`), about 1.5 lines a second for as long as the service runs, on the
  volume with the data. With `sys/health` it stayed at 23 lines over the same 30 s; SCN-DIST-039 checks that an idle
  profile adds no entry in 5 s.
- BusyBox `wget` in OpenBao's image follows `http_proxy` and ignores `no_proxy`, so the health check passes `-Y off`.

## Decision

- **The service `openbao`** in `deploy/compose/compose.yaml` runs `quay.io/openbao/openbao:2.7.2`, always on, with
  `deploy/compose/openbao/config.hcl`: the integrated storage of one node and the audit log `audit.log` on the volume
  `openbao`, a listener without TLS on the profile's network only (no published port), and no UI. Its health check
  asks `sys/health` every second, which needs no token and which OpenBao does not audit, so the check writes nothing
  to the audit log. `openbao-setup` waits, at most 30 s, until the root token of `.env` answers, and otherwise fails
  with a message that names `OSF_OPENBAO_ROOT_TOKEN`: on the first start the `initialize` block sets the token up a
  moment after the store answers. The service gets no `BAO_TOKEN`: no service needs the root token there, and an
  operator who runs `bao` in it names `$OSF_OPENBAO_ROOT_TOKEN`, which the service holds for its first start.
- **OpenBao initializes itself.** On the first start of an empty volume, the configuration's `initialize` block gives
  the root token the ID `OSF_OPENBAO_ROOT_TOKEN` of `.env`. No person runs `bao operator init`, and there are no
  unseal or recovery keys to hand out: the static seal has none.
- **It unseals itself** with OpenBao's static seal and the key `OSF_OPENBAO_UNSEAL_KEY` of `.env`, 32 random bytes as
  64 hex digits, at every start.
- **The key and the root token live in `.env`**, as every other credential of the profile (ADR 0074), and only the
  services `openbao` and `openbao-setup` get them. `osf init` generates both, and the two token IDs. Whoever holds the
  volume and the key holds every value; whoever holds `.env` and the running profile holds them too, which was already
  so for the profile's own tokens. The docs say to keep `.env` in the operator's safe and to back up the volume and the
  key together.
- **The job makes the two tokens at every start.** The one-shot `openbao-policies` prints the two policies with
  `secrets-openbao policy write` and `policy read` from the console's image into the volume `openbao-policies`. The
  one-shot `openbao-setup`, in OpenBao's image with `bao` and the root token, then writes them as the policies
  `osf-console` and `osf-egress`, enables the KV version 2 mount `OSF_OPENBAO_MOUNT` (default `secret`) when it is
  missing, and for each token revokes it and creates it again, an orphan with its ID of `.env`
  (`OSF_OPENBAO_CONSOLE_TOKEN`, `OSF_OPENBAO_EGRESS_TOKEN`), its policy and `default`. It prints how long each token
  lives, never an ID. The console and the foreman wait for it.
- **The tokens reach the services through `.env`**: the console gets `OSF_OPENBAO_TOKEN` from
  `OSF_OPENBAO_CONSOLE_TOKEN` (writes, lists, deletes, cannot read a value), the foreman from
  `OSF_OPENBAO_EGRESS_TOKEN` (only reads), which it hands to the docker sandbox adapter, the egress proxy and the
  secrets adapter's `exists`. Both get `OSF_OPENBAO_ADDR=http://openbao:8200` and `OSF_OPENBAO_MOUNT`; the egress proxy
  joins the profile's network, so it reaches the same address. The images `console` and `foreman` install
  `@opensoftware/secrets-openbao`, so `CONSOLE_SECRETS_ADAPTER` and `FOREMAN_SECRETS` name the program and nothing
  runs `npx` at run time. Their tags take `-r1`, as no module version changed.
- **Lifetime: 768 hours from each start, and a warning a week before.** The job makes each token new with `-ttl=768h`,
  OpenBao's own maximum, at every `docker compose up`, with the same ID, so no service needs a new setting. A token
  needs no renewal and no loop in the console. A profile that runs 25 days without `up` gets the warning that
  `console doctor` and the page `/health` already give 7 days before the console's token ends; `docker compose up
  --detach --wait` makes both tokens new. The root token has no end; the egress token's end is the same as the
  console's, since the job makes both together.
- **The chart installs no OpenBao** (ADR 0075). Its values `openbao.address`, `openbao.mount` (default `secret`) and
  `openbao.secret`, a Secret the operator makes with the keys `console-token` and `egress-token`, set the same
  variables of the console and the foreman as in the profile, and `FOREMAN_SECRETS` and `CONSOLE_SECRETS_ADAPTER`.
  Without `openbao.address` the chart sets none of them, as before. The team's OpenBao, its unseal and its tokens'
  lifetime are its own; `deploy/README.md` gives the commands that apply the two policies with `secrets-openbao
  policy write|read`. The address must be reachable from the sandboxes' namespace, where the egress pods read it.

## Options considered

| Option for the first start | For | Against |
| --- | --- | --- |
| OpenBao's self-initialization with the root token's ID from `.env` (chosen) | OpenBao's own feature; no script parses `operator init`; nothing to hand out | A failed self-initialization needs an empty volume to run again |
| A script runs `bao operator init` and stores its output | Works on any version | The generated root token must go somewhere: the volume, next to the data it opens, or a file the operator copies |
| Development mode (`bao server -dev`) | One flag | Data in memory, gone at every restart |

| Option for the unseal | For | Against |
| --- | --- | --- |
| The static seal with the key in `.env` (chosen) | OpenBao's own auto-unseal for one node; no service of a cloud | The key sits next to the other credentials; the volume alone is still encrypted |
| Shamir keys and a script that unseals | OpenBao's default | The key shares in `.env` all the same, plus a script |
| Transit seal of a second OpenBao, or a cloud KMS | Key outside the host | A second service or a paid cloud account for a laptop |

| Option for the tokens' lifetime | For | Against |
| --- | --- | --- |
| Made new for 768 h at every start, warning at 7 days (chosen) | No loop; the console's existing warning; no setting of OpenBao changes | A profile that runs a month without `up` must be started again |
| Periodic tokens that a service renews | Never end while it runs | A renewal loop in a service of its own, and a token ends silently when it stops |
| A longer maximum (`max_lease_ttl`) | Fewer restarts | Changes OpenBao's default for every token; still an end |
| Root tokens for the console and the proxy | No end | A fault in the console could read every value (ADR 0137) |

| Option for the job | For | Against |
| --- | --- | --- |
| `bao` in OpenBao's image, with the policies from `secrets-openbao` in the console's image (chosen) | OpenBao's own CLI; the policies' text from the adapter, not copied | Two one-shots and a small volume |
| One Node script with `fetch` in the console's image | One service | Code of our own for five calls the CLI already makes |
| Policies and tokens in the self-initialization | No job | Runs only on the first start; the text would be copied into the configuration |

## Prior art

- **OpenBao** 2.7.2 (MPL-2.0, Linux Foundation, active), adopted in ADR 0137: its static seal, its self-initialization
  with values from the environment, its integrated storage and its `audit` configuration block, all read in its
  documentation for 2.7 and verified on the pinned binary and image.
- **OpenBao's image** `quay.io/openbao/openbao:2.7.2` (MPL-2.0): adopted for the server and the job; it ships `bao`
  and `wget`. The same image is on `ghcr.io/openbao/openbao`.
- **The official Helm chart of OpenBao** (`openbao/openbao-helm`, MPL-2.0, active): checked, not used; the chart leaves
  OpenBao to a team's own installation of it (ADR 0075).
- **Vault's `vault-init` patterns** and community images that run `operator init` and store the output: checked, not
  adopted; OpenBao's self-initialization does the same without a script.

## Consequences

- `osf init` writes four more values into `.env`: the unseal key, the root token and the two token IDs. Losing the key
  loses every stored value; the docs describe a backup of the volume `openbao` together with the key.
- Every `docker compose up` makes the two tokens new. An egress proxy that reads its secret in the few milliseconds
  between the revoke and the new token is refused, sends that request without the value and tries again a minute
  later (ADR 0139); its stage may fail, and a person runs it again.
- OpenBao hashes a token with a chosen ID with SHA-1 where it obfuscates tokens; the ID is 32 random bytes, so the
  weaker hash reveals nothing that could be guessed. Revisit if OpenBao drops chosen IDs.
- `docker compose up --wait` counts a one-shot that still runs as started, and one that ended before the wait looked
  as failed. The whole profile waits for `openbao-setup` through the console's and the foreman's `depends_on`. A start
  of OpenBao alone runs the job in the foreground with `docker compose run --rm openbao-setup`, as SCN-DIST-039 does:
  `docker compose wait openbao-setup` after `up` is no way, as the Compose of GitHub's runner answers
  `no containers for project` when the job has ended before the command runs.
- The console's image now serves two services, `console` and `openbao-policies`, so `docker compose config --images`
  lists it twice; SCN-DIST-041 replaces SCN-DIST-023 to say so.
- The audit log grows without rotation; OpenBao reopens the file on `SIGHUP`. Revisit with the egress log.
- Revisit the lifetime when OpenBao's default maximum changes, or when people run the profile for months without a
  restart.
