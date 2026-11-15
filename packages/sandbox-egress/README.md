---
covers: [packages/sandbox-egress/src/**]
---

# sandbox-egress

The egress proxy of a sandbox, for every sandbox adapter: from a sandbox spec it says where the proxy reads each
secret, writes iron-proxy's configuration, variables and start script, gives the sandbox the environment that sends
it through the proxy, and turns iron-proxy's audit lines into the egress log. A library: the sandbox adapters depend
on it, it has no command of its own. The adapters read the spec and the ends of a copy with the sandbox port's forms
in [contracts](../../contracts/README.md) ([ADR 0147](../../docs/decisions/0147-sandbox-egress-is-the-egress-proxy.md)).
Decisions: [ADR 0054](../../docs/decisions/0054-sandbox-port.md),
[ADR 0055](../../docs/decisions/0055-sandbox-kubernetes.md),
[ADR 0139](../../docs/decisions/0139-git-basic-form-value-timing-and-the-check-before-a-stage.md).

## Quick start

```ts
import { readDocument, type SandboxSpec } from "@opensoftware/contracts";
import { EGRESS_PROXY, proxyConfig, proxyEnv, resolveSecrets, sandboxEnv } from "@opensoftware/sandbox-egress";

const { document: spec } = readDocument<SandboxSpec>("sandbox-spec", "spec.json"); // and check its problems
const secrets = resolveSecrets(spec, process.env.OSF_SECRETS_DIR ?? "/run/secrets");
const config = proxyConfig(spec, secrets); // iron-proxy's proxy.yaml, as JSON
const proxyVariables = proxyEnv(secrets, process.env); // only for the proxy
const sandboxVariables = sandboxEnv(spec, `http://egress:${EGRESS_PROXY.port}`); // placeholders, never a secret
```

## API

| Export | What it does |
| --- | --- |
| `resolveSecrets(spec, secretsDir, env)` | The spec's secrets with the source the proxy reads each from: `file` (the file below `secretsDir`), `env` (the variable `OSF_SECRET_<NAME>` of `env`) or `openbao` (a path in OpenBao). A reference that cannot be resolved is a `UsageError` (see below). `env` defaults to the process's environment. |
| `proxyConfig(spec, secrets, { openbaoMount })` | iron-proxy's configuration: the allowlist of the egress hosts and the MCP servers' hosts, one swap per secret in every header for the egress hosts only, and the MCP policy with the declared tools. JSON, which is YAML. iron-proxy also swaps a placeholder inside git's Basic credentials, `Authorization: Basic` of `<user>:<placeholder>`, so `git clone` and `git push` over HTTPS work with a secret of any provider and any user name ([ADR 0139](../../docs/decisions/0139-git-basic-form-value-timing-and-the-check-before-a-stage.md)). |
| `proxyEnv(secrets, env)` | The proxy's own variables: `<NAME>` for each `env` secret, and `VAULT_ADDR` and `VAULT_TOKEN` from `OSF_OPENBAO_ADDR` and `OSF_OPENBAO_TOKEN` when a secret comes from OpenBao. |
| `startScript()` | The proxy's start script: it creates the CA and hands its certificate out in `<dir>/out/osf/`, then runs iron-proxy with `<dir>/proxy.yaml`. It writes nothing of a secret. |
| `EGRESS_PROXY` | The proxy's container: `image`, the pinned iron-proxy image; `dir`, its folder `/osf`, with a secret's file at `secrets/<VARIABLE>`; `port`, 8080; `ready`, the log line that says the proxy is ready; `caFile`, where the sandbox finds the proxy's CA. |
| `sandboxEnv(spec, egressUrl)` | The sandbox's variables: the spec's `env`, the placeholder `osf-secret-placeholder-<VARIABLE>` per secret, `HTTP_PROXY` and `HTTPS_PROXY` (also lower case) at `egressUrl`, and the CA variables at `caFile`. |
| `egressEntries(log)` | The egress log from iron-proxy's audit lines: host, method, path, `allowed` or `refused`, what refused it, the MCP server and tool, and the names of the secrets the proxy put in. Header values and MCP arguments are left out. |

How secret references resolve (ADR 0055):

| Reference | Value | Refused when |
| --- | --- | --- |
| `ref:file/<name>` | The file `<name>` in `OSF_SECRETS_DIR`, read by the proxy from `/osf/secrets/<VARIABLE>` | the name leaves the folder, or the file is missing |
| `ref:env/<NAME>` | The adapter's variable `OSF_SECRET_<NAME>`, read by the proxy from its variable `<NAME>` | `<NAME>` is no variable name, or the variable is not set |
| `ref:openbao/<path>` | The field `value` of the KV v2 secret `<path>` in the mount `openbaoMount` (default `secret`) | `OSF_OPENBAO_ADDR` or `OSF_OPENBAO_TOKEN` is not set |

Any other provider is refused. Each problem is one line of the `UsageError`.

The proxy reads a secret from OpenBao at the sandbox's first request to an allowed host and keeps that value until
the sandbox ends: a new value reaches the sandboxes that start after it is stored (ADR 0139).

## Releases

release-please opens a release pull request from the Conventional Commits under `packages/sandbox-egress/`. Merging
it creates the tag `sandbox-egress-v<version>`. The workflow `.github/workflows/publish-sandbox-egress.yml` then
builds `dist/` with `pnpm build` and publishes the package to npm. The first release is `0.1.0`; until `1.0.0`, a
breaking change raises the minor version. An adapter names the library with `workspace:*`; `pnpm pack` writes the
released version into the adapter's published `package.json`.

The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)):
the GitHub environment `npm`, a token only for the first version, then a trusted publisher for the workflow
`publish-sandbox-egress.yml`. No credential is stored in the repository.

## Configuration

The library reads no variable itself. Its caller passes the environment to `resolveSecrets` and `proxyEnv`:

| Variable | Meaning |
| --- | --- |
| `OSF_SECRET_*` | `OSF_SECRET_<NAME>` holds the value of `ref:env/<NAME>`. |
| `OSF_OPENBAO_ADDR` | OpenBao's address, for `ref:openbao/...`. |
| `OSF_OPENBAO_TOKEN` | The token the proxy reads OpenBao with. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-SEGRESS-001 | implemented | The proxy configuration allows the egress hosts and the hosts of the MCP servers |
| SCN-SEGRESS-002 | deprecated | A secret is swapped only for the hosts of the egress allowlist |
| SCN-SEGRESS-003 | implemented | Without an egress allowlist no secret is swapped |
| SCN-SEGRESS-004 | implemented | A secret from the environment is read by the proxy from a variable of its own |
| SCN-SEGRESS-005 | implemented | A secret from OpenBao is read by the proxy with the adapter's OpenBao address and token |
| SCN-SEGRESS-006 | implemented | The proxy configuration allows only the declared tools of a declared MCP server |
| SCN-SEGRESS-007 | implemented | The sandbox's environment holds the spec's variables, the placeholders and the proxy |
| SCN-SEGRESS-008 | implemented | The egress log names the host that the allowlist refused |
| SCN-SEGRESS-009 | implemented | The egress log names the secrets the proxy put in, never their values |
| SCN-SEGRESS-010 | implemented | The egress log names a tool that the MCP policy refused |
| SCN-SEGRESS-011 | deprecated | A spec that is no valid sandbox spec is refused with the path of the problem |
| SCN-SEGRESS-012 | implemented | A secret from an unknown provider is refused |
| SCN-SEGRESS-013 | implemented | A secret name that leaves the secrets folder is refused |
| SCN-SEGRESS-014 | implemented | A secret whose file is missing is refused |
| SCN-SEGRESS-015 | implemented | A secret from an unset variable is refused |
| SCN-SEGRESS-016 | implemented | A secret from the environment whose name is no variable name is refused |
| SCN-SEGRESS-017 | implemented | A secret from OpenBao without an address and a token is refused |
| SCN-SEGRESS-018 | deprecated | A memory quantity is converted to bytes |
| SCN-SEGRESS-019 | deprecated | A copy into a sandbox names a path below its working folder |
| SCN-SEGRESS-020 | deprecated | A copy out of a sandbox keeps an absolute path |
| SCN-SEGRESS-021 | deprecated | A copy that names a sandbox on both sides is refused |
| SCN-SEGRESS-022 | deprecated | A secret is swapped only for the hosts of the egress allowlist, also in git's Basic credentials |
| SCN-SEGRESS-023 | implemented | Each secret is swapped by one rule in every header for the hosts of the egress allowlist, whatever its provider |
