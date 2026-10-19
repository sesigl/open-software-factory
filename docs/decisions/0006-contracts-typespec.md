---
status: accepted; Python and Java clients superseded by 0012
date: 2026-10-18
---

# 0006. Contracts in TypeSpec, events in AsyncAPI

## Decision
`contracts/` holds TypeSpec sources that emit OpenAPI 3.1 and JSON Schema, and AsyncAPI documents for events.
Types are generated with openapi-typescript for the modules. Client packages for users are generated with
openapi-generator (Python, Java). oasdiff and JSON Schema compatibility checks block breaking changes without a major version.

## Options considered
Hand-written JSON Schema and OpenAPI (verbose, drift apart); Protobuf with buf (best tooling, but all wire
formats here are JSON).
