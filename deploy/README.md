---
covers: [deploy/compose/**, deploy/images/**, deploy/helm/**]
---

# deploy

Install a complete factory with one command. The Compose profile in [`compose/`](compose/compose.yaml) runs the
factory on one machine for one team: PostgreSQL with Temporal and pgvector, NATS, Jaeger, LiteLLM, OpenBao,
gatekeeper, intake, foreman and console, with the [reference factory](compose/factory/factory.yaml). The
[Helm chart](#helm-chart) in [`helm/osf/`](helm/osf/Chart.yaml) runs the same modules on Kubernetes for platform
teams. Decisions: [ADR 0074](../docs/decisions/0074-compose-profile.md),
[ADR 0075](../docs/decisions/0075-helm-chart-and-images.md).

## Quick start

You need Docker with Compose 2.24 or later. [Your first factory run](../docs/tutorials/first-run.md) does the same
with `osf init`, `osf up` and `osf doctor`, which generate the factory's own secrets and check `.env` before
Compose starts.

```sh
cd deploy/compose
cp .env.example .env    # set the tokens, the database password, and Slack or a forge token for gatekeeper
$EDITOR factory/groups.json    # put your Slack member ID, like slack:U024BE7LH, or github:<login> in place of slack:U0EXAMPLE
docker compose up --detach --wait
docker compose run --rm console console doctor    # one line per check, and one fix per failure
docker compose run --rm factory plan
```

`console doctor` checks each server's health and token, the factory definition and its groups, in that order
([ADR 0086](../docs/decisions/0086-health-routes.md)). Then open the console at http://localhost:8080. `up` pulls the signed module images from GHCR; an image that is not
published yet, like one whose pin moved a moment ago, is built from npm, which takes a minute or two.

The console is open and read-only until you [turn on the sign-in](#turn-on-the-sign-in).

## What runs

| Service | What it is | Port on `OSF_HOST` |
| --- | --- | --- |
| `postgres` | PostgreSQL 17 with pgvector; one database per service, from `postgres/init.sql` | none |
| `temporal-schema` | one-shot: the Temporal schema in PostgreSQL | none |
| `temporal` | the Temporal server on PostgreSQL, configured by `temporal/config.yaml` | none |
| `temporal-namespace` | one-shot: the namespace `default` | none |
| `temporal-ui` | the history of every run | `TEMPORAL_UI_PORT`, 8233 |
| `openbao` | the secret store of the agents' secrets `ref:openbao/<name>`, which an admin stores on the console's `/secrets`: OpenBao on the volume `openbao`, with its audit log; it sets itself up on its first start and unseals itself at every start; see [Secrets in OpenBao](#secrets-in-openbao) ([ADR 0145](../docs/decisions/0145-openbao-in-the-compose-profile-and-the-chart.md)) | none |
| `openbao-policies` | one-shot: the two policies that `secrets-openbao policy write` and `policy read` print | none |
| `openbao-setup` | one-shot at every start: the policies, the mount and the console's and the egress proxy's tokens with the IDs of `.env` | none |
| `nats` | NATS with JetStream for the events between the modules; intake and foreman keep an event in the stream `OSF` for `OSF_STREAM_MAX_AGE`, default `7d` ([ADR 0116](../docs/decisions/0116-events-not-lost-without-a-trace.md)) | none |
| `jaeger` | the trace store: the runs' traces from foreman, by OTLP, kept on the volume `jaeger` ([ADR 0100](../docs/decisions/0100-jaeger-trace-store.md)); the console links each run and each stage's span there ([ADR 0121](../docs/decisions/0121-stage-run-record-in-the-trace.md)) | `JAEGER_PORT`, 16686 |
| `litellm` | the LLM gateway, configured by `litellm/config.yaml`: LiteLLM's image with its bytecode compiled, so it starts sooner ([ADR 0098](../docs/decisions/0098-litellm-image-with-bytecode.md)), and without BerriAI's enterprise code, whose license allows no changed copies ([ADR 0102](../docs/decisions/0102-litellm-image-without-enterprise-code.md)) | `LITELLM_PORT`, 4000 |
| `factory-repo` | one-shot: copies `FACTORY_DIR` into the volume `factory` and commits it | none |
| `gatekeeper` | approvals in Slack or on pull requests, with the policy and groups of the factory | `GATEKEEPER_PORT`, 8082 |
| `intake` | work from Slack, the forge and Sentry | `INTAKE_PORT`, 8081 |
| `docker-proxy` | the foreman's only way to the Docker API, for the agents' sandboxes; see [Sandboxes](#sandboxes) | none |
| `agent-template` | one-shot: puts the image `harness-claude-code` on this machine, the template of the agents' sandboxes | none |
| `foreman` | runs the factory's workflow on Temporal | `FOREMAN_PORT`, 8083 |
| `console` | the web view of the runs and the factory; its health check asks `/v1/ready`, which needs no session | `CONSOLE_PORT`, 8080 |
| `factory` | factory-spec for `docker compose run --rm factory <command>`; profile `tools` | none |

The module images are `ghcr.io/sesigl/open-software-factory/<module>:<version>`, built from
[`images/Dockerfile`](images/Dockerfile): Node 24, Git and the module with its adapters from npm, at the versions
`compose.yaml` pins. Compose pulls them, and builds one only when GHCR does not have it. A new release reaches the
profile with the release itself, as each release moves the pins. See [Releases](#releases) for how they are published
and verified.

## Your factory

The reference factory in `compose/factory/` has the stages triage, spec, implement (behind a gate that a member of
`maintainers` approves in Slack, so the spec's pull request is approved before implement starts), review, verify (after the pull request's check `verify` succeeded, with
evidence) and ship (again only after `verify` and the evidence succeeded on the pull request's head commit). foreman reads that check with `FOREMAN_FORGE_TOKEN`. Its prompts work on any GitHub repository:
each stage clones the repository of the issue in the work item's origin, reads the repository's own `AGENTS.md`,
`CONTRIBUTING.md` and `README.md`, runs the checks they name, and starts from what the stage before it wrote, which
the foreman puts at the end of its prompt ([ADR 0111](../docs/decisions/0111-the-result-of-a-stage-in-the-next-prompt.md)). Name your CI's check in the stage `verify` of
`factory.yaml` when it is not `verify`. On GitHub, a job of GitHub Actions is a check run named after the job: its
`name:`, or its key under `jobs:` when it has no `name:`. The workflow's name is not part of it. A job of a matrix
without its own `name:` adds the matrix values in parentheses, like `test (ubuntu-latest, 24)`. A job of a reusable
workflow is named `<calling job> / <called job>`, like `ci / verify`. The forge adapter `github` reads check runs and
commit statuses ([ADR 0104](../docs/decisions/0104-forge-github-check-runs.md)), so its token needs `Checks: read`. To run your own, copy the
folder, change the prompts, `policy/spec.rego` and `groups.json`, and set `FACTORY_DIR` to it. The reference
`groups.json` names `slack:U0EXAMPLE`, a member that stands for a person and is nobody: until a group has a real
member, gatekeeper names it when it starts and `console doctor` fails its check `groups`
([ADR 0114](../docs/decisions/0114-the-example-member-of-the-reference-groups.md)). Its `access.yaml`, which the
console's own sign-in reads (ADR 0134), names `admin@example.com` the same way: with `CONSOLE_SIGN_IN` set,
`console doctor` fails its check `access` until an admin of yours is listed. Each
`docker compose up` commits the folder into the volume `factory`, so a run's factory version is a commit. The factory
attaches to `litellm` with `inference/litellm.yaml`, so its agents' models are the routes in
`compose/litellm/config.yaml`. Add your models there, with their keys in `.env`. Its routes point at Anthropic's
models without a key, for `CLAUDE_CODE_OAUTH_TOKEN`.

A factory that names `providers.inference: litellm` with the config `osf.proxy` attaches to the service `litellm`:
foreman gets a key with the factory's budget for each run, and the spend log names the run.

### The factory of this repository

[`dogfood/factory/`](dogfood/factory/factory.yaml) implements the issues labeled `factory` of this repository on its
owner's Claude subscription ([ADR 0080](../docs/decisions/0080-dogfood-on-a-subscription.md)). Its agents clone the
issue's repository with `gh`, follow its `AGENTS.md` and open a draft pull request with the scenarios. The gate before
`implement` asks the owner on that pull request; the owner comments `/approve`, and the agents implement, review,
wait for the check `verify` and mark the pull request ready. The owner merges it. It has no `access.yaml`, so with
the [sign-in](#turn-on-the-sign-in) on nobody gets in until the owner adds one with their own email. In `.env`:

```sh
FACTORY_DIR=../dogfood/factory
CLAUDE_CODE_OAUTH_TOKEN=...   # claude setup-token
GH_TOKEN=...                  # fine-grained: this repository only, Contents, Issues and Pull requests write, Commit statuses write, Checks read
GATEKEEPER_FORGE_TOKEN=...    # the same token
FOREMAN_FORGE_TOKEN=...       # the same token
INTAKE_WEBHOOK_SECRET=...     # see "Receive GitHub issues on your machine"
```

Every agent of this factory runs in a sandbox, as the reference factory's agents do (see [Sandboxes](#sandboxes)): it
gets `GH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN` as placeholders and never sees a token of foreman or the master key of
`litellm`. Its egress allows what `make install` and `make verify` of this repository download: `litellm`, GitHub and
its release files, `registry.npmjs.org`, `get.helm.sh` and `dl.k8s.io`. The sandbox has no Docker, so the system tests
that start containers do not run in it; the stage `verify` waits for the check `verify` of the pull request instead.

### Sandboxes

An agent that declares `sandbox` runs in a container of the
[docker sandbox adapter](../adapters/sandbox/docker/README.md), on its own network whose only way out is its egress
proxy ([ADR 0096](../docs/decisions/0096-agents-in-sandboxes-in-the-profile.md)). The proxy also joins the profile's
network, so a sandbox whose `egress` allows `litellm` reaches the gateway, and nothing else of the profile. The image
`ghcr.io/sesigl/open-software-factory/harness-claude-code`, which `agent-template` pulls or builds, is the template
with the harness adapter, `gh`, Git and `make`. Git takes its token from `gh` and commits as `factory`.

Every agent of the reference factory runs in such a sandbox:

- It reaches `litellm` with its run's own key, GitHub, and the package registries of npm, PyPI, Go and crates.io.
  Every other host is refused. Add the hosts that your repositories' builds need to `egress` in `factory.yaml`.
- It gets `GH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN` as placeholders. foreman holds the real values as
  `OSF_SECRET_GH_TOKEN` and `OSF_SECRET_CLAUDE_CODE_OAUTH_TOKEN`, and only the sandbox's egress proxy gets them; it
  puts them in on the way to the hosts of `egress`. The agent never sees a token of foreman or the master key of
  `litellm`.
- `FACTORY_GIT_NAME` and `FACTORY_GIT_EMAIL` apply only to an agent without a sandbox.

foreman has no Docker socket. It reaches the Docker API through `docker-proxy`
([wollomatic/socket-proxy](https://github.com/wollomatic/socket-proxy)), which holds the host's socket read-only,
answers only foreman, allows only the API paths that the adapter calls, and refuses every bind mount. A request it
refuses gets `403 Forbidden`. It does not read the rest of a request, so a compromised foreman can still start a
privileged container: the proxy narrows what foreman can do, it does not make foreman safe to expose.

Each agent of the reference factory names its effort level ([ADR 0078](../docs/decisions/0078-agent-effort.md)):
`high` for triage and ship, which need a small model, and `medium` for spec, implement and review, which need a smart
one. Point the routes in `compose/litellm/config.yaml` at models of those sizes. When you change a route to a model of
the other size, change the agent's `effort` too.

The stage verify has `evidence: required`: it fails until a proof evidence bundle is attached to its pull request
([ADR 0088](../docs/decisions/0088-evidence-check.md)). Run proof in the target repository's CI after its tests,
with [proof's GitHub Action](../modules/proof/README.md#github-action) on the JUnit or Playwright reports.

The stage verify has `wait: true` ([ADR 0107](../docs/decisions/0107-a-stage-that-only-waits.md)): it runs no agent
and only waits for its checks and its evidence, with no model call and no new commit.

### A paid run of the reference factory

The workflow [`paid-reference-run.yml`](../.github/workflows/paid-reference-run.yml) runs the implement stage of
the reference factory, from the branch you name, on one issue of a tiny sample repository with a paid model on
OpenRouter. Only a maintainer or an admin of this repository starts it:
`gh workflow run paid-reference-run.yml -f ref=<branch>`. It costs about 0.01 to 0.05 USD and stops at 0.50 USD
([ADR 0128](../docs/decisions/0128-paid-reference-run.md)).

### The improvement path

`docker compose --profile improve up --detach` adds the service `improve` ([ADR 0123](../docs/decisions/0123-cost-and-scores-in-the-console.md)).
Every `IMPROVE_INTERVAL` seconds it copies the run record of each stage that foreman exported into the volume
`improve`, and writes the reports of `scorekit report`, `ledger report` and `observer analyze` into its folder
`reports`. The console's `/improvement` reads that volume and shows each run's cost per stage. Judging runs is a paid
model call through `litellm`, so `scorekit score` runs only for the scorers you name in `IMPROVE_SCORERS`. A stage in a
sandbox keeps its run record in the sandbox for now, so the reference factory's stages do not show there yet.

## Configuration

`compose.yaml` reads these values from `compose/.env` or the environment. It refuses to start without a required one
and names it, like `set FOREMAN_API_TOKEN in .env`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | | Required. The password of the user `osf`, whom every service connects as. |
| `LITELLM_MASTER_KEY` | | Required. The admin key of LiteLLM, starting with `sk-`. |
| `FOREMAN_API_TOKEN` | | Required. The token of foreman's API; console sends it. |
| `INTAKE_API_TOKEN` | | Required. The token of intake's API; console sends it. |
| `GATEKEEPER_API_TOKEN` | | Required. The token of gatekeeper's API; foreman and console send it. |
| `OSF_OPENBAO_UNSEAL_KEY` | | Required; `osf init` generates it. 32 bytes as 64 hex digits, with which OpenBao unseals the volume `openbao` at every start. Never change it for a volume that holds data. |
| `OSF_OPENBAO_ROOT_TOKEN` | | Required; `osf init` generates it. The ID of OpenBao's root token, which only `openbao` and `openbao-setup` get. |
| `OSF_OPENBAO_CONSOLE_TOKEN`, `OSF_OPENBAO_EGRESS_TOKEN` | | Required; `osf init` generates them. The IDs of the console's token, which stores and deletes values and cannot read one, and of the token with which foreman and the sandboxes' egress proxies only read. |
| `OSF_OPENBAO_MOUNT` | `secret` | The KV version 2 mount of the factory's secrets in OpenBao. |
| `GATEKEEPER_SLACK_CHANNEL` | | The ID of the Slack channel where gatekeeper asks, like `C0GATES`. Set it, `GATEKEEPER_FORGE_TOKEN` or both. |
| `GATEKEEPER_SLACK_TOKEN` | | With a Slack channel: the bot token of gatekeeper's Slack app. |
| `GATEKEEPER_SLACK_SIGNING_SECRET` | | With a Slack channel: the signing secret of gatekeeper's Slack app. |
| `GATEKEEPER_FORGE_TOKEN` | | A token that may comment on pull requests, set their commit status and read their checks (on GitHub: `Checks: read`, since the forge adapter's `pr` lists the check runs). Set: a gate request that links a pull request is asked on it, and decided by `/approve` or `/reject` comments. |
| `FOREMAN_FORGE_TOKEN` | | A token that may read pull requests and their checks (on GitHub: commit statuses and `Checks: read`), for the verify stage's check `verify`. |
| `CLAUDE_CODE_OAUTH_TOKEN` | | A token of `claude setup-token`. Set: Claude Code runs on that person's subscription, and its calls still go through `litellm` with the run's key ([ADR 0080](../docs/decisions/0080-dogfood-on-a-subscription.md)). |
| `GH_TOKEN` | | A token with which the agents clone, push and open pull requests on github.com with `gh` and Git. |
| `FACTORY_GIT_NAME`, `FACTORY_GIT_EMAIL` | `factory`, `factory@localhost` | The author of the agents' commits. |
| `INTAKE_FORGE_ADAPTER` | `forge-github` | The forge adapter of intake's webhook: `forge-github` or `forge-forgejo`. |
| `INTAKE_WEBHOOK_SECRET` | | The secret that the forge signs its webhook deliveries with. Set: intake takes them at `/forge/events`, and an issue labeled `factory` becomes a work item. Empty: intake takes no forge webhooks. |
| `FACTORY_DIR` | `./factory` | The folder of the factory definition, its prompts, policy and groups. |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | The host's Docker socket, which only `docker-proxy` mounts. For rootless Docker, like `$XDG_RUNTIME_DIR/docker.sock`. |
| `OSF_HOST` | `127.0.0.1` | The address every published port listens on. `0.0.0.0` makes them reachable from other machines. |
| `CONSOLE_PORT` | `8080` | The port of the console. `0` picks a free port, but not with the sign-in: its callback names the port. |
| `CONSOLE_SIGN_IN` | | The console's own sign-in: `oidc` (Google, a company's provider) or `github`. Empty: the console is open and read-only. See [Turn on the sign-in](#turn-on-the-sign-in). |
| `CONSOLE_SESSION_SECRET` | | With the sign-in: the key of the session cookie; `osf init` generates it. |
| `CONSOLE_OIDC_ISSUER`, `CONSOLE_OIDC_CLIENT_ID`, `CONSOLE_OIDC_CLIENT_SECRET` | | With `CONSOLE_SIGN_IN=oidc`: the provider's issuer, like `https://accounts.google.com`, and the client's ID and secret. |
| `CONSOLE_GITHUB_CLIENT_ID`, `CONSOLE_GITHUB_CLIENT_SECRET` | | With `CONSOLE_SIGN_IN=github`: the client ID and secret of a GitHub OAuth app. |
| `CONSOLE_URL` | `http://localhost:<CONSOLE_PORT>` | Where people open the console. The provider's callback is `<CONSOLE_URL>/signin/callback`. With the sign-in it must be `https://` or loopback. |
| `INTAKE_PORT` | `8081` | The port of intake, for the webhooks of Slack, the forge and Sentry. |
| `GATEKEEPER_PORT` | `8082` | The port of gatekeeper, for Slack's events and buttons. |
| `FOREMAN_PORT` | `8083` | The port of foreman's API. |
| `TEMPORAL_UI_PORT` | `8233` | The port of the Temporal UI. |
| `JAEGER_PORT` | `16686` | The port of Jaeger's UI. |
| `LITELLM_PORT` | `4000` | The port of LiteLLM. |
| `IMPROVE_INTERVAL` | `3600` | With the profile `improve`: the seconds between the runs of the improvement jobs. `0` runs them once. |
| `IMPROVE_SCORERS` | | With the profile `improve`: the scorers of scorekit that judge each run, like `redundant-tests scope-creep`. Each judgment is a paid model call. Empty: no run is judged. |
| `OSF_BUILD_CA` | `../images/no-ca.pem` | Behind a proxy that inspects TLS: the proxy's CA for npm in the image builds, as a path inside `deploy/`, like `../images/local-ca.pem`. |

### Turn on the sign-in

The console signs people in itself when `CONSOLE_SIGN_IN` names the provider
([ADR 0134](../docs/decisions/0134-console-sign-in-roles-and-modes.md)). Every page then needs a session, and only the
people of the factory's `access.yaml` get past the sign-in page; anyone else reads that they are not on the list. On
a laptop:

1. Register the console at the provider, with the callback `http://localhost:8080/signin/callback` (with another
   `CONSOLE_PORT`, that port):
   - Google: in the Google Cloud console, APIs & Services → Credentials → Create credentials → OAuth client ID, of the
     type "Web application", with the callback as an authorized redirect URI.
   - GitHub: Settings → Developer settings → OAuth Apps → New OAuth App, with the homepage `http://localhost:8080` and
     the callback as the authorization callback URL.
2. Set in `.env`:

   ```sh
   CONSOLE_SIGN_IN=oidc                            # or github
   CONSOLE_OIDC_ISSUER=https://accounts.google.com
   CONSOLE_OIDC_CLIENT_ID=...
   CONSOLE_OIDC_CLIENT_SECRET=...
   # with github instead: CONSOLE_GITHUB_CLIENT_ID=... and CONSOLE_GITHUB_CLIENT_SECRET=...
   ```

   `osf init` generated `CONSOLE_SESSION_SECRET`; without it, set it to a long random value, like the output of
   `openssl rand -hex 32`.
3. List yourself in the factory's `access.yaml` in place of `admin@example.com`, with the email that your provider
   verified (on GitHub, your primary email):

   ```yaml
   version: 1
   people:
     - email: ada@acme.dev
       role: admin
   ```

4. Run `docker compose up --detach --wait` again, open http://localhost:8080 and sign in.

`osf up` names each setting that the provider still needs. The console does not start without one, and
`docker compose logs console` names it. With the sign-in on, `console doctor` also checks `sign-in`, that the
provider's discovery answers (with `oidc`), and `access`, that `access.yaml` has an admin who is not
`admin@example.com`.

Open the console on `localhost`, not `127.0.0.1`: a browser sends the cookie of a host to every port of that host,
and Jaeger, LiteLLM and the Temporal UI stay on `OSF_HOST`, `127.0.0.1`, so they never get the session cookie. The
console sends a request for another host to `CONSOLE_URL` first. Whoever may write to the factory's repository can
make themselves `admin`, and `access.yaml` holds emails: keep that repository private. On a private network, put a TLS
proxy in front of the console and set `CONSOLE_URL` to its `https://` address; with the sign-in on, the console does
not start on an address that is neither `https://` nor loopback.

### Secrets in OpenBao

An agent that declares a secret `ref:openbao/<name>` gets its value from the service `openbao`
([ADR 0145](../docs/decisions/0145-openbao-in-the-compose-profile-and-the-chart.md)). An admin stores it on the
console's page `/secrets`, which needs [the sign-in](#turn-on-the-sign-in); the factory's `factory.yaml` declares
`providers.secrets.openbao`. A new value takes effect in the stages that start after you save it; nothing restarts,
and `.env` does not change. The egress proxy sends it only to the hosts that the agent may reach, in place of a
placeholder in an HTTP request, so a secret that is not sent in one, like an SSH key or a database password, does not
work this way. `GH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN` of the reference factory stay in `.env`.

- **Set up by itself.** On its first start OpenBao initializes itself and gives its root token the ID
  `OSF_OPENBAO_ROOT_TOKEN`; at every start it unseals itself with `OSF_OPENBAO_UNSEAL_KEY`. Then `openbao-setup`
  writes the policies of `secrets-openbao`, enables the mount, and makes the console's and the egress proxy's tokens
  new with their IDs of `.env`. `docker compose logs openbao-setup` shows how long they live. The console and foreman
  start after it; `docker compose up --detach --wait openbao-setup` alone returns while the job still runs, so
  follow it with `docker compose wait openbao-setup`.
- **The tokens live 768 hours (32 days)** from each `docker compose up`, OpenBao's maximum. `console doctor` and the
  page `/health` warn 7 days before the console's token ends; run `docker compose up --detach --wait` to make both new.
- **The audit log** is `/openbao/file/audit.log` on the volume, one JSON line per request and answer, each value as an
  HMAC: `docker compose exec openbao tail /openbao/file/audit.log`. It grows without rotation.
- **An operator's commands** run in the service with the root token of `.env`, which the service holds for its first
  start: `docker compose exec openbao sh -c 'BAO_TOKEN=$OSF_OPENBAO_ROOT_TOKEN bao kv list secret'`.
  OpenBao listens only on the profile's network.

**Back up the volume and the key together.** The volume `openbao` holds the values, encrypted with
`OSF_OPENBAO_UNSEAL_KEY`; neither is any use without the other, and a lost key loses every value. Keep `.env`, with the
key and the three tokens, in your safe, never in Git. To back up, stop OpenBao for a moment and copy its volume:

```sh
docker compose stop openbao
docker run --rm -v osf_openbao:/data:ro -v "$PWD":/backup alpine tar -czf /backup/openbao.tar.gz -C /data .
docker compose up --detach --wait
```

To restore, put the archive into an empty volume `osf_openbao` the same way, with the `.env` of the backup. The
volume's name starts with the Compose project, `osf` unless you set another.

### Receive GitHub issues on your machine

GitHub cannot reach `127.0.0.1`. A webhook relay forwards its deliveries to intake. [smee.io](https://smee.io) is
free and keeps the same URL:

1. Open https://smee.io/new and copy the channel URL.
2. Set `INTAKE_WEBHOOK_SECRET` in `.env` to a long random value, like the output of `openssl rand -hex 32`.
3. In the repository on GitHub, open Settings → Webhooks → Add webhook. Set the payload URL to the channel URL, the
   content type to `application/json`, the secret to the value of `INTAKE_WEBHOOK_SECRET`, and select only the event
   "Issues".
4. Start intake and the relay:

   ```sh
   docker compose up --detach --wait intake
   npx smee-client --url <channel URL> --target http://127.0.0.1:8081/forge/events
   ```

5. Add the label `factory` to an issue. Its work item is at
   `GET http://127.0.0.1:8081/v1/work-items?dedupeKey=<link of the issue>`, with the header
   `Authorization: Bearer <INTAKE_API_TOKEN>`.

intake receives work only while the relay runs. To send a delivery that failed again, use "Redeliver" on the webhook's
page "Recent Deliveries".

For a URL that does not depend on a relay, see [Give intake a public URL](../docs/how-to/public-intake.md).

## Helm chart

The chart `osf` installs LiteLLM, gatekeeper, intake, foreman and console with the reference factory on Kubernetes.
PostgreSQL with pgvector, NATS and Temporal are in the chart, so one command installs a complete factory; a platform
team turns each off and names its own. LiteLLM takes the model routes of the profile, and its Service is `litellm`,
the address of the reference factory's `inference/litellm.yaml`, so install one release per namespace. You need Helm
3.8 or later, and agent-sandbox in the cluster for the agents' sandboxes (below).

```sh
cat > values.yaml <<'YAML'
secrets:
  postgresPassword: change-me
  foremanApiToken: change-me
  intakeApiToken: change-me
  gatekeeperApiToken: change-me
  gatekeeperSlackToken: xoxb-change-me     # Slack, a forge token or both, as in the Compose profile
  gatekeeperSlackSigningSecret: change-me
  forgeToken: change-me               # gatekeeper asks on the run's pull request; foreman reads its checks
  litellmMasterKey: sk-change-me
  githubToken: change-me            # GH_TOKEN of the agents
  claudeCodeOauthToken: change-me   # a token of `claude setup-token`
YAML
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v1.0.8/sandbox-with-extensions.yaml
helm install osf oci://ghcr.io/sesigl/open-software-factory/charts/osf --values values.yaml --wait --timeout 10m
helm test osf --logs          # plans the factory definition with factory-spec
kubectl port-forward service/osf-console 8080:8080
```

Then open http://localhost:8080. To [turn on the sign-in](#turn-on-the-sign-in), register the same callback
`http://localhost:8080/signin/callback`, list yourself in the factory's `access.yaml`, make a Secret with the session
key and the client's secret, and name it in the values; the chart never holds either value:

```sh
kubectl create secret generic osf-sign-in \
  --from-literal=session-secret="$(openssl rand -hex 32)" --from-literal=client-secret=<the client's secret>
cat >> values.yaml <<'YAML'
console:
  signIn:
    provider: oidc                        # or github, without issuer
    issuer: https://accounts.google.com
    clientId: <the client's ID>
    secret: osf-sign-in
YAML
```

From a clone, install `deploy/helm/osf` instead of the OCI address. Object storage, Langfuse and OpenBao are installed
with their own charts; no module uses them yet, so the chart has no wiring for them.

### Sandboxes on Kubernetes

Each stage of the reference factory runs in a sandbox of the
[kubernetes sandbox adapter](../adapters/sandbox/kubernetes/README.md): a pod of
[agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox), whose only way out is its egress pod
([ADR 0097](../docs/decisions/0097-agents-in-sandboxes-in-the-chart.md)).

- **Prerequisites.** agent-sandbox v1.0.8 with its extensions, and a network plugin that enforces NetworkPolicies.
  Without agent-sandbox, the chart installs, but every stage fails when it starts its sandbox.
- **A namespace of their own.** The sandboxes run in `<release namespace>-sandboxes`, or `sandboxes.namespace`, which
  the chart creates unless `sandboxes.createNamespace` is `false` (ADR 0055).
- **foreman's rights.** foreman's ServiceAccount has a Role in that namespace only: it applies, reads and deletes the
  objects of a sandbox (claims, templates, warm pools, pods, services, config maps, secrets and volume claims), runs
  `exec` in their pods and reads the egress pod's log. It reads no Secret of the release namespace.
- **The gateway.** In the sandboxes' namespace, the Service `litellm` is a name for the chart's LiteLLM, so a sandbox
  whose `egress` allows `litellm` reaches it with the run's own key, as in the Compose profile.
- **The tokens.** `secrets.githubToken` and `secrets.claudeCodeOauthToken` are the secrets `ref:env/GH_TOKEN` and
  `ref:env/CLAUDE_CODE_OAUTH_TOKEN` of the reference factory's agents. Only each sandbox's egress pod gets them; the
  agent holds a placeholder.

### OpenBao on Kubernetes

The chart installs no OpenBao ([ADR 0075](../docs/decisions/0075-helm-chart-and-images.md),
[ADR 0145](../docs/decisions/0145-openbao-in-the-compose-profile-and-the-chart.md)): it takes your team's. Its
operator makes a KV version 2 mount for the factory, the two policies that `secrets-openbao` prints for that mount,
and a token of each, then puts the tokens into a Secret of the release's namespace:

```sh
export BAO_ADDR=https://bao.acme.dev OSF_OPENBAO_MOUNT=factory
bao secrets enable -path=factory -version=2 kv
npx @opensoftware/secrets-openbao@0.1.0 policy write | bao policy write osf-console -
npx @opensoftware/secrets-openbao@0.1.0 policy read | bao policy write osf-egress -
kubectl create secret generic osf-openbao \
  --from-literal=console-token="$(bao token create -orphan -policy=osf-console -field=token)" \
  --from-literal=egress-token="$(bao token create -orphan -policy=osf-egress -field=token)"
```

Then set `openbao.address`, `openbao.mount: factory` and `openbao.secret: osf-openbao`. The console's token writes,
lists and deletes values and cannot read one; the egress token only reads. Your OpenBao decides how long a token
lives (768 hours by default): `console doctor` warns 7 days before the console's token ends. The sandboxes' egress pods
in the sandboxes' namespace must reach the address.

### Helm values

| Value | Default | Meaning |
| --- | --- | --- |
| `secrets.existingSecret` | | A Secret with the keys `postgres-password`, `foreman-api-token`, `intake-api-token`, `gatekeeper-api-token`, `litellm-master-key` and, optional, `gatekeeper-slack-token` and `gatekeeper-slack-signing-secret` (with `gatekeeper.slackChannel`), `forge-token`, `github-token` and `claude-code-oauth-token`, for example filled from OpenBao by its operator or the External Secrets Operator. Set, the chart makes no Secret. |
| `secrets.postgresPassword` | | Required without `existingSecret`. The password of the database user; it goes into URLs, so use letters, digits, `-` and `_`. |
| `secrets.foremanApiToken`, `secrets.intakeApiToken`, `secrets.gatekeeperApiToken` | | Required without `existingSecret`. The API tokens of foreman, intake and gatekeeper. |
| `secrets.gatekeeperSlackToken`, `secrets.gatekeeperSlackSigningSecret` | | The bot token and signing secret of gatekeeper's Slack app. Set them, `secrets.forgeToken` or both; without either the chart names the three. Without them gatekeeper asks on pull requests only. |
| `secrets.litellmMasterKey` | | Required without `existingSecret`. The master key of LiteLLM, like `sk-<random>`; foreman makes each run's key with it. |
| `secrets.forgeToken` | | gatekeeper's and foreman's forge token: gatekeeper asks on the run's pull request, foreman reads its checks. On GitHub it needs `Pull requests: write`, `Commit statuses: write` and `Checks: read`. |
| `secrets.githubToken`, `secrets.claudeCodeOauthToken` | | The agents' `GH_TOKEN` and the token of `claude setup-token`, which only each sandbox's egress pod gets. Without them, a stage that needs them fails. |
| `sandboxes.namespace` | `<release namespace>-sandboxes` | The namespace of the agents' sandboxes, where foreman has its rights. |
| `sandboxes.createNamespace` | `true` | `false` when the namespace exists, or the installer may not create namespaces. |
| `sandboxes.clusterDomain` | `cluster.local` | The cluster's DNS domain, for the name `litellm` in the sandboxes' namespace. |
| `litellm.image`, `litellm.resources` | the pin of `compose.yaml` | The LLM gateway's image and its resources. |
| `images.registry` | `ghcr.io/sesigl/open-software-factory` | Where the module images come from. |
| `images.gatekeeper`, `images.intake`, `images.foreman`, `images.console`, `images.factorySpec`, `images.observer` | the pins of `compose.yaml` | The tags of the module images; `observer` is the image of the improvement jobs, with scorekit and ledger. |
| `factory.files` | the reference factory | Your factory definition as path: content, like `factory.yaml: "version: 1 ..."`. foreman commits it into Git with a fixed author and date. |
| `gatekeeper.slackChannel` | `C0GATES` | The Slack channel where gatekeeper asks, with the Slack secrets. With `existingSecret`, empty turns Slack off. |
| `foreman.harnesses`, `foreman.forges` | claude-code; github and forgejo | foreman's `FOREMAN_HARNESSES` and `FOREMAN_FORGES`. |
| `foreman.persistence.size` | `1Gi` | The volume of the runs' working folders. |
| `console.temporalUrl`, `console.links` | | The Temporal UI and the dashboards the console links, like `Langfuse=https://langfuse.acme.dev`. |
| `console.signIn.provider` | | The console's own sign-in, `oidc` or `github` ([ADR 0134](../docs/decisions/0134-console-sign-in-roles-and-modes.md)); only the people of the factory's `access.yaml` sign in. Empty: the console is open and read-only. |
| `console.signIn.url` | the console's own, `http://localhost:8080` | Where people open the console, its `CONSOLE_URL`; the provider's callback is `<url>/signin/callback`. Empty, the chart sets no `CONSOLE_URL`; the default suits `kubectl port-forward`. Behind an Ingress with TLS, its `https://` address. |
| `console.signIn.issuer`, `console.signIn.clientId` | | With `oidc` the provider's issuer; the client ID of the provider's client or of the GitHub OAuth app. |
| `console.signIn.secret` | | Required with a provider: a Secret you make, with the keys `session-secret`, the key of the session cookie, and `client-secret`, the client's secret. |
| `openbao.address` | | Your team's OpenBao, like `https://bao.acme.dev`, as the console, foreman and the sandboxes' egress pods reach it; the chart installs none. Set, the console has `/secrets` and foreman checks a stage's secrets `ref:openbao/<name>` (see [OpenBao on Kubernetes](#openbao-on-kubernetes)). Empty: no setting of OpenBao. |
| `openbao.mount` | `secret` | The KV version 2 mount of the factory's secrets. |
| `openbao.secret` | | Required with an address: a Secret you make, with the keys `console-token`, the console's token with the policy of `secrets-openbao policy write`, and `egress-token`, the token with the policy of `secrets-openbao policy read`. |
| `improve.enabled` | `false` | The CronJob `improve` with the commands of the Compose service `improve`, and the claim `osf-improve` that the console's `/improvement` reads. Its pod and the console then run on foreman's node, as the claims are ReadWriteOnce. |
| `improve.schedule`, `improve.scorers`, `improve.persistence.size`, `improve.resources` | `17 * * * *`, empty, `1Gi` | When the job runs, the scorers that judge each run (each judgment is a paid model call; empty: none), its claim's size and its resources. |
| `postgresql.enabled` | `true` | PostgreSQL with pgvector in the cluster. `false` uses `externalDatabase`. |
| `externalDatabase.host`, `.port`, `.user`, `.adminDatabase` | `5432`, `osf`, `postgres` | A managed PostgreSQL. Each pod creates its database when it is missing (gatekeeper, intake, temporal, temporal_visibility), so the user needs `CREATEDB`, or create them yourself. |
| `nats.enabled`, `externalNats.url` | `true` | NATS with JetStream in the cluster, or the team's own. |
| `natsStreamMaxAge` | `7d` | How long the stream `OSF` keeps an event, a dead letter too; intake and foreman set it ([ADR 0116](../docs/decisions/0116-events-not-lost-without-a-trace.md)). |
| `temporal.enabled`, `externalTemporal.address` | `true` | Temporal on the PostgreSQL above, or the team's own. |
| `temporalNamespace` | `default` | The Temporal namespace of the runs; foreman creates it when it is missing. |

The chart's scenarios run on kind with agent-sandbox. To run them on your machine, start kind with agent-sandbox and
load the chart's images first:

```sh
.tools/bin/kind create cluster
kubectl apply -f .tools/bin/agent-sandbox.yaml
deploy/helm/kind-images.sh    # pulls or builds the images of compose.yaml, then loads the chart's images
make test-scenario ID=SCN-DIST-019
```

## Releases

Each release moves the pins of `compose/compose.yaml` and `helm/osf/` to the released versions: the release workflow
runs `osf profile-pins` in the release pull request ([ADR 0095](../docs/decisions/0095-profile-pins-move-with-releases.md)).
The workflow `publish-images` publishes after each change to `compose/compose.yaml`, `images/` or `helm/osf/` on
`main`, once npm serves the packages of the pins. It builds every module image whose tag GHCR does not have yet for `linux/amd64` and `linux/arm64`, with an SBOM
and SLSA provenance attached by BuildKit, and signs it with cosign through the workflow's GitHub identity. A tag never
changes: a new adapter pin without a new module version takes the tag `<version>-r<n>`. The chart goes to
`oci://ghcr.io/sesigl/open-software-factory/charts/osf` at the version in `helm/osf/Chart.yaml`, signed the same way;
change the version with the chart.

Verify an image, and read its SBOM and provenance:

`<tag>` is the tag of the image in `compose/compose.yaml`.

```sh
cosign verify ghcr.io/sesigl/open-software-factory/foreman:<tag> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/sesigl/open-software-factory/'
docker buildx imagetools inspect ghcr.io/sesigl/open-software-factory/foreman:<tag> --format '{{ json .SBOM }}'
docker buildx imagetools inspect ghcr.io/sesigl/open-software-factory/foreman:<tag> --format '{{ json .Provenance }}'
```

One-time setup: GHCR makes each new package private. After the first run, the owner opens each package under the
repository's Packages and sets its visibility to public, like the first npm release of a module.

### Licenses of the images

The label `org.opencontainers.image.licenses` of each image names its license.

| Image | License | What the image holds |
| --- | --- | --- |
| The module images and the agents' templates | Apache-2.0, as this repository | The packages of this repository from npm, and their dependencies |
| `litellm` | MIT, LiteLLM's license | BerriAI's image of LiteLLM, with compiled bytecode ([ADR 0098](../docs/decisions/0098-litellm-image-with-bytecode.md)) and without BerriAI's enterprise code, which has a license of its own (`SCN-DIST-027`, [ADR 0102](../docs/decisions/0102-litellm-image-without-enterprise-code.md)) |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-DIST-001 | deprecated | Every service of the Compose profile is healthy after one command |
| SCN-DIST-002 | implemented | The Compose profile names the value that .env is missing |
| SCN-DIST-003 | implemented | The console of the Compose profile lists the runs of its foreman |
| SCN-DIST-004 | implemented | The console of the Compose profile shows the agents of the reference factory |
| SCN-DIST-005 | deprecated | The plan of the reference factory adds the factory and finds no problems |
| SCN-DIST-006 | implemented | After the reference factory is applied, its plan shows no changes |
| SCN-DIST-007 | deprecated | Every workload of the Helm chart is ready after one command |
| SCN-DIST-008 | implemented | The Helm chart names the secret that the values are missing |
| SCN-DIST-009 | implemented | The console of the Helm chart lists the runs of its foreman |
| SCN-DIST-010 | implemented | The console of the Helm chart shows the agents of the reference factory |
| SCN-DIST-011 | deprecated | The test of the Helm chart plans the reference factory without problems |
| SCN-DIST-012 | implemented | The verify stage of the reference factory waits for the check "verify" |
| SCN-DIST-013 | deprecated | The Compose profile takes the module images from the factory's registry |
| SCN-DIST-014 | implemented | The intake of the Compose profile turns a GitHub issue labeled "factory" into a work item |
| SCN-DIST-015 | implemented | The plan of this repository's factory adds the factory and finds no problems |
| SCN-DIST-016 | deprecated | Every service of the Compose profile is healthy after one command, and each server's health checks pass |
| SCN-DIST-017 | implemented | The foreman of the Compose profile starts a sandbox from the agents' template through docker-proxy only |
| SCN-DIST-018 | deprecated | The Compose profile takes the module images and the agents' template from the factory's registry |
| SCN-DIST-019 | implemented | Every workload of the Helm chart is ready after one command, the LLM gateway included |
| SCN-DIST-020 | implemented | The plan of the reference factory adds the factory and finds no problems, with its inference config |
| SCN-DIST-021 | implemented | The test of the Helm chart plans the reference factory without problems, with its inference config |
| SCN-DIST-022 | implemented | The foreman of the Helm chart starts a sandbox of agent-sandbox from the agents' template, with rights only in the sandboxes' namespace |
| SCN-DIST-023 | deprecated | The Compose profile takes the module images, the agents' template and the LLM gateway from the factory's registry |
| SCN-DIST-026 | implemented | Every service of the Compose profile is healthy after one command, Jaeger as the trace store, and each server's health checks pass |
| SCN-DIST-027 | implemented | The profile's LLM gateway holds no code under BerriAI's enterprise license |
| SCN-DIST-028 | implemented | The reference factory asks for approval of the spec after the stage "spec" and before "implement" |
| SCN-DIST-029 | implemented | The ship stage of the reference factory starts only when the checks "verify" and "proof" succeeded |
| SCN-DIST-030 | implemented | The ship stage of this repository's factory starts only when the checks "verify" and "proof" succeeded |
| SCN-DIST-031 | implemented | The verify stage of the reference factory only waits and runs no agent |
| SCN-DIST-032 | implemented | The verify stage of this repository's factory only waits and runs no agent |
| SCN-DIST-033 | implemented | The chart takes a forge token without Slack, and asks on pull requests only |
| SCN-DIST-034 | implemented | The service improve writes the reports of ledger and observer and judges no run without scorers |
| SCN-DIST-035 | implemented | The chart runs the improvement jobs as a CronJob on foreman's run records, without scorers by default |
| SCN-DIST-036 | implemented | The console of the Compose profile renders its health page from the templates its package ships |
| SCN-DIST-037 | implemented | With the sign-in on, the console of the Compose profile lets in only the people of the factory's access.yaml |
| SCN-DIST-038 | implemented | The chart switches the console's sign-in on with the client secret and the session key from a Secret the operator names |
| SCN-DIST-039 | implemented | The profile's OpenBao keeps a stored secret over a restart, unseals itself, and a sandbox still sends the value |
| SCN-DIST-040 | implemented | The chart gives the console and the foreman the team's own OpenBao with the two tokens from a Secret the operator names |
| SCN-DIST-041 | implemented | The Compose profile takes the module images, the agents' template and the LLM gateway from the factory's registry, and OpenBao from its own |
