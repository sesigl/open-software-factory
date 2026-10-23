// The transcript export as a run record (contracts/run-record): the resource of the session and the root span's
// attributes, with the outcome of the session's last turn and the usage the agent reported.
import type { StopReason } from "@agentclientprotocol/sdk";
import type { RunRecord } from "@opensoftware/contracts";
import type { SessionLine } from "./session.ts";

type Span = RunRecord["span"];

/** How a run ends after a turn with this stop reason; a session without a turn failed. */
export function outcomeOf(stopReason: StopReason | undefined): Span["osf.outcome"] {
  if (stopReason === "end_turn") return "succeeded";
  if (stopReason === "cancelled") return "cancelled";
  return "failed";
}

/** The tokens of every turn summed, and the session's last cost in USD; only what the agent reported. */
export function usageOf(lines: SessionLine[]): Partial<Span> {
  const usage: Partial<Span> = {};
  const add = (key: keyof Span, value: number | null | undefined): void => {
    if (typeof value === "number") (usage[key] as number) = ((usage[key] as number | undefined) ?? 0) + value;
  };
  for (const line of lines) {
    if (line.type === "stop" && line.usage) {
      add("gen_ai.usage.input_tokens", line.usage.inputTokens);
      add("gen_ai.usage.output_tokens", line.usage.outputTokens);
      add("gen_ai.usage.cache_read.input_tokens", line.usage.cachedReadTokens);
      add("gen_ai.usage.cache_write.input_tokens", line.usage.cachedWriteTokens);
    }
    if (
      line.type === "update" &&
      line.update.sessionUpdate === "usage_update" &&
      line.update.cost?.currency === "USD"
    ) {
      usage["osf.cost.usd"] = line.update.cost.amount;
    }
  }
  return usage;
}

/**
 * The stop reason of the session's last turn: the last stop after the last prompt. The agent may send updates after
 * it; a session whose last prompt has no stop yet is still in a turn and has none.
 */
function lastStopOf(lines: SessionLine[]): StopReason | undefined {
  const lastPrompt = lines.findLastIndex((line) => line.type === "prompt");
  const stop = lines.slice(lastPrompt).findLast((line) => line.type === "stop");
  return stop?.type === "stop" ? stop.stopReason : undefined;
}

/** The run record of a session of the harness `harness`. Its resource is complete when the launcher set it. */
export function runRecordOf(lines: SessionLine[], harness: string, transcriptUri: string): RunRecord {
  // The first line starts the session.
  const start = lines[0] as Extract<SessionLine, { type: "session" }>;
  return {
    resource: {
      "service.name": `harness-${harness}`,
      ...start.resource,
      "osf.harness.name": harness,
      "osf.harness.version": start.agent.version,
    } as RunRecord["resource"],
    span: {
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.conversation.id": start.sessionId,
      ...usageOf(lines),
      "osf.outcome": outcomeOf(lastStopOf(lines)),
      "osf.transcript.uri": transcriptUri,
    },
  };
}
