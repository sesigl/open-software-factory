-- The tables ledger ingest fills in PostgreSQL, the same as sql/duckdb/tables.sql (ADR 0035). They are private: read
-- the views in views.sql. Times are UTC.

CREATE TABLE IF NOT EXISTS spend (
  request_id VARCHAR PRIMARY KEY,
  started_at TIMESTAMP NOT NULL,
  usd DOUBLE PRECISION NOT NULL,
  model VARCHAR,
  run_id VARCHAR
);

CREATE TABLE IF NOT EXISTS runs (
  run_id VARCHAR PRIMARY KEY,
  trace_id VARCHAR NOT NULL,
  span_id VARCHAR NOT NULL,
  work_item_id VARCHAR,
  source VARCHAR,
  requester_id VARCHAR,
  agent VARCHAR,
  model VARCHAR,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NOT NULL,
  cost_usd DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS run_links (
  run_id VARCHAR NOT NULL,
  pr_url VARCHAR NOT NULL,
  PRIMARY KEY (run_id, pr_url)
);

CREATE TABLE IF NOT EXISTS spans (
  trace_id VARCHAR NOT NULL,
  span_id VARCHAR NOT NULL,
  parent_span_id VARCHAR,
  PRIMARY KEY (trace_id, span_id)
);

CREATE TABLE IF NOT EXISTS work_items (
  id VARCHAR PRIMARY KEY,
  received_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS pull_requests (
  url VARCHAR PRIMARY KEY,
  title VARCHAR NOT NULL,
  author_id VARCHAR NOT NULL,
  opened_at TIMESTAMP NOT NULL,
  work_item_id VARCHAR,
  run_id VARCHAR
);

CREATE TABLE IF NOT EXISTS closes (
  url VARCHAR PRIMARY KEY,
  closed_at TIMESTAMP NOT NULL,
  merged BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  source VARCHAR NOT NULL,
  id VARCHAR NOT NULL,
  url VARCHAR NOT NULL,
  reviewer_id VARCHAR NOT NULL,
  automated BOOLEAN NOT NULL,
  state VARCHAR NOT NULL,
  reviewed_at TIMESTAMP NOT NULL,
  PRIMARY KEY (source, id)
);
