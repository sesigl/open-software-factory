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
import type { Control, Fact, GateDecision, RunInput, RunView, StageResult } from "../domain/run.ts";
import type { Activities } from "./activities.ts";

export const viewQuery = defineQuery<RunView>("view");
export const controlQuery = defineQuery<Control>("control");
export const steerSignal = defineSignal<[string]>("steer");
export const gateSignal = defineSignal<[GateDecision]>("gate");
/** A person takes over the stage at this index (ADR 0070). */
export const takeOverSignal = defineSignal<[number]>("take-over");
export const handBackSignal = defineSignal("hand-back");

const local = proxyLocalActivities<Activities>({ startToCloseTimeout: "1 minute" });
const remote = proxyActivities<Activities>({
  startToCloseTimeout: "1 day",
  heartbeatTimeout: "1 minute",
  retry: { maximumAttempts: 3 },
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
});

export async function factoryRun({ view, definition, before }: RunInput): Promise<RunView> {
  let run = view;
  const steering: string[] = [];
  const decisions: GateDecision[] = [];
  let takeOver: number | undefined;
  let handedBack = false;
  setHandler(viewQuery, () => run);
  setHandler(controlQuery, () => ({ steering, ...(takeOver === undefined ? {} : { takeOver }) }));
  setHandler(steerSignal, (message) => void steering.push(message));
  setHandler(gateSignal, (decision) => void decisions.push(decision));
  setHandler(takeOverSignal, (index) => {
    takeOver = index;
  });
  setHandler(handBackSignal, () => {
    handedBack = true;
  });
  // When the stage at the index began to wait for its checks, in Temporal's workflow time, which replays the same.
  let checksSince = { index: -1, at: 0 };
  // The result of the last stage that wrote one, for the next stage's prompt (ADR 0111). A fact recorded before ADR
  // 0111 has none, so a replay of an older run schedules the same activities.
  let previous: StageResult | undefined;
  const settle = async (fact: Fact) => {
    run = await CancellationScope.nonCancellable(() => local.apply(run, fact));
  };
  try {
    await remote.publishStarted(run);
    // A new run of a run before it goes on in that run's folder (ADR 0105).
    if (run.retryOf) await remote.moveFolder(run.retryOf, run.runId);
    for (let step = await local.next(run, definition); step.kind !== "end"; step = await local.next(run, definition)) {
      const { index } = step;
      if (step.kind === "read-checks") {
        if (checksSince.index !== index) checksSince = { index, at: Date.now() };
        // The wait sleeps at most until its limit, then reads the checks one last time (ADR 0106). A step recorded
        // before ADR 0106 has no limit, so a replay of an older run waits as it did then.
        const limitMs = step.limitMs ?? Number.POSITIVE_INFINITY;
        const left = limitMs - (Date.now() - checksSince.at);
        if (step.delayMs) await sleep(Math.max(1, Math.min(step.delayMs, left)));
        const last = Date.now() - checksSince.at >= limitMs ? limitMs : undefined;
        run = await local.apply(run, await remote.readChecks(run, definition, index, last));
      } else if (step.kind === "request-gate") {
        run = await local.apply(run, await remote.requestGate(run, definition, index));
      } else if (step.kind === "await-gate") {
        const { gateId } = step;
        const decided = await condition(() => decisions.some((decision) => decision.gateId === gateId), step.limitMs);
        // Without a decision in the foreman's limit the gate expires (ADR 0106).
        const decision = decisions.find((candidate) => candidate.gateId === gateId);
        run = await local.apply(
          run,
          decided && decision
            ? { kind: "gate", index, ...decision }
            : { kind: "gate", index, gateId, state: "expired", afterMs: step.limitMs },
        );
      } else if (step.kind === "await-hand-back") {
        await condition(() => handedBack);
        [handedBack, takeOver] = [false, undefined];
        run = await local.apply(run, { kind: "handed-back", index });
      } else {
        run = await local.apply(run, { kind: "stage-started", index });
        const ended = await remote.runStage(run, definition, index, steering.length, before, previous);
        if (ended.kind === "stage-ended" && ended.result) previous = ended.result;
        await settle(ended);
      }
    }
  } catch (error) {
    await settle(isCancellation(error) ? { kind: "cancelled" } : { kind: "error", message: String(error) });
  }
  await CancellationScope.nonCancellable(() => remote.publishCompleted(run));
  return run;
}
