---
status: accepted
date: 2026-10-21
---

# 0041. contracts reads run records: runSpans

## Context

runlog writes each run as an OTLP/JSON trace export request with the `run-record` attributes (ADR 0023). ledger
and scorekit both read these files. Each had its own copy of the OTLP/JSON value types and the code that turns an
attribute list (`stringValue`, `intValue`, `doubleValue`, `arrayValue`) into plain values. DUP listed the copy in
its baseline (ADR 0037). The run record is a shared format, so its reader belongs next to its schema, in
`contracts/`, not in a library.

## Decision

- `@opensoftware/contracts` exports `runSpans(record)`: the spans of a run record in the order they appear, each
  with `traceId`, `spanId`, `parentSpanId`, `name`, `start` and `end` in nanoseconds as `bigint`, the decoded
  attributes of its resource and its own decoded attributes. It returns `undefined` for a value that is no
  trace export request. The types `RunSpan`, `SpanAttributes` and `AttributeValue` come with it.
- Values decode as runlog writes them: a string, an integer (`intValue`, as a number), a double or an array of
  them. Other value kinds give `undefined`, as before in both modules.
- ledger and scorekit read runs with `runSpans`. Their own rules stay in them: ledger turns `invoke_agent` spans
  into run rows, scorekit joins the spans of a trace into a run.
- This is a minor change of `contracts`: a new export, no schema change. Scenarios `SCN-CTR-010` and `SCN-CTR-011`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `runSpans` in contracts | One reader next to the schema of the format | contracts grows a function beyond validation |
| A library `packages/otlp` | contracts stays schemas only | A second place that knows the run record |
| Decode with the OpenTelemetry JS packages | Maintained by OpenTelemetry | They encode SDK spans into OTLP; none decodes OTLP/JSON back |

## Prior art

- `@opentelemetry/otlp-transformer` (0.300.0, Apache-2.0, released October 2026): turns SDK spans into OTLP; it
  has no decoder for OTLP/JSON. runlog already uses it to write runs.
- `@opentelemetry/sdk-trace-base` and `@opentelemetry/api`: model live spans, not exported files.
- The OpenTelemetry Collector reads OTLP/JSON, but it is a Go service, not a library for a TypeScript module.
- We build the reader: about 60 lines, the code ledger and scorekit already had.

## Consequences

- A new module that reads runs starts from `runSpans` and the `RunRecord` schema.
- When runlog writes a new value kind, `runSpans` changes once, with a scenario.
- Revisit when the run record moves to another wire format, for example OTLP protobuf.
