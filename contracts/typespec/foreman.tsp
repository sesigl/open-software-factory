import "@typespec/json-schema";
import "./common.tsp";
import "./work-item.tsp";
import "./factory-definition.tsp";

using TypeSpec.JsonSchema;

namespace Osf.Contracts;

/** foreman: where a run stands (vision scenario ORCH-008). */
enum RunState {
  running,
  blocked,
  complete,
  failed,
  cancelled,
}

/** foreman: where a stage of a run stands. */
enum StageState {
  pending,
  blocked,
  running,
  succeeded,
  failed,
  rejected,
  cancelled,
}

/** foreman: the state of a check on the forge (forge port). */
enum CheckState {
  pending,
  success,
  failure,
  error,
}

/** foreman: a check that a stage waits for, as the foreman last read it on the run's pull request (ADR 0069). */
model CheckView {
  name: CheckName;
  state: CheckState;
}

/** foreman: one stage of a run (ADR 0067). */
model StageView {
  stage: Name;

  /** The agent that runs the stage; none for a stage that only waits (ADR 0107). */
  agent?: Name;

  state: StageState;

  /** The harness session of the stage's agent, once it started. */
  sessionId?: string;

  /** The gate that decides whether the stage starts, once it was requested. */
  @pattern("^g[0-9a-f]{16}$")
  gateId?: string;

  /** The checks the stage waits for, once the foreman read them (ADR 0069). */
  checks?: CheckView[];

  /** Since when the stage waits for its checks, its gate or a person, while it is blocked (ADR 0106). */
  waitingSince?: utcDateTime;

  /** When a person took the stage over from its agent (ADR 0070). */
  takenOverAt?: utcDateTime;

  /** Why the stage ended without success, when the foreman knows. */
  @minLength(1)
  reason?: string;

  startedAt?: utcDateTime;
  endedAt?: utcDateTime;
}

/** foreman: a run of the factory's workflow for one work item, as the HTTP API shows it (ADR 0067). */
model RunView {
  /** "run_" and 20 hex digits of the SHA-256 of the work item's ID; for the n-th run of the work item, n ≥ 2, of "<work item ID>#<n>" (ADR 0105). */
  @pattern("^run_[0-9a-f]{20}$")
  runId: string;

  /** Which run of the work item this is: 1 when absent (ADR 0105). */
  @minValue(1)
  attempt?: safeint;

  /** The run before this one, which a person ran again (ADR 0105). */
  @pattern("^run_[0-9a-f]{20}$")
  retryOf?: string;

  /** The person who ran the run before again (ADR 0105). */
  retriedBy?: Actor;

  workItem: WorkItem;

  /** The name of the factory. */
  factory: Name;

  /** The commit of the factory definition the run started with. */
  factoryVersion: CommitHash;

  state: RunState;

  /** The last pull request link that an agent of the run wrote (ADR 0069). */
  pullRequest?: url;

  /** The run's folder on the foreman's machine, where a person who took over a stage goes on (ADR 0070). */
  @minLength(1)
  folder?: string;

  startedAt: utcDateTime;
  endedAt?: utcDateTime;

  /** The OpenTelemetry trace of the run: the first 32 hex digits of the SHA-256 of `runId` (ADR 0087). */
  traceId?: TraceId;

  /** The stages of the workflow, in order. */
  stages: StageView[];
}

/** foreman: the runs of the server, running runs first, then the runs that ended, the one that ended last first, as `GET /v1/runs` answers them (ADR 0071). */
model RunList {
  runs: RunView[];
}

/** foreman: what a person tells a run. */
enum RunSignalType {
  steer,
  cancel,
  `take-over`,
  `hand-back`,
}

/**
 * foreman: a signal to a run: "steer" with a message for the running stage's agent, "cancel", "take-over" of the running
 * stage by a person, or "hand-back" of that stage (ADR 0070).
 */
model RunSignal {
  type: RunSignalType;

  /** The steering message. Required with "steer". */
  @minLength(1)
  message?: string;
}

/**
 * foreman: run a run that failed or was cancelled again, as a new run (ADR 0105). The new run starts at the first stage
 * that did not succeed, or at `from`, a stage at or before it.
 */
model RunRetry {
  /** The person who asks. */
  by: Actor;

  from?: Name;
}
