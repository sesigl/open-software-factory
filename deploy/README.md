---
covers: [deploy/compose/**, deploy/images/**]
---

# deploy

Install a complete factory with one command. The Compose profile in [`compose/`](compose/compose.yaml) runs the
factory on one machine for one team: PostgreSQL with Temporal and pgvector, SeaweedFS, NATS, Phoenix, LiteLLM,
gatekeeper, intake, foreman and console, with the [reference factory](compose/factory/factory.yaml). Decision:
[ADR 0074](../docs/decisions/0074-compose-profile.md).

## Quick start

You need Docker with Compose 2.24 or later.

```sh
cd deploy/compose
cp .env.example .env    # set every value: the tokens, the database password and the Slack app of gatekeeper
docker compose up --detach --wait
docker compose run --rm factory plan
```

Then open the console at http://127.0.0.1:8080. The first `up` builds the module images from npm, which takes a
minute or two.

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

Compose builds the images `osf/<module>:<version>` from [`images/Dockerfile`](images/Dockerfile): Node 24, Git and
the module with its adapters from npm, at the versions `compose.yaml` pins. A new release reaches the profile when its
pin moves.

## Your factory

The reference factory in `compose/factory/` has the stages triage, spec (behind a gate that a member of
`maintainers` approves in Slack), implement, review, verify (with evidence) and ship. To run your own, copy the
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

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-DIST-001 | planned | Every service of the Compose profile is healthy after one command |
| SCN-DIST-002 | planned | The Compose profile names the value that .env is missing |
| SCN-DIST-003 | planned | The console of the Compose profile lists the runs of its foreman |
| SCN-DIST-004 | planned | The console of the Compose profile shows the agents of the reference factory |
| SCN-DIST-005 | planned | The plan of the reference factory adds the factory and finds no problems |
| SCN-DIST-006 | planned | After the reference factory is applied, its plan shows no changes |
