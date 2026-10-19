---
status: accepted
date: 2026-10-19
---

# 0012. Toolchain and dependencies of the contracts package

## Context

ADR 0006 puts the shared formats into TypeSpec, events into AsyncAPI, TypeScript types into `@osf/contracts` and
Python and Java clients into packages for users. TODO item T-01 builds them. Every module, the testkit and the
checks are TypeScript (ADR 0009), and nobody uses a Python or Java client yet. Three facts shape the toolchain:

- TypeSpec's OpenAPI emitter writes only models that an operation uses. No module has an HTTP API yet, so the
  formats come out through the TypeSpec JSON Schema emitter.
- TypeSpec has no maintained AsyncAPI emitter. The only one on npm (`@lars-artmann/typespec-asyncapi`) has one
  maintainer.
- The OpenTelemetry GenAI conventions moved out of the main semantic-conventions repository into
  `open-telemetry/semantic-conventions-genai`, which has no release yet (status Development).

## Decision

`contracts/` is the package `@osf/contracts`, version 1.0.0 at its first release, published to npm. It is the
only client: no Python, Java or other client is generated or published. This replaces the generated Python and
Java clients in ADR 0006, the generated-client exception for Python and Java in ADR 0009, and their release in ADR
0005. A client for another language needs a new ADR; it can be generated from `openapi/openapi.json`.

It depends on:

| Need | Dependency | Version | Kind |
| --- | --- | --- | --- |
| Source of every format | `@typespec/compiler`, `@typespec/json-schema` | 1.17.0 | dev |
| Validate `events/asyncapi.yaml` and its payload references | `@asyncapi/parser` | 3.6.6 | dev |
| TypeScript types from the schemas | `openapi-typescript` | 7.13.0 | dev |
| `osf-contracts validate`: JSON Schema 2020-12 with formats | `ajv`, `ajv-formats` | 8.20.0, 3.0.1 | runtime |
| Read `factory.yaml` | `yaml` | 2.9.1 | runtime |

The build (`pnpm build` in `contracts/`):

1. compiles `typespec/` with the JSON Schema emitter into one bundle;
2. writes one self-contained schema per format, `contracts/<format>/<format>.schema.json`, all references
   inlined, so the CONTRACT check and every reader see the whole format in one file (committed);
3. writes `contracts/openapi/openapi.json`: OpenAPI 3.1 whose `components.schemas` are the named models, the
   input of openapi-typescript and oasdiff. JSON, not YAML: YAML 1.1 readers turn the key `on` into `true`;
4. validates `events/asyncapi.yaml` (hand-written AsyncAPI 3.1 that references the event schemas);
5. compiles `dist/`. `pnpm lint` fails when a committed generated file is out of date.

Every format is a plain model or a closed set of models, never a union without a discriminator, so a client
generated later for another language can read it: a trial Java client could not tell undiscriminated `anyOf`
branches apart. "Exactly one of" rules use `oneOf` with
`required` and `not` inside one model.

Pins: OpenTelemetry semantic conventions v1.44.0 for resource attributes; GenAI conventions at
`open-telemetry/semantic-conventions-genai@547934a` (schema `gen-ai-dev/1.42.0-dev`). The pins are written in
`typespec/run-record.tsp`; a change of pin is a contract change.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| TypeSpec JSON Schema emitter, OpenAPI assembled from it | works without operations; one source | own build step of about 100 lines |
| TypeSpec OpenAPI emitter with dummy operations | standard path | fake API in a public contract |
| Hand-written AsyncAPI referencing generated schemas | no new emitter; official parser validates it | message list kept by hand (six events) |
| `@lars-artmann/typespec-asyncapi` | AsyncAPI from TypeSpec | one maintainer, young |
| Python and Java clients with openapi-generator (ADR 0006) | reach for Python and Java users | no user yet; Java 17+, Maven and Python in every build; a trial found three generator bugs that each needed a schema workaround |
| `datamodel-code-generator` (Python) and `jsonschema2pojo` (Java) from JSON Schema | mature for JSON Schema | no user yet; two generators |
| `json-schema-to-typescript` instead of openapi-typescript | reads JSON Schema directly | ADR 0006 names openapi-typescript |

## Prior art

- **TypeSpec** (MIT, Microsoft, monthly releases): compiler and JSON Schema emitter at 1.17.0, stable.
- **AsyncAPI parser** (Apache-2.0, AsyncAPI Initiative, active): the reference validator for AsyncAPI 3.x.
- **openapi-typescript** (MIT, active): types only, no runtime.
- **ajv** (MIT, active) already used by the CONTRACT check (ADR 0011); **ajv-formats** (MIT) adds `uri` and
  `date-time`.
- **openapi-generator** (Apache-2.0, active): checked for Python and Java models, not adopted. Its OpenAPI 3.1
  support is marked beta. The trial worked after the schema changes above, but no user needs the clients yet.
- **JSON Schema compatibility checkers:** checked Atlassian `json-schema-diff` (Apache-2.0, last release 2025,
  draft-07 only) and the CONTRACT check's own diff (ADR 0011). None handles 2020-12 with `unevaluatedProperties`;
  keep one own diff on the inlined schemas, in `osf-contracts breaking`, which the CONTRACT check also uses.

## Consequences

The build needs only Node. Adding a client for another language later is cheap: generate it from
`openapi/openapi.json` and prove it with a round-trip scenario. GenAI attribute names can still change upstream; when
they do, the pin moves in a new major version of `@osf/contracts`. Revisit the AsyncAPI choice when TypeSpec
ships an official emitter, and the OpenAPI assembly when the first module API exists.
