// The activities of a run (ADR 0067). `next` and `apply` are local activities around the domain, so a run's logic runs
// in the worker's thread; the others reach outside: the sandbox, the harness, the forge, gatekeeper and NATS. Each
// stage's agent gets the factory's inference gateway with the run's key (ADR 0070).
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Context } from "@temporalio/activity";
import { pullRequestChecks, pullRequestsOf } from "../adapters/forge.ts";
import type { Gatekeeper } from "../adapters/gatekeeper.ts";
import { type HarnessTurn, sessionRecord, startTurn } from "../adapters/harness.ts";
import { type Gateway, hasKey } from "../adapters/inference.ts";
import { type Bus, SUBJECTS } from "../adapters/nats.ts";
import type { Exporter } from "../adapters/otlp.ts";
import { cloneRepositories } from "../adapters/repositories.ts";
import { createSandbox } from "../adapters/sandbox.ts";
import { writeSkills } from "../adapters/skills.ts";
import { type CommandLines, commandOf } from "../domain/adapters.ts";
import type { Definition } from "../domain/definition.ts";
import {
  apply,
  branchOf,
  type Control,
  checksOf,
  type Fact,
  gateSummaryOf,
  lastPullRequestIn,
  missingOf,
  nextStep,
  promptOf,
  pullRequestOf,
  type Repository,
  type RunBefore,
  type RunView,
  repositoryOf,
  resultOf,
  runBlocked,
  runCompleted,
  runStarted,
  type StagePullRequest,
  type StageResult,
  type Step,
  stagePullRequest,
  type Waits,
} from "../domain/run.ts";
import { type Outcome, otlpOf, outcomeOf, type SpanFacts, traceparentOf, usageOf } from "../domain/trace.ts";

export interface ActivityDeps {
  now(): string;
  bus?: Bus;
  gatekeeper: Gatekeeper;
  /**
   * The adapter's command line per harness name; others run `npx -y @opensoftware/harness-<name>@<range> run` at the
   * factory's range (ADR 0110).
   */
  harnesses: CommandLines;
  /** The adapter's command line per sandbox adapter name; others run `npx -y @opensoftware/sandbox-<name>@<range>`. */
  sandboxes: CommandLines;
  /** The sandbox adapter of a factory that names none, FOREMAN_SANDBOX. */
  sandbox: string;
  /** The adapter's command line per forge adapter name; others run `npx -y @opensoftware/forge-<name>@<range>`. */
  forges: CommandLines;
  /** FORGE_URL and FORGE_TOKEN of the forge adapter. */
  forgeEnv: Record<string, string | undefined>;
  /** How long a stage waits before it reads pending checks again, for its checks, and for its gate (ADR 0106). */
  waits: Waits;
  /** The foreman's data folder: each run works in `runs/<run ID>`. */
  data: string;
  /** How often a running stage looks for steering messages and reports that it lives. */
  pollMs: number;
  /** The steering messages the workflow of the run received so far, and the stage a person takes over. */
  control(runId: string): Promise<Control>;
  /** The factory's inference gateway, when it names an inference adapter; it resolves once the gateway started. */
  gateway?: Promise<Gateway>;
  /** The gateway's folder, which knows the runs with a key (ADR 0108). */
  gatewayFolder?: string;
  /** The OTLP receiver of the run's spans (ADR 0087), and where a span that cannot be sent is a warning. */
  traces?: Exporter;
  warn(text: string): void;
  env: Record<string, string | undefined>;
}

export type Activities = ReturnType<typeof activities>;

/** The resource of every span of the run. */
const resourceOf = (view: RunView): Record<string, string> => ({
  "osf.run.id": view.runId,
  "osf.work_item.id": view.workItem.id,
  "osf.factory.version": view.factoryVersion,
});

