---
covers: [contracts/typespec/**, contracts/src/**, contracts/scripts/**, contracts/events/asyncapi.yaml]
---

# contracts

The formats that modules share, from one TypeSpec source: JSON Schemas for every format, the AsyncAPI document of
the events, and the TypeScript package `@opensoftware/contracts`. Decisions:
[ADR 0006](../docs/decisions/0006-contracts-typespec.md), [ADR 0012](../docs/decisions/0012-contracts-toolchain.md).

## Quick start

This quick start is scenario `SCN-CTR-001` and is tested on every change.

```sh
npx @opensoftware/contracts validate factory-definition factory.yaml
# factory.yaml: valid factory-definition
```

From TypeScript:

```ts
import { type FactoryDefinition, validate } from "@opensoftware/contracts";

const problems = validate("factory-definition", document); // [] when valid, else { path, message } per problem
```

`runSpans(record)` reads a run record as runlog writes it: each span with its decoded resource and attributes, or
`undefined` when the value is no OTLP/JSON trace export request ([ADR 0041](../docs/decisions/0041-run-record-reader.md)).

The schema files are exported at the paths in the table below, for example
`@opensoftware/contracts/work-item/work-item.schema.json`, along with `events/asyncapi.yaml`, `openapi/*` and `typespec/*`.

## Formats

Each format has one schema, generated from `typespec/`, and fixtures that CONTRACT checks on every change.

| Format | Schema | Model | Notes |
| --- | --- | --- | --- |
| factory definition | `factory-definition/factory-definition.schema.json` | `FactoryDefinition` | `factory.yaml`. Closed objects: an unknown field is an error. |
| work item | `work-item/work-item.schema.json` | `WorkItem` | The `data` of `work.received@v1`. |
| run record | `run-record/run-record.schema.json` | `RunRecord` | OTel resource and root-span attributes; pins in `typespec/run-record.tsp`. |
| evidence bundle | `evidence-bundle/evidence-bundle.schema.json` | `EvidenceManifest` | `evidence.json` at the bundle root. |
| score | `score/score.schema.json` | `Score` | Subset of Langfuse's create-score request; factory fields in `metadata`. |
| gate record | `gate-record/gate-record.schema.json` | `GateRecord` | gatekeeper's signed approval record (ADR 0047). |
| sandbox spec | `sandbox-spec/sandbox-spec.schema.json` | `SandboxSpec` | The input of a sandbox adapter's `create` (ADR 0054). Closed objects: an unknown field is an error. |
| events | `events/<event>/<event>.schema.json`, `events/asyncapi.yaml` | `WorkReceived`, `WorkRetryRequested`, `RunStarted` … `IssueLabeled` | CloudEvents 1.0, structured JSON. |

## HTTP APIs

`openapi/openapi.json` also holds the paths of the module APIs, from the operations in `typespec/` (ADR 0048). The
first is gatekeeper's: `POST /v1/gates` and `GET /v1/gates/{gateId}` with the models `GateRequest`, `GateView` and
`ApiProblem` (RFC 9457). The second is intake's (ADR 0063): `POST /v1/work-items` and
`GET /v1/work-items/{workItemId}` with the models `WorkSubmission`, `WorkItemView` and `WorkRequest`, and
`GET /v1/inbox` with `WorkItemList`. The third is the
foreman's (ADR 0067): `POST /v1/runs`, `GET /v1/runs/{runId}`, `POST /v1/runs/{runId}/signals` and
`POST /v1/runs/{runId}/retry` (ADR 0105) with the models `RunView` (its `adapters`, ADR 0110), `StageView` (its `waitingSince`, ADR 0106, and its `note`, ADR 0109), `CheckView` (ADR 0069), `RunSignal`
and `RunRetry`. All three answer `GET /v1/health` with the models
`Health` and `HealthCheck` (`HealthApi`, ADR 0086). `pnpm build` compiles the operations with the TypeSpec OpenAPI 3 emitter and copies their
paths next to the named models; an operation that uses a type that is no model fails the build. The package exports
the type `paths`, which types a client such as openapi-fetch.

Wire formats (everything but the factory definition) are open: readers ignore fields they do not know, so a minor
version may add optional fields. Read `factory.yaml` with a YAML 1.2 parser: YAML 1.1 parsers turn the key `on`
into `true`.

## Commands

| Command | What it does |
| --- | --- |
| `osf-contracts validate <format> <file>` | Check a YAML or JSON document. Prints `<file>: valid <format>`, or one `<file> <JSON Pointer>: <problem>` line per problem and exits 1. |
| `osf-contracts breaking [--base <ref>]` | Compare every schema with the last `contracts-v*` tag (or `<ref>`). A change that makes released documents invalid fails unless `contracts/package.json` has a new major version. |
| `osf-contracts roundtrip --client typescript [dir]` | Load every valid fixture under `dir` (default `contracts`) with the generated TypeScript types and compare what they write back. TypeScript is the only client (ADR 0012). |

## Changing a format

1. Change `typespec/`. Run `pnpm build` in `contracts/`; it regenerates the schemas, `openapi/openapi.json`,
   `src/generated/types.ts` and `dist/`. `pnpm lint` fails when a committed generated file is out of date.
2. Add or update fixtures in `<format>/fixtures/{valid,invalid}/`.
3. A breaking change (removed or newly required field, changed type, removed enum value, closed object, tighter
   bound or pattern) needs a new major version in `package.json`. Prefer a new optional field, or for events a new
   type `name@v2` next to the old one.

## Releases

release-please opens a release pull request from the Conventional Commits under `contracts/`. Merging it creates
the tag `contracts-v<version>`. The release pull request also sets the version in `openapi/openapi.json`, which
`pnpm build` copies from `package.json`, so the generated file stays current. The workflow `.github/workflows/publish-contracts.yml` then builds the package and
publishes it to npm as `@opensoftware/contracts`. npm accepts a provenance statement only from a public
repository, so the workflow adds one only when this repository is public. When the newest tag is missing on npm,
for example after a failed upload, the next run of the workflow on `main` publishes it. To publish a tag again, run
the workflow by hand with the tag. The CONTRACT check and `osf-contracts breaking` compare with the newest `contracts-v*` tag.

Only the TypeScript package exists (ADR 0012). A client for another language can be generated from
`openapi/openapi.json` with any OpenAPI generator when someone needs one.

A new package gets its publish workflow and its release-please entries with `osf release-files`; the check RELEASE
fails until they are current, and also when a workflow differs from `tools/scaffold/publish-workflow.yml`.

One-time setup (no credential is ever stored in the repository):

1. npm: the organization `opensoftware` owns the scope `@opensoftware`, under which every package of this
   repository is published.
2. GitHub: the publish job runs in the environment `npm` (Settings → Environments; GitHub creates it on the first
   run).
3. New package only: npm adds a trusted publisher only to a package that exists. Before the release pull request
   with its first version merges, a maintainer creates it: build and pack it as version `0.0.0`, then run
   `npm publish <file>.tgz --tag placeholder --access public` without `--otp`. npm stages that version, so the
   package exists and nothing is public (`skills/release-packages`).
4. Then add the trusted publisher, on npmjs.com (package settings → Trusted publishing) or with
   `npm trust github <package> --file publish-<name>.yml --repository sesigl/open-software-factory --environment npm
   --allow-publish --allow-stage-publish`. Every later version publishes through OIDC only, with a provenance
   statement; the repository holds no npm token.

An agent can do step 4 and the checks below with the npm CLI (11.19 or later). It needs a maintainer's
`npm login --registry https://registry.npmjs.org`. Every `npm trust` call needs two-factor authentication, also
`list`. Without a terminal, the call fails with `EOTP` and prints an `authUrl` and a `doneUrl`. The maintainer
opens the `authUrl` and approves. Then a `GET` of the `doneUrl`, with the login's token as a bearer token, returns
a `token`. The agent passes it as `--otp=<token>` to the next `npm trust` calls; it stays valid for some minutes.

To check all packages, run `npm trust list <package>` for each `publish-*.yml` that publishes to npm. Each package
has exactly one entry: this repository, its own workflow file, the environment `npm`, and the permissions
`createPackage` and `createStagedPackage`.

When a publish fails with `E404 Not Found - PUT https://registry.npmjs.org/@opensoftware%2f<name>`:

- npm did not accept the job as a trusted publisher. Check that the job has `id-token: write` and
  `environment: npm`, and compare the package's entry with the rule above.
- An entry can look correct and still fail. Then remove it with `npm trust revoke <package> --id=<id>`, add it
  again with step 4 and run the workflow again with the tag.
- After a successful publish, npm can take some minutes before the version is available. A build that installs
  the new version in this time fails with `ETARGET`; run it again.

## Configuration

None. The CLI reads no environment variables.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-CTR-001 | implemented | A valid factory definition validates |
| SCN-CTR-002 | implemented | A factory definition with an unknown agent field is rejected with its path |
| SCN-CTR-003 | implemented | A run record that names its transcript, artifacts and pull request validates |
| SCN-CTR-004 | implemented | A run record without a requester is rejected with its path |
| SCN-CTR-005 | implemented | A breaking change to a released schema fails the compatibility check |
| SCN-CTR-006 | implemented | The generated TypeScript types round-trip every valid fixture |
| SCN-CTR-007 | deprecated | The generated Python client round-trips every valid fixture |
| SCN-CTR-008 | deprecated | The generated Java client round-trips every valid fixture |
| SCN-CTR-009 | implemented | A tighter form of a "exactly one of" rule fails the compatibility check |
| SCN-CTR-010 | implemented | runSpans gives each span of a run record with its resource and decoded attributes |
| SCN-CTR-011 | implemented | runSpans gives no spans for a value that is not a trace export request |
| SCN-CTR-012 | implemented | A factory definition with an unknown effort is rejected with the allowed levels |
