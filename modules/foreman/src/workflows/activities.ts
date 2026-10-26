// The activities of a run (ADR 0067). `next` and `apply` are local activities around the domain, so a run's logic runs
// in the worker's thread; the others reach outside: the sandbox, the harness, the forge, gatekeeper and NATS. Each
// stage's agent gets the factory's inference gateway with the run's key (ADR 0070).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Context } from "@temporalio/activity";
import { pullRequestChecks } from "../adapters/forge.ts";
import type { Gatekeeper } from "../adapters/gatekeeper.ts";
import { type HarnessTurn, startTurn } from "../adapters/harness.ts";
import type { Gateway } from "../adapters/inference.ts";
import { type Bus, SUBJECTS } from "../adapters/nats.ts";
import { createSandbox } from "../adapters/sandbox.ts";
import type { Definition } from "../domain/definition.ts";
import {
  apply,
  type Control,
  checksOf,
  type Fact,
  gateSummaryOf,
  lastPullRequestIn,
  nextStep,
  promptOf,
  pullRequestOf,
  type RunView,
  runCompleted,
  runStarted,
  type Step,
} from "../domain/run.ts";

export interface ActivityDeps {
  now(): string;
  bus?: Bus;
  gatekeeper: Gatekeeper;
  /** The adapter's command line per harness name; others run `npx -y @opensoftware/harness-<name> run`. */
  harnesses: Record<string, string>;
  /** The adapter's command line per sandbox adapter name; others run `npx -y @opensoftware/sandbox-<name>`. */
  sandboxes: Record<string, string>;
  /** The adapter's command line per forge adapter name; others run `npx -y @opensoftware/forge-<name>`. */
  forges: Record<string, string>;
  /** FORGE_URL and FORGE_TOKEN of the forge adapter. */
  forgeEnv: Record<string, string | undefined>;
  /** How long a stage waits before it reads pending checks again. */
  checkPollMs: number;
  /** The foreman's data folder: each run works in `runs/<run ID>`. */
  data: string;
  /** How often a running stage looks for steering messages and reports that it lives. */
  pollMs: number;
  /** The steering messages the workflow of the run received so far, and the stage a person takes over. */
  control(runId: string): Promise<Control>;
  /** The factory's inference gateway, when it names an inference adapter. */
  gateway?: Gateway;
  env: Record<string, string | undefined>;
}

export type Activities = ReturnType<typeof activities>;

/** The command line of an adapter by its name, as program and arguments. */
const commandLine = (lines: Record<string, string>, name: string, otherwise: string): string[] =>
  (lines[name] ?? otherwise).split(" ");

