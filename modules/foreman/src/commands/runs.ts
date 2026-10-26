// The runs of the foreman as Temporal workflows (ADR 0067): start one per work item, read its view, signal it: steer,
// cancel, take over and hand back (ADR 0070).
import { UsageError } from "@opensoftware/cli";
import { validate, type WorkItem } from "@opensoftware/contracts";
import {
  type Client,
  WorkflowExecutionAlreadyStartedError,
  WorkflowIdReusePolicy,
  WorkflowNotFoundError,
} from "@temporalio/client";
import type { Factory } from "../adapters/factory.ts";
import {
  type Control,
  firstView,
  type GateDecision,
  hasEnded,
  type RunView,
  runIdOf,
  signalOf,
} from "../domain/run.ts";
import {
  controlQuery,
  factoryRun,
  gateSignal,
  handBackSignal,
  steerSignal,
  takeOverSignal,
  viewQuery,
} from "../workflows/run.ts";

export class Conflict extends Error {
  readonly title: string;
  constructor(message: string, title = "The run ended") {
    super(message);
    this.title = title;
  }
}

const NOT_NOW = "The signal does not fit the run's state";

export interface Runs {
  /** Starts the run of the work item, or finds the one it started before. */
  start(workItem: unknown): Promise<{ created: boolean; view: RunView }>;
  view(runId: string): Promise<RunView | undefined>;
  /** The run's view after the signal, or undefined for an unknown run; a run that ended is a conflict. */
  signal(runId: string, signal: unknown): Promise<RunView | undefined>;
  /** The run's steering messages and the stage a person takes over, for its running stage. */
  control(runId: string): Promise<Control>;
  /** Hands a gate's decision to the run of its work item. */
  decided(workItemId: string, decision: GateDecision): Promise<void>;
}

function checked<T>(format: string, document: unknown, what: string): T {
  const problems = validate(format, document);
  if (problems.length)
    throw new UsageError(
      `${what}: ${problems.map((problem) => `${problem.path || "/"}: ${problem.message}`).join("; ")}`,
    );
  return document as T;
}

export function runs(options: {
  client: Client;
  taskQueue: string;
  factory: () => Promise<Factory>;
  now: () => string;
}): Runs {
  const { client, taskQueue } = options;
  const handle = (runId: string) => client.workflow.getHandle(runId);
  const view = (runId: string): Promise<RunView | undefined> =>
    handle(runId)
      .query(viewQuery)
      .catch((error: Error) => (error instanceof WorkflowNotFoundError ? undefined : Promise.reject(error)));
  return {
    async start(document) {
      const workItem = checked<WorkItem>("work-item", document, "the body is not a work item");
      const { definition, version } = await options.factory();
      const first = firstView(workItem, definition, version, options.now());
      try {
        await client.workflow.start(factoryRun, {
          workflowId: first.runId,
          taskQueue,
          // One run per work item, also after it ended.
          workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
          args: [{ view: first, definition }],
        });
        return { created: true, view: first };
      } catch (error) {
        if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error;
        return { created: false, view: (await view(first.runId)) as RunView };
      }
    },
    view,
    async signal(runId, document) {
      const signal = signalOf(document);
      if (typeof signal === "string") throw new UsageError(`the body is not a signal: ${signal}`);
      const current = await view(runId);
      if (!current) return undefined;
      if (hasEnded(current)) throw new Conflict(`${runId} is ${current.state}`);
      if (signal.type === "steer") {
        await handle(runId).signal(steerSignal, signal.message);
      } else if (signal.type === "take-over") {
        const index = current.stages.findIndex((stage) => stage.state === "running");
        if (index < 0) throw new Conflict(`no stage of ${runId} is running`, NOT_NOW);
        await handle(runId).signal(takeOverSignal, index);
      } else if (signal.type === "hand-back") {
        if (!current.stages.some((stage) => stage.state === "blocked" && stage.takenOverAt))
          throw new Conflict(`nobody took over ${runId}`, NOT_NOW);
        await handle(runId).signal(handBackSignal);
      } else {
        await handle(runId).cancel();
      }
      return current;
    },
    async control(runId) {
      return handle(runId).query(controlQuery);
    },
    async decided(workItemId, decision) {
      await handle(runIdOf(workItemId)).signal(gateSignal, decision);
    },
  };
}
