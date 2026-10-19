---
status: accepted
date: 2026-10-18
---

# 0003. Storage: PostgreSQL, S3 API, NATS, files first

## Context
Every module must work alone from files; server installs should need few stateful services.

## Decision
- CLI mode: files, SQLite, DuckDB, a local folder.
- Server mode: PostgreSQL for operational state (also Temporal, pgvector, the event outbox); PostgreSQL views
  for ledger, ClickHouse views when an install already runs it for Langfuse.
- Objects: S3 API only; SeaweedFS in the self-hosted distribution.
- Events: CloudEvents written to a Postgres outbox in the same transaction, relayed to NATS JetStream; webhooks
  for installs without NATS.
- Valkey where a cache is required; OpenBao for secrets.

## Prior art
MinIO's community edition was archived in April 2026 (no new security fixes). SeaweedFS (Apache-2.0) and Garage
(AGPL-3.0) are the common replacements. Redis and Vault changed their licenses; Valkey and OpenBao are the
community forks.

## Consequences
One query layer (Kysely or Drizzle) to run on SQLite and PostgreSQL.
