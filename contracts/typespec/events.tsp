import "@typespec/json-schema";
import "./common.tsp";
import "./work-item.tsp";
import "./score.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/**
 * A CloudEvents 1.0 event in structured JSON mode. The same JSON is the NATS message body and the webhook body.
 * `type` is the versioned event name; a breaking change gets a new name (`@v2`) next to the old one.
 */
model CloudEvent<Type extends string, Data> {
  specversion: "1.0";

  /** Unique per source. A consumer that sees the same source and id twice handles the event once. */
  id: Identifier;

  /** The producing module, for example "/osf/intake". */
  @minLength(1)
  source: string;

  type: Type;
  time: utcDateTime;

  /** The ID of the thing the event is about: work item, gate, run, score or pull request. */
  subject?: string;

  datacontenttype?: "application/json";
  dataschema?: url;

  /** W3C trace context (CloudEvents distributed tracing extension). */
  traceparent?: string;

  data: Data;
}

/** intake: a work item was accepted. */
model WorkReceived is CloudEvent<"work.received@v1", WorkItem>;

/** foreman: a run ended. */
model RunCompleted is CloudEvent<"run.completed@v1", RunCompletedData>;

/** gatekeeper: a decision is needed before a stage starts. */
model GateRequested is CloudEvent<"gate.requested@v1", GateRequestedData>;

/** gatekeeper: a gate was decided. */
model GateDecided is CloudEvent<"gate.decided@v1", GateDecidedData>;

/** scorekit: a scorer scored a run. */
model ScoreRecorded is CloudEvent<"score.recorded@v1", Score>;

/** forge adapters: the factory opened a pull request. */
model PrOpened is CloudEvent<"pr.opened@v1", PrOpenedData>;

/** forge adapters: a person, an agent or a bot reviewed or commented on a pull request. */
model PrReviewed is CloudEvent<"pr.reviewed@v1", PrReviewedData>;

/** forge adapters: a pull request was merged or closed without a merge. */
model PrClosed is CloudEvent<"pr.closed@v1", PrClosedData>;

/** forge adapters: a label was added to an issue. */
model IssueLabeled is CloudEvent<"issue.labeled@v1", IssueLabeledData>;

model RunCompletedData {
  runId: Identifier;
  workItemId: Identifier;
  stage?: Name;
  factoryVersion: CommitHash;
  outcome: RunOutcome;
  startedAt: utcDateTime;
  endedAt: utcDateTime;
  requester: Actor;
  source: Name;

  @minValue(0)
  costUsd?: float64;

  traceId?: TraceId;
  pullRequests?: url[];
  evidenceBundle?: url;
}

model GateRequestedData {
  gateId: Identifier;
  workItemId: Identifier;
  runId?: Identifier;

  /** The stage that waits. */
  stage: Name;

  /** Path to the policy in the factory definition. */
  @minLength(1)
  policy: string;

  /** Approver groups picked by the policy. */
  @minItems(1)
  approvers: Name[];

  /** What the approver is asked to decide, shown in the channel. */
  @minLength(1)
  summary: string;

  links?: Link[];
  expiresAt?: utcDateTime;
}

enum GateDecision {
  approved,
  rejected,
  expired,
}

model GateDecidedData {
  gateId: Identifier;
  workItemId: Identifier;
  decision: GateDecision;

  /** The person who decided. Absent only when the gate expired. */
  decidedBy?: Actor;

  decidedAt: utcDateTime;
  reason?: string;
}

model PrOpenedData {
  url: url;
  repository: url;

  @minValue(1)
  number: safeint;

  @minLength(1)
  title: string;

  headBranch: string;
  baseBranch: string;
  headCommit: CommitHash;
  author: Actor;
  workItemId?: Identifier;
  runId?: Identifier;
}

enum ReviewState {
  approved,
  changes_requested,
  commented,
}

model PrReviewedData {
  /** The pull request. */
  url: url;

  reviewer: Actor;

  /** True when an agent or a bot wrote the review, not a person. */
  automated?: boolean;

  state: ReviewState;
}

model PrClosedData {
  /** The pull request. */
  url: url;

  /** True when the pull request was merged, false when it was closed without a merge. */
  merged: boolean;

  mergeCommit?: CommitHash;
}

model IssueLabeledData {
  /** The issue. */
  url: url;

  repository: url;

  @minValue(1)
  number: safeint;

  @minLength(1)
  title: string;

  body?: string;

  /** The person who opened the issue. */
  author: Actor;

  /** Every label of the issue after the change. */
  labels: string[];

  /** The label that was added, when the forge names it. */
  label?: string;
}
