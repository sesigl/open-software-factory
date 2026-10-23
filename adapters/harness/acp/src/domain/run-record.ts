// The transcript export as a run record (contracts/run-record): the resource of the session and the root span's
// attributes, with the outcome of the session's last turn.
import type { StopReason } from "@agentclientprotocol/sdk";
import type { RunRecord } from "@opensoftware/contracts";
import type { SessionLine } from "./session.ts";

/** How a run ends after a turn with this stop reason; a session without a turn failed. */
export function outcomeOf(stopReason: StopReason | undefined): RunRecord["span"]["osf.outcome"] {
  if (stopReason === "end_turn") return "succeeded";
  if (stopReason === "cancelled") return "cancelled";
  return "failed";
}

/** The run record of a session. Its resource is complete when the launcher set the required attributes. */
export function runRecordOf(lines: SessionLine[], transcriptUri: string): RunRecord {
  const start = lines.find((line) => line.type === "session");
  const stops = lines.flatMap((line) => (line.type === "stop" ? [line.stopReason] : []));
  return {
    resource: {
      "service.name": "harness-acp",
      ...start?.resource,
      "osf.harness.name": "acp",
      "osf.harness.version": start?.agent.version,
    } as RunRecord["resource"],
    span: {
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.conversation.id": start?.sessionId,
      "osf.outcome": outcomeOf(stops.at(-1)),
      "osf.transcript.uri": transcriptUri,
    },
  };
}
