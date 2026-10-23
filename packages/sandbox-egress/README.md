---
covers: [packages/sandbox-egress/src/**]
---

# sandbox-egress

What every sandbox adapter shares about the egress proxy of a sandbox: it reads and checks the sandbox spec, resolves
the spec's secret references, writes the configuration and the variables of iron-proxy, gives the sandbox's
environment, and turns iron-proxy's audit lines into the egress log. A library: the sandbox adapters depend on it,
it has no command of its own. Decisions: [ADR 0054](../../docs/decisions/0054-sandbox-port.md),
[ADR 0055](../../docs/decisions/0055-sandbox-kubernetes.md).

## Quick start

```ts
import { proxyConfig, proxyEnv, readSpec, resolveSecrets, sandboxEnv } from "@opensoftware/sandbox-egress";

const spec = readSpec("spec.json");
const secrets = resolveSecrets(spec, process.env.OSF_SECRETS_DIR ?? "/run/secrets");
const config = proxyConfig(spec, secrets); // iron-proxy's proxy.yaml, as JSON
const proxyVariables = proxyEnv(secrets, process.env); // only for the proxy
const sandboxVariables = sandboxEnv(spec, "http://egress:8080"); // placeholders, never a secret
```

## API

| Export | What it does |
| --- | --- |
| `readSpec(file)` | The `sandbox-spec` (contracts) in the file. A document that is no sandbox spec is a `UsageError` that names `<file>: <path> <problem>` for each problem. |
| `resolveSecrets(spec, secretsDir, env)` | The spec's secrets with their provider: `file` (the file below `secretsDir`), `env` (the variable `OSF_SECRET_<NAME>` of `env`) or `openbao` (a path in OpenBao). A reference that cannot be resolved is a `UsageError` (see below). `env` defaults to the process's environment. |
| `proxyConfig(spec, secrets, { openbaoMount })` | iron-proxy's configuration: the allowlist of the egress hosts and the MCP servers' hosts, the secret swaps for the egress hosts only, and the MCP policy with the declared tools. JSON, which is YAML. |
| `proxyEnv(secrets, env)` | The proxy's own variables: `<NAME>` for each `env` secret, and `VAULT_ADDR` and `VAULT_TOKEN` from `OSF_OPENBAO_ADDR` and `OSF_OPENBAO_TOKEN` when a secret comes from OpenBao. |
| `sandboxEnv(spec, egressUrl)` | The sandbox's variables: the spec's `env`, a placeholder per secret, `HTTP_PROXY` and `HTTPS_PROXY` (also lower case) at `egressUrl`, and the CA variables at `CA_FILE`. |
| `egressEntries(log)` | The egress log from iron-proxy's audit lines: host, method, path, `allowed` or `refused`, what refused it, the MCP server and tool, and the names of the secrets the proxy put in. Header values and MCP arguments are left out. |
| `memoryBytes(quantity)` | A Kubernetes quantity such as `256Mi` in bytes. |
| `placeholder(variable)`, `envVariable(name)` | `osf-secret-placeholder-<variable>`, and `OSF_SECRET_<name>`. |
| `EGRESS_IMAGE`, `START_SCRIPT`, `READY`, `PROXY_DIR`, `EGRESS_PORT`, `CA_FILE`, `WORKSPACE` | The pinned iron-proxy image, its start script (it creates the CA and hands its certificate out in `<PROXY_DIR>/out/osf/`), the log line that says the proxy is ready, the proxy's folder `/osf`, its port 8080, the sandbox's CA file and working folder. |

How secret references resolve (ADR 0055):

| Reference | Value | Refused when |
| --- | --- | --- |
| `ref:file/<name>` | The file `<name>` in `OSF_SECRETS_DIR`, read by the proxy from `/osf/secrets/<VARIABLE>` | the name leaves the folder, or the file is missing |
| `ref:env/<NAME>` | The adapter's variable `OSF_SECRET_<NAME>`, read by the proxy from its variable `<NAME>` | `<NAME>` is no variable name, or the variable is not set |
| `ref:openbao/<path>` | The field `value` of the KV v2 secret `<path>` in the mount `openbaoMount` (default `secret`) | `OSF_OPENBAO_ADDR` or `OSF_OPENBAO_TOKEN` is not set |

Any other provider is refused. Each problem is one line of the `UsageError`.

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
| SCN-SEGRESS-002 | implemented | A secret is swapped only for the hosts of the egress allowlist |
| SCN-SEGRESS-003 | implemented | Without an egress allowlist no secret is swapped |
| SCN-SEGRESS-004 | implemented | A secret from the environment is read by the proxy from a variable of its own |
| SCN-SEGRESS-005 | implemented | A secret from OpenBao is read by the proxy with the adapter's OpenBao address and token |
| SCN-SEGRESS-006 | implemented | The proxy configuration allows only the declared tools of a declared MCP server |
| SCN-SEGRESS-007 | implemented | The sandbox's environment holds the spec's variables, the placeholders and the proxy |
| SCN-SEGRESS-008 | implemented | The egress log names the host that the allowlist refused |
| SCN-SEGRESS-009 | implemented | The egress log names the secrets the proxy put in, never their values |
| SCN-SEGRESS-010 | implemented | The egress log names a tool that the MCP policy refused |
| SCN-SEGRESS-011 | implemented | A spec that is no valid sandbox spec is refused with the path of the problem |
| SCN-SEGRESS-012 | implemented | A secret from an unknown provider is refused |
| SCN-SEGRESS-013 | implemented | A secret name that leaves the secrets folder is refused |
| SCN-SEGRESS-014 | implemented | A secret whose file is missing is refused |
| SCN-SEGRESS-015 | implemented | A secret from an unset variable is refused |
| SCN-SEGRESS-016 | implemented | A secret from the environment whose name is no variable name is refused |
| SCN-SEGRESS-017 | implemented | A secret from OpenBao without an address and a token is refused |
| SCN-SEGRESS-018 | implemented | A memory quantity is converted to bytes |
| SCN-SEGRESS-019 | implemented | A copy into a sandbox names a path below its working folder |
| SCN-SEGRESS-020 | implemented | A copy out of a sandbox keeps an absolute path |
| SCN-SEGRESS-021 | implemented | A copy that names a sandbox on both sides is refused |
