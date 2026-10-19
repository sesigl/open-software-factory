import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/**
 * The result of one scorer on one run. The fields are a subset of Langfuse's create-score request
 * (POST /api/public/scores), so a score can be sent to Langfuse as is. Factory fields live in `metadata`.
 */
model Score {
  id: Identifier;

  /** Scorer name, for example "redundant-tests". */
  @minLength(1)
  name: string;

  /** A number for NUMERIC, 0 or 1 for BOOLEAN, a string for CATEGORICAL. */
  value: float64 | string;

  dataType: ScoreDataType;

  /** Trace of the run (the OTel trace ID). */
  traceId: TraceId;

  /** Span the score is about, when it is not the whole run. */
  observationId?: string;

  sessionId?: string;

  /** The reason. */
  comment?: string;

  timestamp: utcDateTime;

  /** API for scorers, ANNOTATION for scores a person reviews. */
  source?: ScoreSource;

  configId?: string;
  environment?: string;
  metadata: ScoreMetadata;
}

enum ScoreDataType {
  NUMERIC,
  BOOLEAN,
  CATEGORICAL,
}

enum ScoreSource {
  API,
  ANNOTATION,
}

model ScoreMetadata {
  `osf.run.id`: Identifier;
  `osf.scorer.version`?: string;

  /** Judge model of an LLM scorer. */
  `osf.judge.model`?: string;

  /** Cost of the judge call. */
  @minValue(0)
  `osf.judge.cost.usd`?: float64;

  ...Record<unknown>;
}
