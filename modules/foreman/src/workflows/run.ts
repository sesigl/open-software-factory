// The Temporal workflow of a run (ADR 0004, ADR 0067). It runs in Temporal's sandbox, so it only asks the local
// activity `next` for each step, waits, and hands each fact to `apply`; the logic is in the domain.
// Stryker disable all: this file runs in Temporal's workflow sandbox, a V8 context of its own that Stryker's mutant
// switch and coverage never reach; every mutant here would count as not run (ADR 0067).
import {
  ActivityCancellationType,
  CancellationScope,
  condition,
  defineQuery,
  defineSignal,
  isCancellation,
  proxyActivities,
  proxyLocalActivities,
  setHandler,
  sleep,
} from "@temporalio/workflow";
import type { Fact, GateDecision, RunInput, RunView } from "../domain/run.ts";
import type { Activities } from "./activities.ts";

export const viewQuery = defineQuery<RunView>("view");
export const steeringQuery = defineQuery<string[]>("steering");
export const steerSignal = defineSignal<[string]>("steer");
export const gateSignal = defineSignal<[GateDecision]>("gate");

const local = proxyLocalActivities<Activities>({ startToCloseTimeout: "1 minute" });
const remote = proxyActivities<Activities>({
  startToCloseTimeout: "1 day",
  heartbeatTimeout: "1 minute",
  retry: { maximumAttempts: 3 },
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
});

export async function factoryRun({ view, definition }: RunInput): Promise<RunView> {
  let run = view;
  const steering: string[] = [];
  const decisions: GateDecision[] = [];
  setHandler(viewQuery, () => run);
  setHandler(steeringQuery, () => steering);
  setHandler(steerSignal, (message) => void steering.push(message));
  setHandler(gateSignal, (decision) => void decisions.push(decision));
  const settle = async (fact: Fact) => {
    run = await CancellationScope.nonCancellable(() => local.apply(run, fact));
  };
  try {
    await remote.publishStarted(run);
    for (let step = await local.next(run, definition); step.kind !== "end"; step = await local.next(run, definition)) {
      const { index } = step;
      if (step.kind === "read-checks") {
        if (step.delayMs) await sleep(step.delayMs);
        run = await local.apply(run, await remote.readChecks(run, definition, index));
      } else if (step.kind === "request-gate") {
        run = await local.apply(run, await remote.requestGate(run, definition, index));
      } else if (step.kind === "await-gate") {
        const { gateId } = step;
        await condition(() => decisions.some((decision) => decision.gateId === gateId));
        const decision = decisions.find((candidate) => candidate.gateId === gateId) as GateDecision;
        run = await local.apply(run, { kind: "gate", index, ...decision });
      } else {
        run = await local.apply(run, { kind: "stage-started", index });
        await settle(await remote.runStage(run, definition, index, steering.length));
      }
    }
  } catch (error) {
    await settle(isCancellation(error) ? { kind: "cancelled" } : { kind: "error", message: String(error) });
  }
  await CancellationScope.nonCancellable(() => remote.publishCompleted(run));
  return run;
}