export function activities(deps: ActivityDeps) {
  /** The forge adapter's command line and variables. */
  const forge = (definition: Definition): [string[], Record<string, string | undefined>] => [
    commandOf(deps.forges, "forge", definition.forgeAdapter as string, definition.ranges),
    { ...deps.env, ...deps.forgeEnv },
  ];

  /**
   * What the stage gives the run: with a forge adapter and a repository of the work item, the forge's pull request of
   * the run's branch or the one the agent stated (ADR 0109); else the last link the agent wrote (ADR 0069).
   */
  async function pullRequestAfter(
    view: RunView,
    definition: Definition,
    repository: Repository | undefined,
    transcript: string,
  ): Promise<StagePullRequest> {
    if (!definition.forgeAdapter || !repository) return { pullRequest: lastPullRequestIn(transcript) };
    const branch = branchOf(view.runId);
    const listed = await pullRequestsOf(...forge(definition), repository.repo, branch).catch(
      (failure: Error) => failure,
    );
    return stagePullRequest(repository, branch, listed, transcript, Boolean(view.pullRequest));
  }

  /** Sends the span; a receiver that refuses it is a warning, never a failed stage. */
  const trace = async (span: SpanFacts): Promise<void> => {
    if (!deps.traces) return;
    await deps.traces.send(otlpOf(span)).catch((failure: Error) => deps.warn(`the run's trace: ${failure.message}`));
  };

  /**
   * The tokens and the cost of the stage's session, from the harness's transcript, for the stage's span (ADR 0121);
   * none without a receiver, without a session, or in a sandbox, whose harness keeps its session record inside.
   */
  const usage = async (harness: string[], harnessEnv: Record<string, string | undefined>, sessionId?: string) => {
    if (!deps.traces || !sessionId) return {};
    const output = join(deps.data, "transcripts", sessionId);
    return sessionRecord(harness, sessionId, harnessEnv, output).then(usageOf, (failure: Error) => {
      deps.warn(`the stage's run record: ${failure.message}`);
      return {};
    });
  };
  /**
   * Each run's key of the gateway, asked once per run while this worker lives; never in Temporal's history. The port
   * gives the same key for the same run, also after a restart (ADR 0108).
   */
  const keys = new Map<string, Promise<string>>();
  const keyOf = (gateway: Gateway, runId: string, budget?: number): Promise<string> => {
    const key = keys.get(runId) ?? gateway.key(runId, budget);
    keys.set(runId, key);
    return key;
  };

  /** Revokes the run's key when it has one; a revoke that fails is a warning, never a failed run (ADR 0108). */
  async function revokeKey(runId: string): Promise<void> {
    if (!deps.gateway || !hasKey(deps.gatewayFolder as string, runId)) return;
    keys.delete(runId);
    await (await deps.gateway)
      .revoke(runId)
      .catch((failure: Error) => deps.warn(`the key of the run ${runId}: ${failure.message}`));
  }

  /** The variables of the gateway that every harness adapter finds its own in (ADR 0070); none without a gateway. */
  async function gatewayEnv(view: RunView, definition: Definition, model: string): Promise<Record<string, string>> {
    if (!deps.gateway) return {};
    const gateway = await deps.gateway;
    const key = await keyOf(gateway, view.runId, definition.inference?.budget);
    return {
      OPENAI_BASE_URL: gateway.url,
      OPENAI_API_KEY: key,
      OPENAI_MODEL: model,
      ANTHROPIC_BASE_URL: gateway.url.replace(/\/v1\/?$/, ""),
      ANTHROPIC_API_KEY: key,
      ANTHROPIC_MODEL: model,
    };
  }

  /**
   * The turn's stop reason, and whether a person took the stage over; meanwhile it sends the run's new steering
   * messages, ends the turn when a person takes the stage at `index` over, and reports that the stage lives.
   */
  async function untilDone(
    turn: HarnessTurn,
    runId: string,
    index: number,
    steered: number,
  ): Promise<{ stopReason: string; takenOver: boolean }> {
    const context = Context.current();
    context.cancellationSignal.addEventListener("abort", () => turn.cancel());
    let sent = steered;
    let takenOver = false;
    const watch = setInterval(() => {
      context.heartbeat();
      deps.control(runId).then(
        ({ steering, takeOver }) => {
          for (const message of steering.slice(sent)) turn.steer(message);
          sent = Math.max(sent, steering.length);
          if (takeOver === index && !takenOver) {
            takenOver = true;
            turn.cancel();
          }
        },
        () => undefined,
      );
    }, deps.pollMs);
    try {
      const stopReason = await turn.done;
      // A cancelled attempt throws its cancel. At a shutdown of the worker the attempt then fails, not the stage, so
      // Temporal runs it again soon (ADR 0101); a cancelled run ends as cancelled.
      context.cancellationSignal.throwIfAborted();
      return { stopReason, takenOver };
    } finally {
      clearInterval(watch);
      await turn.close();
    }
  }

  return {
    async next(view: RunView, definition: Definition): Promise<Step> {
      return nextStep(view, definition, deps.waits);
    },
    async apply(view: RunView, fact: Fact): Promise<RunView> {
      return apply(view, fact, deps.now());
    },
    async publishStarted(view: RunView): Promise<void> {
      await deps.bus?.publish(SUBJECTS.runStarted, runStarted(view));
    },
    async publishCompleted(view: RunView): Promise<void> {
      await deps.bus?.publish(SUBJECTS.runCompleted, runCompleted(view));
      await trace({
        runId: view.runId,
        name: `run ${view.factory}`,
        start: view.startedAt,
        end: view.endedAt ?? deps.now(),
        outcome: outcomeOf(view.state),
        resource: resourceOf(view),
        attributes: {
          "osf.factory": view.factory,
          "osf.pull_request": view.pullRequest,
          "osf.run.retry_of": view.retryOf,
        },
      });
      // Every end of a run comes here, completed, failed or cancelled; its key then stops working.
      await revokeKey(view.runId);
    },
    /** Moves the folder of the run before to the new run's; it may run again after a crash, so a moved folder stays. */
    async moveFolder(before: string, runId: string): Promise<void> {
      const [from, to] = [join(deps.data, "runs", before), join(deps.data, "runs", runId)];
      if (existsSync(from) && !existsSync(to)) renameSync(from, to);
    },
    async requestGate(view: RunView, definition: Definition, index: number): Promise<Fact> {
      const plan = definition.stages[index];
      const origin = view.workItem.origin.url;
      // The run's pull request lets gatekeeper ask the approvers on it (ADR 0080).
      const links = [
        ...(origin ? [{ url: origin, title: "Origin" }] : []),
        ...(view.pullRequest ? [{ url: view.pullRequest, title: "Pull request" }] : []),
      ];
      const gate = await deps.gatekeeper.request({
        workItem: view.workItem.id,
        stage: plan?.stage ?? "",
        summary: gateSummaryOf(view, index),
        ...(links.length ? { links } : {}),
        // The run makes each run's request a new one, which gatekeeper asks again (ADR 0105).
        change: {
          run: view.runId,
          factory: definition.factory,
          policy: plan?.gate?.policy,
          approvers: plan?.gate?.approvers ?? [],
        },
      });
      return { kind: "gate", index, gateId: gate.id, state: gate.state };
    },
    /**
     * The stage's checks on the run's pull request, through the forge adapter that the factory names; `afterMs` when
     * this is the last read, after the foreman's limit (ADR 0106).
     */
    async readChecks(view: RunView, definition: Definition, index: number, afterMs?: number): Promise<Fact> {
      const names = definition.stages[index]?.checks ?? [];
      if (!view.pullRequest)
        return { kind: "checks", index, checks: [], reason: "no earlier stage linked a pull request" };
      const { repo, number } = pullRequestOf(view.pullRequest);
      const printed = await pullRequestChecks(...forge(definition), repo, number);
      const fact: Fact = {
        kind: "checks",
        index,
        checks: checksOf(names, printed),
        afterMs,
        missing: missingOf(names, printed),
      };
      // The requester hears once that the stage waits for its checks (ADR 0127).
      const blocked = runBlocked(view, apply(view, fact, deps.now()), index, names);
      if (blocked) await deps.bus?.publish(SUBJECTS.runBlocked, blocked);
      return fact;
    },
    /**
     * Runs the stage's agent, in a sandbox when it declares one; steering messages from the `steered`-th on are for it.
     * The first stage of a new run is told how the run before ended.
     */
    async runStage(
      view: RunView,
      definition: Definition,
      index: number,
      steered: number,
      before?: RunBefore,
      previous?: StageResult,
    ): Promise<Fact> {
      const plan = definition.stages[index];
      if (!plan) throw new Error(`no stage ${index}`);
      // A stage that only waits ends here: its checks and its gate came before it (ADR 0107).
      if (plan.agent === undefined) return { kind: "stage-ended", index, stopReason: "end_turn" };
      const cwd = join(deps.data, "runs", view.runId);
      mkdirSync(cwd, { recursive: true });
      writeSkills(cwd, plan.skills ?? []);
      await cloneRepositories(cwd, plan.repositories ?? []);
      const attributes = {
        "osf.run.id": view.runId,
        "osf.work_item.id": view.workItem.id,
        "osf.stage": plan.stage,
        "osf.factory.version": view.factoryVersion,
      };
      const started = deps.now();
      const resource = Object.entries(attributes)
        .map(([key, value]) => `${key}=${value}`)
        .join(",");
      const harness = commandOf(deps.harnesses, "harness", plan.harness, definition.ranges);
      const adapter = definition.sandboxAdapter ?? deps.sandbox;
      // The agent's model and gateway (ADR 0070) and its effort level (ADR 0078), with or without a sandbox.
      const agentEnv = {
        ...(await gatewayEnv(view, definition, plan.model)),
        OSF_EFFORT: plan.effort,
        // The harness's spans join the run's trace below the stage's span (ADR 0087).
        TRACEPARENT: traceparentOf(view.runId, index),
      };
      const harnessEnv = {
        ...deps.env,
        OSF_DATA: join(deps.data, "harness", plan.harness),
        OTEL_RESOURCE_ATTRIBUTES: resource,
        ...agentEnv,
      };
      let outcome: Outcome = "failed";
      let sessionId: string | undefined;
      const sandbox = plan.sandbox
        ? await createSandbox(
            commandOf(deps.sandboxes, "sandbox", adapter, definition.ranges),
            { ...plan.sandbox, env: { OTEL_RESOURCE_ATTRIBUTES: resource, ...agentEnv } },
            cwd,
            view.runId,
            deps.env,
          )
        : undefined;
      // The work item's repository, whose pull request of the run's branch the forge gives the run (ADR 0109).
      const repository = definition.forgeAdapter ? repositoryOf(view.workItem.origin.url) : undefined;
      try {
        const prompt = promptOf(
          plan.prompt,
          view.workItem,
          view.pullRequest,
          before?.index === index ? before.line : undefined,
          repository ? branchOf(view.runId) : undefined,
          previous,
        );
        const mcpServers = plan.mcpServers ?? [];
        const turn = await startTurn(
          sandbox
            ? { command: sandbox.exec(harness), cwd, folder: await sandbox.copyIn(), env: deps.env, prompt, mcpServers }
            : { command: harness, cwd, folder: cwd, env: harnessEnv, prompt, mcpServers },
        );
        sessionId = turn.sessionId;
        const { stopReason, takenOver } = await untilDone(turn, view.runId, index, steered);
        outcome = outcomeOf(stopReason);
        await sandbox?.copyOut();
        const { pullRequest, note } = await pullRequestAfter(view, definition, repository, turn.transcript());
        const said = turn.messages();
        return {
          kind: "stage-ended",
          index,
          stopReason,
          sessionId: turn.sessionId,
          ...(pullRequest ? { pullRequest } : {}),
          ...(note ? { note } : {}),
          ...(takenOver ? { takenOver: { folder: cwd } } : {}),
          ...(said ? { result: { stage: plan.stage, text: resultOf(said) } } : {}),
        };
      } finally {
        await sandbox?.destroy();
        await trace({
          runId: view.runId,
          index,
          name: `stage ${plan.stage}`,
          start: started,
          end: deps.now(),
          outcome,
          resource: { ...resourceOf(view), "osf.stage": plan.stage },
          attributes: {
            "osf.stage": plan.stage,
            "osf.agent": plan.agent,
            "osf.harness.name": plan.harness,
            "gen_ai.request.model": plan.model,
            "osf.effort": plan.effort,
            "gen_ai.conversation.id": sessionId,
            // The session's run record joins the stage's span (ADR 0121).
            ...(await usage(harness, harnessEnv, sandbox ? undefined : sessionId)),
          },
        });
      }
    },
  };
}
