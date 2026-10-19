import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

// Attribute names follow the OpenTelemetry semantic conventions v1.44.0 (resource) and the GenAI semantic
// conventions at open-telemetry/semantic-conventions-genai@547934a (schema gen-ai-dev/1.42.0-dev, status
// Development). Factory attributes use the `osf.` namespace so they never collide with future OTel names.

/**
 * The attributes of one run: the OTel resource of every span of the run, and the attributes of its root
 * `invoke_agent` span. The run record travels as OTLP; this schema fixes the attribute names and types.
 * Realizes SCN-FACTORY-DATA-001 (record shape) and SCN-FACTORY-RUNTIME-008 (attribution).
 */
model RunRecord {
  resource: RunResource;
  span: RunSpan;
}

/** Set at launch through OTEL_RESOURCE_ATTRIBUTES, so it is on every span of the run. */
model RunResource {
  `service.name`: string;
  `osf.run.id`: Identifier;
  `osf.work_item.id`: Identifier;

  /** Commit of the factory definition the run used. */
  `osf.factory.version`: CommitHash;

  `osf.stage`?: Name;
  `osf.requester.kind`: ActorKind;
  `osf.requester.id`: string;

  /** Where the run was started from, for example "slack", "github", "cli". */
  `osf.source`: Name;

  `osf.origin.url`?: url;

  /** Harness adapter, for example "claude-code". */
  `osf.harness.name`: Name;

  `osf.harness.version`?: string;
}

/** Attributes of the root span of the run. GenAI names where a convention exists. */
model RunSpan {
  `gen_ai.operation.name`: "invoke_agent";
  `gen_ai.provider.name`?: string;
  `gen_ai.agent.name`?: string;

  /** The harness session ID. */
  `gen_ai.conversation.id`?: string;

  `gen_ai.request.model`?: string;
  `gen_ai.response.model`?: string;

  @minValue(0)
  `gen_ai.usage.input_tokens`?: safeint;

  @minValue(0)
  `gen_ai.usage.output_tokens`?: safeint;

  @minValue(0)
  `gen_ai.usage.cache_read.input_tokens`?: safeint;

  @minValue(0)
  `gen_ai.usage.cache_write.input_tokens`?: safeint;

  `osf.outcome`: RunOutcome;

  /** Cost of all model calls of the run, from the inference gateway. */
  @minValue(0)
  `osf.cost.usd`?: float64;

  /** Full transcript, stored when the run ends. */
  `osf.transcript.uri`?: url;

  /** Artifacts of the run: reports, screenshots, videos. */
  `osf.artifact.uris`?: url[];

  `osf.pull_request.urls`?: url[];
  `osf.issue.urls`?: url[];
  `osf.evidence_bundle.uri`?: url;

  /** Agent Trace record with line attribution of the run's changes. */
  `osf.agent_trace.uri`?: url;
}
