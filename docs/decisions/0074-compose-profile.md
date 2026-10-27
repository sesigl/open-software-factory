---
status: accepted
date: 2026-10-27
---

# 0074. The Compose profile: a complete factory with one command

## Context

TODO item T-19 asks to install a complete factory with one command. Until now each module runs alone: an operator
has to start PostgreSQL, Temporal, NATS and the modules by hand and wire their URLs and tokens. The stack
(`docs/architecture/stack.md`) names Docker Compose for one team on one machine and Helm for platform teams. The
modules are released to npm; no container image exists yet. T-20 runs the end-to-end scenarios against the same
profile, so the profile must start the same way in CI as on an operator's machine.

## Decision

- `deploy/` is a unit of the repository like `tools/`: the private package `@opensoftware/deploy` with its
  scenarios in `deploy/features/` (prefix `SCN-DIST`) and its system tests in `deploy/system-tests/`. It is not a
  module and has no code in `src/`.
- `deploy/compose/compose.yaml` is the Compose profile. One `docker compose up --detach --wait` starts:
  - PostgreSQL 17 with pgvector (`pgvector/pgvector`), with one database per service, made by `postgres/init.sql`;
  - Temporal on that PostgreSQL: the one-shot `temporal-schema` sets up the schema with `temporal-sql-tool`,
    `temporal` runs `temporalio/server` with `temporal/config.yaml`, and the one-shot `temporal-namespace` creates the
    namespace `default`; `temporal-ui` shows the runs' history;
  - NATS with JetStream, SeaweedFS with its S3 API, Phoenix as the trace store on PostgreSQL, and LiteLLM on
    PostgreSQL as the LLM gateway;
  - gatekeeper, intake, foreman and console, each wired to the others with the tokens from `.env`.
- The module images are built by Compose from one `deploy/images/Dockerfile`: Node 24 and Git, with the module and
  its adapters installed from npm at the versions `compose.yaml` pins. `pull_policy: build` keeps Compose from
  pulling an image of the same name from a registry. The target `gatekeeper` adds OPA from its official image.
- `deploy/compose/factory/` is the reference factory: triage, spec behind a gate that a maintainer approves,
  implement, review, verify with evidence, ship. The one-shot `factory-repo` copies `FACTORY_DIR` (default
  `./factory`) into the volume `factory` and commits it there, because foreman takes a run's factory version from
  Git. `docker compose run --rm factory <command>` runs factory-spec on that folder.
- `.env` holds every secret. `compose.yaml` refuses to start without one and names it: `${NAME:?set NAME in .env}`.
  Every port listens on `OSF_HOST`, `127.0.0.1` by default.
- The testkit gets `sut.compose(file)`: `docker compose` on a Compose file of the unit, as a project of the scenario
  with its own `.env` in `$INPUT`, taken down with its volumes when the scenario ends. T-20 uses the same handle.
- Helm, published images with signatures, SBOMs and SLSA provenance are the next slice of T-19. They need images in a
  registry, which this slice does not publish yet.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Build the images from npm releases (chosen) | the profile installs what users get; no registry needed yet; one Dockerfile | a module change reaches the profile only after its release and a new pin |
| Build the images from the workspace | tests the current commit | a monorepo build in every image; the profile would not match what users install |
| Pull published images from GHCR | fastest start | needs the publish workflow, signing and a registry first: the next slice |
| `temporalio/auto-setup` | one container for Temporal | deprecated; the last tag is 1.29 |
| Temporal's dev server (`temporal server start-dev`) | one binary, used by the tests of foreman | SQLite, not for a team's factory; the stack asks for Temporal on PostgreSQL |
| Testcontainers' `DockerComposeEnvironment` for `sut.compose` | adopted library, already a dependency | hides the `docker compose` command line the scenarios name; its wait strategies duplicate `--wait` |

## Prior art

- [temporalio/docker-compose](https://github.com/temporalio/docker-compose) (MIT): Temporal's own Compose files. It
  used `temporalio/auto-setup`, which stopped at 1.29. We adopt its layout: schema setup with `temporal-sql-tool`
  from `temporalio/admin-tools`, then the server.
- [Langfuse's docker-compose.yml](https://github.com/langfuse/langfuse) (MIT, active): one Compose file with
  PostgreSQL, ClickHouse, Valkey and MinIO. It confirms the pattern of one file, `.env` for secrets and health checks
  with `--wait`. We keep Langfuse for the Helm profile, as the stack says.
- [Dify's docker setup](https://github.com/langgenius/dify) (Apache-2.0 with conditions, active): Compose with
  `.env.example` and `${VAR:-default}` interpolation; it inspired `.env.example`.
- [LiteLLM's docker-compose.yml](https://github.com/BerriAI/litellm) (MIT, active): the proxy with PostgreSQL and
  `LITELLM_MASTER_KEY`. We use its image and settings, as inference-litellm does (ADR 0056).
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) (Elastic License 2.0, active): the light trace store with
  `PHOENIX_SQL_DATABASE_URL` on PostgreSQL. Running it unchanged is allowed by its license.
- [Testcontainers for Node](https://github.com/testcontainers/testcontainers-node) (MIT, active): already the
  testkit's container library. Its Compose support was checked for `sut.compose` and not chosen (see above).

## Consequences

- An operator copies `.env.example` to `.env`, sets its values and runs one command. CI runs the same command in the
  `deploy` suite.
- A new module release changes nothing in the profile until its pin in `compose.yaml` moves. The pins move by hand
  in the change that needs them, until Renovate watches them.
- factory-spec 0.4.0 pins `@opensoftware/contracts` 1.6.0, which does not know a stage's `checks`. The reference
  factory's verify stage asks for evidence but names no checks until the profile pins a factory-spec release with a
  newer contracts. `SCN-FSPEC-057` proves that factory-spec accepts a stage's checks, so its next release carries one.
- Revisit when the images are published: Compose then pulls the signed images, and the Dockerfile builds them in the
  publish workflow instead.
