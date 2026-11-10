---
covers: [deploy/compose/**, deploy/images/**, deploy/helm/**]
---

# deploy

Install a complete factory with one command. The Compose profile in [`compose/`](compose/compose.yaml) runs the
factory on one machine for one team: PostgreSQL with Temporal and pgvector, NATS, Jaeger, LiteLLM,
gatekeeper, intake, foreman and console, with the [reference factory](compose/factory/factory.yaml). The
[Helm chart](#helm-chart) in [`helm/osf/`](helm/osf/Chart.yaml) runs the same modules on Kubernetes for platform
teams. Decisions: [ADR 0074](../docs/decisions/0074-compose-profile.md),
[ADR 0075](../docs/decisions/0075-helm-chart-and-images.md).

## Quick start

You need Docker with Compose 2.24 or later.

```sh
cd deploy/compose
cp .env.example .env    # set the tokens, the database password, and Slack or a forge token for gatekeeper
docker compose up --detach --wait
docker compose run --rm console console doctor    # one line per check, and one fix per failure
docker compose run --rm factory plan
```

`console doctor` checks each server's health and token and the factory definition, in that order
([ADR 0086](../docs/decisions/0086-health-routes.md)). Then open the console at http://127.0.0.1:8080. `up` pulls the signed module images from GHCR; an image that is not
published yet, like one whose pin moved a moment ago, is built from npm, which takes a minute or two.

## What runs

| Service | What it is | Port on `OSF_HOST` |
| --- | --- | --- |
| `postgres` | PostgreSQL 17 with pgvector; one database per service, from `postgres/init.sql` | none |
| `temporal-schema` | one-shot: the Temporal schema in PostgreSQL | none |
| `temporal` | the Temporal server on PostgreSQL, configured by `temporal/config.yaml` | none |
| `temporal-namespace` | one-shot: the namespace `default` | none |
| `temporal-ui` | the history of every run | `TEMPORAL_UI_PORT`, 8233 |
| `nats` | NATS with JetStream for the events between the modules | none |
| `jaeger` | the trace store: the runs' traces from foreman, by OTLP, kept on the volume `jaeger` ([ADR 0100](../docs/decisions/0100-jaeger-trace-store.md)) | `JAEGER_PORT`, 16686 |
| `litellm` | the LLM gateway, configured by `litellm/config.yaml`: LiteLLM's image with its bytecode compiled, so it starts sooner ([ADR 0098](../docs/decisions/0098-litellm-image-with-bytecode.md)) | `LITELLM_PORT`, 4000 |
| `factory-repo` | one-shot: copies `FACTORY_DIR` into the volume `factory` and commits it | none |
| `gatekeeper` | approvals in Slack or on pull requests, with the policy and groups of the factory | `GATEKEEPER_PORT`, 8082 |
| `intake` | work from Slack, the forge and Sentry | `INTAKE_PORT`, 8081 |
| `docker-proxy` | the foreman's only way to the Docker API, for the agents' sandboxes; see [Sandboxes](#sandboxes) | none |
| `agent-template` | one-shot: puts the image `harness-claude-code` on this machine, the template of the agents' sandboxes | none |
| `foreman` | runs the factory's workflow on Temporal | `FOREMAN_PORT`, 8083 |
| `console` | the web view of the runs and the factory | `CONSOLE_PORT`, 8080 |
| `factory` | factory-spec for `docker compose run --rm factory <command>`; profile `tools` | none |

The module images are `ghcr.io/sesigl/open-software-factory/<module>:<version>`, built from
[`images/Dockerfile`](images/Dockerfile): Node 24, Git and the module with its adapters from npm, at the versions
`compose.yaml` pins. Compose pulls them, and builds one only when GHCR does not have it. A new release reaches the
profile with the release itself, as each release moves the pins. See [Releases](#releases) for how they are published
and verified.

## Your factory

The reference factory in `compose/factory/` has the stages triage, spec (behind a gate that a member of
`maintainers` approves in Slack), implement, review, verify (after the pull request's check `verify` succeeded, with
evidence) and ship. foreman reads that check with `FOREMAN_FORGE_TOKEN`. Its prompts work on any GitHub repository:
each stage clones the repository of the issue in the work item's origin, reads the repository's own `AGENTS.md`,
`CONTRIBUTING.md` and `README.md`, and runs the checks they name. Name your CI's check in the stage `verify` of
`factory.yaml` when it is not `verify`. To run your own, copy the
folder, change the prompts, `policy/spec.rego` and `groups.json`, and set `FACTORY_DIR` to it. Each
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
wait for the check `verify` and mark the pull request ready. The owner merges it. In `.env`:

```sh
FACTORY_DIR=../dogfood/factory
CLAUDE_CODE_OAUTH_TOKEN=...   # claude setup-token
GH_TOKEN=...                  # fine-grained: this repository only, Contents, Issues and Pull requests write
GATEKEEPER_FORGE_TOKEN=...    # the same token
FOREMAN_FORGE_TOKEN=...       # the same token
INTAKE_WEBHOOK_SECRET=...     # see "Receive GitHub issues on your machine"
```

foreman runs Claude Code without a sandbox: its agents see foreman's environment, with both tokens and the master key
of `litellm`. Run it on your own machine only.

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
| `GATEKEEPER_SLACK_CHANNEL` | | The ID of the Slack channel where gatekeeper asks, like `C0GATES`. Set it, `GATEKEEPER_FORGE_TOKEN` or both. |
| `GATEKEEPER_SLACK_TOKEN` | | With a Slack channel: the bot token of gatekeeper's Slack app. |
| `GATEKEEPER_SLACK_SIGNING_SECRET` | | With a Slack channel: the signing secret of gatekeeper's Slack app. |
| `GATEKEEPER_FORGE_TOKEN` | | A token that may comment on pull requests and set their commit status. Set: a gate request that links a pull request is asked on it, and decided by `/approve` or `/reject` comments. |
| `FOREMAN_FORGE_TOKEN` | | A token that may read pull requests and their checks, for the verify stage's check `verify`. |
| `CLAUDE_CODE_OAUTH_TOKEN` | | A token of `claude setup-token`. Set: Claude Code runs on that person's subscription, and its calls still go through `litellm` with the run's key ([ADR 0080](../docs/decisions/0080-dogfood-on-a-subscription.md)). |
| `GH_TOKEN` | | A token with which the agents clone, push and open pull requests on github.com with `gh` and Git. |
| `FACTORY_GIT_NAME`, `FACTORY_GIT_EMAIL` | `factory`, `factory@localhost` | The author of the agents' commits. |
| `INTAKE_FORGE_ADAPTER` | `forge-github` | The forge adapter of intake's webhook: `forge-github` or `forge-forgejo`. |
| `INTAKE_WEBHOOK_SECRET` | | The secret that the forge signs its webhook deliveries with. Set: intake takes them at `/forge/events`, and an issue labeled `factory` becomes a work item. Empty: intake takes no forge webhooks. |
| `FACTORY_DIR` | `./factory` | The folder of the factory definition, its prompts, policy and groups. |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | The host's Docker socket, which only `docker-proxy` mounts. For rootless Docker, like `$XDG_RUNTIME_DIR/docker.sock`. |
| `OSF_HOST` | `127.0.0.1` | The address every published port listens on. `0.0.0.0` makes them reachable from other machines. |
| `CONSOLE_PORT` | `8080` | The port of the console. `0` picks a free port. |
| `INTAKE_PORT` | `8081` | The port of intake, for the webhooks of Slack, the forge and Sentry. |
| `GATEKEEPER_PORT` | `8082` | The port of gatekeeper, for Slack's events and buttons. |
| `FOREMAN_PORT` | `8083` | The port of foreman's API. |
| `TEMPORAL_UI_PORT` | `8233` | The port of the Temporal UI. |
| `JAEGER_PORT` | `16686` | The port of Jaeger's UI. |
| `LITELLM_PORT` | `4000` | The port of LiteLLM. |
| `OSF_BUILD_CA` | `../images/no-ca.pem` | Behind a proxy that inspects TLS: the proxy's CA for npm in the image builds, as a path inside `deploy/`, like `../images/local-ca.pem`. |

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
  gatekeeperSlackToken: xoxb-change-me
  gatekeeperSlackSigningSecret: change-me
  litellmMasterKey: sk-change-me
  githubToken: change-me            # GH_TOKEN of the agents
  claudeCodeOauthToken: change-me   # a token of `claude setup-token`
YAML
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v1.0.8/sandbox-with-extensions.yaml
helm install osf oci://ghcr.io/sesigl/open-software-factory/charts/osf --values values.yaml --wait --timeout 10m
helm test osf --logs          # plans the factory definition with factory-spec
kubectl port-forward service/osf-console 8080:8080
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

### Helm values

| Value | Default | Meaning |
| --- | --- | --- |
| `secrets.existingSecret` | | A Secret with the keys `postgres-password`, `foreman-api-token`, `intake-api-token`, `gatekeeper-api-token`, `gatekeeper-slack-token`, `gatekeeper-slack-signing-secret`, `litellm-master-key` and, optional, `forge-token`, `github-token` and `claude-code-oauth-token`, for example filled from OpenBao by its operator or the External Secrets Operator. Set, the chart makes no Secret. |
| `secrets.postgresPassword` | | Required without `existingSecret`. The password of the database user; it goes into URLs, so use letters, digits, `-` and `_`. |
| `secrets.foremanApiToken`, `secrets.intakeApiToken`, `secrets.gatekeeperApiToken` | | Required without `existingSecret`. The API tokens of foreman, intake and gatekeeper. |
| `secrets.gatekeeperSlackToken`, `secrets.gatekeeperSlackSigningSecret` | | Required without `existingSecret`. The bot token and signing secret of gatekeeper's Slack app. |
| `secrets.litellmMasterKey` | | Required without `existingSecret`. The master key of LiteLLM, like `sk-<random>`; foreman makes each run's key with it. |
| `secrets.forgeToken` | | foreman's token for the checks of a pull request. |
| `secrets.githubToken`, `secrets.claudeCodeOauthToken` | | The agents' `GH_TOKEN` and the token of `claude setup-token`, which only each sandbox's egress pod gets. Without them, a stage that needs them fails. |
| `sandboxes.namespace` | `<release namespace>-sandboxes` | The namespace of the agents' sandboxes, where foreman has its rights. |
| `sandboxes.createNamespace` | `true` | `false` when the namespace exists, or the installer may not create namespaces. |
| `sandboxes.clusterDomain` | `cluster.local` | The cluster's DNS domain, for the name `litellm` in the sandboxes' namespace. |
| `litellm.image`, `litellm.resources` | the pin of `compose.yaml` | The LLM gateway's image and its resources. |
| `images.registry` | `ghcr.io/sesigl/open-software-factory` | Where the module images come from. |
| `images.gatekeeper`, `images.intake`, `images.foreman`, `images.console`, `images.factorySpec` | the pins of `compose.yaml` | The tags of the module images. |
| `factory.files` | the reference factory | Your factory definition as path: content, like `factory.yaml: "version: 1 ..."`. foreman commits it into Git with a fixed author and date. |
| `gatekeeper.slackChannel` | `C0GATES` | The Slack channel where gatekeeper asks. |
| `foreman.harnesses`, `foreman.forges` | claude-code; github and forgejo | foreman's `FOREMAN_HARNESSES` and `FOREMAN_FORGES`. |
| `foreman.persistence.size` | `1Gi` | The volume of the runs' working folders. |
| `console.temporalUrl`, `console.links` | | The Temporal UI and the dashboards the console links, like `Langfuse=https://langfuse.acme.dev`. |
| `postgresql.enabled` | `true` | PostgreSQL with pgvector in the cluster. `false` uses `externalDatabase`. |
| `externalDatabase.host`, `.port`, `.user`, `.adminDatabase` | `5432`, `osf`, `postgres` | A managed PostgreSQL. Each pod creates its database when it is missing (gatekeeper, intake, temporal, temporal_visibility), so the user needs `CREATEDB`, or create them yourself. |
| `nats.enabled`, `externalNats.url` | `true` | NATS with JetStream in the cluster, or the team's own. |
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
| `litellm` | MIT, LiteLLM's license | BerriAI's image of LiteLLM, with compiled bytecode ([ADR 0098](../docs/decisions/0098-litellm-image-with-bytecode.md)) |

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
| SCN-DIST-023 | implemented | The Compose profile takes the module images, the agents' template and the LLM gateway from the factory's registry |
| SCN-DIST-026 | implemented | Every service of the Compose profile is healthy after one command, Jaeger as the trace store, and each server's health checks pass |
