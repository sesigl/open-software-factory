// The runs of the foreman as Temporal workflows (ADR 0067): start one per work item, read its view, list them by state
// (ADR 0071), signal them: steer, cancel, take over and hand back (ADR 0070), and run one again (ADR 0105).
import { UsageError } from "@opensoftware/cli";
import { validate, type WorkItem } from "@opensoftware/contracts";
import {
  type Client,
  defaultPayloadConverter,
  WorkflowExecutionAlreadyStartedError,
  WorkflowIdReusePolicy,
  WorkflowNotFoundError,
} from "@temporalio/client";
import type { Factory } from "../adapters/factory.ts";
import {
  actionOf,
  type Control,
  firstView,
  type GateDecision,
  hasEnded,
  isRunState,
  listed,
  type RunInput,
  type RunView,
  retried,
  retryOf,
  runIdOf,
  signalOf,
} from "../domain/run.ts";
import {
  actedSignal,
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
const NOT_AGAIN = "The run does not run again";

export interface Runs {
  /** Starts the run of the work item, or finds its newest run. */
  start(workItem: unknown): Promise<{ created: boolean; view: RunView }>;
  view(runId: string): Promise<RunView | undefined>;
  /**
   * A page of the runs of the task queue, running ones first, then the latest ended first; with a state, only the runs
   * in it, so a page may hold fewer. Another state, a limit outside 1 to 500 or a cursor Temporal does not know is a
   * usage error (ADR 0115).
   */
  list(page?: { state?: string; limit?: string; cursor?: string }): Promise<{ runs: RunView[]; next?: string }>;
  /** The run's view after the signal, or undefined for an unknown run; a run that ended is a conflict. */
  signal(runId: string, signal: unknown): Promise<RunView | undefined>;
  /** The run's steering messages and the stage a person takes over, for its running stage. */
  control(runId: string): Promise<Control>;
  /** The new run of a run that failed or was cancelled, or undefined for an unknown run; another run is a conflict. */
  retry(runId: string, retry: unknown): Promise<RunView | undefined>;
  /** Hands a gate's decision to the newest run of its work item. */
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

/** The page size of `limit`: 50 without one, else a whole number from 1 to 500 (ADR 0115). */
function pageSizeOf(limit: string | undefined): number {
  if (limit === undefined) return 50;
  const size = Number(limit);
  if (!Number.isInteger(size) || size < 1 || size > 500)
    throw new UsageError(`limit: "${limit}" is not a whole number from 1 to 500`);
  return size;
}

/**
 * The cursor of Temporal's page token: `{"page": "<token in base64>"}` in base64url, so a cursor the foreman did not
 * write is refused before Temporal, whose client retries what it cannot read (ADR 0115).
 */
const cursorOf = (token: Uint8Array): string =>
  Buffer.from(JSON.stringify({ page: Buffer.from(token).toString("base64") })).toString("base64url");

function tokenOf(cursor: string): Buffer {
  let page: unknown;
  try {
    page = JSON.parse(Buffer.from(cursor, "base64url").toString()).page;
  } catch {}
  if (typeof page !== "string" || !page)
    throw new UsageError(`cursor: "${cursor}" is not the next of a page of the runs`);
  return Buffer.from(page, "base64");
}

export function runs(options: {
  client: Client;
  taskQueue: string;
  factory: () => Promise<Factory>;
  now: () => string;
  /** Aborts the queries still open: once the worker stopped, no worker answers them. */
  stopping: AbortSignal;
}): Runs {
  const { client, taskQueue } = options;
  const handle = (runId: string) => client.workflow.getHandle(runId);
  const ask = <T>(query: () => Promise<T>): Promise<T> => client.connection.withAbortSignal(options.stopping, query);
  const view = (runId: string): Promise<RunView | undefined> =>
    ask(() => handle(runId).query(viewQuery)).catch((error: Error) =>
      error instanceof WorkflowNotFoundError ? undefined : Promise.reject(error),
    );
  const exists = (runId: string): Promise<boolean> =>
    handle(runId)
      .describe()
      .then(
        () => true,
        (error: Error) => (error instanceof WorkflowNotFoundError ? false : Promise.reject(error)),
      );
  /** The ID of the work item's newest run: run 1, 2, … until one is not found (ADR 0105). */
  const newest = async (workItemId: string): Promise<string> => {
    let n = 1;
    while (await exists(runIdOf(workItemId, n + 1))) n++;
    return runIdOf(workItemId, n);
  };
  /** Starts the run's workflow; false when a workflow with its ID started before. */
  const launch = (input: RunInput): Promise<boolean> =>
    client.workflow
      .start(factoryRun, {
        workflowId: input.view.runId,
        taskQueue,
        // Each run ID starts one workflow, also after it ended.
        workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
        args: [input],
        // The run list reads the view from the memo, which the workflow keeps current (ADR 0115).
        memo: { view: input.view },
      })
      .then(
        () => true,
        (error: Error) => (error instanceof WorkflowExecutionAlreadyStartedError ? false : Promise.reject(error)),
      );
  return {
    async start(document) {
      const workItem = checked<WorkItem>("work-item", document, "the body is not a work item");
      const { definition, version } = await options.factory();
      const first = firstView(workItem, definition, version, options.now());
      if (await launch({ view: first, definition })) return { created: true, view: first };
      return { created: false, view: (await view(await newest(workItem.id))) as RunView };
    },
    async retry(runId, document) {
      const retry = retryOf(document);
      if (typeof retry === "string") throw new UsageError(`the body is not a retry: ${retry}`);
      const before = await view(runId);
      if (!before) return undefined;
      const later = runIdOf(before.workItem.id, (before.attempt ?? 1) + 1);
      const again = new Conflict(`${runId} already ran again as ${later}`, NOT_AGAIN);
      const { definition, version } = await options.factory();
      const next = retried(before, retry, definition, version, options.now());
      if ("status" in next)
        throw next.status === 400 ? new UsageError(next.message) : new Conflict(next.message, NOT_AGAIN);
      // A run that ran again, or two retries at once, name the run `later`, which Temporal starts once.
      if (!(await launch({ ...next, definition }))) throw again;
      return next.view;
    },
    view,
    async list({ state, limit, cursor } = {}) {
      if (state !== undefined && !isRunState(state))
        throw new UsageError(`state: no run is "${state}"; ask for running, blocked, complete, failed or cancelled`);
      const pageSize = pageSizeOf(limit);
      const query = `WorkflowType = '${factoryRun.name}' AND TaskQueue = '${taskQueue}'`;
      // Temporal's visibility lists running runs first, then the runs that ended, the latest first. Each run keeps its
      // view in its memo (ADR 0115), so a page is one call. A run that started before has no memo and answers the query.
      const page = await client.workflowService.listWorkflowExecutions({
        namespace: client.options.namespace,
        query,
        pageSize,
        nextPageToken: cursor === undefined ? undefined : tokenOf(cursor),
      });
      const views = await Promise.all(
        page.executions.map((run) => {
          const memo = run.memo?.fields?.view;
          // Stryker disable next-line ConditionalExpression: only a run that started before ADR 0115 has no memo, and no scenario can start one
          if (memo) return defaultPayloadConverter.fromPayload<RunView>(memo);
          return view(run.execution?.workflowId as string) as Promise<RunView>;
        }),
      );
      const token = page.nextPageToken?.length ? cursorOf(page.nextPageToken) : undefined;
      return { runs: listed(views, state), ...(token ? { next: token } : {}) };
    },
    async signal(runId, document) {
      const signal = signalOf(document);
      if (typeof signal === "string") throw new UsageError(`the body is not a signal: ${signal}`);
      const current = await view(runId);
      if (!current) return undefined;
      if (hasEnded(current)) throw new Conflict(`${runId} is ${current.state}`);
      const acted = () =>
        signal.by
          ? handle(runId).signal(actedSignal, actionOf({ ...signal, by: signal.by }, options.now()))
          : undefined;
      if (signal.type === "steer") {
        await acted();
        await handle(runId).signal(steerSignal, signal.message);
      } else if (signal.type === "take-over") {
        const index = current.stages.findIndex((stage) => stage.state === "running");
        if (index < 0) throw new Conflict(`no stage of ${runId} is running`, NOT_NOW);
        await acted();
        await handle(runId).signal(takeOverSignal, index);
      } else if (signal.type === "hand-back") {
        if (!current.stages.some((stage) => stage.state === "blocked" && stage.takenOverAt))
          throw new Conflict(`nobody took over ${runId}`, NOT_NOW);
        await acted();
        await handle(runId).signal(handBackSignal);
      } else {
        await acted();
        await handle(runId).cancel();
      }
      return current;
    },
    async control(runId) {
      return ask(() => handle(runId).query(controlQuery));
    },
    async decided(workItemId, decision) {
      const runId = await newest(workItemId);
      // A run that ended, also because its gate expired at the foreman's limit, takes no decision (ADR 0106).
      const current = await view(runId);
      if (current && hasEnded(current))
        throw new Conflict(`${runId} is ${current.state}: the decision of the gate ${decision.gateId} came too late`);
      await handle(runId).signal(gateSignal, decision);
    },
  };
}
