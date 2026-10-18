---
covers: [package.json, pyproject.toml, Makefile, contracts/**, deploy/**]
---

# Technology stack

The deciding question throughout: what makes each tool easy to adopt alone and easy for outside contributors to
work on. Each choice has an ADR in [`../decisions/`](../decisions/).

## At a glance

| Layer | Pick | Main reason | Runner-up | ADR |
| --- | --- | --- | --- | --- |
| Languages | TypeScript for tools and adapters, Python for evaluation and benchmarks | the agent ecosystem and its contributors live there | Java with Temporal (internal-only factory) | 0002 |
| Source of truth | Git | review, versions, rollback | — | — |
| Operational database | PostgreSQL; SQLite in CLI mode | Temporal, Langfuse, pgvector run on it | — | 0003 |
| Analytics | DuckDB locally, PostgreSQL views in server mode, ClickHouse at scale | nearly the same SQL from laptop to large org | ClickHouse everywhere | 0003 |
| Object storage | S3 API; SeaweedFS self-hosted; local folder in CLI mode | MinIO community edition archived April 2026; SeaweedFS is Apache-2.0 | Garage (AGPL) | 0003 |
| Events | CloudEvents on NATS JetStream via a Postgres outbox | small binary; no lost events | webhooks only | 0003 |
| Workflow engine | Temporal | long human waits, signals, timers, history UI, polyglot workers | DBOS | 0004 |
| Repo and build | monorepo; pnpm + uv workspaces; `make` on top; Nx when CI > 10 min; release-please | native tools, affected builds, independent releases | moon | 0005 |
| Contracts | TypeSpec → OpenAPI 3.1 + JSON Schema; AsyncAPI for events | one source, generated TS, Python and Java types | hand-written JSON Schema | 0006 |
| Testing | system tests from the outside, no unit tests by default | see testing strategy | — | 0007 |
| License | Apache-2.0 | patent grant | MIT | 0008 |

## Language scoring

Judgments from 1 to 5, weighted for an open-source tool family.

| Criterion | Weight | TypeScript | Python | Java | Go |
| --- | --- | --- | --- | --- | --- |
| Libraries the tools need (MCP, ACP, Chat SDK, Harbor, LiteLLM, Langfuse) | 25 | 5 | 4 | 2 | 3 |
| Contributors in AI-tooling open source | 20 | 5 | 5 | 2 | 3 |
| Distributing CLIs and small tools | 15 | 5 | 4 | 2 | 5 |
| Maintainer speed (a Java engineer who knows TS and Python) | 15 | 4 | 4 | 5 | 1 |
| Robustness of long-running services | 15 | 4 | 3 | 5 | 4 |
| Kubernetes and infrastructure fit | 10 | 3 | 2 | 3 | 5 |
| **Weighted (max 100)** | | **90** | **77** | **60** | **67** |

Facts behind the scores: Microsoft's Java bot SDK is retired and the new Agents and Teams SDKs support only C#,
JavaScript and Python; Vercel Chat SDK is TypeScript only; Harbor, LiteLLM and most eval tooling are Python; MCP
has an official Java SDK; Temporal's Java SDK is its most proven.

**Which module in which language:** TypeScript: factory-spec, proof, spec-trace, gatekeeper, intake, foreman,
testkit (with a Python twin), all harness, sandbox and channel adapters. Python: runlog, scorekit, taskcapture,
observer, ledger CLI. Java appears only as generated clients from the contracts.

## Quality tooling

| Concern | TypeScript | Python |
| --- | --- | --- |
| Format and lint | Biome; typescript-eslint only for type-aware rules | Ruff |
| Types | `tsc --strict`; Zod or TypeBox at boundaries | pyright strict; Pydantic at boundaries |
| Tests | Vitest | pytest |
| Integration | Testcontainers (Postgres, NATS, Temporal, SeaweedFS, Forgejo) | Testcontainers |
| Import boundaries | dependency-cruiser | import-linter |
| Coverage of the running module | `NODE_V8_COVERAGE` | coverage.py subprocess mode |
| Mutation (nightly) | Stryker | mutmut |

## Runtime, packaging, supply chain

| Concern | Pick |
| --- | --- |
| Runtimes | Node 24 LTS; Python 3.12 and 3.13 |
| HTTP servers | Fastify; FastAPI |
| Tool distribution | npm (`npx`), PyPI (`uvx`), multi-arch container images |
| Factory install | Docker Compose and Helm |
| Supply chain | Sigstore signatures, SLSA provenance, SBOMs, Renovate |
| CI | GitHub Actions; each tool also ships as a GitHub Action |

## Install profiles

| Profile | For | Stateful services |
| --- | --- | --- |
| Laptop | trying one tool | none: files, SQLite, DuckDB, local folder |
| Single VM (Compose) | one team | PostgreSQL (with Temporal and pgvector), SeaweedFS, NATS, Phoenix as trace store; Docker sandboxes |
| Kubernetes (Helm) | platform teams | managed PostgreSQL, object storage, NATS, Temporal, Langfuse (ClickHouse, Valkey), OpenBao, agent-sandbox |

## Smaller choices

| Need | Pick | Why not the obvious one |
| --- | --- | --- |
| Cache and queues for Langfuse | Valkey | Redis changed its license twice |
| Secrets | OpenBao | Vault moved to the Business Source License |
| Trace store | Langfuse (full); Arize Phoenix (light) | Langfuse brings ClickHouse, Valkey and S3 |
| Agent memory | pgvector first | no extra service |

## Revisit when

- the maintainer works mostly outside Java and that slows delivery: the foreman may move to Java on Temporal; its
  contract is language-neutral;
- users complain about install size: make Phoenix the default trace store;
- Nx's community Python plugin breaks: switch the task graph to moon;
- ACP, the OTel GenAI conventions or the MCP Registry API change: they are pinned behind single adapters.
