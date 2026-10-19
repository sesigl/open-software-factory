---
covers: [package.json, Makefile, contracts/**, deploy/**]
---

# Technology stack

The deciding question throughout: what makes each tool easy to adopt alone and easy for outside contributors to
work on. Each choice has an ADR in [`../decisions/`](../decisions/).

## At a glance

| Layer | Pick | Main reason | Runner-up | ADR |
| --- | --- | --- | --- | --- |
| Languages | TypeScript for every module, port, adapter, the testkit and the checks; Python only for plugins into Python-only tools; no generated clients for other languages | one toolchain; no module edge needs Python | TypeScript + Python (ADR 0002, superseded) | 0009, 0012 |
| Source of truth | Git | review, versions, rollback | — | — |
| Operational database | PostgreSQL; SQLite in CLI mode | Temporal, Langfuse, pgvector run on it | — | 0003 |
| Analytics | DuckDB locally, PostgreSQL views in server mode, ClickHouse at scale | nearly the same SQL from laptop to large org | ClickHouse everywhere | 0003 |
| Object storage | S3 API; SeaweedFS self-hosted; local folder in CLI mode | MinIO community edition archived April 2026; SeaweedFS is Apache-2.0 | Garage (AGPL) | 0003 |
| Events | CloudEvents on NATS JetStream via a Postgres outbox | small binary; no lost events | webhooks only | 0003 |
| Workflow engine | Temporal | long human waits, signals, timers, history UI, polyglot workers | DBOS | 0004 |
| Repo and build | monorepo; pnpm workspaces + Turborepo; `make` on top; release-please | native tools, cached affected builds, independent releases, nothing to migrate | Nx | 0005, 0010 |
| Contracts | TypeSpec → JSON Schema and OpenAPI 3.1; hand-written AsyncAPI 3.1 for events | one source; generated TypeScript types, the only client | hand-written JSON Schema | 0006, 0012 |
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

**Decision after review (ADR 0009):** the scores above favored two languages, but no module edge needs Python:
runlog, scorekit, ledger, taskcapture and observer depend only on files, HTTP, SQL and CLIs that work from
TypeScript, and system tests drive modules from outside. Two languages would double the testkit, the checks, the
lint and type stacks and the release paths. So every module, port, adapter, the testkit and the checks are
TypeScript. Python appears only as plugins into Python-only tools (an optional Harbor agent plugin). The contracts
publish only the TypeScript package; clients for other languages are not built (ADR 0012).

## Quality tooling

| Concern | Pick |
| --- | --- |
| Format and lint | Biome; typescript-eslint only for type-aware rules |
| Types | `tsc --strict`; Zod or TypeBox at boundaries |
| Tests | Vitest |
| Integration | Testcontainers (Postgres, NATS, Temporal, SeaweedFS, Forgejo) |
| Import boundaries | dependency-cruiser |
| Coverage of the running module | `NODE_V8_COVERAGE` |
| Mutation (nightly) | Stryker |

## Runtime, packaging, supply chain

| Concern | Pick |
| --- | --- |
| Runtime | Node 24 LTS |
| HTTP servers | Fastify |
| Tool distribution | npm (`npx`), multi-arch container images; `@osf/contracts` on npm |
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
- scorekit or observer need real machine learning: add a separate Python service behind an HTTP contract, with
  its own ADR (see ADR 0009);
- the repository grows past a few hundred packages or needs finer dependency analysis than Turborepo gives:
  evaluate Nx (ADR 0010);
- ACP, the OTel GenAI conventions or the MCP Registry API change: they are pinned behind single adapters.