export function activities(deps: ActivityDeps) {
  /** Each run's key of the gateway, made once per run while this worker lives; never in Temporal's history. */
  const keys = new Map<string, Promise<string>>();
  const keyOf = (gateway: Gateway, runId: string, budget?: number): Promise<string> => {
    const key = keys.get(runId) ?? gateway.key(runId, budget);
    keys.set(runId, key);
    return key;
  };

  /** The variables of the gateway that every harness adapter finds its own in (ADR 0070); none without a gateway. */
  async function gatewayEnv(view: RunView, definition: Definition, model: string): Promise<Record<string, string>> {
    const { gateway } = deps;
    if (!gateway) return {};
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
      return { stopReason: await turn.done, takenOver };
    } finally {
      clearInterval(watch);
      await turn.close();
    }
  }

  return {
    async next(view: RunView, definition: Definition): Promise<Step> {
      return nextStep(view, definition, deps.checkPollMs);
    },
    async apply(view: RunView, fact: Fact): Promise<RunView> {
      return apply(view, fact, deps.now());
    },
    async publishStarted(view: RunView): Promise<void> {
      await deps.bus?.publish(SUBJECTS.runStarted, runStarted(view));
    },
    async publishCompleted(view: RunView): Promise<void> {
      await deps.bus?.publish(SUBJECTS.runCompleted, runCompleted(view));
    },
    async requestGate(view: RunView, definition: Definition, index: number): Promise<Fact> {
      const plan = definition.stages[index];
      const origin = view.workItem.origin.url;
      const gate = await deps.gatekeeper.request({
        workItem: view.workItem.id,
        stage: plan?.stage ?? "",
        summary: gateSummaryOf(view, index),
        ...(origin ? { links: [{ url: origin, title: "Origin" }] } : {}),
        change: { factory: definition.factory, policy: plan?.gate?.policy, approvers: plan?.gate?.approvers ?? [] },
      });
      return { kind: "gate", index, gateId: gate.id, state: gate.state };
    },
    /** The stage's checks on the run's pull request, through the forge adapter that the factory names. */
    async readChecks(view: RunView, definition: Definition, index: number): Promise<Fact> {
      const names = definition.stages[index]?.checks ?? [];
      if (!view.pullRequest)
        return { kind: "checks", index, checks: [], reason: "no earlier stage linked a pull request" };
      const { repo, number } = pullRequestOf(view.pullRequest);
      const adapter = definition.forgeAdapter as string;
      const printed = await pullRequestChecks(
        commandLine(deps.forges, adapter, `npx -y @opensoftware/forge-${adapter}`),
        { ...deps.env, ...deps.forgeEnv },
        repo,
        number,
      );
      return { kind: "checks", index, checks: checksOf(names, printed) };
    },
    /** Runs the stage's agent, in a sandbox when it declares one; steering messages from the `steered`-th on are for it. */
    async runStage(view: RunView, definition: Definition, index: number, steered: number): Promise<Fact> {
      const plan = definition.stages[index];
      if (!plan) throw new Error(`no stage ${index}`);
      const cwd = join(deps.data, "runs", view.runId);
      mkdirSync(cwd, { recursive: true });
      const attributes = {
        "osf.run.id": view.runId,
        "osf.work_item.id": view.workItem.id,
        "osf.stage": plan.stage,
        "osf.factory.version": view.factoryVersion,
      };
      const resource = Object.entries(attributes)
        .map(([key, value]) => `${key}=${value}`)
        .join(",");
      const harness = commandLine(deps.harnesses, plan.harness, `npx -y @opensoftware/harness-${plan.harness} run`);
      const adapter = definition.sandboxAdapter;
      const model = await gatewayEnv(view, definition, plan.model);
      const sandbox = plan.sandbox
        ? await createSandbox(
            commandLine(deps.sandboxes, adapter, `npx -y @opensoftware/sandbox-${adapter}`),
            { ...plan.sandbox, env: { OTEL_RESOURCE_ATTRIBUTES: resource, ...model } },
            cwd,
            view.runId,
            deps.env,
          )
        : undefined;
      try {
        const prompt = promptOf(plan.prompt, view.workItem, view.pullRequest);
        const turn = await startTurn(
          sandbox
            ? { command: sandbox.exec(harness), cwd, folder: await sandbox.copyIn(), env: deps.env, prompt }
            : {
                command: harness,
                cwd,
                folder: cwd,
                env: {
                  ...deps.env,
                  OSF_DATA: join(deps.data, "harness", plan.harness),
                  OTEL_RESOURCE_ATTRIBUTES: resource,
                  ...model,
                },
                prompt,
              },
        );
        const { stopReason, takenOver } = await untilDone(turn, view.runId, index, steered);
        await sandbox?.copyOut();
        const pullRequest = lastPullRequestIn(turn.transcript());
        return {
          kind: "stage-ended",
          index,
          stopReason,
          sessionId: turn.sessionId,
          ...(pullRequest ? { pullRequest } : {}),
          ...(takenOver ? { takenOver: { folder: cwd } } : {}),
        };
      } finally {
        await sandbox?.destroy();
      }
    },
  };
}
