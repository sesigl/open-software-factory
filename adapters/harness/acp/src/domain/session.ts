// The session record: one JSON line per event of a session, in the order the adapter saw them (ADR 0050).
import type { PromptResponse, SessionUpdate, ToolKind } from "@agentclientprotocol/sdk";

/** What the adapter did with a tool call the agent asked to approve. */
export type Decision = "allowed" | "refused" | "refused by the allowlist" | "cancelled";

export type SessionLine =
  | {
      type: "session";
      sessionId: string;
      cwd: string;
      agent: { name?: string; version?: string };
      resource: Record<string, string>;
    }
  | { type: "prompt"; text: string }
  | { type: "update"; update: SessionUpdate }
  | { type: "permission"; title: string; kind: ToolKind; decision: Decision }
  | { type: "stop"; stopReason: PromptResponse["stopReason"] };
