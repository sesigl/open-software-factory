---
covers: [deploy/compose/**, deploy/images/**, deploy/helm/**]
---

# deploy

Install a complete factory with one command. The Compose profile in [`compose/`](compose/compose.yaml) runs the
factory on one machine for one team: PostgreSQL with Temporal and pgvector, SeaweedFS, NATS, Phoenix, LiteLLM,
gatekeeper, intake, foreman and console, with the [reference factory](compose/factory/factory.yaml). The
[Helm chart](#helm-chart) in [`helm/osf/`](helm/osf/Chart.yaml) runs the same modules on Kubernetes for platform
teams. Decisions: [ADR 0074](../docs/decisions/0074-compose-profile.md),
[ADR 0075](../docs/decisions/0075-helm-chart-and-images.md).

## Quick start

You need Docker with Compose 2.24 or later.

```sh
cd deploy/compose
cp .env.example .env    # set every value: the tokens, the database password and the Slack app of gatekeeper
docker compose up --detach --wait
docker compose run --rm factory plan
```

Then open the console at http://127.0.0.1:8080. `up` pulls the signed module images from GHCR; an image that is not
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
| `seaweedfs` | object storage with the S3 API, for evidence | none |
| `phoenix` | the trace store, on PostgreSQL | `PHOENIX_PORT`, 6006 |
| `litellm` | the LLM gateway, configured by `litellm/config.yaml` | `LITELLM_PORT`, 4000 |
| `factory-repo` | one-shot: copies `FACTORY_DIR` into the volume `factory` and commits it | none |
| `gatekeeper` | approvals in Slack, with the policy and groups of the factory | `GATEKEEPER_PORT`, 8082 |
| `intake` | work from Slack, the forge and Sentry | `INTAKE_PORT`, 8081 |
| `foreman` | runs the factory's workflow on Temporal | `FOREMAN_PORT`, 8083 |
| `console` | the web view of the runs and the factory | `CONSOLE_PORT`, 8080 |
| `factory` | factory-spec for `docker compose run --rm factory <command>`; profile `tools` | none |

The module images are `ghcr.io/sesigl/open-software-factory/<module>:<version>`, built from
[`images/Dockerfile`](images/Dockerfile): Node 24, Git and the module with its adapters from npm, at the versions
`compose.yaml` pins. Compose pulls them, and builds one only when GHCR does not have it. A new release reaches the
profile when its pin moves. See [Releases](#releases) for how they are published and verified.

## Your factory

The reference factory in `compose/factory/` has the stages triage, spec (behind a gate that a member of
`maintainers` approves in Slack), implement, review, verify (after the pull request's check `verify` succeeded, with
evidence) and ship. foreman reads that check with `FOREMAN_FORGE_TOKEN`. To run your own, copy the
folder, change the prompts, `policy/spec.rego` and `groups.json`, and set `FACTORY_DIR` to it. Each
`docker compose up` commits the folder into the volume `factory`, so a run's factory version is a commit. Add your
models to `compose/litellm/config.yaml`, with their keys in `.env`.

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
| `GATEKEEPER_SLACK_TOKEN` | | Required. The bot token of gatekeeper's Slack app. |
| `GATEKEEPER_SLACK_SIGNING_SECRET` | | Required. The signing secret of gatekeeper's Slack app. |
| `GATEKEEPER_SLACK_CHANNEL` | | Required. The ID of the Slack channel where gatekeeper asks, like `C0GATES`. |
| `FOREMAN_FORGE_TOKEN` | | A token that may read pull requests and their checks, for the verify stage's check `verify`. |
| `INTAKE_FORGE_ADAPTER` | `forge-github` | The forge adapter of intake's webhook: `forge-github` or `forge-forgejo`. |
| `FACTORY_DIR` | `./factory` | The folder of the factory definition, its prompts, policy and groups. |
| `OSF_HOST` | `127.0.0.1` | The address every published port listens on. `0.0.0.0` makes them reachable from other machines. |
| `CONSOLE_PORT` | `8080` | The port of the console. `0` picks a free port. |
| `INTAKE_PORT` | `8081` | The port of intake, for the webhooks of Slack, the forge and Sentry. |
| `GATEKEEPER_PORT` | `8082` | The port of gatekeeper, for Slack's events and buttons. |
| `FOREMAN_PORT` | `8083` | The port of foreman's API. |
| `TEMPORAL_UI_PORT` | `8233` | The port of the Temporal UI. |
| `PHOENIX_PORT` | `6006` | The port of Phoenix. |
| `LITELLM_PORT` | `4000` | The port of LiteLLM. |
| `OSF_BUILD_CA` | `../images/no-ca.pem` | Behind a proxy that inspects TLS: the proxy's CA for npm in the image builds, as a path inside `deploy/`, like `../images/local-ca.pem`. |

## Helm chart

The chart `osf` installs gatekeeper, intake, foreman and console with the reference factory on Kubernetes. PostgreSQL
with pgvector, NATS and Temporal are in the chart, so one command installs a complete factory; a platform team turns
each off and names its own. You need Helm 3.8 or later.

```sh
cat > values.yaml <<'YAML'
secrets:
  postgresPassword: change-me
  foremanApiToken: change-me
  intakeApiToken: change-me
  gatekeeperApiToken: change-me
  gatekeeperSlackToken: xoxb-change-me
  gatekeeperSlackSigningSecret: change-me
YAML
helm install osf oci://ghcr.io/sesigl/open-software-factory/charts/osf --values values.yaml --wait --timeout 10m
helm test osf --logs          # plans the factory definition with factory-spec
kubectl port-forward service/osf-console 8080:8080
```

From a clone, install `deploy/helm/osf` instead of the OCI address. Object storage, Langfuse, OpenBao and agent-sandbox
are installed with their own charts; no module uses them yet, so the chart has no wiring for them.

### Helm values

| Value | Default | Meaning |
| --- | --- | --- |
| `secrets.existingSecret` | | A Secret with the keys `postgres-password`, `foreman-api-token`, `intake-api-token`, `gatekeeper-api-token`, `gatekeeper-slack-token`, `gatekeeper-slack-signing-secret` and, optional, `forge-token`, for example filled from OpenBao by its operator or the External Secrets Operator. Set, the chart makes no Secret. |
| `secrets.postgresPassword` | | Required without `existingSecret`. The password of the database user; it goes into URLs, so use letters, digits, `-` and `_`. |
| `secrets.foremanApiToken`, `secrets.intakeApiToken`, `secrets.gatekeeperApiToken` | | Required without `existingSecret`. The API tokens of foreman, intake and gatekeeper. |
| `secrets.gatekeeperSlackToken`, `secrets.gatekeeperSlackSigningSecret` | | Required without `existingSecret`. The bot token and signing secret of gatekeeper's Slack app. |
| `secrets.forgeToken` | | foreman's token for the checks of a pull request. |
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

The chart's scenarios run on kind. To run them on your machine, start kind and load the chart's images first:

```sh
.tools/bin/kind create cluster
deploy/helm/kind-images.sh    # pulls or builds the images of compose.yaml, then loads the chart's images
make test-scenario ID=SCN-DIST-007
```

## Releases

The workflow `publish-images` publishes after each change to `compose/compose.yaml`, `images/` or `helm/osf/` on
`main`. It builds every module image whose tag GHCR does not have yet for `linux/amd64` and `linux/arm64`, with an SBOM
and SLSA provenance attached by BuildKit, and signs it with cosign through the workflow's GitHub identity. A tag never
changes: a new adapter pin without a new module version takes the tag `<version>-r<n>`. The chart goes to
`oci://ghcr.io/sesigl/open-software-factory/charts/osf` at the version in `helm/osf/Chart.yaml`, signed the same way;
change the version with the chart.

Verify an image, and read its SBOM and provenance:

```sh
cosign verify ghcr.io/sesigl/open-software-factory/foreman:0.4.0 \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/sesigl/open-software-factory/'
docker buildx imagetools inspect ghcr.io/sesigl/open-software-factory/foreman:0.4.0 --format '{{ json .SBOM }}'
docker buildx imagetools inspect ghcr.io/sesigl/open-software-factory/foreman:0.4.0 --format '{{ json .Provenance }}'
```

One-time setup: GHCR makes each new package private. After the first run, the owner opens each package under the
repository's Packages and sets its visibility to public, like the first npm release of a module.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-DIST-001 | implemented | Every service of the Compose profile is healthy after one command |
| SCN-DIST-002 | implemented | The Compose profile names the value that .env is missing |
| SCN-DIST-003 | implemented | The console of the Compose profile lists the runs of its foreman |
| SCN-DIST-004 | implemented | The console of the Compose profile shows the agents of the reference factory |
| SCN-DIST-005 | implemented | The plan of the reference factory adds the factory and finds no problems |
| SCN-DIST-006 | implemented | After the reference factory is applied, its plan shows no changes |
| SCN-DIST-007 | implemented | Every workload of the Helm chart is ready after one command |
| SCN-DIST-008 | implemented | The Helm chart names the secret that the values are missing |
| SCN-DIST-009 | implemented | The console of the Helm chart lists the runs of its foreman |
| SCN-DIST-010 | implemented | The console of the Helm chart shows the agents of the reference factory |
| SCN-DIST-011 | implemented | The test of the Helm chart plans the reference factory without problems |
| SCN-DIST-012 | implemented | The verify stage of the reference factory waits for the check "verify" |
| SCN-DIST-013 | implemented | The Compose profile takes the module images from the factory's registry |
