// The activities of a run (ADR 0067). `next` and `apply` are local activities around the domain, so a run's logic runs
// in the worker's thread; the others reach outside: the harness, gatekeeper and NATS.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Context } from "@temporalio/activity";
import type { Gatekeeper } from "../adapters/gatekeeper.ts";
import { startTurn } from "../adapters/harness.ts";
import { type Bus, SUBJECTS } from "../adapters/nats.ts";
import type { Definition } from "../domain/definition.ts";
import {
  apply,
  type Fact,
  gateSummaryOf,
  nextStep,
  promptOf,
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
  /** The foreman's data folder: each run works in `runs/<run ID>`. */
  data: string;
  /** How often a running stage looks for steering messages and reports that it lives. */
  pollMs: number;
  /** The steering messages the workflow of the run received so far. */
  steering(runId: string): Promise<string[]>;
  env: Record<string, string | undefined>;
}

export type Activities = ReturnType<typeof activities>;

export function activities(deps: ActivityDeps) {
  return {
    async next(view: RunView, definition: Definition): Promise<Step> {
      return nextStep(view, definition);
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
    async runStage(view: RunView, definition: Definition, index: number): Promise<Fact> {
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
      const turn = await startTurn({
        command: deps.harnesses[plan.harness] ?? `npx -y @opensoftware/harness-${plan.harness} run`,
        cwd,
        env: {
          ...deps.env,
          OSF_DATA: join(deps.data, "harness", plan.harness),
          OTEL_RESOURCE_ATTRIBUTES: Object.entries(attributes)
            .map(([key, value]) => `${key}=${value}`)
            .join(","),
        },
        prompt: promptOf(plan.prompt, view.workItem),
      });
      const context = Context.current();
      context.cancellationSignal.addEventListener("abort", () => turn.cancel());
      let sent = (await deps.steering(view.runId)).length;
      const watch = setInterval(() => {
        context.heartbeat();
        deps.steering(view.runId).then(
          (messages) => {
            for (const message of messages.slice(sent)) turn.steer(message);
            sent = Math.max(sent, messages.length);
          },
          () => undefined,
        );
      }, deps.pollMs);
      try {
        return { kind: "stage-ended", index, stopReason: await turn.done, sessionId: turn.sessionId };
      } finally {
        clearInterval(watch);
        await turn.close();
      }
    },
  };
}
