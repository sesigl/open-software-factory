-- The databases of the Compose profile in one PostgreSQL (ADR 0003, ADR 0074). PostgreSQL runs this file once,
-- when its volume is empty. Every service connects as POSTGRES_USER.
CREATE DATABASE temporal;
CREATE DATABASE temporal_visibility;
CREATE DATABASE gatekeeper;
CREATE DATABASE intake;
CREATE DATABASE phoenix;
CREATE DATABASE litellm;
-- Agent memory starts with pgvector in the factory's own database (docs/architecture/stack.md).
CREATE EXTENSION IF NOT EXISTS vector;
